import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Encapsula las llamadas a la API REST de Vercel para dominios propios
// (LINKED). El MCP de Vercel conectado a la sesión de desarrollo no expone
// estas operaciones como tools — esto es lo que corre en producción, server
// side, con un token propio (VERCEL_TOKEN). fetch nativo, mismo criterio que
// el resto del proyecto (sin @nestjs/axios) — ver import-tefaltacalleok.ts.
//
// Proyecto/team confirmados con el usuario como los de producción de
// orbita.site (ver plan de "Dominios propios en Configuración"):
//   VERCEL_PROJECT_ID=prj_av89lYukI5YJOENhuiH4n3kAwyvM
//   VERCEL_TEAM_ID=team_GDb8FqCjzYMRIVrvwuGIgG0S

export interface VercelDnsRecord {
  type: string; // "A" | "CNAME" | "TXT" ...
  domain: string;
  value: string;
  reason?: string;
}

export interface VercelDomainInfo {
  name: string;
  verified: boolean;
  verification: VercelDnsRecord[];
}

export interface VercelDomainContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

@Injectable()
export class VercelDomainsService {
  private readonly logger = new Logger(VercelDomainsService.name);

  constructor(private readonly config: ConfigService) {}

  private get token(): string {
    const t = this.config.get<string>('VERCEL_TOKEN');
    if (!t) throw new BadRequestException('VERCEL_TOKEN no configurado — no se puede gestionar el dominio todavía');
    return t;
  }
  private get projectId(): string {
    return this.config.get<string>('VERCEL_PROJECT_ID') ?? 'prj_av89lYukI5YJOENhuiH4n3kAwyvM';
  }
  private get teamId(): string {
    return this.config.get<string>('VERCEL_TEAM_ID') ?? 'team_GDb8FqCjzYMRIVrvwuGIgG0S';
  }

