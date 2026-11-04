import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Reserva, ReservaActor, ReservaEstado, ReservaEspera, ReservaModulo, ReservaOrigen } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { describeError } from '../common/utils/describe-error.util';
import { ReservasCatalogoService, datosAlojamiento } from './reservas-catalogo.service';
import { DisponibilidadService, type Modo, type ReglasDelRecurso } from './disponibilidad.service';
import { ReservasAvisosService } from './reservas-avisos.service';
import { desdeDonde, ETIQUETA, mensajeTransicion, OCUPAN } from './dominio/estados';
import { aperturaDelDia, sesionesDelDia } from './dominio/horario';
import { extrasElegidos, precioTotal, sena as calcularSena, type ExtraElegido } from './dominio/precio';
import { diasEntre, esFecha, fechaYMinutos, instante } from './dominio/tiempo';
import { generarCodigo, generarToken } from './dominio/codigos';
import type { PedidoReservaDto } from './dto/reservas.dto';
import { PoliticaDto } from './reservas.types';

type Db = Prisma.TransactionClient | PrismaService;

export interface DatosCliente {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
}

export interface OpcionesCrear {
  estado: 'RETENIDA' | 'PENDIENTE' | 'CONFIRMADA';
  origen: ReservaOrigen;
  actor: ReservaActor;
  memberId?: string;
  cliente?: DatosCliente;
  clienteId?: string;
  clave?: string;
  notas?: string;
  notaInterna?: string;
  fueraDeHorario?: boolean;
  precioManual?: number;
}

export type SenaAlCancelar = 'DEVUELTA' | 'PERDIDA' | 'SIN_SENA';

interface PedidoResuelto {
  reglas: ReglasDelRecurso;
  inicio: Date;
  fin: Date;
  fecha: string;
  cantidad: number;
  precio: number;
  sena: number;
  extras: ExtraElegido[];
  servicio: { id: string; nombre: string; duracionMinutos: number; precio: number } | null;
}

interface FilaRecurso { id: string; cupo: number; activo: boolean; nombre: string }

const INTENTOS_CODIGO = 5;
const HORA_MS = 3_600_000;
const MAX_DIAS_LISTADO = 93;

