import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { esMes, mesArgentina, rangoDeMesArgentina } from '../../common/utils/hora-argentina';

const CREDITOS_BASE = 1500;
const CREDITOS_AVANZADO = 2000;

export interface CupoDelNegocio {
  mes: string;
  base: number;
  ajustes: number;
  total: number;
  avanzado: boolean;
}

export interface EstadoDelCupo {
  mes: string;
  /** ORBI_CUPO_BLOQUEA === 'true'. Apagado, el cupo solo se muestra, no corta nada. */
  bloquea: boolean;
  negocio: { usados: number; total: number; porcentaje: number };
  propio: { usados: number; disponible: number; porcentaje: number; topePorcentaje: number | null };
}

export function porcentajeDe(usados: number, total: number): number {
  if (total <= 0) return usados > 0 ? 100 : 0;
  return Math.floor((usados * 100) / total);
}

/**
 * Cupo mensual de Orbi en créditos (spec 2026-10-03 §3, D2-D7). El cupo es el
 * del plan más los ajustes del mes; lo usado es la suma de `orbi_turns.credits`
 * del mes. No se guarda un saldo: se calcula, así un ajuste o un cambio de plan
 * se ve en el acto y no hay dos números que puedan desincronizarse.
 */
@Injectable()
export class CupoOrbiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private creditos(variable: string, porDefecto: number): number {
    const n = Number(this.config.get<string>(variable));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : porDefecto;
  }

  get bloquea(): boolean {
    return this.config.get<string>('ORBI_CUPO_BLOQUEA') === 'true';
  }

  async cupoDelNegocio(businessId: string, mes: string): Promise<CupoDelNegocio> {
    const ahora = new Date();
    const [addon, ajustes] = await Promise.all([
      this.prisma.businessAddon.findFirst({
        where: { businessId, type: 'ADVANCED', isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: ahora } }] },
        select: { id: true },
      }),
      this.prisma.orbiCupoAjuste.aggregate({ where: { businessId, mes }, _sum: { creditos: true } }),
    ]);
    const avanzado = !!addon;
    const base = avanzado
      ? this.creditos('ORBI_CREDITOS_MES_AVANZADO', CREDITOS_AVANZADO)
      : this.creditos('ORBI_CREDITOS_MES_BASE', CREDITOS_BASE);
    const extra = ajustes._sum.creditos ?? 0;
    return { mes, base, ajustes: extra, total: Math.max(0, base + extra), avanzado };
  }

  async usados(businessId: string, mes: string): Promise<{ negocio: number; porMiembro: Map<string, number> }> {
    const { desde, hasta } = rangoDeMesArgentina(mes);
    const filas = await this.prisma.orbiTurn.groupBy({
      by: ['memberId'],
      where: { businessId, createdAt: { gte: desde, lt: hasta } },
      _sum: { credits: true },
    });
    const porMiembro = new Map<string, number>();
    let negocio = 0;
    for (const f of filas) {
      const c = f._sum.credits ?? 0;
      porMiembro.set(f.memberId, c);
      negocio += c;
    }
    return { negocio, porMiembro };
  }

  async topes(businessId: string): Promise<Map<string, number>> {
    const filas = await this.prisma.orbiCupoMiembro.findMany({
      where: { businessId },
      select: { memberId: true, topePorcentaje: true },
    });
    return new Map(filas.map((f) => [f.memberId, f.topePorcentaje]));
  }

  async estado(businessId: string, memberId: string, ahora = new Date()): Promise<EstadoDelCupo> {
    const mes = mesArgentina(ahora);
    const [cupo, uso, tope] = await Promise.all([
      this.cupoDelNegocio(businessId, mes),
      this.usados(businessId, mes),
      this.prisma.orbiCupoMiembro.findUnique({
        where: { businessId_memberId: { businessId, memberId } },
        select: { topePorcentaje: true },
      }),
    ]);
    const propios = uso.porMiembro.get(memberId) ?? 0;
    const topePorcentaje = tope?.topePorcentaje ?? null;
    const disponible = topePorcentaje === null ? cupo.total : Math.floor((cupo.total * topePorcentaje) / 100);
    return {
      mes,
      bloquea: this.bloquea,
      negocio: { usados: uso.negocio, total: cupo.total, porcentaje: porcentajeDe(uso.negocio, cupo.total) },
      propio: { usados: propios, disponible, porcentaje: porcentajeDe(propios, disponible), topePorcentaje },
    };
  }

  /** null = puede; si no, qué cupo se agotó. Siempre null con el bloqueo apagado. */
  async motivoDeBloqueo(businessId: string, memberId: string, ahora = new Date()): Promise<'negocio' | 'miembro' | null> {
    if (!this.bloquea) return null;
    const e = await this.estado(businessId, memberId, ahora);
    if (e.negocio.usados >= e.negocio.total) return 'negocio';
    if (e.propio.topePorcentaje !== null && e.propio.usados >= e.propio.disponible) return 'miembro';
    return null;
  }

  async fijarTope(businessId: string, memberId: string, topePorcentaje: number | null, porMemberId: string): Promise<void> {
    if (topePorcentaje === null) {
      await this.prisma.orbiCupoMiembro.deleteMany({ where: { businessId, memberId } });
      return;
    }
    if (!Number.isInteger(topePorcentaje) || topePorcentaje < 10 || topePorcentaje > 100) {
      throw new BadRequestException('El tope tiene que ser un porcentaje entero entre 10 y 100.');
    }
    await this.prisma.orbiCupoMiembro.upsert({
      where: { businessId_memberId: { businessId, memberId } },
      create: { businessId, memberId, topePorcentaje, updatedBy: porMemberId },
      update: { topePorcentaje, updatedBy: porMemberId },
    });
  }

  async ajustar(a: { businessId: string; mes: string; creditos: number; motivo: string; adminId: string }): Promise<{ id: string }> {
    if (!esMes(a.mes)) throw new BadRequestException('El mes tiene que tener la forma AAAA-MM.');
    if (!Number.isInteger(a.creditos) || a.creditos === 0 || Math.abs(a.creditos) > 100_000) {
      throw new BadRequestException('Los créditos tienen que ser un entero distinto de 0, de hasta 100.000.');
    }
    const motivo = a.motivo.trim();
    if (motivo.length < 5 || motivo.length > 300) {
      throw new BadRequestException('El motivo tiene que tener entre 5 y 300 caracteres.');
    }
    return this.prisma.orbiCupoAjuste.create({
      data: { businessId: a.businessId, mes: a.mes, creditos: a.creditos, motivo, adminId: a.adminId },
      select: { id: true },
    });
  }

  ajustesDelMes(businessId: string, mes: string) {
    return this.prisma.orbiCupoAjuste.findMany({
      where: { businessId, mes },
      orderBy: { createdAt: 'desc' },
      select: { id: true, creditos: true, motivo: true, adminId: true, createdAt: true },
    });
  }
}