  private async call(path: string, init?: RequestInit): Promise<any> {
    const url = `https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamId=${this.teamId}`;
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message ?? `Vercel respondió ${res.status}`;
      this.logger.warn(`Vercel API error (${path}): ${msg}`);
      throw new BadRequestException(`No se pudo completar la operación con Vercel: ${msg}`);
    }
    return body;
  }

  /** Agrega el dominio al proyecto — devuelve los registros DNS a configurar (según Vercel, no hardcodeados). */
  async addDomain(domain: string): Promise<VercelDomainInfo> {
    await this.call(`/v10/projects/${this.projectId}/domains`, {
      method: 'POST',
      body: JSON.stringify({ name: domain }),
    });
    return this.getDomainInfo(domain);
  }

  /** Estado de verificación + registros DNS pendientes de ESTE dominio puntual. */
  async getDomainInfo(domain: string): Promise<VercelDomainInfo> {
    const data = await this.call(`/v9/projects/${this.projectId}/domains/${domain}`);
    return { name: data.name, verified: !!data.verified, verification: data.verification ?? [] };
  }

  /** true si el DNS ya propagó correctamente (sin misconfiguración). */
  async isDnsConfigured(domain: string): Promise<boolean> {
    const data = await this.call(`/v6/domains/${domain}/config`);
    return data.misconfigured === false;
  }

  async removeDomain(domain: string): Promise<void> {
    await this.call(`/v9/projects/${this.projectId}/domains/${domain}`, { method: 'DELETE' });
  }

  // ── Registrador: comprar un dominio nuevo (.com, .store, etc.) ──
  // Confirmado en vivo (read-only, sin comprar nada) contra la cuenta real
  // de OrbitaCorp que estos endpoints existen y devuelven precio/
  // disponibilidad reales — reemplaza la necesidad de un revendedor aparte
  // (OpenSRS/ResellerClub, nunca se dio de alta ninguna cuenta). Ver
  // domain-purchase.service.ts para el flujo completo (cobro por Mercado
  // Pago ANTES de llamar `buyDomain`).

  /** true si el dominio está disponible para comprar (no si ya está en uso en Vercel). */
  async checkAvailability(domain: string): Promise<boolean> {
    const data = await this.call(`/v1/registrar/domains/${domain}/availability`);
    return !!data.available;
  }

  /** Mismo chequeo, pero para varios dominios de una — un solo request en vez de N, para la búsqueda multi-TLD. */
  async checkAvailabilityBatch(domains: string[]): Promise<Map<string, boolean>> {
    const data = await this.call('/v1/registrar/domains/availability', {
      method: 'POST',
      body: JSON.stringify({ domains }),
    });
    const map = new Map<string, boolean>();
    for (const r of data.results ?? []) map.set(r.domain, !!r.available);
    return map;
  }

  /**
   * Precio BASE del TLD (no de un dominio puntual) — más barato de consultar
   * que `getPrice()` por cada candidato de la búsqueda multi-TLD (un
   * request por TLD, no por dominio). Vercel aclara que esto no refleja
   * "premium pricing" de un dominio específico — por eso `startCheckout()`
   * sigue pidiendo el precio EXACTO del dominio elegido antes de cobrar,
   * esto es solo para mostrar una lista de resultados con precios
   * aproximados, igual que hacen las plataformas de venta de dominios.
   */
  async getTldPrice(tld: string, years = 1): Promise<number | null> {
    try {
      const data = await this.call(`/v1/registrar/tlds/${tld}/price?years=${years}`);
      return typeof data.purchasePrice === 'number' ? data.purchasePrice : null;
    } catch {
      return null; // TLD no soportado, o algún otro error — se filtra de los resultados, no rompe la búsqueda entera
    }
  }

  /**
   * Precio real de Vercel para este dominio, en USD — confirmado en vivo
   * (read-only) que la respuesta real es `{ years, purchasePrice,
   * renewalPrice, transferPrice }`; se usa `purchasePrice` (lo que cuesta
   * comprarlo ahora — para muchos TLD es un precio promocional del primer
   * año, bastante más bajo que `renewalPrice`, ej. .store: $1.99 comprar vs
   * $44 renovar — otro motivo más para que la renovación automática haya
   * quedado explícitamente fuera de esta pasada, ver el plan).
   */
  async getPrice(domain: string, years = 1): Promise<number> {
    const data = await this.call(`/v1/registrar/domains/${domain}/price?years=${years}`);
    const price = data.purchasePrice;
    if (typeof price !== 'number') throw new BadRequestException('Vercel no devolvió un precio válido para este dominio');
    return price;
  }

  /**
   * Compra el dominio de verdad — SOLO se llama después de confirmar el pago
   * por Mercado Pago (ver domain-purchase.service.ts#handlePaymentConfirmed).
   * `expectedPrice` es el precio ORIGINAL de Vercel (USD, el mismo que
   * devolvió `getPrice`) — Vercel rechaza la compra si no coincide con el
   * precio real en el momento de comprar (protección contra que el precio
   * haya cambiado entre la cotización y el pago).
   */
  async buyDomain(domain: string, years: number, contact: VercelDomainContact, expectedPrice: number, autoRenew: boolean): Promise<{ orderId: string }> {
    const data = await this.call(`/v1/registrar/domains/${domain}/buy`, {
      method: 'POST',
      body: JSON.stringify({
        years,
        autoRenew,
        expectedPrice,
        contactInformation: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          address1: contact.address1,
          city: contact.city,
          state: contact.state,
          zip: contact.zip,
          country: contact.country,
        },
      }),
    });
    if (!data.orderId) throw new BadRequestException('Vercel no devolvió una orden de compra válida');
    return { orderId: data.orderId };
  }

  /** Estado de una orden de compra ya creada — la compra es asincrónica del lado de Vercel. */
  async getOrderStatus(orderId: string): Promise<{ status?: string }> {
    return this.call(`/v1/registrar/orders/${orderId}`);
  }
}
