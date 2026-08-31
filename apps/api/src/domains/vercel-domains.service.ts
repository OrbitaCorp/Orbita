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
}
