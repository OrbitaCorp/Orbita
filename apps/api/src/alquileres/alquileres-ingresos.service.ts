import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReservasCatalogoService } from '../reservas/reservas-catalogo.service';
import { esFecha } from '../reservas/dominio/tiempo';
import { leerCsvDeAirbnb, type EstadiaLeida, type FilaDescartada } from './dominio/csv-airbnb';

// Lo que un alojamiento cobró afuera de Órbita (hoy, por Airbnb), importado del
// archivo de ganancias que el dueño descarga. Reglas que no se negocian:
//
// - Una estadía de Airbnb NUNCA es una reserva del motor: sus noches llegan
//   como bloqueo del .ics y su plata y su huésped, por acá.
// - Importar es todo o nada: si el archivo no se entiende, o una propiedad no
//   es del negocio, no se guarda nada.
// - Una fila por negocio, canal y código de confirmación: importar dos veces
//   el mismo archivo no duplica, y uno más nuevo corrige los montos.
// - El servidor no recuerda nada entre la vista previa y la importación: lee
//   el texto las dos veces, y no confía en filas armadas por el navegador.
// - El texto del archivo no se guarda ni se escribe en ningún registro.
// - Todo filtra por negocio. Los recursos se miran por el catálogo del motor.
//
// Diseño: docs/superpowers/specs/2026-11-26-alquileres-estadisticas-y-csv-airbnb-design.md

export type CanalExterno = 'airbnb';
const AIRBNB: CanalExterno = 'airbnb';

export interface VistaPreviaDto {
  estadias: number;
  /** La primera entrada y la última salida de lo leído. */
  desde: string | null;
  hasta: string | null;
  totales: { moneda: string; neto: number; estadias: number }[];
  descartadas: FilaDescartada[];
  /** Filas que no son de una estadía (transferencias al banco): no se importan. */
  otrasFilas: number;
  /** Cada aviso del archivo, con la propiedad que ya tiene unida si la tiene. */
  avisos: { nombre: string; estadias: number; recursoId: string | null }[];
}

export interface ImportadoDto { creadas: number; actualizadas: number; sinImportar: number }

export interface IngresoExternoDto {
  id: string;
  recursoId: string;
  canal: CanalExterno;
  codigo: string;
  entrada: string;
  salida: string;
  noches: number;
  huesped: string | null;
  montoBruto: number;
  comision: number;
  limpieza: number;
  montoNeto: number;
  moneda: string;
}

export interface IngresosDto {
  filas: IngresoExternoDto[];
  /** De todo lo importado del negocio, no solo del rango pedido. */
  resumen: { estadias: number; ultimaImportacion: string | null; hasta: string | null };
}

