import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActualizarLeadDto, CrearLeadDto } from './leads.dto';
import {
  LEADS_SEMILLA,
  MAX_PILOTOS_POR_RUBRO,
  RUBROS_LEAD,
  UBICACION_MISIONES,
  esPuertoIguazu,
  normalizarInstagram,
  normalizarWhatsappUrl,
} from './leads-seed.data';

const ESTADOS_QUE_IMPLICAN_CONTACTO = new Set(['CONTACTADO', 'RESPONDIO', 'DEMO', 'PILOTO_ACTIVO', 'CLIENTE']);

function limpiarOpcional(valor: string | null | undefined): string | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  const t = valor.trim();
  return t.length > 0 ? t : null;
}

@Injectable()
export class LeadsService {
  private semillaLista = false;
  private semillaEnCurso: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Carga la base inicial verificada (189 negocios) la primera vez que la tabla está vacía. */
  async asegurarSemilla(): Promise<void> {
    if (this.semillaLista) return;
    if (!this.semillaEnCurso) {
      this.semillaEnCurso = (async () => {
        const count = await this.prisma.marketingLead.count();
        if (count === 0) {
          await this.prisma.marketingLead.createMany({ data: LEADS_SEMILLA, skipDuplicates: true });
        }
        this.semillaLista = true;
      })().finally(() => {
        this.semillaEnCurso = null;
      });
    }
    await this.semillaEnCurso;
  }

