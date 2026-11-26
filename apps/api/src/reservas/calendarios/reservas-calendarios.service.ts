import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ReservaCalendarioExterno, ReservaModulo } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { describeError } from '../../common/utils/describe-error.util';
import { ReservasCatalogoService, datosAlojamiento } from '../reservas-catalogo.service';
import { clasificarEvento, generarICS, leerICS, sinEco, type EventoParaExportar, type NochesExportadas } from '../dominio/ics';
import { diasEntre, fechaYMinutos, instante, sumarDias } from '../dominio/tiempo';
import { tomarRecurso, TRANSACCION_CON_CANDADO } from '../candado';
import { claveDelCalendario, descargarCalendario, errorDeUrl, urlSinClave, type Descarga } from './descarga';

// Calendarios externos: el .ics de un aviso de Airbnb conectado a un
// alojamiento. Cada sincronización baja el archivo y REEMPLAZA los bloqueos de
// ese calendario (ReservaBloqueo con origen ICAL), que el motor ya respeta al
// reservar. Reglas que no se negocian:
//
// - Si la descarga falla, se guarda el motivo y los bloqueos quedan como
//   estaban: nunca se libera una noche por un error.
// - Lo que Airbnb marca como reservado bloquea siempre. Lo que marca como "no
//   disponible" bloquea salvo que sea el eco de algo que Órbita le mostró
//   (dominio/ics.ts, sinEco): Airbnb reexporta lo que importó, y a veces lo
//   sigue publicando cuando acá ya se canceló, se movió o se desbloqueó.
// - Qué es "lo que Órbita le mostró" no se deduce de lo que hay hoy en la base:
//   se anota cada vez que alguien lee el .ics (ReservaIcalExportada). Así se
//   recuerda un bloqueo que el dueño ya borró y no se "recuerda" una retención
//   que nadie llegó a ver.
// - Los bloqueos se reemplazan con el recurso tomado (candado.ts): dos
//   sincronizaciones del mismo calendario a la vez entran de a una, y tampoco
//   se cruzan con alguien que está reservando esas noches.
// - Al panel el enlace le llega sin su clave (urlSinClave): con `reservas.view`
//   se ve qué calendario es, no se puede leer el calendario del aviso.
// - Todo filtra por negocio, menos la corrida automática, que recorre los
//   calendarios de todos.
//
// Detalle y decisiones: docs/superpowers/plans/2026-11-25-alquileres-airbnb-calendario.md.

/** Cada cuánto se vuelve a bajar un calendario. */
export const MINUTOS_ENTRE_SYNC = 30;
/** Cuántos se bajan por corrida del job de 5 minutos (de a uno, con 8 s de espera cada uno). */
export const POR_CORRIDA = 5;
export const MAXIMO_POR_RECURSO = 3;
/** Cuánto se recuerda que el .ics mostró unas noches, desde la última vez que las mostró. */
const DIAS_DE_MEMORIA_DEL_ECO = 60;
const DIA_MS = 24 * 60 * 60 * 1000;
/** Hasta cuánto para adelante se exporta. */
const DIAS_QUE_SE_EXPORTAN = 365;
/** Lo que se le dice al dueño cuando el archivo bajó pero no se pudo guardar (lo de la base no se le cuenta). */
const NO_SE_PUDO_GUARDAR = 'No se pudo guardar lo que trajo el calendario. Se vuelve a intentar solo.';

export interface ConflictoDto { reservaId: string; codigo: string; desde: string; hasta: string }

export interface CalendarioDto {
  id: string;
  recursoId: string;
  nombre: string;
  /** El enlace sin su clave: para reconocerlo, no para bajarlo. */
  url: string;
  activo: boolean;
  ultimaSync: string | null;
  ultimoError: string | null;
  /** Las noches que tiene bloqueadas de acá en adelante (lo que se libera si se desconecta). */
  noches: number;
  /** Reservas activas de Órbita que pisan noches que el calendario trae como reservadas allá. */
  conflictos: ConflictoDto[];
}

@Injectable()
export class ReservasCalendariosService {
  private readonly logger = new Logger(ReservasCalendariosService.name);

