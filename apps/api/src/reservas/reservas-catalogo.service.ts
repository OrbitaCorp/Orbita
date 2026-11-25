import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReservaConfig, ReservaModulo, ReservaRecurso, ReservaRecursoTipo, ReservaServicio } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CrearBloqueoDto, UpsertConfigDto, UpsertRecursoDto, UpsertServicioDto } from './dto/catalogo.dto';
import { errorDeHorario, sesionesDelDia, type HorarioSemanal } from './dominio/horario';
import { cuandoEs, esFecha, fechaYMinutos, instante, MINUTOS_DIA } from './dominio/tiempo';
import { OCUPAN } from './dominio/estados';
import { tomarRecurso, TRANSACCION_CON_CANDADO } from './candado';

// Lo que el negocio configura para reservar: las reglas (config), qué se
// reserva (recursos), qué se elige antes (servicios) y cuándo no se reserva
// (bloqueos). Todo filtrado por negocio y módulo; todo con registro en
// audit_logs. El motor (ReservasService) lee de acá.

const CAMPOS_CONFIG = [
  'activo', 'confirmacion', 'retencionMinutos', 'anticipacionMinimaMinutos', 'anticipacionMaximaDias', 'cancelacionHastaHoras',
  'reprogramacionHastaHoras', 'reprogramacionesMaximas', 'senaPorcentaje', 'senaReembolsable', 'maximoActivasPorCliente',
  'listaDeEspera', 'margenMinutos', 'horario', 'datos',
];
const CAMPOS_RECURSO = ['nombre', 'descripcion', 'tipo', 'cupo', 'duracionMinutos', 'pasoMinutos', 'margenMinutos', 'maximoSeguidos', 'precio', 'horario', 'datos', 'memberId', 'orden', 'activo'];
const CAMPOS_SERVICIO = ['nombre', 'descripcion', 'duracionMinutos', 'precio', 'reservableOnline', 'recursoIds', 'orden', 'activo'];

/** Horario de fábrica cuando el panel crea la config sin uno: lunes a viernes de 9 a 18. */
export const HORARIO_DE_FABRICA = { '1': [[540, 1080]], '2': [[540, 1080]], '3': [[540, 1080]], '4': [[540, 1080]], '5': [[540, 1080]] };

export const MODULO_DEL_TIPO: Record<ReservaRecursoTipo, ReservaModulo> = {
  PROFESIONAL: 'TURNOS',
  ESPACIO: 'TURNOS',
  CANCHA: 'ALQUILERES',
  SALON: 'ALQUILERES',
  ALOJAMIENTO: 'ALQUILERES',
  CLASE: 'GIMNASIO',
};

/** Lo que trae `datos` de un alojamiento, con valores de fábrica: check-in 14:00, check-out 10:00, una noche mínima. */
export function datosAlojamiento(datos: unknown): { checkIn: number; checkOut: number; nochesMinimas: number } {
  const d = (datos && typeof datos === 'object' ? datos : {}) as Record<string, unknown>;
  const entero = (v: unknown, def: number, min: number, max: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : def);
  return {
    checkIn: entero(d.checkIn, 14 * 60, 0, MINUTOS_DIA - 1),
    checkOut: entero(d.checkOut, 10 * 60, 0, MINUTOS_DIA - 1),
    nochesMinimas: entero(d.nochesMinimas, 1, 1, 365),
  };
}

@Injectable()
export class ReservasCatalogoService {
  constructor(
    private readonly prisma: PrismaService,
    // Opcional solo para los tests unitarios; Nest lo inyecta siempre.
    private readonly audit?: AuditService,
  ) {}

  // ─── Config ────────────────────────────────────────────────────────────────

  async config(businessId: string, modulo: ReservaModulo): Promise<ReservaConfig | null> {
    return this.prisma.reservaConfig.findUnique({ where: { businessId_modulo: { businessId, modulo } } });
  }

