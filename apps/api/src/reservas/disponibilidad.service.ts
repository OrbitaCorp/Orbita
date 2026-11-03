import { BadRequestException, Injectable } from '@nestjs/common';
import { ReservaConfig, ReservaModulo, ReservaRecurso, ReservaServicio } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReservasCatalogoService, datosAlojamiento } from './reservas-catalogo.service';
import { franjasDelDia, seguidasDesde, sesionesConCupo, type OcupacionDelDia } from './dominio/disponibilidad';
import { aperturaDelDia, sesionesDelDia, type HorarioSemanal } from './dominio/horario';
import { diasEntre, esFecha, fechaYMinutos, instante, MINUTOS_DIA, sumarDias, tramoEnElDia, type Tramo } from './dominio/tiempo';
import { DisponibilidadDiaDto, DisponibilidadRangoDto, NochesDto } from './reservas.types';

export type Modo = 'publico' | 'panel';

/** Con qué reglas se arma el día: lo resuelve `reglasDe` y lo usan la disponibilidad y el motor. */
export interface ReglasDelRecurso {
  config: ReservaConfig;
  recurso: ReservaRecurso;
  servicio: ReservaServicio | null;
  /** Minutos de lo que se reserva (una franja, una sesión, un turno del servicio). */
  duracionBase: number;
  /** Minutos totales pedidos (franjas seguidas de una cancha). */
  duracion: number;
  paso: number;
  margen: number;
  horario: HorarioSemanal | null;
}

const MAX_DIAS_RANGO = 93;