  /** La descarga, reemplazable en los tests. */
  descargar: (url: string) => Promise<Descarga> = (url) => descargarCalendario(url);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogo: ReservasCatalogoService,
    // Opcional solo para los tests unitarios; Nest lo inyecta siempre.
    private readonly audit?: AuditService,
  ) {}

  // ─── Leer ──────────────────────────────────────────────────────────────────

  async listar(businessId: string, modulo: ReservaModulo, ahora = new Date()): Promise<CalendarioDto[]> {
    const calendarios = await this.prisma.reservaCalendarioExterno.findMany({ where: { businessId, modulo }, orderBy: { createdAt: 'asc' } });
    return this.conConflictos(businessId, calendarios, ahora);
  }

  private async uno(businessId: string, id: string, ahora: Date): Promise<CalendarioDto> {
    const c = await this.prisma.reservaCalendarioExterno.findFirst({ where: { id, businessId } });
    if (!c) throw new NotFoundException('Ese calendario ya no está conectado.');
    return (await this.conConflictos(businessId, [c], ahora))[0];
  }

  /** Un conflicto es una reserva activa de acá sobre noches que allá están RESERVADAS (no las cerradas: eso suele ser el eco). */
  private async conConflictos(businessId: string, calendarios: ReservaCalendarioExterno[], ahora: Date): Promise<CalendarioDto[]> {
    if (calendarios.length === 0) return [];
    const [bloqueos, reservas] = await Promise.all([
      this.prisma.reservaBloqueo.findMany({
        where: { businessId, calendarioId: { in: calendarios.map((c) => c.id) }, fin: { gt: ahora } },
        select: { calendarioId: true, inicio: true, fin: true, externoTipo: true },
      }),
      this.prisma.reserva.findMany({
        where: {
          businessId, recursoId: { in: [...new Set(calendarios.map((c) => c.recursoId))] }, fin: { gt: ahora },
          OR: [{ estado: { in: ['PENDIENTE', 'CONFIRMADA'] } }, { estado: 'RETENIDA', retenidaHasta: { gte: ahora } }],
        },
        select: { id: true, codigo: true, recursoId: true, inicio: true, fin: true },
        orderBy: { inicio: 'asc' },
      }),
    ]);
    return calendarios.map((c) => {
      const suyos = bloqueos.filter((b) => b.calendarioId === c.id);
      const reservados = suyos.filter((b) => b.externoTipo === 'RESERVADO');
      const conflictos = reservas
        .filter((r) => r.recursoId === c.recursoId && reservados.some((b) => r.inicio < b.fin && b.inicio < r.fin))
        .map((r) => ({ reservaId: r.id, codigo: r.codigo, desde: fechaYMinutos(r.inicio).fecha, hasta: fechaYMinutos(r.fin).fecha }));
      const noches = suyos.reduce((n, b) => n + Math.max(1, diasEntre(fechaYMinutos(b.inicio).fecha, fechaYMinutos(b.fin).fecha)), 0);
      return {
        id: c.id, recursoId: c.recursoId, nombre: c.nombre, url: urlSinClave(c.url), activo: c.activo,
        ultimaSync: c.ultimaSync?.toISOString() ?? null, ultimoError: c.ultimoError, noches, conflictos,
      };
    });
  }

  // ─── Conectar y desconectar ────────────────────────────────────────────────

  async conectar(businessId: string, memberId: string, dto: { modulo: ReservaModulo; recursoId: string; nombre: string; url: string }, ahora = new Date()): Promise<CalendarioDto> {
    const url = dto.url.trim();
    const error = errorDeUrl(url);
    if (error) throw new BadRequestException(error);
    const recurso = await this.catalogo.recurso(businessId, dto.recursoId);
    if (recurso.modulo !== dto.modulo) throw new BadRequestException('Ese recurso es de otro módulo.');
    if (recurso.tipo !== 'ALOJAMIENTO') throw new BadRequestException('Por ahora se conectan calendarios solo a alojamientos.');
    const yaHay = await this.prisma.reservaCalendarioExterno.findMany({ where: { businessId, recursoId: recurso.id }, select: { url: true } });
    // El mismo aviso por otro dominio de Airbnb (.com y .com.ar) es el mismo calendario: contaría todo dos veces.
    const clave = claveDelCalendario(url);
    if (yaHay.some((c) => c.url === url || claveDelCalendario(c.url) === clave)) throw new ConflictException('Ese calendario ya está conectado a esta propiedad.');
    if (yaHay.length >= MAXIMO_POR_RECURSO) throw new BadRequestException(`Hasta ${MAXIMO_POR_RECURSO} calendarios por propiedad. Desconectá uno para sumar otro.`);

    const creado = await this.prisma.reservaCalendarioExterno.create({ data: { businessId, modulo: dto.modulo, recursoId: recurso.id, nombre: dto.nombre.trim() || 'Airbnb', url } });
    await this.audit?.registrar({ businessId, memberId, entityType: 'reserva_calendario', entityId: creado.id, action: 'CREATE', changes: [{ field: 'nombre', before: null, after: creado.nombre }] });
    // Se baja en el momento: el dueño ve enseguida si el enlace sirve y qué noches trajo.
    await this.sincronizarUno(creado, ahora);
    return this.uno(businessId, creado.id, ahora);
  }

  async desconectar(businessId: string, memberId: string, id: string): Promise<{ ok: true; bloqueos: number }> {
    const c = await this.prisma.reservaCalendarioExterno.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!c) throw new NotFoundException('Ese calendario ya no está conectado.');
    const bloqueos = await this.borrar(businessId, id);
    await this.audit?.registrar({ businessId, memberId, entityType: 'reserva_calendario', entityId: id, action: 'DELETE' });
    return { ok: true, bloqueos };
  }

  /** Borra el calendario con sus bloqueos (la base también los borra en cascada; acá queda dicho y contado). */
  private async borrar(businessId: string, id: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.reservaBloqueo.deleteMany({ where: { businessId, calendarioId: id } });
      await tx.reservaCalendarioExterno.deleteMany({ where: { id, businessId } });
      return count;
    });
  }

  // ─── Sincronizar ───────────────────────────────────────────────────────────

  /** A pedido ("Sincronizar ahora"). */
  async sincronizar(businessId: string, id: string, ahora = new Date()): Promise<CalendarioDto> {
    const c = await this.prisma.reservaCalendarioExterno.findFirst({ where: { id, businessId } });
    if (!c) throw new NotFoundException('Ese calendario ya no está conectado.');
    await this.sincronizarUno(c, ahora);
    return this.uno(businessId, id, ahora);
  }

  /**
   * La corrida automática (job de 5 minutos): los calendarios activos de TODOS
   * los negocios que nunca se bajaron o hace más de MINUTOS_ENTRE_SYNC, primero
   * los más atrasados, hasta POR_CORRIDA. De a uno, y uno que falla no frena
   * al resto.
   */
  async sincronizarVencidos(ahora = new Date()): Promise<{ revisados: number; conError: number }> {
    const limite = new Date(ahora.getTime() - MINUTOS_ENTRE_SYNC * 60_000);
    const pendientes = await this.prisma.reservaCalendarioExterno.findMany({
      where: { activo: true, OR: [{ ultimaSync: null }, { ultimaSync: { lt: limite } }] },
      orderBy: { ultimaSync: { sort: 'asc', nulls: 'first' } },
      take: POR_CORRIDA,
    });
    let conError = 0;
    for (const c of pendientes) {
      try {
        if (!(await this.sincronizarUno(c, ahora))) conError++;
      } catch (e) {
        conError++;
        this.logger.error(`Calendario ${c.id}: no se pudo sincronizar — ${describeError(e)}`);
        // Pasa al final de la cola con su motivo: si quedara primero, la corrida siguiente volvería a
        // tropezar con él y los de atrás no se bajarían nunca. Sus bloqueos no se tocan.
        await this.prisma.reservaCalendarioExterno
          .updateMany({ where: { id: c.id, businessId: c.businessId }, data: { ultimaSync: ahora, ultimoError: NO_SE_PUDO_GUARDAR } })
          .catch((otro: unknown) => this.logger.error(`Calendario ${c.id}: tampoco se pudo anotar el error — ${describeError(otro)}`));
      }
    }
    return { revisados: pendientes.length, conError };
  }

  /** Baja un calendario y reemplaza sus bloqueos. false si la descarga falló (los bloqueos no se tocan). */
  private async sincronizarUno(c: ReservaCalendarioExterno, ahora: Date): Promise<boolean> {
    const { businessId } = c;
    const bajado = await this.descargar(c.url);
    if (!bajado.ok) {
      await this.prisma.reservaCalendarioExterno.updateMany({ where: { id: c.id, businessId }, data: { ultimaSync: ahora, ultimoError: bajado.motivo.slice(0, 300) } });
      return false;
    }
    const recurso = await this.prisma.reservaRecurso.findFirst({ where: { id: c.recursoId, businessId, eliminadoEn: null }, select: { id: true, datos: true } });
    if (!recurso) {
      // La propiedad ya no existe: el calendario no tiene qué bloquear.
      await this.borrar(businessId, c.id);
      return true;
    }
    const { checkIn, checkOut } = datosAlojamiento(recurso.datos);
    const ayer = sumarDias(fechaYMinutos(ahora).fecha, -1);
    const leidos = leerICS(bajado.texto).filter((e) => e.hasta > ayer).map((e) => ({ ...e, tipo: clasificarEvento(e.titulo) }));
    const eventos = sinEco(leidos, await this.exportadas(businessId, recurso.id, ahora));

    const vistos = new Set<string>();
    const nuevos: Prisma.ReservaBloqueoCreateManyInput[] = [];
    for (const e of eventos) {
      const uid = e.uid.slice(0, 255);
      if (vistos.has(uid)) continue;
      vistos.add(uid);
      nuevos.push({
        businessId, modulo: c.modulo, recursoId: recurso.id, inicio: instante(e.desde, checkIn), fin: instante(e.hasta, checkOut),
        motivo: 'Airbnb', origen: 'ICAL', calendarioId: c.id, externoTipo: e.tipo, externoUid: uid,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Con el recurso tomado: otra sincronización de este calendario (el job y "Sincronizar ahora" a la
      // vez) espera a que esta termine, y al entrar borra lo que esta dejó. Sin esto, las dos borraban
      // primero y creaban después, y los bloqueos quedaban duplicados hasta la corrida siguiente.
      await tomarRecurso(tx, businessId, recurso.id);
      // Si lo desconectaron mientras bajaba, no se crea nada.
      const sigue = await tx.reservaCalendarioExterno.findFirst({ where: { id: c.id, businessId }, select: { id: true } });
      if (!sigue) return;
      await tx.reservaBloqueo.deleteMany({ where: { businessId, calendarioId: c.id } });
      if (nuevos.length) await tx.reservaBloqueo.createMany({ data: nuevos });
      await tx.reservaCalendarioExterno.updateMany({ where: { id: c.id, businessId }, data: { ultimaSync: ahora, ultimoError: null } });
    }, TRANSACCION_CON_CANDADO);
    return true;
  }

  // ─── Exportar ──────────────────────────────────────────────────────────────

  /**
   * El .ics de una propiedad, para pegar en Airbnb: sus reservas que ocupan y
   * los bloqueos del dueño, de ayer a un año, como eventos de día entero.
   * Solo fechas: ni nombres, ni teléfonos, ni notas, ni montos, ni el motivo
   * de un bloqueo. Nunca lo que vino de un calendario externo (sería
   * devolverle a Airbnb lo suyo). Es lo mismo que ya muestra el sitio en
   * disponibilidad/noches, por eso no lleva token.
   */
  async feed(businessId: string, recursoId: string, ahora = new Date()): Promise<string> {
    // Una propiedad pausada (activo = false) sigue publicando: las noches que ya tiene tomadas siguen tomadas.
    const recurso = await this.prisma.reservaRecurso.findFirst({ where: { id: recursoId, businessId, eliminadoEn: null }, select: { id: true, nombre: true, tipo: true, modulo: true } });
    if (!recurso || recurso.tipo !== 'ALOJAMIENTO') throw new NotFoundException('Ese calendario no existe.');
    const desde = new Date(ahora.getTime() - DIA_MS);
    const hasta = new Date(ahora.getTime() + DIAS_QUE_SE_EXPORTAN * DIA_MS);
    const [reservas, bloqueos] = await Promise.all([
      this.prisma.reserva.findMany({
        where: {
          businessId, recursoId: recurso.id, fin: { gt: desde }, inicio: { lt: hasta },
          OR: [{ estado: { in: ['PENDIENTE', 'CONFIRMADA'] } }, { estado: 'RETENIDA', retenidaHasta: { gte: ahora } }],
        },
        select: { id: true, inicio: true, fin: true },
        orderBy: { inicio: 'asc' },
      }),
      this.prisma.reservaBloqueo.findMany({
        where: { businessId, modulo: recurso.modulo, origen: 'DUENO', OR: [{ recursoId: null }, { recursoId: recurso.id }], fin: { gt: desde }, inicio: { lt: hasta } },
        select: { id: true, inicio: true, fin: true },
        orderBy: { inicio: 'asc' },
      }),
    ]);
    const evento = (x: { id: string; inicio: Date; fin: Date }, titulo: string): EventoParaExportar => ({ uid: `${x.id}@orbita.site`, titulo, ...nochesDe(x.inicio, x.fin) });
    const eventos = [...reservas.map((r) => evento(r, 'Reservado')), ...bloqueos.map((b) => evento(b, 'No disponible'))];
    await this.recordar(businessId, recurso.id, eventos, ahora);
    return generarICS(eventos, { nombre: recurso.nombre, ahora });
  }

  /**
   * Anota las noches que el .ics acaba de mostrar (la memoria del eco) y
   * olvida las que no muestra hace más de DIAS_DE_MEMORIA_DEL_ECO. Si falla,
   * el calendario se sirve igual: lo peor que pasa es que un eco no se
   * reconozca y bloquee de más, nunca de menos.
   */
  private async recordar(businessId: string, recursoId: string, eventos: NochesExportadas[], ahora: Date): Promise<void> {
    try {
      if (eventos.length) {
        await this.prisma.reservaIcalExportada.createMany({ data: eventos.map((e) => ({ businessId, recursoId, desde: e.desde, hasta: e.hasta, ultimaVez: ahora })), skipDuplicates: true });
        await this.prisma.reservaIcalExportada.updateMany({ where: { businessId, recursoId, OR: eventos.map((e) => ({ desde: e.desde, hasta: e.hasta })) }, data: { ultimaVez: ahora } });
      }
      await this.prisma.reservaIcalExportada.deleteMany({ where: { businessId, recursoId, ultimaVez: { lt: new Date(ahora.getTime() - DIAS_DE_MEMORIA_DEL_ECO * DIA_MS) } } });
    } catch (e) {
      this.logger.error(`Calendario de ${recursoId}: no se pudo anotar lo exportado — ${describeError(e)}`);
    }
  }

  /**
   * Las noches que el .ics de este recurso mostró en los últimos
   * DIAS_DE_MEMORIA_DEL_ECO días: lo que Airbnb pudo haber importado, exista o
   * no todavía acá. Sale de lo anotado en cada lectura (recordar), no del
   * estado actual de las reservas y los bloqueos.
   */
  private async exportadas(businessId: string, recursoId: string, ahora: Date): Promise<NochesExportadas[]> {
    return this.prisma.reservaIcalExportada.findMany({
      where: { businessId, recursoId, ultimaVez: { gt: new Date(ahora.getTime() - DIAS_DE_MEMORIA_DEL_ECO * DIA_MS) } },
      select: { desde: true, hasta: true },
    });
  }
}

/** El rango de noches de una reserva o de un bloqueo: del día en que empieza al día en que termina (la salida, exclusiva). */
export function nochesDe(inicio: Date, fin: Date): NochesExportadas {
  const desde = fechaYMinutos(inicio).fecha;
  const hasta = fechaYMinutos(fin).fecha;
  return { desde, hasta: hasta > desde ? hasta : sumarDias(desde, 1) };
}