  private async nombreAdmin(adminId: string): Promise<string | null> {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { id: adminId }, select: { name: true } });
    return admin?.name ?? null;
  }

  private async validarPiloto(rubro: string, localidad: string, clasificacion: string, excludeId?: string) {
    if (clasificacion !== 'PILOTO') return;
    if (rubro === 'TIENDA') {
      throw new BadRequestException('En Tienda Online los locales de Iguazú van como «Potencial cliente · Iguazú» o «Lead».');
    }
    if (!esPuertoIguazu(localidad)) {
      throw new BadRequestException('Solo los negocios de Puerto Iguazú pueden ser pilotos (el resto son leads de venta cerrada).');
    }
    const existentes = await this.prisma.marketingLead.count({
      where: {
        rubro,
        clasificacion: 'PILOTO',
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existentes >= MAX_PILOTOS_POR_RUBRO) {
      throw new BadRequestException(
        `Ya hay ${MAX_PILOTOS_POR_RUBRO} pilotos en este rubro (máximo ${MAX_PILOTOS_POR_RUBRO} con cortesía de hasta 3 meses). Pasá uno a Lead primero.`,
      );
    }
  }

  async listar(filtros?: { rubro?: string; clasificacion?: string; estado?: string; localidad?: string; q?: string }) {
    await this.asegurarSemilla();
    const where: Record<string, unknown> = {};
    if (filtros?.rubro) where.rubro = filtros.rubro;
    if (filtros?.clasificacion) where.clasificacion = filtros.clasificacion;
    if (filtros?.estado) where.estado = filtros.estado;
    if (filtros?.localidad) where.localidad = filtros.localidad;
    if (filtros?.q?.trim()) {
      const q = filtros.q.trim();
      where.OR = [
        { negocio: { contains: q, mode: 'insensitive' } },
        { subrubro: { contains: q, mode: 'insensitive' } },
        { localidad: { contains: q, mode: 'insensitive' } },
        { telefono: { contains: q, mode: 'insensitive' } },
        { instagram: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [leads, todos] = await Promise.all([
      this.prisma.marketingLead.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { negocio: 'asc' }],
      }),
      this.prisma.marketingLead.findMany({
        select: { rubro: true, clasificacion: true, contactado: true, whatsappUrl: true, instagram: true },
      }),
    ]);

    const porRubro: Record<string, { total: number; contactados: number; pilotos: number; maxPilotos: number; potencialesLocales: number }> = {};
    for (const r of RUBROS_LEAD) {
      porRubro[r] = { total: 0, contactados: 0, pilotos: 0, maxPilotos: r === 'TIENDA' ? 0 : MAX_PILOTOS_POR_RUBRO, potencialesLocales: 0 };
    }
    let contactados = 0;
    let potencialesLocales = 0;
    for (const item of todos) {
      const bucket = porRubro[item.rubro];
      if (bucket) {
        bucket.total += 1;
        if (item.contactado) bucket.contactados += 1;
        if (item.clasificacion === 'PILOTO') bucket.pilotos += 1;
        if (item.clasificacion === 'POTENCIAL_LOCAL') bucket.potencialesLocales += 1;
      }
      if (item.contactado) contactados += 1;
      if (item.clasificacion === 'POTENCIAL_LOCAL') potencialesLocales += 1;
    }

    return {
      resumen: {
        total: todos.length,
        contactados,
        potencialesLocales,
        maxPilotosPorRubro: MAX_PILOTOS_POR_RUBRO,
        porRubro,
      },
      leads,
    };
  }

  async crear(adminId: string, dto: CrearLeadDto) {
    await this.asegurarSemilla();
    const localidad = dto.localidad.trim();
    const ubic = UBICACION_MISIONES[localidad] ?? {
      zona: dto.zona?.trim() || 'Misiones',
      departamento: dto.departamento?.trim() || localidad,
    };
    const clasificacion =
      dto.clasificacion ?? (dto.rubro === 'TIENDA' && esPuertoIguazu(localidad) ? 'POTENCIAL_LOCAL' : 'LEAD');

    await this.validarPiloto(dto.rubro, localidad, clasificacion);

    const telefono = limpiarOpcional(dto.telefono) ?? null;
    const instagram = normalizarInstagram(dto.instagram);
    const whatsappUrl = normalizarWhatsappUrl(telefono);
    const asignadoA = limpiarOpcional(dto.asignadoA) ?? null;
    const adminName = await this.nombreAdmin(adminId);

    return this.prisma.marketingLead.create({
      data: {
        rubro: dto.rubro,
        subrubro: dto.subrubro.trim(),
        clasificacion,
        negocio: dto.negocio.trim(),
        zona: dto.zona?.trim() || ubic.zona,
        departamento: dto.departamento?.trim() || ubic.departamento,
        localidad,
        telefono,
        whatsappUrl,
        instagram,
        webActual: limpiarOpcional(dto.webActual) ?? (instagram ? 'Solo Instagram' : 'Sin sitio web'),
        direccion: limpiarOpcional(dto.direccion) ?? null,
        fuente: adminName ? `Manual (${adminName})` : 'Manual',
        asignadoA,
        notas: limpiarOpcional(dto.notas) ?? null,
      },
    });
  }

  async actualizar(adminId: string, id: string, dto: ActualizarLeadDto) {
    const actual = await this.prisma.marketingLead.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Lead no encontrado');

    const rubro = dto.rubro ?? actual.rubro;
    const localidad = dto.localidad ? dto.localidad.trim() : actual.localidad;
    const clasificacion = dto.clasificacion ?? actual.clasificacion;

    if (dto.clasificacion !== undefined || dto.rubro !== undefined || dto.localidad !== undefined) {
      await this.validarPiloto(rubro, localidad, clasificacion, id);
    }

    const data: Record<string, unknown> = {};
    if (dto.rubro !== undefined) data.rubro = rubro;
    if (dto.subrubro !== undefined) data.subrubro = dto.subrubro.trim();
    if (dto.clasificacion !== undefined) data.clasificacion = clasificacion;
    if (dto.negocio !== undefined) data.negocio = dto.negocio.trim();
    if (dto.localidad !== undefined) {
      data.localidad = localidad;
      const ubic = UBICACION_MISIONES[localidad];
      if (ubic) {
        data.zona = ubic.zona;
        data.departamento = ubic.departamento;
      }
    }
    if (dto.telefono !== undefined) {
      const tel = limpiarOpcional(dto.telefono) ?? null;
      data.telefono = tel;
      data.whatsappUrl = normalizarWhatsappUrl(tel);
    }
    if (dto.instagram !== undefined) {
      data.instagram = normalizarInstagram(dto.instagram);
    }
    if (dto.webActual !== undefined) data.webActual = limpiarOpcional(dto.webActual) ?? null;
    if (dto.direccion !== undefined) data.direccion = limpiarOpcional(dto.direccion) ?? null;
    if (dto.asignadoA !== undefined) data.asignadoA = limpiarOpcional(dto.asignadoA) ?? null;
    if (dto.notas !== undefined) data.notas = limpiarOpcional(dto.notas) ?? null;

    let nuevoEstado = dto.estado;
    let nuevoContactado = dto.contactado;

    if (nuevoEstado !== undefined && nuevoContactado === undefined) {
      if (ESTADOS_QUE_IMPLICAN_CONTACTO.has(nuevoEstado) && !actual.contactado) {
        nuevoContactado = true;
      } else if (nuevoEstado === 'NUEVO' && actual.contactado) {
        nuevoContactado = false;
      }
    } else if (nuevoContactado !== undefined && nuevoEstado === undefined) {
      if (nuevoContactado && actual.estado === 'NUEVO') {
        nuevoEstado = 'CONTACTADO';
      } else if (!nuevoContactado && actual.estado === 'CONTACTADO') {
        nuevoEstado = 'NUEVO';
      }
    }

    if (nuevoEstado !== undefined) data.estado = nuevoEstado;
    if (nuevoContactado !== undefined) {
      data.contactado = nuevoContactado;
      if (nuevoContactado) {
        if (!actual.contactado) {
          data.contactadoPor = await this.nombreAdmin(adminId);
          data.contactadoAt = new Date();
        }
      } else {
        data.contactadoPor = null;
        data.contactadoAt = null;
      }
    }

    return this.prisma.marketingLead.update({ where: { id }, data });
  }

  async eliminar(id: string) {
    const actual = await this.prisma.marketingLead.findUnique({ where: { id }, select: { id: true } });
    if (!actual) throw new NotFoundException('Lead no encontrado');
    await this.prisma.marketingLead.delete({ where: { id } });
    return { ok: true };
  }
}