  /** La config, o 404 "este negocio no usa ese módulo". Es el gate de todo el módulo. */
  async configOFalla(businessId: string, modulo: ReservaModulo): Promise<ReservaConfig> {
    const c = await this.config(businessId, modulo);
    if (!c) throw new NotFoundException('Este negocio no tiene reservas configuradas para ese módulo.');
    return c;
  }

  async guardarConfig(businessId: string, memberId: string, dto: UpsertConfigDto): Promise<ReservaConfig> {
    const antes = await this.config(businessId, dto.modulo);
    if (dto.horario !== undefined) {
      const error = errorDeHorario(dto.horario);
      if (error) throw new BadRequestException(error);
    }
    const { modulo, horario, datos: libres, ...resto } = dto;
    const datos = {
      ...resto,
      ...(horario !== undefined ? { horario: horario as Prisma.InputJsonValue } : {}),
      ...(libres !== undefined ? { datos: libres as Prisma.InputJsonValue } : {}),
    };
    const despues = antes
      ? await this.prisma.reservaConfig.update({ where: { businessId_modulo: { businessId, modulo } }, data: datos })
      : await this.prisma.reservaConfig.create({ data: { businessId, modulo, ...datos, horario: (horario ?? HORARIO_DE_FABRICA) as Prisma.InputJsonValue } });
    await this.audit?.registrar({
      businessId, memberId, entityType: 'reserva_config', entityId: despues.id, action: antes ? 'UPDATE' : 'CREATE',
      changes: AuditService.diferencias((antes ?? {}) as Record<string, unknown>, despues as unknown as Record<string, unknown>, CAMPOS_CONFIG),
    });
    return despues;
  }

  // ─── Recursos ──────────────────────────────────────────────────────────────

