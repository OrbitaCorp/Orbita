import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DomainStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VercelDomainsService } from './vercel-domains.service';
import { LinkDomainDto } from './dto/link-domain.dto';

@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vercelDomains: VercelDomainsService,
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

  async linkDomain(businessId: string, dto: LinkDomainDto) {
    const normalized = dto.domain.trim().toLowerCase();
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
    await this.vercelDomains.addDomain(normalized);

    return this.prisma.customDomain.create({
      data: {
        businessId,
        domain: normalized,
        source: 'LINKED',
        status: 'PENDING',
        dnsVerified: false,
      },
    });
  }

  /** Registros DNS pendientes de configurar del lado del negocio (no persistidos — se piden a Vercel en el momento). */
  async getDnsInstructions(businessId: string, id: string) {
    const domain = await this.findOwned(businessId, id);
    const info = await this.vercelDomains.getDomainInfo(domain.domain);
    return { domain: domain.domain, verified: info.verified, records: info.verification };
  }

  async verifyDns(businessId: string, id: string) {
    const domain = await this.findOwned(businessId, id);
    const configured = await this.vercelDomains.isDnsConfigured(domain.domain);
    const info = configured ? await this.vercelDomains.getDomainInfo(domain.domain) : null;
    const verified = configured && !!info?.verified;

    const status: DomainStatus = verified ? 'ACTIVE' : 'VERIFYING';
    return this.prisma.customDomain.update({
      where: { id },
      data: { dnsVerified: verified, status },
    });
  }

  async sslStatus(businessId: string, id: string) {
    const domain = await this.findOwned(businessId, id);
    // El certificado lo emite Vercel automáticamente una vez que el DNS
    // verifica — no hay un endpoint de "estado de SSL" separado en su API,
    // se infiere de si el dominio ya verificó.
    const info = await this.vercelDomains.getDomainInfo(domain.domain);
    const sslStatus = info.verified ? 'ACTIVE' : 'PROVISIONING';
    return this.prisma.customDomain.update({ where: { id }, data: { sslStatus } });
  }

  async remove(businessId: string, id: string) {
    const domain = await this.findOwned(businessId, id);
    // Best-effort en Vercel — igual que el borrado de imágenes en products.service.ts,
    // un error de red ahí no debería trabar que el negocio se saque el dominio de encima.
    await this.vercelDomains.removeDomain(domain.domain).catch(() => {});
    await this.prisma.customDomain.delete({ where: { id } });
    return { ok: true };
  }

  // ── PURCHASED: compra real vía la API de registrador de Vercel ──
  // Ya no es mock — ver DomainPurchaseService (domain-purchase.service.ts):
  // cobra por Mercado Pago con el token de plataforma y recién con el pago
  // confirmado compra de verdad contra Vercel, creando la fila de
  // CustomDomain acá abajo desde ese flujo (no desde este service).
}