// Qué se puede reservar y cuándo. Lee la config, el recurso, los bloqueos y
// las reservas que ocupan lugar, y le pasa todo al dominio puro
// (dominio/disponibilidad.ts) para armar las franjas. Una retenida vencida que
// nadie barrió todavía NO ocupa lugar: se filtra por `retenidaHasta`.
@Injectable()
export class DisponibilidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogo: ReservasCatalogoService,
  ) {}

  /**
   * Resuelve las reglas de un pedido: duración (del servicio en Turnos, del
   * recurso en el resto, por `duracionMinutos` si piden franjas seguidas),
   * paso, margen y horario. Falla con 400 si el pedido no cierra.
   */
  async reglasDe(businessId: string, modulo: ReservaModulo, recursoId: string, servicioId?: string, duracionMinutos?: number): Promise<ReglasDelRecurso> {
    const config = await this.catalogo.configOFalla(businessId, modulo);
    const recurso = await this.catalogo.recurso(businessId, recursoId);
    if (recurso.modulo !== modulo) throw new BadRequestException('Ese recurso es de otro módulo.');
    let servicio: ReservaServicio | null = null;
    if (servicioId) {
      servicio = await this.catalogo.servicio(businessId, servicioId);
      if (servicio.modulo !== modulo) throw new BadRequestException('Ese servicio es de otro módulo.');
      if (servicio.recursoIds.length > 0 && !servicio.recursoIds.includes(recurso.id)) {
        throw new BadRequestException(`${recurso.nombre} no hace ${servicio.nombre}.`);
      }
    }
    const duracionBase = servicio?.duracionMinutos ?? recurso.duracionMinutos ?? null;
    if (recurso.tipo !== 'ALOJAMIENTO' && !duracionBase) {
      throw new BadRequestException(recurso.modulo === 'TURNOS' ? 'Elegí un servicio.' : 'Ese recurso no tiene duración configurada.');
    }
    const base = duracionBase ?? MINUTOS_DIA;
    let duracion = base;
    if (duracionMinutos !== undefined && recurso.tipo !== 'ALOJAMIENTO') {
      if (duracionMinutos % base !== 0) throw new BadRequestException(`La duración tiene que ser un múltiplo de ${base} minutos.`);
      const seguidas = duracionMinutos / base;
      if (seguidas > recurso.maximoSeguidos) {
        throw new BadRequestException(recurso.maximoSeguidos === 1 ? 'Acá se reserva de a una franja.' : `Se pueden tomar hasta ${recurso.maximoSeguidos} franjas seguidas.`);
      }
      duracion = duracionMinutos;
    }
    return {
      config, recurso, servicio, duracionBase: base, duracion,
      paso: recurso.pasoMinutos ?? base,
      margen: recurso.tipo === 'CLASE' ? 0 : (recurso.margenMinutos ?? config.margenMinutos),
      horario: (recurso.horario ?? config.horario) as HorarioSemanal | null,
    };
  }

  /** Desde qué minuto del día se ofrece algo: hoy, desde ahora (+ anticipación mínima en el sitio); un día pasado, nada. */
  static desdeMinuto(fecha: string, ahora: Date, modo: Modo, config: ReservaConfig): number | null {
    const limite = modo === 'publico' ? new Date(ahora.getTime() + config.anticipacionMinimaMinutos * 60_000) : ahora;
    const { fecha: fechaLimite, minutos } = fechaYMinutos(limite);
    if (fecha < fechaLimite) return null;
    if (fecha > fechaLimite) {
      if (modo === 'publico' && diasEntre(fechaYMinutos(ahora).fecha, fecha) > config.anticipacionMaximaDias) return null;
      return 0;
    }
    return minutos;
  }

  /** Bloqueos del módulo que tocan [desde, hasta), del recurso o de todos. */
  async bloqueosEntre(businessId: string, modulo: ReservaModulo, recursoId: string, desde: Date, hasta: Date) {
    return this.prisma.reservaBloqueo.findMany({
      where: { businessId, modulo, OR: [{ recursoId: null }, { recursoId }], inicio: { lt: hasta }, fin: { gt: desde } },
      select: { inicio: true, fin: true },
    });
  }

  /** Reservas que ocupan lugar en [desde, hasta) (una retenida vencida no cuenta). */
  async ocupadasEntre(businessId: string, recursoId: string, desde: Date, hasta: Date, ahora: Date, salvo?: string) {
    return this.prisma.reserva.findMany({
      where: {
        businessId, recursoId,
        ...(salvo ? { id: { not: salvo } } : {}),
        inicio: { lt: hasta }, fin: { gt: desde },
        OR: [{ estado: { in: ['PENDIENTE', 'CONFIRMADA'] } }, { estado: 'RETENIDA', retenidaHasta: { gte: ahora } }],
      },
      select: { inicio: true, fin: true, cantidad: true },
    });
  }

  private franjasDe(r: ReglasDelRecurso, fecha: string, bloqueos: Tramo[], ocupadas: OcupacionDelDia[], desdeMinuto: number | null) {
    if (desdeMinuto === null) return { cerrado: true, franjas: [] as ReturnType<typeof franjasDelDia> };
    if (r.recurso.tipo === 'CLASE') {
      const sesiones = sesionesDelDia(r.horario, fecha);
      return { cerrado: sesiones.length === 0, franjas: sesionesConCupo(sesiones, bloqueos, ocupadas, r.recurso.cupo, desdeMinuto) };
    }
    const apertura = aperturaDelDia(r.horario, fecha);
    const franjas = franjasDelDia(apertura, bloqueos, ocupadas, { duracion: r.duracionBase, paso: r.paso, margen: r.margen, cupo: r.recurso.cupo, desdeMinuto });
    return { cerrado: apertura.length === 0, franjas };
  }

  async delDia(businessId: string, q: { modulo: ReservaModulo; recursoId: string; fecha: string; servicioId?: string; duracionMinutos?: number; salvo?: string }, modo: Modo, ahora = new Date()): Promise<DisponibilidadDiaDto> {
    if (!esFecha(q.fecha)) throw new BadRequestException('Esa fecha no existe.');
    const r = await this.reglasDe(businessId, q.modulo, q.recursoId, q.servicioId, q.duracionMinutos);
    if (r.recurso.tipo === 'ALOJAMIENTO') throw new BadRequestException('Un alojamiento se consulta por noches (disponibilidad/noches).');
    const inicioDia = instante(q.fecha, 0);
    const finDia = instante(q.fecha, MINUTOS_DIA);
    const [bloqueos, ocupadas] = await Promise.all([
      this.bloqueosEntre(businessId, q.modulo, r.recurso.id, inicioDia, finDia),
      this.ocupadasEntre(businessId, r.recurso.id, new Date(inicioDia.getTime() - r.margen * 60_000), new Date(finDia.getTime() + r.margen * 60_000), ahora, q.salvo),
    ]);
    const tramosBloqueados = bloqueos.map((b) => tramoEnElDia(b.inicio, b.fin, q.fecha)).filter((t): t is Tramo => t !== null);
    const ocupacion = this.ocupacionDelDia(ocupadas, q.fecha);
    const desde = DisponibilidadService.desdeMinuto(q.fecha, ahora, modo, r.config);
    const { cerrado, franjas } = this.franjasDe(r, q.fecha, tramosBloqueados, ocupacion, desde);
    const conSeguidas = r.recurso.maximoSeguidos > 1;
    return {
      fecha: q.fecha, recursoId: r.recurso.id, duracionMinutos: r.duracionBase, cerrado,
      franjas: franjas.map((f) => ({
        inicioMinutos: f.inicio, finMinutos: f.fin, libres: f.libres, cupo: f.cupo,
        ...(conSeguidas ? { seguidas: seguidasDesde(franjas, f.inicio, r.recurso.maximoSeguidos) } : {}),
      })),
    };
  }

  /** Por día, cuántas franjas con lugar hay: para pintar el calendario sin pedir día por día. */
  async rango(businessId: string, q: { modulo: ReservaModulo; recursoId: string; desde: string; hasta: string; servicioId?: string; duracionMinutos?: number }, modo: Modo, ahora = new Date()): Promise<DisponibilidadRangoDto> {
    if (!esFecha(q.desde) || !esFecha(q.hasta)) throw new BadRequestException('Esa fecha no existe.');
    const dias = diasEntre(q.desde, q.hasta);
    if (dias < 0) throw new BadRequestException('El fin del rango es anterior al inicio.');
    if (dias >= MAX_DIAS_RANGO) throw new BadRequestException(`Pedí hasta ${MAX_DIAS_RANGO} días por vez.`);
    const r = await this.reglasDe(businessId, q.modulo, q.recursoId, q.servicioId, q.duracionMinutos);
    if (r.recurso.tipo === 'ALOJAMIENTO') throw new BadRequestException('Un alojamiento se consulta por noches (disponibilidad/noches).');
    const inicio = instante(q.desde, 0);
    const fin = instante(q.hasta, MINUTOS_DIA);
    const [bloqueos, ocupadas] = await Promise.all([
      this.bloqueosEntre(businessId, q.modulo, r.recurso.id, inicio, fin),
      this.ocupadasEntre(businessId, r.recurso.id, new Date(inicio.getTime() - r.margen * 60_000), new Date(fin.getTime() + r.margen * 60_000), ahora),
    ]);
    const salida: DisponibilidadRangoDto['dias'] = [];
    for (let i = 0; i <= dias; i++) {
      const fecha = sumarDias(q.desde, i);
      const tramosBloqueados = bloqueos.map((b) => tramoEnElDia(b.inicio, b.fin, fecha)).filter((t): t is Tramo => t !== null);
      const desde = DisponibilidadService.desdeMinuto(fecha, ahora, modo, r.config);
      const { cerrado, franjas } = this.franjasDe(r, fecha, tramosBloqueados, this.ocupacionDelDia(ocupadas, fecha), desde);
      salida.push({ fecha, libres: franjas.filter((f) => f.libres > 0).length, cerrado });
    }
    return { recursoId: r.recurso.id, dias: salida };
  }

  /** Alojamientos: qué noches están tomadas o bloqueadas entre dos días. */
  async noches(businessId: string, q: { recursoId: string; desde: string; hasta: string }, ahora = new Date()): Promise<NochesDto> {
    if (!esFecha(q.desde) || !esFecha(q.hasta)) throw new BadRequestException('Esa fecha no existe.');
    const dias = diasEntre(q.desde, q.hasta);
    if (dias < 0 || dias >= MAX_DIAS_RANGO * 2) throw new BadRequestException(`Pedí un rango de hasta ${MAX_DIAS_RANGO * 2} días.`);
    const recurso = await this.catalogo.recurso(businessId, q.recursoId);
    if (recurso.tipo !== 'ALOJAMIENTO') throw new BadRequestException('Solo un alojamiento se consulta por noches.');
    const { checkIn, checkOut, nochesMinimas } = datosAlojamiento(recurso.datos);
    const inicio = instante(q.desde, 0);
    const fin = instante(q.hasta, MINUTOS_DIA);
    const [bloqueos, ocupadas] = await Promise.all([
      this.bloqueosEntre(businessId, recurso.modulo, recurso.id, inicio, fin),
      this.ocupadasEntre(businessId, recurso.id, inicio, fin, ahora),
    ]);
    const tomadas = new Set<string>();
    // Una noche es el día en que empieza: la reserva del 10 al 12 ocupa las noches del 10 y del 11.
    for (const o of [...bloqueos, ...ocupadas]) {
      const desde = fechaYMinutos(o.inicio).fecha;
      const { fecha: ultimo, minutos } = fechaYMinutos(o.fin);
      const hasta = minutos > checkOut ? sumarDias(ultimo, 1) : ultimo;
      for (let f = desde; f < hasta; f = sumarDias(f, 1)) if (f >= q.desde && f <= q.hasta) tomadas.add(f);
    }
    return { recursoId: recurso.id, ocupadas: [...tomadas].sort(), nochesMinimas, checkInMinutos: checkIn, checkOutMinutos: checkOut };
  }

  private ocupacionDelDia(ocupadas: { inicio: Date; fin: Date; cantidad: number }[], fecha: string): OcupacionDelDia[] {
    const out: OcupacionDelDia[] = [];
    for (const o of ocupadas) {
      const t = tramoEnElDia(o.inicio, o.fin, fecha);
      if (t) out.push({ tramo: t, cantidad: o.cantidad });
    }
    return out;
  }
}