const redondo = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class AlquileresIngresosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogo: ReservasCatalogoService,
    // Opcional solo para los tests unitarios; Nest lo inyecta siempre.
    private readonly audit?: AuditService,
  ) {}

  private leer(texto: string): { estadias: EstadiaLeida[]; descartadas: FilaDescartada[]; otrasFilas: number } {
    const leido = leerCsvDeAirbnb(texto);
    if (!leido.ok) throw new BadRequestException(leido.motivo);
    return leido;
  }

  /** Si esa propiedad sigue siendo un alojamiento del negocio. */
  private async esAlojamiento(businessId: string, recursoId: string): Promise<boolean> {
    try {
      const r = await this.catalogo.recurso(businessId, recursoId);
      return r.modulo === 'ALQUILERES' && r.tipo === 'ALOJAMIENTO';
    } catch {
      return false;
    }
  }

  async vistaPrevia(businessId: string, texto: string): Promise<VistaPreviaDto> {
    const { estadias, descartadas, otrasFilas } = this.leer(texto);
    const guardadas = await this.prisma.alquilerAvisoExterno.findMany({ where: { businessId, canal: AIRBNB } });
    const union = new Map<string, string>();
    for (const g of guardadas) {
      if (await this.esAlojamiento(businessId, g.recursoId)) union.set(g.nombreExterno, g.recursoId);
    }

    const porMoneda = new Map<string, { neto: number; estadias: number }>();
    const porAviso = new Map<string, number>();
    for (const e of estadias) {
      const m = porMoneda.get(e.moneda) ?? { neto: 0, estadias: 0 };
      porMoneda.set(e.moneda, { neto: m.neto + e.montoNeto, estadias: m.estadias + 1 });
      porAviso.set(e.aviso, (porAviso.get(e.aviso) ?? 0) + 1);
    }
    const pesosPrimero = (a: string, b: string) => (a === 'ARS' ? -1 : b === 'ARS' ? 1 : a.localeCompare(b));
    return {
      estadias: estadias.length,
      desde: estadias.reduce<string | null>((m, e) => (m === null || e.entrada < m ? e.entrada : m), null),
      hasta: estadias.reduce<string | null>((m, e) => (m === null || e.salida > m ? e.salida : m), null),
      totales: [...porMoneda].sort(([a], [b]) => pesosPrimero(a, b)).map(([moneda, t]) => ({ moneda, neto: redondo(t.neto), estadias: t.estadias })),
      descartadas,
      otrasFilas,
      avisos: [...porAviso].sort(([a], [b]) => a.localeCompare(b)).map(([nombre, cuantas]) => ({ nombre, estadias: cuantas, recursoId: union.get(nombre) ?? null })),
    };
  }

  /**
   * Guarda las estadías del archivo. `avisos` dice, por cada aviso del
   * archivo, a qué propiedad corresponde, o `null` para no importarlo: tienen
   * que venir todos. Se valida todo antes de escribir, y se escribe en una
   * transacción.
   */
  async importar(
    businessId: string,
    memberId: string,
    dto: { texto: string; avisos: { nombre: string; recursoId: string | null }[] },
    ahora = new Date(),
  ): Promise<ImportadoDto> {
    const { estadias } = this.leer(dto.texto);
    const decidido = new Map(dto.avisos.map((a) => [a.nombre, a.recursoId]));
    const delArchivo = [...new Set(estadias.map((e) => e.aviso))];
    const sinDecidir = delArchivo.find((nombre) => !decidido.has(nombre));
    if (sinDecidir !== undefined) throw new BadRequestException(`Falta decir a qué propiedad corresponde "${sinDecidir}".`);

    // Cada propiedad elegida tiene que ser un alojamiento de este negocio (el catálogo tira 404 si no es suya).
    const elegidas = [...new Set(delArchivo.map((nombre) => decidido.get(nombre)).filter((id): id is string => !!id))];
    for (const id of elegidas) {
      const r = await this.catalogo.recurso(businessId, id);
      if (r.modulo !== 'ALQUILERES' || r.tipo !== 'ALOJAMIENTO') throw new BadRequestException('Las ganancias de Airbnb se unen a un alojamiento.');
    }

    const aGuardar = estadias.filter((e) => decidido.get(e.aviso));
    const codigos = aGuardar.map((e) => e.codigo);
    const resultado = await this.prisma.$transaction(async (tx) => {
      // Las uniones: se guarda (o se corrige) la de cada aviso que se importa.
      const guardadas = await tx.alquilerAvisoExterno.findMany({ where: { businessId, canal: AIRBNB } });
      for (const nombre of delArchivo) {
        const recursoId = decidido.get(nombre);
        if (!recursoId) continue;
        const ya = guardadas.find((g) => g.nombreExterno === nombre);
        if (!ya) await tx.alquilerAvisoExterno.create({ data: { businessId, canal: AIRBNB, nombreExterno: nombre, recursoId } });
        else if (ya.recursoId !== recursoId) await tx.alquilerAvisoExterno.updateMany({ where: { id: ya.id, businessId }, data: { recursoId } });
      }
      // Las estadías: las que ya estaban (por su código) se reemplazan por lo que dice este archivo.
      const { count: actualizadas } = await tx.alquilerIngresoExterno.deleteMany({ where: { businessId, canal: AIRBNB, codigoExterno: { in: codigos } } });
      if (aGuardar.length) {
        await tx.alquilerIngresoExterno.createMany({
          data: aGuardar.map((e) => ({
            businessId, recursoId: decidido.get(e.aviso) as string, canal: AIRBNB, codigoExterno: e.codigo.slice(0, 40),
            entrada: e.entrada, salida: e.salida, noches: e.noches, huesped: e.huesped?.slice(0, 120) ?? null,
            montoBruto: e.montoBruto, comision: e.comision, limpieza: e.limpieza, montoNeto: e.montoNeto, moneda: e.moneda, importadoEn: ahora,
          })),
        });
      }
      return { creadas: aGuardar.length - actualizadas, actualizadas, sinImportar: estadias.length - aGuardar.length };
    }, { timeout: 30_000 });

    await this.audit?.registrar({
      businessId, memberId, entityType: 'alquiler_ingresos', entityId: AIRBNB, action: 'CREATE',
      changes: [{ field: 'estadias', before: null, after: `${resultado.creadas} nuevas, ${resultado.actualizadas} actualizadas` }],
    });
    return resultado;
  }

  /** Las estadías que tocan el rango (entran hasta `hasta` y salen después de `desde`), y el resumen de todo lo importado. */
  async listar(businessId: string, desde: string, hasta: string): Promise<IngresosDto> {
    if (!esFecha(desde) || !esFecha(hasta) || hasta < desde) throw new BadRequestException('Revisá las fechas.');
    const [filas, total] = await Promise.all([
      this.prisma.alquilerIngresoExterno.findMany({ where: { businessId, entrada: { lte: hasta }, salida: { gt: desde } }, orderBy: [{ entrada: 'asc' }, { codigoExterno: 'asc' }] }),
      this.prisma.alquilerIngresoExterno.aggregate({ where: { businessId }, _count: { _all: true }, _max: { importadoEn: true, salida: true } }),
    ]);
    return {
      filas: filas.map((f) => ({
        id: f.id, recursoId: f.recursoId, canal: f.canal as CanalExterno, codigo: f.codigoExterno, entrada: f.entrada, salida: f.salida, noches: f.noches, huesped: f.huesped,
        montoBruto: Number(f.montoBruto), comision: Number(f.comision), limpieza: Number(f.limpieza), montoNeto: Number(f.montoNeto), moneda: f.moneda,
      })),
      resumen: { estadias: total._count._all, ultimaImportacion: total._max.importadoEn?.toISOString() ?? null, hasta: total._max.salida ?? null },
    };
  }

  /** Borra todo lo importado de un canal (por si se subió un archivo equivocado). Las uniones de avisos se conservan. */
  async borrarTodo(businessId: string, memberId: string, canal: CanalExterno): Promise<{ ok: true; borradas: number }> {
    const { count } = await this.prisma.alquilerIngresoExterno.deleteMany({ where: { businessId, canal } });
    await this.audit?.registrar({ businessId, memberId, entityType: 'alquiler_ingresos', entityId: canal, action: 'DELETE', changes: [{ field: 'estadias', before: `${count}`, after: null }] });
    return { ok: true, borradas: count };
  }
}
