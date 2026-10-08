import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// Los canales de la EMPRESA (Instagram y WhatsApp) para la pantalla Marketing del super panel.
//
// Órbita no tiene un negocio propio: sus cuentas están conectadas al negocio de prueba del equipo
// (hoy `negocio`), porque Instagram y WhatsApp se conectan por negocio, desde su bandeja de mensajes.
// Este servicio solo LEE ese estado para mostrarlo en un solo lugar; conectar o desconectar sigue
// siendo desde esa bandeja. Cuál es el negocio se puede cambiar con MARKETING_NEGOCIO (subdominio).
// TikTok no pasa por acá: es una conexión de la empresa, no de un negocio (ver marketing/tiktok/).

const NEGOCIO_POR_DEFECTO = 'negocio';
const DIA_MS = 86_400_000;

/** WhatsApp da números de prueba (+1 555…) para desarrollar: sirven para probar, no para atender clientes. */
export function esNumeroDePrueba(numero: string | null | undefined): boolean {
  return /^\+?1[\s-]?\(?555/.test((numero ?? '').trim());
}

export type CanalesEmpresa = {
  /** El negocio al que están conectadas las cuentas. null = no existe (cambió el subdominio o se borró). */
  negocio: { nombre: string; subdominio: string } | null;
  instagram: { conectado: false } | { conectado: true; usuario: string | null; venceEl: Date; diasRestantes: number };
  whatsapp: { conectado: false } | { conectado: true; numero: string | null; dePrueba: boolean };
};

@Injectable()
export class CanalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canales(ahora = new Date()): Promise<CanalesEmpresa> {
    const subdominio = this.config.get<string>('MARKETING_NEGOCIO')?.trim().toLowerCase() || NEGOCIO_POR_DEFECTO;
    const negocio = await this.prisma.business.findFirst({
      where: { subdomain: subdominio, deletedAt: null },
      select: { id: true, name: true, subdomain: true },
    });
    if (!negocio) return { negocio: null, instagram: { conectado: false }, whatsapp: { conectado: false } };

    const [ig, wa] = await Promise.all([
      this.prisma.instagramConnection.findUnique({ where: { businessId: negocio.id }, select: { username: true, status: true, tokenExpiresAt: true } }),
      this.prisma.whatsappConnection.findUnique({ where: { businessId: negocio.id }, select: { status: true, displayPhone: true } }),
    ]);

    return {
      negocio: { nombre: negocio.name, subdominio: negocio.subdomain },
      instagram: ig && ig.status === 'ACTIVE'
        ? { conectado: true, usuario: ig.username, venceEl: ig.tokenExpiresAt, diasRestantes: Math.max(0, Math.ceil((ig.tokenExpiresAt.getTime() - ahora.getTime()) / DIA_MS)) }
        : { conectado: false },
      whatsapp: wa && wa.status === 'ACTIVE'
        ? { conectado: true, numero: wa.displayPhone, dePrueba: esNumeroDePrueba(wa.displayPhone) }
        : { conectado: false },
    };
  }
}