// El motor de reservas: el único lugar que crea, mueve y cierra reservas de
// los tres módulos. Cómo se defiende (ver README.md):
//
// - Crear y reprogramar corren en una transacción que PRIMERO toma el candado
//   de la fila del recurso (SELECT … FOR UPDATE). Dos pedidos sobre el mismo
//   recurso entran de a uno: el segundo espera al primero y, cuando cuenta,
//   ya ve la reserva nueva y recibe 409. Debajo, la base tiene la restricción
//   de exclusión para los recursos exclusivos: si algún camino se la saltea,
//   el INSERT falla igual (23P01 → 409).
// - Antes de contar se vencen las retenidas pasadas de ese recurso: un lugar
//   que alguien dejó a medias se libera solo, sin esperar al cron.
// - Toda transición de estado es un compare-and-set (updateMany con el estado
//   de partida y, si viene, la version): nunca se pisa lo que otro hizo.
// - La clave de idempotencia hace que repetir un pedido devuelva la misma
//   reserva en vez de crear dos.
@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogo: ReservasCatalogoService,
    private readonly disponibilidad: DisponibilidadService,
    private readonly avisos: ReservasAvisosService,
    // Opcional solo para los tests unitarios; Nest lo inyecta siempre.
    private readonly audit?: AuditService,
  ) {}

  // ─── Resolver qué se pide ──────────────────────────────────────────────────

  /**
   * Traduce el pedido (recurso, día, hora, servicio…) a un rango de instantes
   * con su precio, verificando todo lo que no necesita el candado: que el
   * recurso y el servicio existan y estén activos, que el horario caiga en la
   * apertura y en la grilla, la anticipación mínima y máxima, los bloqueos.
   */
  async resolverPedido(
    businessId: string,
    pedido: PedidoReservaDto,
    modo: Modo,
    ahora: Date,
    opciones: { fueraDeHorario?: boolean; precioManual?: number } = {},
  ): Promise<PedidoResuelto> {
    if (!esFecha(pedido.fecha) || (pedido.fechaHasta && !esFecha(pedido.fechaHasta))) throw new BadRequestException('Esa fecha no existe.');
    const reglas = await this.disponibilidad.reglasDe(businessId, pedido.modulo, pedido.recursoId, pedido.servicioId, pedido.duracionMinutos);
    const { config, recurso, servicio } = reglas;
    if (modo === 'publico' && !config.activo) throw new NotFoundException('Las reservas online están pausadas por el momento.');
    if (!recurso.activo) throw new BadRequestException(`${recurso.nombre} no está disponible por el momento.`);
    if (modo === 'publico' && servicio && !servicio.reservableOnline) throw new BadRequestException(`${servicio.nombre} se reserva solo por el negocio.`);
    const cantidad = pedido.cantidad ?? 1;
    if (cantidad > recurso.cupo) throw new BadRequestException(recurso.cupo === 1 ? 'Acá se reserva de a un lugar.' : `Hay ${recurso.cupo} lugares como máximo.`);

    let inicio: Date;
    let fin: Date;
    let unidades = 1;
    if (recurso.tipo === 'ALOJAMIENTO') {
      if (!pedido.fechaHasta) throw new BadRequestException('Decinos hasta qué día (check-out).');
      const noches = diasEntre(pedido.fecha, pedido.fechaHasta);
      const { checkIn, checkOut, nochesMinimas } = datosAlojamiento(recurso.datos);
      if (noches < 1) throw new BadRequestException('El check-out tiene que ser después del check-in.');
      if (noches < nochesMinimas) throw new BadRequestException(`La estadía mínima es de ${nochesMinimas} ${nochesMinimas === 1 ? 'noche' : 'noches'}.`);
      inicio = instante(pedido.fecha, checkIn);
      fin = instante(pedido.fechaHasta, checkOut);
      unidades = noches;
    } else {
      if (pedido.inicioMinutos === undefined) throw new BadRequestException('Elegí un horario.');
      const m = pedido.inicioMinutos;
      if (recurso.tipo === 'CLASE') {
        const sesion = sesionesDelDia(reglas.horario, pedido.fecha).find((s) => s[0] === m);
        if (!sesion && !opciones.fueraDeHorario) throw new BadRequestException('Ese día no hay clase a esa hora.');
        inicio = instante(pedido.fecha, m);
        fin = instante(pedido.fecha, sesion ? sesion[1] : m + reglas.duracionBase);
      } else {
        inicio = instante(pedido.fecha, m);
        fin = new Date(inicio.getTime() + reglas.duracion * 60_000);
        unidades = reglas.duracion / reglas.duracionBase;
        if (!opciones.fueraDeHorario) {
          const apertura = aperturaDelDia(reglas.horario, pedido.fecha);
          const tramo = apertura.find(([a, b]) => m >= a && m + reglas.duracion <= b);
          if (!tramo) throw new BadRequestException(apertura.length === 0 ? 'Ese día está cerrado.' : 'Ese horario está fuera de la apertura.');
          if ((m - tramo[0]) % reglas.paso !== 0) throw new BadRequestException(`Los horarios arrancan cada ${reglas.paso} minutos.`);
        }
      }
    }

    // Anticipación: en el sitio, ni demasiado pronto ni demasiado lejos. En el
    // panel se puede registrar algo que ya pasó (hasta un día atrás).
    if (modo === 'publico') {
      const minimo = ahora.getTime() + config.anticipacionMinimaMinutos * 60_000;
      if (inicio.getTime() < minimo) {
        throw new BadRequestException(inicio < ahora ? 'Ese horario ya pasó.' : `Hay que reservar con al menos ${describirMinutos(config.anticipacionMinimaMinutos)} de anticipación.`);
      }
      if (diasEntre(fechaYMinutos(ahora).fecha, pedido.fecha) > config.anticipacionMaximaDias) {
        throw new BadRequestException(`Se puede reservar hasta ${config.anticipacionMaximaDias} días adelante.`);
      }
    } else if (inicio.getTime() < ahora.getTime() - 24 * HORA_MS) {
      throw new BadRequestException('Ese horario ya pasó.');
    }

    const bloqueos = await this.disponibilidad.bloqueosEntre(businessId, pedido.modulo, recurso.id, inicio, fin);
    if (bloqueos.length > 0) throw new BadRequestException('Ese horario está bloqueado por el negocio.');

    const datos = (recurso.datos && typeof recurso.datos === 'object' ? recurso.datos : {}) as Record<string, unknown>;
    const extras = extrasElegidos(datos.extras, pedido.extras);
    const base = servicio ? Number(servicio.precio) : Number(recurso.precio);
    const precio = opciones.precioManual ?? precioTotal(base, recurso.tipo === 'CLASE' ? cantidad : unidades, extras);
    return {
      reglas, inicio, fin, fecha: fechaYMinutos(inicio).fecha, cantidad, precio,
      sena: calcularSena(precio, config.senaPorcentaje), extras,
      servicio: servicio ? { id: servicio.id, nombre: servicio.nombre, duracionMinutos: servicio.duracionMinutos, precio: Number(servicio.precio) } : null,
    };
  }

  // ─── Crear ────────────────────────────────────────────────────────────────

  /**
   * La única forma de crear una reserva. Si viene `clave` y ya existe una
   * reserva con esa clave en el negocio, la devuelve sin crear otra.
   */
  async crear(businessId: string, pedido: PedidoReservaDto, o: OpcionesCrear, ahora = new Date()): Promise<Reserva> {
    if (o.clave) {
      const repetida = await this.prisma.reserva.findUnique({ where: { businessId_claveIdempotencia: { businessId, claveIdempotencia: o.clave } } });
      if (repetida) return repetida;
    }
    const modo: Modo = o.origen === 'PANEL' ? 'panel' : 'publico';
    const p = await this.resolverPedido(businessId, pedido, modo, ahora, { fueraDeHorario: o.fueraDeHorario, precioManual: o.precioManual });
    const { config, recurso } = p.reglas;

    let cliente: DatosCliente | null = o.cliente ?? null;
    let clienteId: string | null = null;
    if (o.clienteId) {
      const ficha = await this.prisma.customer.findFirst({ where: { id: o.clienteId, businessId, deletedAt: null } });
      if (!ficha) throw new BadRequestException('Esa ficha de cliente no existe.');
      clienteId = ficha.id;
      cliente ??= { nombre: [ficha.firstName, ficha.lastName].filter(Boolean).join(' '), telefono: ficha.phone, email: ficha.email };
    }
    if (o.estado !== 'RETENIDA' && !cliente) throw new BadRequestException('Elegí un cliente o cargá sus datos.');
    if (cliente && o.origen === 'TIENDA') await this.verificarTope(businessId, config.maximoActivasPorCliente, cliente, ahora);
    if (cliente && !clienteId) clienteId = await this.vincularCliente(businessId, cliente);

    for (let intento = 1; ; intento++) {
      try {
        const creada = await this.prisma.$transaction(
          async (tx) => {
            await this.tomarRecurso(tx, businessId, recurso.id);
            await this.vencerRetenidasDe(tx, businessId, recurso.id, ahora);
            await this.verificarLugar(tx, businessId, p, ahora);
            const reserva = await tx.reserva.create({
              data: {
                businessId, modulo: pedido.modulo, recursoId: recurso.id, servicioId: p.servicio?.id ?? null,
                codigo: generarCodigo(), tokenAcceso: generarToken(), estado: o.estado, origen: o.origen,
                inicio: p.inicio, fin: p.fin, fecha: p.fecha, cantidad: p.cantidad, exclusivo: recurso.cupo === 1,
                retenidaHasta: o.estado === 'RETENIDA' ? new Date(ahora.getTime() + config.retencionMinutos * 60_000) : null,
                clienteId, clienteNombre: cliente?.nombre ?? '', clienteTelefono: cliente?.telefono ?? null, clienteEmail: cliente?.email?.toLowerCase() ?? null,
                notas: o.notas ?? null, notaInterna: o.notaInterna ?? null,
                servicio: p.servicio ? (p.servicio as Prisma.InputJsonValue) : Prisma.DbNull,
                extras: p.extras.length ? (p.extras as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
                precio: p.precio, sena: p.sena,
                confirmadaEn: o.estado === 'CONFIRMADA' ? ahora : null,
                claveIdempotencia: o.clave ?? null, creadaPorMemberId: o.memberId ?? null,
              },
            });
            await tx.reservaHistorial.create({ data: { businessId, reservaId: reserva.id, de: null, a: o.estado, quien: o.actor, memberId: o.memberId ?? null } });
            return reserva;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 15000 },
        );
        if (o.origen === 'PANEL') {
          await this.audit?.registrar({ businessId, memberId: o.memberId, entityType: 'reserva', entityId: creada.id, action: 'CREATE', changes: [{ field: 'estado', before: null, after: creada.estado }, { field: 'inicio', before: null, after: creada.inicio }] });
        }
        if (creada.estado === 'CONFIRMADA') void this.avisos.confirmada(creada, recurso.nombre);
        if (creada.estado === 'PENDIENTE') void this.avisos.pendiente(creada, recurso.nombre);
        return creada;
      } catch (e) {
        const choque = this.choqueDeUnico(e);
        if (choque === 'clave' && o.clave) {
          const repetida = await this.prisma.reserva.findUnique({ where: { businessId_claveIdempotencia: { businessId, claveIdempotencia: o.clave } } });
          if (repetida) return repetida;
        }
        if (choque === 'codigo' && intento < INTENTOS_CODIGO) continue;
        throw this.traducirError(e, recurso.cupo);
      }
    }
  }

  /** Sitio: tomar el lugar mientras la persona carga sus datos. */
  retener(businessId: string, pedido: PedidoReservaDto, clave: string, notas?: string, clienteId?: string, ahora = new Date()): Promise<Reserva> {
    return this.crear(businessId, pedido, { estado: 'RETENIDA', origen: 'TIENDA', actor: 'CLIENTE', clave, notas, clienteId }, ahora);
  }

  /** Sitio: reservar en un paso, con los datos ya cargados. */
  async reservar(businessId: string, pedido: PedidoReservaDto, clave: string, cliente: DatosCliente, notas?: string, clienteId?: string, ahora = new Date()): Promise<Reserva> {
    const config = await this.catalogo.configOFalla(businessId, pedido.modulo);
    return this.crear(businessId, pedido, {
      estado: config.confirmacion === 'MANUAL' ? 'PENDIENTE' : 'CONFIRMADA', origen: 'TIENDA', actor: 'CLIENTE', clave, cliente, notas, clienteId,
    }, ahora);
  }

  /** Sitio, paso 2: la retenida pasa a firme (o a pendiente si el negocio confirma a mano) con los datos de la persona. */
  async confirmarRetenida(businessId: string, token: string, cliente: DatosCliente, notas?: string, clienteIdSesion?: string, ahora = new Date()): Promise<Reserva> {
    const r = await this.porTokenOFalla(businessId, token);
    if (r.estado === 'CONFIRMADA' || r.estado === 'PENDIENTE') return r; // dos clics en "Confirmar"
    if (r.estado !== 'RETENIDA') throw new ConflictException(`La reserva está ${ETIQUETA[r.estado]}.`);
    if (!r.retenidaHasta || r.retenidaHasta < ahora) {
      await this.prisma.reserva.updateMany({ where: { id: r.id, businessId, estado: 'RETENIDA' }, data: { estado: 'VENCIDA', version: { increment: 1 } } });
      throw new ConflictException('Se venció el tiempo para confirmar. Elegí el horario de nuevo.');
    }
    const config = await this.catalogo.configOFalla(businessId, r.modulo);
    await this.verificarTope(businessId, config.maximoActivasPorCliente, cliente, ahora, r.id);
    const clienteId = clienteIdSesion ?? (await this.vincularCliente(businessId, cliente));
    const estado: ReservaEstado = config.confirmacion === 'MANUAL' ? 'PENDIENTE' : 'CONFIRMADA';
    const cambio = await this.prisma.reserva.updateMany({
      where: { id: r.id, businessId, estado: 'RETENIDA', retenidaHasta: { gte: ahora } },
      data: {
        estado, retenidaHasta: null, confirmadaEn: estado === 'CONFIRMADA' ? ahora : null, version: { increment: 1 },
        clienteId, clienteNombre: cliente.nombre, clienteTelefono: cliente.telefono ?? null, clienteEmail: cliente.email?.toLowerCase() ?? null,
        ...(notas !== undefined ? { notas } : {}),
      },
    });
    if (cambio.count === 0) {
      const actual = await this.porTokenOFalla(businessId, token);
      if (actual.estado === 'CONFIRMADA' || actual.estado === 'PENDIENTE') return actual;
      throw new ConflictException(actual.estado === 'RETENIDA' ? 'Se venció el tiempo para confirmar. Elegí el horario de nuevo.' : `La reserva está ${ETIQUETA[actual.estado]}.`);
    }
    await this.prisma.reservaHistorial.create({ data: { businessId, reservaId: r.id, de: 'RETENIDA', a: estado, quien: 'CLIENTE' } });
    const final = await this.porTokenOFalla(businessId, token);
    const recurso = await this.catalogo.recurso(businessId, final.recursoId).catch(() => null);
    if (estado === 'CONFIRMADA') void this.avisos.confirmada(final, recurso?.nombre ?? '');
    else void this.avisos.pendiente(final, recurso?.nombre ?? '');
    return final;
  }

  // ─── Cancelar ─────────────────────────────────────────────────────────────

  /**
   * Cancela y, si el negocio tiene lista de espera, le da el lugar al primero
   * que esperaba por ese mismo horario (dentro de la misma transacción, con el
   * recurso tomado: nadie se mete en el medio).
   */
  async cancelar(
    businessId: string,
    quien: { id: string } | { token: string },
    o: { actor: ReservaActor; memberId?: string; motivo?: string; mantenerSena?: boolean; version?: number },
    ahora = new Date(),
  ): Promise<{ reserva: Reserva; sena: SenaAlCancelar; promovida: Reserva | null }> {
    const r = 'id' in quien ? await this.porIdOFalla(businessId, quien.id) : await this.porTokenOFalla(businessId, quien.token);
    if (r.estado === 'CANCELADA') return { reserva: r, sena: 'SIN_SENA', promovida: null }; // dos clics en "Cancelar"
    if (!OCUPAN.includes(r.estado)) throw new ConflictException(mensajeTransicion(r.estado, 'CANCELADA'));
    const config = await this.catalogo.configOFalla(businessId, r.modulo);
    const recurso = await this.catalogo.recurso(businessId, r.recursoId);

    let sena: SenaAlCancelar = 'SIN_SENA';
    if (o.actor === 'CLIENTE') {
      if (r.inicio <= ahora) throw new BadRequestException('La reserva ya empezó: no se puede cancelar desde acá.');
      const politica = this.politica(r, config, ahora);
      if (!politica.puedeCancelar) throw new BadRequestException(politica.motivo ?? 'Ya no se puede cancelar: comunicate con el negocio.');
      if (Number(r.pagado) > 0) sena = politica.senaSiCancela;
    } else if (Number(r.pagado) > 0) {
      sena = o.mantenerSena ? 'PERDIDA' : 'DEVUELTA';
    }

    const resultado = await this.prisma.$transaction(
      async (tx) => {
        await this.tomarRecurso(tx, businessId, recurso.id);
        const cambio = await tx.reserva.updateMany({
          where: { id: r.id, businessId, estado: { in: [...OCUPAN] }, ...(o.version ? { version: o.version } : {}) },
          data: { estado: 'CANCELADA', canceladaEn: ahora, canceladaPor: o.actor, motivoCancelacion: o.motivo ?? null, retenidaHasta: null, version: { increment: 1 } },
        });
        if (cambio.count === 0) return null;
        await tx.reservaHistorial.create({
          data: { businessId, reservaId: r.id, de: r.estado, a: 'CANCELADA', quien: o.actor, memberId: o.memberId ?? null, motivo: o.motivo ?? null, datos: { sena, pagado: Number(r.pagado) } },
        });
        const promovida = config.listaDeEspera && r.estado !== 'RETENIDA' ? await this.promoverEspera(tx, businessId, recurso, r.inicio, r.fin, config.senaPorcentaje, ahora) : null;
        const reserva = await tx.reserva.findFirstOrThrow({ where: { id: r.id, businessId } });
        return { reserva, promovida };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 15000 },
    );
    if (!resultado) {
      const actual = await this.porIdOFalla(businessId, r.id);
      if (actual.estado === 'CANCELADA') return { reserva: actual, sena: 'SIN_SENA', promovida: null };
      throw new ConflictException(o.version && actual.version !== o.version ? 'La reserva cambió mientras la mirabas. Volvé a cargarla.' : mensajeTransicion(actual.estado, 'CANCELADA'));
    }
    if (o.actor === 'NEGOCIO') {
      await this.audit?.registrar({ businessId, memberId: o.memberId, entityType: 'reserva', entityId: r.id, action: 'UPDATE', changes: [{ field: 'estado', before: r.estado, after: 'CANCELADA' }, { field: 'sena', before: null, after: sena }] });
    }
    if (r.estado !== 'RETENIDA') void this.avisos.cancelada(resultado.reserva, recurso.nombre, sena);
    if (resultado.promovida) void this.avisos.lugarTomado(resultado.promovida, recurso.nombre);
    return { ...resultado, sena };
  }

  // ─── Reprogramar ──────────────────────────────────────────────────────────

  async reprogramar(
    businessId: string,
    quien: { id: string } | { token: string },
    cambio: { fecha: string; inicioMinutos?: number; fechaHasta?: string; recursoId?: string; fueraDeHorario?: boolean; version?: number },
    o: { actor: ReservaActor; memberId?: string },
    ahora = new Date(),
  ): Promise<Reserva> {
    const r = 'id' in quien ? await this.porIdOFalla(businessId, quien.id) : await this.porTokenOFalla(businessId, quien.token);
    if (r.estado !== 'CONFIRMADA' && r.estado !== 'PENDIENTE') throw new ConflictException(`La reserva está ${ETIQUETA[r.estado]}: no se puede mover.`);
    const config = await this.catalogo.configOFalla(businessId, r.modulo);
    if (o.actor === 'CLIENTE') {
      const politica = this.politica(r, config, ahora);
      if (!politica.puedeReprogramar) throw new BadRequestException(politica.motivo ?? 'Ya no se puede reprogramar: comunicate con el negocio.');
    }
    const recursoViejo = await this.catalogo.recurso(businessId, r.recursoId);
    const recursoId = cambio.recursoId ?? r.recursoId;
    if (recursoId !== r.recursoId) {
      const nuevo = await this.catalogo.recurso(businessId, recursoId);
      if (nuevo.modulo !== r.modulo || nuevo.tipo !== recursoViejo.tipo) throw new BadRequestException('Solo se puede cambiar a otro del mismo tipo.');
    }
    const duracionActual = Math.round((r.fin.getTime() - r.inicio.getTime()) / 60_000);
    const servicioSnap = r.servicio && typeof r.servicio === 'object' ? (r.servicio as { id?: string }) : null;
    const p = await this.resolverPedido(
      businessId,
      {
        modulo: r.modulo, recursoId, servicioId: servicioSnap?.id ?? undefined, fecha: cambio.fecha, inicioMinutos: cambio.inicioMinutos,
        fechaHasta: cambio.fechaHasta, cantidad: r.cantidad,
        // Canchas: la misma cantidad de franjas que tenía.
        duracionMinutos: recursoViejo.tipo === 'CANCHA' || recursoViejo.tipo === 'SALON' ? duracionActual : undefined,
      },
      o.actor === 'CLIENTE' ? 'publico' : 'panel',
      ahora,
      { fueraDeHorario: o.actor === 'NEGOCIO' ? cambio.fueraDeHorario : false },
    ).catch((e) => {
      // Un servicio borrado después de reservar no impide mover el turno.
      if (e instanceof NotFoundException && servicioSnap?.id) throw new BadRequestException('El servicio de esta reserva ya no existe: cancelala y creá una nueva.');
      throw e;
    });
    if (p.inicio.getTime() === r.inicio.getTime() && p.fin.getTime() === r.fin.getTime() && recursoId === r.recursoId) return r;
    // El precio solo se recalcula si cambió la cantidad de noches (alojamientos); lo demás queda como se pactó.
    const precioNuevo = recursoViejo.tipo === 'ALOJAMIENTO' && p.precio !== Number(r.precio) ? p.precio : null;

    try {
      const movida = await this.prisma.$transaction(
        async (tx) => {
          // Los dos recursos, siempre en el mismo orden, para que dos movimientos cruzados no se traben entre sí.
          for (const id of [...new Set([r.recursoId, recursoId])].sort()) await this.tomarRecurso(tx, businessId, id);
          await this.vencerRetenidasDe(tx, businessId, recursoId, ahora);
          await this.verificarLugar(tx, businessId, p, ahora, r.id);
          const res = await tx.reserva.updateMany({
            where: { id: r.id, businessId, estado: { in: ['CONFIRMADA', 'PENDIENTE'] }, ...(cambio.version ? { version: cambio.version } : {}) },
            data: {
              recursoId, inicio: p.inicio, fin: p.fin, fecha: p.fecha, version: { increment: 1 },
              ...(o.actor === 'CLIENTE' ? { reprogramaciones: { increment: 1 } } : {}),
              ...(precioNuevo !== null ? { precio: precioNuevo, sena: p.sena } : {}),
            },
          });
          if (res.count === 0) return null;
          await tx.reservaHistorial.create({
            data: {
              businessId, reservaId: r.id, de: r.estado, a: r.estado, quien: o.actor, memberId: o.memberId ?? null, motivo: 'Reprogramada.',
              datos: { antes: { recursoId: r.recursoId, inicio: r.inicio.toISOString(), fin: r.fin.toISOString() }, despues: { recursoId, inicio: p.inicio.toISOString(), fin: p.fin.toISOString() } },
            },
          });
          return tx.reserva.findFirstOrThrow({ where: { id: r.id, businessId } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 15000 },
      );
      if (!movida) {
        const actual = await this.porIdOFalla(businessId, r.id);
        throw new ConflictException(cambio.version && actual.version !== cambio.version ? 'La reserva cambió mientras la mirabas. Volvé a cargarla.' : `La reserva está ${ETIQUETA[actual.estado]}: no se puede mover.`);
      }
      if (o.actor === 'NEGOCIO') {
        await this.audit?.registrar({ businessId, memberId: o.memberId, entityType: 'reserva', entityId: r.id, action: 'UPDATE', changes: [{ field: 'inicio', before: r.inicio, after: movida.inicio }, { field: 'recursoId', before: r.recursoId, after: movida.recursoId }] });
      }
      void this.avisos.reprogramada(movida, p.reglas.recurso.nombre, { inicio: r.inicio, fin: r.fin });
      return movida;
    } catch (e) {
      throw this.traducirError(e, p.reglas.recurso.cupo);
    }
  }

  // ─── Transiciones del panel ───────────────────────────────────────────────

  /** PENDIENTE → CONFIRMADA, CONFIRMADA → COMPLETADA o AUSENTE. Idempotente: repetirla devuelve la reserva tal cual. */
  async transicionPanel(businessId: string, id: string, memberId: string, a: 'CONFIRMADA' | 'COMPLETADA' | 'AUSENTE', o: { motivo?: string; version?: number } = {}, ahora = new Date()): Promise<Reserva> {
    const r = await this.porIdOFalla(businessId, id);
    if (r.estado === a) return r;
    if ((a === 'COMPLETADA' || a === 'AUSENTE') && r.inicio > ahora) throw new BadRequestException('Todavía no es la hora: no se puede marcar como atendida ni ausente.');
    const desde = desdeDonde(a).filter((d) => d !== 'RETENIDA'); // una retenida la confirma el cliente, no el panel
    const cambio = await this.prisma.reserva.updateMany({
      where: { id, businessId, estado: { in: desde }, ...(o.version ? { version: o.version } : {}) },
      data: {
        estado: a, version: { increment: 1 },
        ...(a === 'CONFIRMADA' ? { confirmadaEn: ahora, retenidaHasta: null } : {}),
        ...(a === 'COMPLETADA' ? { completadaEn: ahora } : {}),
      },
    });
    if (cambio.count === 0) {
      const actual = await this.porIdOFalla(businessId, id);
      if (actual.estado === a) return actual;
      throw new ConflictException(o.version && actual.version !== o.version ? 'La reserva cambió mientras la mirabas. Volvé a cargarla.' : mensajeTransicion(actual.estado, a));
    }
    await this.prisma.reservaHistorial.create({ data: { businessId, reservaId: id, de: r.estado, a, quien: 'NEGOCIO', memberId, motivo: o.motivo ?? null } });
    await this.audit?.registrar({ businessId, memberId, entityType: 'reserva', entityId: id, action: 'UPDATE', changes: [{ field: 'estado', before: r.estado, after: a }] });
    const final = await this.porIdOFalla(businessId, id);
    if (a === 'CONFIRMADA') {
      const recurso = await this.catalogo.recurso(businessId, final.recursoId).catch(() => null);
      void this.avisos.confirmada(final, recurso?.nombre ?? '');
    }
    return final;
  }

  async registrarPago(businessId: string, id: string, memberId: string, pago: { monto: number; metodo: string; referencia?: string }, ahora = new Date()): Promise<Reserva> {
    const r = await this.porIdOFalla(businessId, id);
    if (!['PENDIENTE', 'CONFIRMADA', 'COMPLETADA'].includes(r.estado)) throw new BadRequestException(`La reserva está ${ETIQUETA[r.estado]}: no se le registran pagos.`);
    const total = Number(r.precio);
    const pagado = Number(r.pagado) + pago.monto;
    if (total > 0 && pagado > total + 0.009) throw new BadRequestException(`Con ese monto se pasa del total (${total}). Ya pagó ${Number(r.pagado)}.`);
    const cambio = await this.prisma.reserva.updateMany({ where: { id, businessId, pagado: r.pagado }, data: { pagado, pagoMetodo: pago.metodo } });
    if (cambio.count === 0) throw new ConflictException('Alguien registró un pago al mismo tiempo. Volvé a cargar la reserva.');
    await this.prisma.reservaHistorial.create({
      data: { businessId, reservaId: id, de: r.estado, a: r.estado, quien: 'NEGOCIO', memberId, motivo: `Pago registrado: ${pago.monto} (${pago.metodo}).`, datos: { monto: pago.monto, metodo: pago.metodo, referencia: pago.referencia ?? null, en: ahora.toISOString() } },
    });
    await this.audit?.registrar({ businessId, memberId, entityType: 'reserva', entityId: id, action: 'UPDATE', changes: [{ field: 'pagado', before: Number(r.pagado), after: pagado }] });
    return this.porIdOFalla(businessId, id);
  }

  async nota(businessId: string, id: string, memberId: string, notaInterna: string | null): Promise<Reserva> {
    const r = await this.porIdOFalla(businessId, id);
    await this.prisma.reserva.updateMany({ where: { id, businessId }, data: { notaInterna } });
    await this.audit?.registrar({ businessId, memberId, entityType: 'reserva', entityId: id, action: 'UPDATE', changes: [{ field: 'notaInterna', before: r.notaInterna, after: notaInterna }] });
    return this.porIdOFalla(businessId, id);
  }

  // ─── Leer ─────────────────────────────────────────────────────────────────

  async porIdOFalla(businessId: string, id: string): Promise<Reserva> {
    const r = await this.prisma.reserva.findFirst({ where: { id, businessId } });
    if (!r) throw new NotFoundException('Esa reserva no existe.');
    return r;
  }

  async porTokenOFalla(businessId: string, token: string): Promise<Reserva> {
    const r = await this.prisma.reserva.findFirst({ where: { tokenAcceso: token, businessId } });
    if (!r) throw new NotFoundException('Esa reserva no existe.');
    return r;
  }

  async historial(businessId: string, reservaId: string) {
    return this.prisma.reservaHistorial.findMany({ where: { businessId, reservaId }, orderBy: { createdAt: 'asc' } });
  }

  /** Qué puede hacer el cliente con su reserva ahora, según las reglas del negocio. */
  politica(r: Reserva, config: { cancelacionHastaHoras: number; reprogramacionHastaHoras: number; reprogramacionesMaximas: number; senaReembolsable: boolean }, ahora: Date): PoliticaDto {
    const activa = (r.estado === 'CONFIRMADA' || r.estado === 'PENDIENTE') && r.inicio > ahora;
    const cancelarHasta = new Date(r.inicio.getTime() - config.cancelacionHastaHoras * HORA_MS);
    const reprogramarHasta = new Date(r.inicio.getTime() - config.reprogramacionHastaHoras * HORA_MS);
    const puedeCancelar = activa && ahora <= cancelarHasta;
    const restantes = Math.max(0, config.reprogramacionesMaximas - r.reprogramaciones);
    const puedeReprogramar = activa && ahora <= reprogramarHasta && restantes > 0;
    let motivo: string | null = null;
    if (!activa) motivo = r.estado === 'CONFIRMADA' || r.estado === 'PENDIENTE' ? 'La reserva ya empezó.' : `La reserva está ${ETIQUETA[r.estado]}.`;
    else if (!puedeCancelar && !puedeReprogramar) motivo = `Se podía cancelar hasta ${config.cancelacionHastaHoras} horas antes. Comunicate con el negocio.`;
    else if (!puedeReprogramar) motivo = restantes === 0 ? 'Ya se reprogramó las veces permitidas.' : `Se podía reprogramar hasta ${config.reprogramacionHastaHoras} horas antes.`;
    const pagado = Number(r.pagado);
    return {
      puedeCancelar, puedeReprogramar,
      cancelarHasta: activa ? cancelarHasta.toISOString() : null,
      reprogramarHasta: activa ? reprogramarHasta.toISOString() : null,
      reprogramacionesRestantes: restantes,
      senaSiCancela: pagado > 0 ? (puedeCancelar && config.senaReembolsable ? 'DEVUELTA' : 'PERDIDA') : 'SIN_SENA',
      motivo,
    };
  }

  async listar(businessId: string, q: { modulo?: ReservaModulo; desde?: string; hasta?: string; recursoId?: string; clienteId?: string; estado?: ReservaEstado[]; q?: string; page?: number; limit?: number }, ahora = new Date()) {
    const hoy = fechaYMinutos(ahora).fecha;
    const desde = q.desde ?? hoy;
    const hasta = q.hasta ?? (q.desde ? q.desde : hoy);
    if (!esFecha(desde) || !esFecha(hasta)) throw new BadRequestException('Esa fecha no existe.');
    if (hasta < desde) throw new BadRequestException('El fin del rango es anterior al inicio.');
    if (diasEntre(desde, hasta) >= MAX_DIAS_LISTADO) throw new BadRequestException(`Pedí hasta ${MAX_DIAS_LISTADO} días por vez.`);
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const where: Prisma.ReservaWhereInput = {
      businessId,
      fecha: { gte: desde, lte: hasta },
      ...(q.modulo ? { modulo: q.modulo } : {}),
      ...(q.recursoId ? { recursoId: q.recursoId } : {}),
      ...(q.clienteId ? { clienteId: q.clienteId } : {}),
      ...(q.estado?.length ? { estado: { in: q.estado } } : {}),
      ...(q.q
        ? { OR: [{ clienteNombre: { contains: q.q, mode: 'insensitive' } }, { clienteTelefono: { contains: q.q } }, { clienteEmail: { contains: q.q, mode: 'insensitive' } }, { codigo: { equals: q.q.toUpperCase() } }] }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.reserva.findMany({ where, orderBy: { inicio: 'asc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.reserva.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  /** Cuántas hay por estado y cuánta plata, entre dos días (para los tableros de Hoy e Ingresos). */
  async resumen(businessId: string, modulo: ReservaModulo, desde: string, hasta: string) {
    if (!esFecha(desde) || !esFecha(hasta) || hasta < desde) throw new BadRequestException('Revisá las fechas.');
    if (diasEntre(desde, hasta) > 400) throw new BadRequestException('Pedí hasta 400 días por vez.');
    const where: Prisma.ReservaWhereInput = { businessId, modulo, fecha: { gte: desde, lte: hasta } };
    const [porEstado, plata] = await Promise.all([
      this.prisma.reserva.groupBy({ by: ['estado'], where, _count: { _all: true } }),
      this.prisma.reserva.aggregate({ where: { ...where, estado: { in: ['CONFIRMADA', 'COMPLETADA'] } }, _sum: { precio: true, pagado: true } }),
    ]);
    const conteo = Object.fromEntries(porEstado.map((p) => [p.estado, p._count._all])) as Partial<Record<ReservaEstado, number>>;
    return { desde, hasta, porEstado: conteo, ingresos: Number(plata._sum.precio ?? 0), cobrado: Number(plata._sum.pagado ?? 0) };
  }

  // ─── Lista de espera ──────────────────────────────────────────────────────

  async anotarseEnEspera(businessId: string, d: { modulo: ReservaModulo; recursoId: string; fecha: string; inicioMinutos: number; cliente: DatosCliente }, clienteId?: string, ahora = new Date()): Promise<ReservaEspera> {
    const config = await this.catalogo.configOFalla(businessId, d.modulo);
    if (!config.listaDeEspera) throw new BadRequestException('Este negocio no tiene lista de espera.');
    const dia = await this.disponibilidad.delDia(businessId, { modulo: d.modulo, recursoId: d.recursoId, fecha: d.fecha }, 'publico', ahora);
    const franja = dia.franjas.find((f) => f.inicioMinutos === d.inicioMinutos);
    if (!franja) throw new BadRequestException('Ese horario no existe o ya pasó.');
    if (franja.libres > 0) throw new BadRequestException('Todavía hay lugar en ese horario: reservá directo.');
    const inicio = instante(d.fecha, franja.inicioMinutos);
    const fin = instante(d.fecha, franja.finMinutos);
    const email = d.cliente.email?.toLowerCase() ?? null;
    const yaEsta = await this.prisma.reservaEspera.findFirst({
      where: {
        businessId, recursoId: d.recursoId, inicio, estado: 'ESPERANDO',
        OR: [...(email ? [{ clienteEmail: email }] : []), ...(d.cliente.telefono ? [{ clienteTelefono: d.cliente.telefono }] : []), ...(clienteId ? [{ clienteId }] : [])],
      },
    });
    if (yaEsta) return yaEsta;
    const vinculado = clienteId ?? (await this.vincularCliente(businessId, d.cliente));
    return this.prisma.reservaEspera.create({
      data: {
        businessId, modulo: d.modulo, recursoId: d.recursoId, inicio, fin, clienteId: vinculado,
        clienteNombre: d.cliente.nombre, clienteTelefono: d.cliente.telefono ?? null, clienteEmail: email, tokenAcceso: generarToken(),
      },
    });
  }

  async posicionEnEspera(businessId: string, token: string): Promise<{ espera: ReservaEspera; posicion: number | null; reserva: Reserva | null }> {
    const espera = await this.prisma.reservaEspera.findFirst({ where: { tokenAcceso: token, businessId } });
    if (!espera) throw new NotFoundException('No estás en ninguna lista de espera.');
    const posicion = espera.estado === 'ESPERANDO'
      ? (await this.prisma.reservaEspera.count({ where: { businessId, recursoId: espera.recursoId, inicio: espera.inicio, estado: 'ESPERANDO', createdAt: { lte: espera.createdAt } } }))
      : null;
    const reserva = espera.reservaId ? await this.prisma.reserva.findFirst({ where: { id: espera.reservaId, businessId } }) : null;
    return { espera, posicion, reserva };
  }

  async salirDeEspera(businessId: string, quien: { token: string } | { id: string }, memberId?: string): Promise<{ ok: true }> {
    const where = 'token' in quien ? { tokenAcceso: quien.token, businessId } : { id: quien.id, businessId };
    const r = await this.prisma.reservaEspera.updateMany({ where: { ...where, estado: 'ESPERANDO' }, data: { estado: 'CANCELADA' } });
    if (r.count === 0) {
      const existe = await this.prisma.reservaEspera.findFirst({ where, select: { id: true } });
      if (!existe) throw new NotFoundException('No estás en ninguna lista de espera.');
    }
    if (memberId && 'id' in quien) await this.audit?.registrar({ businessId, memberId, entityType: 'reserva_espera', entityId: quien.id, action: 'DELETE' });
    return { ok: true };
  }

  async listarEspera(businessId: string, modulo: ReservaModulo, recursoId?: string, fecha?: string) {
    return this.prisma.reservaEspera.findMany({
      where: {
        businessId, modulo, estado: 'ESPERANDO',
        ...(recursoId ? { recursoId } : {}),
        ...(fecha ? { inicio: { gte: instante(fecha, 0), lt: instante(fecha, 24 * 60) } } : {}),
      },
      orderBy: [{ inicio: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // ─── Lo privado ───────────────────────────────────────────────────────────

  /** SELECT … FOR UPDATE sobre el recurso: serializa todo lo que lo toca hasta que la transacción termina. */
  private async tomarRecurso(tx: Prisma.TransactionClient, businessId: string, recursoId: string): Promise<FilaRecurso> {
    const filas = await tx.$queryRaw<FilaRecurso[]>`
      SELECT "id", "cupo", "activo", "nombre" FROM "reservas_recursos"
      WHERE "id" = ${recursoId} AND "business_id" = ${businessId} AND "eliminado_en" IS NULL
      FOR UPDATE`;
    if (filas.length === 0) throw new NotFoundException('Ese recurso no existe.');
    return filas[0];
  }

  /** Vence las retenidas pasadas de un recurso, adentro de la transacción: un lugar a medias no bloquea a nadie. */
  private async vencerRetenidasDe(tx: Prisma.TransactionClient, businessId: string, recursoId: string, ahora: Date): Promise<void> {
    const pasadas = await tx.reserva.findMany({ where: { businessId, recursoId, estado: 'RETENIDA', retenidaHasta: { lt: ahora } }, select: { id: true } });
    if (pasadas.length === 0) return;
    const ids = pasadas.map((p) => p.id);
    await tx.reserva.updateMany({ where: { businessId, id: { in: ids }, estado: 'RETENIDA' }, data: { estado: 'VENCIDA', version: { increment: 1 } } });
    await tx.reservaHistorial.createMany({ data: ids.map((id) => ({ businessId, reservaId: id, de: 'RETENIDA' as const, a: 'VENCIDA' as const, quien: 'SISTEMA' as const, motivo: 'Se venció el tiempo para confirmar.' })) });
  }

  /** Cuenta, con el recurso ya tomado, si entra lo pedido. 409 si no. */
  private async verificarLugar(tx: Prisma.TransactionClient, businessId: string, p: PedidoResuelto, ahora: Date, salvo?: string): Promise<void> {
    const { recurso } = p.reglas;
    const margenMs = p.reglas.margen * 60_000;
    const ocupadas = await tx.reserva.findMany({
      where: {
        businessId, recursoId: recurso.id,
        ...(salvo ? { id: { not: salvo } } : {}),
        inicio: { lt: new Date(p.fin.getTime() + margenMs) }, fin: { gt: new Date(p.inicio.getTime() - margenMs) },
        OR: [{ estado: { in: ['PENDIENTE', 'CONFIRMADA'] } }, { estado: 'RETENIDA', retenidaHasta: { gte: ahora } }],
      },
      select: { cantidad: true },
    });
    const usados = ocupadas.reduce((s, o) => s + o.cantidad, 0);
    if (usados + p.cantidad > recurso.cupo) {
      if (recurso.cupo === 1) throw new ConflictException('Ese horario se acaba de ocupar. Elegí otro.');
      const quedan = Math.max(0, recurso.cupo - usados);
      throw new ConflictException(quedan === 0 ? 'No queda lugar en ese horario.' : `Queda${quedan === 1 ? '' : 'n'} ${quedan} ${quedan === 1 ? 'lugar' : 'lugares'} en ese horario.`);
    }
  }

  /** El primero que esperaba por ese horario toma el lugar que se liberó. Con el recurso ya tomado. */
  private async promoverEspera(tx: Prisma.TransactionClient, businessId: string, recurso: { id: string; cupo: number; precio: Prisma.Decimal; modulo: ReservaModulo }, inicio: Date, fin: Date, senaPorcentaje: number, ahora: Date): Promise<Reserva | null> {
    const espera = await tx.reservaEspera.findFirst({ where: { businessId, recursoId: recurso.id, inicio, fin, estado: 'ESPERANDO' }, orderBy: { createdAt: 'asc' } });
    if (!espera) return null;
    const ocupadas = await tx.reserva.findMany({
      where: { businessId, recursoId: recurso.id, inicio: { lt: fin }, fin: { gt: inicio }, OR: [{ estado: { in: ['PENDIENTE', 'CONFIRMADA'] } }, { estado: 'RETENIDA', retenidaHasta: { gte: ahora } }] },
      select: { cantidad: true },
    });
    if (ocupadas.reduce((s, o) => s + o.cantidad, 0) + 1 > recurso.cupo) return null;
    const precio = Number(recurso.precio);
    const reserva = await tx.reserva.create({
      data: {
        businessId, modulo: recurso.modulo, recursoId: recurso.id, codigo: generarCodigo(), tokenAcceso: generarToken(),
        estado: 'CONFIRMADA', origen: 'TIENDA', inicio, fin, fecha: fechaYMinutos(inicio).fecha, cantidad: 1, exclusivo: recurso.cupo === 1,
        clienteId: espera.clienteId, clienteNombre: espera.clienteNombre, clienteTelefono: espera.clienteTelefono, clienteEmail: espera.clienteEmail,
        precio, sena: calcularSena(precio, senaPorcentaje), confirmadaEn: ahora,
      },
    });
    await tx.reservaHistorial.create({ data: { businessId, reservaId: reserva.id, de: null, a: 'CONFIRMADA', quien: 'SISTEMA', motivo: 'Tomó el lugar desde la lista de espera.' } });
    await tx.reservaEspera.updateMany({ where: { id: espera.id, businessId, estado: 'ESPERANDO' }, data: { estado: 'TOMADA', reservaId: reserva.id } });
    return reserva;
  }

  /** Sitio: una misma persona no acumula más reservas activas que las que permite el negocio. */
  private async verificarTope(businessId: string, maximo: number, cliente: DatosCliente, ahora: Date, salvo?: string): Promise<void> {
    if (maximo <= 0) return;
    const email = cliente.email?.toLowerCase();
    const quien: Prisma.ReservaWhereInput[] = [];
    if (email) quien.push({ clienteEmail: email });
    if (cliente.telefono) quien.push({ clienteTelefono: cliente.telefono });
    if (quien.length === 0) return;
    const activas = await this.prisma.reserva.count({
      where: { businessId, ...(salvo ? { id: { not: salvo } } : {}), estado: { in: ['PENDIENTE', 'CONFIRMADA'] }, fin: { gt: ahora }, OR: quien },
    });
    if (activas >= maximo) throw new BadRequestException(`Ya tenés ${maximo} ${maximo === 1 ? 'reserva activa' : 'reservas activas'}. Cancelá alguna para reservar otra.`);
  }

  /**
   * Busca la ficha del cliente por email o teléfono y, si no está, la crea.
   * Es una comodidad para las pantallas de Clientes: si falla, la reserva
   * sigue con su propia foto del cliente (nombre, teléfono, email).
   */
  private async vincularCliente(businessId: string, cliente: DatosCliente): Promise<string | null> {
    const email = cliente.email?.trim().toLowerCase() || null;
    const telefono = cliente.telefono?.trim() || null;
    try {
      if (email) {
        const porEmail = await this.prisma.customer.findFirst({ where: { businessId, email: { equals: email, mode: 'insensitive' }, deletedAt: null }, select: { id: true } });
        if (porEmail) return porEmail.id;
      }
      if (telefono) {
        const porTelefono = await this.prisma.customer.findFirst({ where: { businessId, phone: telefono, deletedAt: null }, select: { id: true } });
        if (porTelefono) return porTelefono.id;
      }
      if (!email && !telefono) return null;
      const [firstName, ...resto] = cliente.nombre.trim().split(/\s+/);
      const creado = await this.prisma.customer.create({ data: { businessId, firstName: firstName || cliente.nombre, lastName: resto.join(' ') || null, email, phone: telefono } });
      return creado.id;
    } catch (e) {
      this.logger.warn(`No se pudo vincular la ficha del cliente (${businessId}): ${describeError(e)}`);
      return null;
    }
  }

  /** 'clave' si chocó la clave de idempotencia, 'codigo' si chocó el código, null si no fue un unique. */
  private choqueDeUnico(e: unknown): 'clave' | 'codigo' | 'otro' | null {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return null;
    const target = JSON.stringify(e.meta?.target ?? '');
    if (/clave_idempotencia|claveIdempotencia/.test(target)) return 'clave';
    if (/codigo/.test(target)) return 'codigo';
    return 'otro';
  }

  /** La restricción de exclusión de la base (23P01) y los demás errores, en palabras. */
  private traducirError(e: unknown, cupo: number): unknown {
    const texto = e instanceof Error ? e.message : String(e);
    if (/reservas_sin_solapamiento|23P01|exclusion_violation/.test(texto)) {
      return new ConflictException(cupo === 1 ? 'Ese horario se acaba de ocupar. Elegí otro.' : 'No queda lugar en ese horario.');
    }
    return e;
  }
}

function describirMinutos(min: number): string {
  if (min % 1440 === 0) return `${min / 1440} ${min / 1440 === 1 ? 'día' : 'días'}`;
  if (min % 60 === 0) return `${min / 60} ${min / 60 === 1 ? 'hora' : 'horas'}`;
  return `${min} minutos`;
}
