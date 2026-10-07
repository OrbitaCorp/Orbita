import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DomainStatus, Prisma, SslStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VercelDomainsService } from './vercel-domains.service';
import { AuditService } from '../audit/audit.service';
import { esDominioDeOrbita } from './dominio-de-orbita';
import { LinkDomainDto } from './dto/link-domain.dto';
import { SearchConsoleService } from '../search-console/search-console.service';

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vercelDomains: VercelDomainsService,
    // Registro de auditoría de vincular/verificar/borrar dominios (hallazgo
    // `auditoria-acciones-sin-registro`). Opcional solo para los tests.
    private readonly audit?: AuditService,
    // Search Console: al activarse el dominio se verifica en Google y se le envía el sitemap.
    // Opcional solo para los tests.
    private readonly searchConsole?: SearchConsoleService,
  ) {}

  findAll(businessId: string) {
    return this.prisma.customDomain.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
  }

  private async findOwned(businessId: string, id: string) {
    const domain = await this.prisma.customDomain.findFirst({ where: { id, businessId } });
    if (!domain) throw new NotFoundException('Dominio no encontrado');
    return domain;
  }

  // ── LINKED: el negocio ya es dueño del dominio, solo lo apunta a Órbita ──

  async linkDomain(businessId: string, dto: LinkDomainDto, actorId?: string) {
    const normalized = dto.domain.trim().toLowerCase();
    if (esDominioDeOrbita(normalized)) {
      throw new BadRequestException('Los dominios de Órbita no se pueden vincular como dominio propio');
    }
    const existing = await this.prisma.customDomain.findUnique({ where: { domain: normalized } });
    if (existing) throw new BadRequestException('Ese dominio ya está vinculado a un negocio en Órbita');

    // Se agrega en Vercel PRIMERO: si falla (dominio inválido, ya usado en
    // otro proyecto, etc.) no queremos una fila en nuestra base sin
    // respaldo real del lado de la infraestructura.
    //
    // OJO: `addDomain`/`getDomainInfo` devuelven `verified` = verificación de
    // OWNERSHIP de Vercel (TXT, solo hace falta si el dominio ya está en
    // conflicto con otro proyecto/cuenta) — NO significa "el DNS ya apunta acá".
    // Confirmado con un dominio de prueba nunca configurado: `verified` daba
    // `true` de entrada igual. El único chequeo real de "el DNS apunta a
    // Vercel" es `isDnsConfigured` (misconfigured:false), el mismo que usa
    // `verifyDns()` — por eso acá SIEMPRE arranca en PENDING sin verificar,
    // nunca se confía en el `verified` de la respuesta de addDomain.
    const info = await this.vercelDomains.addDomain(normalized);
    await this.asegurarWww(normalized, info?.apexName);

    // Dos negocios vinculando el mismo dominio a la vez pasan los dos el
    // chequeo de arriba; el @unique de `domain` decide, y el segundo recibe un
    // 409 en vez de un 500 (auditoría interna 10/09, ítem `api.domains`).
    const creado = await this.prisma.customDomain
      .create({
        data: {
          businessId,
          domain: normalized,
          source: 'LINKED',
          status: 'PENDING',
          dnsVerified: false,
        },
      })
      .catch((err: unknown) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException('Ese dominio ya está vinculado a un negocio en Órbita');
        }
        throw err;
      });
    // Quién vinculó qué dominio (hallazgo `auditoria-acciones-sin-registro`).
    await this.audit?.registrar({
      businessId, memberId: actorId, entityType: 'domain', entityId: creado.id, action: 'CREATE',
      changes: [{ field: 'domain', before: null, after: normalized }, { field: 'source', before: null, after: 'LINKED' }],
    });
    return creado;
  }

  /**
   * Registros DNS pendientes de configurar del lado del negocio (no
   * persistidos — se piden a Vercel en el momento). Bug 2026-09-01: acá
   * antes se devolvía `info.verification` (ownership, casi siempre vacío)
   * en vez de los A/CNAME reales que arma `armarRecords()` — "Ver DNS" no
   * mostraba nada aunque el dominio siguiera sin apuntar (ver comentario en
   * VercelDomainsService#getDnsConfig).
   */
  async getDnsInstructions(businessId: string, id: string) {
    const domain = await this.findOwned(businessId, id);
    const [info, dnsConfig] = await Promise.all([
      this.vercelDomains.getDomainInfo(domain.domain),
      this.vercelDomains.getDnsConfig(domain.domain),
    ]);
    const esApex = domain.domain === info.apexName;
    // Los dominios vinculados antes de que existiera el www no lo tienen en
    // Vercel: se les agrega la primera vez que piden sus registros.
    // Mejor esfuerzo: si el www falla, el apex igual se puede configurar.
    let wwwCname: string | undefined;
    if (esApex) {
      await this.asegurarWww(domain.domain, info.apexName);
      wwwCname = (await this.vercelDomains.getDnsConfig(`www.${domain.domain}`).catch(() => null))?.recommendedCNAME[0]?.value;
    }
    return { domain: domain.domain, verified: info.verified, records: this.armarRecords(domain.domain, info.apexName, dnsConfig, wwwCname) };
  }

  /**
   * Un dominio raíz también recibe `www.` con redirección al raíz (ver
   * VercelDomainsService#addWwwRedirect). Mejor esfuerzo: que el www ya
   * exista (409) o que Vercel lo rechace no debe tumbar el vincular ni los
   * registros del apex; se deja en el log y el panel sigue con lo principal.
   */
  private async asegurarWww(domain: string, apexName: string | undefined) {
    if (!apexName || domain !== apexName) return;
    await this.vercelDomains.addWwwRedirect(domain).catch((err: unknown) => {
      this.logger.warn(`No se pudo agregar www.${domain} a Vercel: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  // Dominio raíz (ej. "tefaltacalleok.com") → A record(s) en "@" (un DNS
  // estándar no permite CNAME en la raíz) más un CNAME para "www", que
  // redirige al raíz. Subdominio (ej. "tienda.mi.com") → CNAME, con el nombre
  // siendo la parte antes del apex ("tienda"). Se toma siempre la
  // recomendación de mejor rank (`[0]`) — Vercel devuelve varias
  // alternativas pero mostrar una sola es más claro para alguien cargando
  // esto por primera vez en el panel de su registrador.
  private armarRecords(
    domain: string,
    apexName: string,
    config: { recommendedIPv4: { value: string[] }[]; recommendedCNAME: { value: string }[] },
    wwwCname?: string,
  ) {
    const limpiar = (v: string) => v.replace(/\.$/, ''); // Vercel devuelve el CNAME con punto final (sintaxis de zonefile) — confunde copiado a mano en otros paneles
    if (domain === apexName) {
      const ips = config.recommendedIPv4[0]?.value ?? ['76.76.21.21'];
      return [
        ...ips.map((ip) => ({ type: 'A', domain: '@', value: ip })),
        { type: 'CNAME', domain: 'www', value: limpiar(wwwCname ?? 'cname.vercel-dns.com.') },
      ];
    }
    const nombre = domain.slice(0, domain.length - apexName.length - 1); // "tienda.mi.com" - ".mi.com" = "tienda"
    const cname = config.recommendedCNAME[0]?.value ?? 'cname.vercel-dns.com.';
    return [{ type: 'CNAME', domain: nombre, value: limpiar(cname) }];
  }

  async verifyDns(businessId: string, id: string, actorId?: string) {
    const domain = await this.findOwned(businessId, id);
    const configured = await this.vercelDomains.isDnsConfigured(domain.domain);
    const info = configured ? await this.vercelDomains.getDomainInfo(domain.domain) : null;
    const verified = configured && !!info?.verified;

    // "Activo" = el visitante entra por HTTPS. Que el DNS apunte a Vercel no
    // alcanza: el certificado se emite recién después y hasta entonces el
    // navegador muestra ERR_CONNECTION_CLOSED. Un dominio que ya andaba (activo
    // y con SSL activo) no se degrada por un sondeo que falla una vez: el
    // timeout de un request no debe cortarle la tienda ni el CORS.
    const yaAndaba = domain.status === 'ACTIVE' && domain.sslStatus === 'ACTIVE';
    const conCertificado = verified && (yaAndaba || (await this.vercelDomains.tieneCertificado(domain.domain)));
    const sslStatus: SslStatus = conCertificado ? 'ACTIVE' : 'PROVISIONING';
    const status: DomainStatus = conCertificado ? 'ACTIVE' : 'VERIFYING';
    // businessId también en el where de la escritura: el aislamiento lo tiene
    // que garantizar la consulta misma, no el findOwned() de arriba.
    const actualizado = await this.prisma.customDomain.update({
      where: { id, businessId },
      data: { dnsVerified: verified, status, sslStatus },
    });
    // Solo cuando cambia algo: "verificar" se aprieta muchas veces mientras
    // el DNS propaga y no vale la pena una fila por cada intento sin novedad.
    const cambios = AuditService.diferencias(
      { status: domain.status, dnsVerified: domain.dnsVerified },
      { status, dnsVerified: verified },
      ['status', 'dnsVerified'],
    );
    if (cambios.length > 0) {
      await this.audit?.registrar({
        businessId, memberId: actorId, entityType: 'domain', entityId: id, action: 'UPDATE',
        changes: [{ field: 'domain', before: null, after: domain.domain }, ...cambios],
      });
    }
    // Dominio ya activo: se lo deja listo en Search Console (verificarlo y enviarle el sitemap).
    // Se espera acá y no "en segundo plano" porque Cloud Run no le da CPU a una promesa que quedó
    // suelta después de responder; con tope de tiempo, y nunca rompe la respuesta: es un extra.
    // El servicio no insiste si lo intentó hace menos de un minuto, así que apretar "verificar"
    // varias veces mientras propaga el DNS no le pega a Google en cada click.
    if (status === 'ACTIVE' && this.searchConsole) {
      await Promise.race([
        this.searchConsole.registrarDominio(actualizado.id),
        new Promise<void>((resolve) => setTimeout(resolve, 8_000)),
      ]).catch((err: unknown) => {
        this.logger.warn(`Search Console: no se pudo registrar ${domain.domain} — ${err instanceof Error ? err.message : String(err)}`);
      });
    }
    return actualizado;
  }

  // El certificado lo emite Vercel solo cuando el DNS ya apunta; su API no
  // expone un estado de SSL y `verified` es de ownership (ver linkDomain), así
  // que el estado se mide de verdad en verifyDns(). Antes se deducía de
  // `verified` (true desde el primer segundo, daba "activo" sin certificado) y
  // el panel ni siquiera llamaba a este endpoint.
  sslStatus(businessId: string, id: string) {
    return this.verifyDns(businessId, id);
  }

  async remove(businessId: string, id: string, actorId?: string) {
    const domain = await this.findOwned(businessId, id);
    // Best-effort en Vercel — igual que el borrado de imágenes en products.service.ts,
    // un error de red ahí no debería trabar que el negocio se saque el dominio de encima.
    await this.vercelDomains.removeDomain(domain.domain).catch(() => {});
    // El www que se agregó junto al dominio raíz (si no existe, Vercel dice 404 y se ignora).
    await this.vercelDomains.removeDomain(`www.${domain.domain}`).catch(() => {});
    await this.prisma.customDomain.delete({ where: { id, businessId } });
    // Un dominio borrado deja la tienda sin esa dirección: queda quién lo hizo
    // (hallazgo `auditoria-acciones-sin-registro`).
    await this.audit?.registrar({
      businessId, memberId: actorId, entityType: 'domain', entityId: id, action: 'DELETE',
      changes: [{ field: 'domain', before: domain.domain, after: null }, { field: 'source', before: domain.source, after: null }],
    });
    return { ok: true };
  }

  // ── PURCHASED: compra real vía la API de registrador de Vercel ──
  // Ya no es mock — ver DomainPurchaseService (domain-purchase.service.ts):
  // cobra por Mercado Pago con el token de plataforma y recién con el pago
  // confirmado compra de verdad contra Vercel, creando la fila de
  // CustomDomain acá abajo desde ese flujo (no desde este service).
}