  async recursos(businessId: string, modulo: ReservaModulo, conInactivos = false): Promise<ReservaRecurso[]> {
    return this.prisma.reservaRecurso.findMany({
      where: { businessId, modulo, eliminadoEn: null, ...(conInactivos ? {} : { activo: true }) },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async recurso(businessId: string, id: string): Promise<ReservaRecurso> {
    const r = await this.prisma.reservaRecurso.findFirst({ where: { id, businessId, eliminadoEn: null } });
    if (!r) throw new NotFoundException('Ese recurso no existe.');
    return r;
  }

  private validarRecurso(dto: UpsertRecursoDto, actual?: ReservaRecurso) {
    if (MODULO_DEL_TIPO[dto.tipo] !== dto.modulo) {
      throw new BadRequestException(`Un recurso de tipo ${dto.tipo} es de ${MODULO_DEL_TIPO[dto.tipo]}, no de ${dto.modulo}.`);
    }
    const tipo = dto.tipo;
    const duracion = dto.duracionMinutos === undefined ? (actual?.duracionMinutos ?? null) : dto.duracionMinutos;
    if ((tipo === 'CANCHA' || tipo === 'SALON' || tipo === 'CLASE') && !duracion) {
      throw new BadRequestException('Una cancha, un salón o una clase necesitan la duración de lo que se reserva.');
    }
    if (dto.pasoMinutos && duracion && dto.pasoMinutos > duracion) {
      throw new BadRequestException('El paso entre franjas no puede ser mayor que la duración.');
    }
    const cupo = dto.cupo ?? actual?.cupo ?? 1;
    if (tipo !== 'CLASE' && cupo !== 1) throw new BadRequestException('Solo una clase puede tener cupo mayor a 1.');
    if (dto.horario) {
      const error = errorDeHorario(dto.horario, { sesiones: tipo === 'CLASE' });
      if (error) throw new BadRequestException(error);
    }
    if (tipo === 'ALOJAMIENTO' && dto.datos) {
      const { checkIn, checkOut } = datosAlojamiento(dto.datos);
      if (checkOut >= checkIn) throw new BadRequestException('El check-out tiene que ser antes que el check-in del mismo día (para que un huésped pueda salir y otro entrar).');
    }
  }

  async crearRecurso(businessId: string, memberId: string, dto: UpsertRecursoDto): Promise<ReservaRecurso> {
    await this.configOFalla(businessId, dto.modulo);
    this.validarRecurso(dto);
    const creado = await this.prisma.reservaRecurso.create({ data: { businessId, ...this.datosRecurso(dto) } });
    await this.audit?.registrar({ businessId, memberId, entityType: 'reserva_recurso', entityId: creado.id, action: 'CREATE', changes: [{ field: 'nombre', before: null, after: creado.nombre }] });
    return creado;
  }

  /**
   * Edita un recurso con su candado tomado, como una reserva nueva: nadie
   * reserva en el medio. En una clase, lo reservado se cuida acá y no solo en
   * el panel, que puede estar mirando datos viejos (ver cuidarLoReservado).
   */
  async editarRecurso(businessId: string, memberId: string, id: string, dto: UpsertRecursoDto, ahora = new Date()): Promise<ReservaRecurso> {
    const leido = await this.recurso(businessId, id);
    if (leido.modulo !== dto.modulo) throw new BadRequestException('Un recurso no cambia de módulo.');
    this.validarRecurso(dto, leido);
    const config = await this.configOFalla(businessId, leido.modulo);
    const { antes, despues } = await this.prisma.$transaction(
      async (tx) => {
        await tomarRecurso(tx, businessId, id);
        // Con el candado puesto se vuelve a leer: es contra esto que se compara, no contra lo de antes de esperar.
        const antes = await tx.reservaRecurso.findFirstOrThrow({ where: { id, businessId } });
        this.validarRecurso(dto, antes);
        if (antes.tipo === 'CLASE') await this.cuidarLoReservado(tx, businessId, antes, dto, config, ahora);
        await tx.reservaRecurso.updateMany({ where: { id, businessId }, data: this.datosRecurso(dto) });
        return { antes, despues: await tx.reservaRecurso.findFirstOrThrow({ where: { id, businessId } }) };
      },
      TRANSACCION_CON_CANDADO,
    );
    await this.audit?.registrar({
      businessId, memberId, entityType: 'reserva_recurso', entityId: id, action: 'UPDATE',
      changes: AuditService.diferencias(antes as unknown as Record<string, unknown>, despues as unknown as Record<string, unknown>, CAMPOS_RECURSO),
    });
    return despues;
  }

  /**
   * Lo que no se le hace a una clase que tiene lugares tomados por delante:
   * bajarle el cupo por debajo de lo ya tomado en alguna fecha, o sacarle (o
   * moverle) una sesión que tiene reservas. Con el recurso ya tomado. Solo
   * mira las reservas que están en una sesión del horario actual: una que el
   * negocio cargó fuera de horario no frena el cambio.
   */
  private async cuidarLoReservado(tx: Prisma.TransactionClient, businessId: string, actual: ReservaRecurso, dto: UpsertRecursoDto, config: ReservaConfig, ahora: Date): Promise<void> {
    const bajaElCupo = dto.cupo !== undefined && dto.cupo < actual.cupo;
    const cambiaElHorario = dto.horario !== undefined;
    if (!bajaElCupo && !cambiaElHorario) return;
    const porDelante = await tx.reserva.findMany({
      where: { businessId, recursoId: actual.id, fin: { gt: ahora }, OR: [{ estado: { in: ['PENDIENTE', 'CONFIRMADA'] } }, { estado: 'RETENIDA', retenidaHasta: { gte: ahora } }] },
      select: { inicio: true, fin: true, cantidad: true },
      orderBy: { inicio: 'asc' },
    });
    if (porDelante.length === 0) return;

    // Los lugares tomados en cada fecha de cada sesión.
    const porSesion = new Map<number, { inicio: Date; fin: Date; lugares: number; reservas: number }>();
    for (const r of porDelante) {
      const s = porSesion.get(r.inicio.getTime()) ?? { inicio: r.inicio, fin: r.fin, lugares: 0, reservas: 0 };
      porSesion.set(r.inicio.getTime(), { ...s, lugares: s.lugares + r.cantidad, reservas: s.reservas + 1 });
    }
    const sesiones = [...porSesion.values()];

    if (bajaElCupo) {
      const llena = sesiones.reduce((a, b) => (b.lugares > a.lugares ? b : a));
      if (llena.lugares > dto.cupo!) {
        throw new BadRequestException(
          `El cupo no puede bajar a ${dto.cupo}: la clase del ${cuandoEs(llena)} ya tiene ${llena.lugares} ${llena.lugares === 1 ? 'lugar tomado' : 'lugares tomados'}.`,
        );
      }
    }
    if (cambiaElHorario) {
      const viejo = (actual.horario ?? config.horario) as HorarioSemanal | null;
      const nuevo = (dto.horario ?? config.horario) as HorarioSemanal | null;
      const estaEn = (h: HorarioSemanal | null, inicio: Date) => {
        const { fecha, minutos } = fechaYMinutos(inicio);
        return sesionesDelDia(h, fecha).some((sesion) => sesion[0] === minutos);
      };
      const sinSesion = sesiones.filter((s) => estaEn(viejo, s.inicio) && !estaEn(nuevo, s.inicio));
      if (sinSesion.length > 0) {
        const reservas = sinSesion.reduce((n, s) => n + s.reservas, 0);
        throw new BadRequestException(
          `Esa clase tiene ${reservas} ${reservas === 1 ? 'reserva por delante' : 'reservas por delante'} en un horario que estás sacando o moviendo (la primera, el ${cuandoEs(sinSesion[0])}). Movelas o cancelalas antes.`,
        );
      }
    }
  }

  /**
   * Borrado blando. Con reservas futuras que ocupan lugar no se borra: hay que
   * moverlas o cancelarlas antes. La cuenta y el borrado van con el recurso
   * tomado: nadie reserva entre una cosa y la otra.
   */
  async borrarRecurso(businessId: string, memberId: string, id: string, ahora = new Date()): Promise<{ ok: true }> {
    await this.recurso(businessId, id);
    await this.prisma.$transaction(
      async (tx) => {
        await tomarRecurso(tx, businessId, id);
        const futuras = await tx.reserva.count({
          where: { businessId, recursoId: id, fin: { gt: ahora }, OR: [{ estado: { in: ['PENDIENTE', 'CONFIRMADA'] } }, { estado: 'RETENIDA', retenidaHasta: { gte: ahora } }] },
        });
        if (futuras > 0) {
          throw new BadRequestException(`Tiene ${futuras} ${futuras === 1 ? 'reserva por delante' : 'reservas por delante'}. Movelas o cancelalas antes de borrarlo.`);
        }
        await tx.reservaRecurso.updateMany({ where: { id, businessId }, data: { eliminadoEn: ahora, activo: false } });
        // Sus calendarios externos y lo que habían bloqueado se van con él: no queda nada ocupando
        // noches de algo que ya no existe (la base también borra esos bloqueos en cascada).
        await tx.reservaBloqueo.deleteMany({ where: { businessId, recursoId: id, origen: 'ICAL' } });
        await tx.reservaCalendarioExterno.deleteMany({ where: { businessId, recursoId: id } });
      },
      TRANSACCION_CON_CANDADO,
    );
    await this.audit?.registrar({ businessId, memberId, entityType: 'reserva_recurso', entityId: id, action: 'DELETE' });
    return { ok: true };
  }

  private datosRecurso(dto: UpsertRecursoDto): Omit<Prisma.ReservaRecursoUncheckedCreateInput, 'businessId'> {
    const { modulo, tipo, nombre, descripcion, cupo, duracionMinutos, pasoMinutos, margenMinutos, maximoSeguidos, precio, horario, datos, memberId, orden, activo } = dto;
    return {
      modulo, tipo, nombre,
      ...(descripcion !== undefined ? { descripcion } : {}),
      ...(cupo !== undefined ? { cupo } : {}),
      ...(duracionMinutos !== undefined ? { duracionMinutos } : {}),
      ...(pasoMinutos !== undefined ? { pasoMinutos } : {}),
      ...(margenMinutos !== undefined ? { margenMinutos } : {}),
      ...(maximoSeguidos !== undefined ? { maximoSeguidos } : {}),
      ...(precio !== undefined ? { precio } : {}),
      ...(horario !== undefined ? { horario: horario === null ? Prisma.DbNull : (horario as Prisma.InputJsonValue) } : {}),
      ...(datos !== undefined ? { datos: datos === null ? Prisma.DbNull : (datos as Prisma.InputJsonValue) } : {}),
      ...(memberId !== undefined ? { memberId } : {}),
      ...(orden !== undefined ? { orden } : {}),
      ...(activo !== undefined ? { activo } : {}),
    };
  }

  // ─── Servicios ─────────────────────────────────────────────────────────────

  async servicios(businessId: string, modulo: ReservaModulo, conInactivos = false): Promise<ReservaServicio[]> {
    return this.prisma.reservaServicio.findMany({
      where: { businessId, modulo, eliminadoEn: null, ...(conInactivos ? {} : { activo: true }) },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async servicio(businessId: string, id: string): Promise<ReservaServicio> {
    const s = await this.prisma.reservaServicio.findFirst({ where: { id, businessId, eliminadoEn: null } });
    if (!s) throw new NotFoundException('Ese servicio no existe.');
    return s;
  }

  private async validarServicio(businessId: string, dto: UpsertServicioDto, salvoId?: string) {
    const repetido = await this.prisma.reservaServicio.findFirst({
      where: { businessId, modulo: dto.modulo, eliminadoEn: null, nombre: { equals: dto.nombre, mode: 'insensitive' }, ...(salvoId ? { id: { not: salvoId } } : {}) },
      select: { id: true },
    });
    if (repetido) throw new BadRequestException('Ya tenés un servicio con ese nombre.');
    if (dto.recursoIds?.length) {
      const propios = await this.prisma.reservaRecurso.count({ where: { businessId, modulo: dto.modulo, id: { in: dto.recursoIds }, eliminadoEn: null } });
      if (propios !== new Set(dto.recursoIds).size) throw new BadRequestException('Alguno de los recursos elegidos no existe.');
    }
  }

  async crearServicio(businessId: string, memberId: string, dto: UpsertServicioDto): Promise<ReservaServicio> {
    await this.configOFalla(businessId, dto.modulo);
    await this.validarServicio(businessId, dto);
    const creado = await this.prisma.reservaServicio.create({ data: { businessId, ...this.datosServicio(dto) } });
    await this.audit?.registrar({ businessId, memberId, entityType: 'reserva_servicio', entityId: creado.id, action: 'CREATE', changes: [{ field: 'nombre', before: null, after: creado.nombre }] });
    return creado;
  }

  async editarServicio(businessId: string, memberId: string, id: string, dto: UpsertServicioDto): Promise<ReservaServicio> {
    const antes = await this.servicio(businessId, id);
    if (antes.modulo !== dto.modulo) throw new BadRequestException('Un servicio no cambia de módulo.');
    await this.validarServicio(businessId, dto, id);
    await this.prisma.reservaServicio.updateMany({ where: { id, businessId }, data: this.datosServicio(dto) });
    const despues = await this.servicio(businessId, id);
    await this.audit?.registrar({
      businessId, memberId, entityType: 'reserva_servicio', entityId: id, action: 'UPDATE',
      changes: AuditService.diferencias(antes as unknown as Record<string, unknown>, despues as unknown as Record<string, unknown>, CAMPOS_SERVICIO),
    });
    return despues;
  }

  async borrarServicio(businessId: string, memberId: string, id: string, ahora = new Date()): Promise<{ ok: true }> {
    await this.servicio(businessId, id);
    // Las reservas ya dadas conservan la foto del servicio: borrarlo no las toca.
    await this.prisma.reservaServicio.updateMany({ where: { id, businessId }, data: { eliminadoEn: ahora, activo: false } });
    await this.audit?.registrar({ businessId, memberId, entityType: 'reserva_servicio', entityId: id, action: 'DELETE' });
    return { ok: true };
  }

  private datosServicio(dto: UpsertServicioDto): Omit<Prisma.ReservaServicioUncheckedCreateInput, 'businessId'> {
    const { modulo, nombre, descripcion, duracionMinutos, precio, reservableOnline, recursoIds, orden, activo } = dto;
    return {
      modulo, nombre, duracionMinutos,
      ...(descripcion !== undefined ? { descripcion } : {}),
      ...(precio !== undefined ? { precio } : {}),
      ...(reservableOnline !== undefined ? { reservableOnline } : {}),
      ...(recursoIds !== undefined ? { recursoIds: [...new Set(recursoIds)] } : {}),
      ...(orden !== undefined ? { orden } : {}),
      ...(activo !== undefined ? { activo } : {}),
    };
  }

  // ─── Bloqueos ──────────────────────────────────────────────────────────────

  async bloqueos(businessId: string, modulo: ReservaModulo, desde?: string, hasta?: string) {
    return this.prisma.reservaBloqueo.findMany({
      where: {
        businessId, modulo,
        ...(hasta ? { inicio: { lt: instante(hasta, MINUTOS_DIA) } } : {}),
        ...(desde ? { fin: { gt: instante(desde, 0) } } : {}),
      },
      orderBy: { inicio: 'asc' },
    });
  }

  /** Crea el bloqueo y dice cuántas reservas activas quedaron adentro: no las cancela, el panel decide. */
  async crearBloqueo(businessId: string, memberId: string, dto: CrearBloqueoDto): Promise<{ id: string; inicio: Date; fin: Date; afectadas: number }> {
    await this.configOFalla(businessId, dto.modulo);
    if (!esFecha(dto.fechaDesde) || (dto.fechaHasta && !esFecha(dto.fechaHasta))) throw new BadRequestException('Esa fecha no existe.');
    if (dto.recursoId) {
      const r = await this.recurso(businessId, dto.recursoId);
      if (r.modulo !== dto.modulo) throw new BadRequestException('Ese recurso es de otro módulo.');
    }
    const inicio = instante(dto.fechaDesde, dto.minutoDesde ?? 0);
    const fin = instante(dto.fechaHasta ?? dto.fechaDesde, dto.minutoHasta ?? MINUTOS_DIA);
    if (fin <= inicio) throw new BadRequestException('El fin del bloqueo tiene que ser después del inicio.');
    const creado = await this.prisma.reservaBloqueo.create({
      data: { businessId, modulo: dto.modulo, recursoId: dto.recursoId ?? null, inicio, fin, motivo: dto.motivo ?? null, creadoPorMemberId: memberId },
    });
    const afectadas = await this.prisma.reserva.count({
      where: { businessId, modulo: dto.modulo, ...(dto.recursoId ? { recursoId: dto.recursoId } : {}), estado: { in: [...OCUPAN] }, inicio: { lt: fin }, fin: { gt: inicio } },
    });
    await this.audit?.registrar({
      businessId, memberId, entityType: 'reserva_bloqueo', entityId: creado.id, action: 'CREATE',
      changes: [{ field: 'inicio', before: null, after: inicio }, { field: 'fin', before: null, after: fin }, { field: 'motivo', before: null, after: dto.motivo ?? null }],
    });
    return { id: creado.id, inicio, fin, afectadas };
  }

  async borrarBloqueo(businessId: string, memberId: string, id: string): Promise<{ ok: true }> {
    // Lo que vino de un calendario externo lo maneja la sincronización: si se quitara a mano,
    // volvería en la próxima corrida (y mientras tanto la noche quedaría libre con alguien adentro).
    const externo = await this.prisma.reservaBloqueo.findFirst({ where: { id, businessId, origen: 'ICAL' }, select: { id: true } });
    if (externo) throw new BadRequestException('Ese bloqueo viene de Airbnb: se va solo cuando Airbnb libera esas noches, o desconectando el calendario.');
    const r = await this.prisma.reservaBloqueo.deleteMany({ where: { id, businessId, origen: 'DUENO' } });
    if (r.count === 0) throw new NotFoundException('Ese bloqueo no existe.');
    await this.audit?.registrar({ businessId, memberId, entityType: 'reserva_bloqueo', entityId: id, action: 'DELETE' });
    return { ok: true };
  }
}
