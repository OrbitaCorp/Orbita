import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GimnasioAlumno, GimnasioPlan, GimnasioSuscripcion, Prisma, Reserva } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReservasCatalogoService } from '../reservas/reservas-catalogo.service';
import { ReservasService, type OpcionesCrear } from '../reservas/reservas.service';
import { TRANSACCION_CON_CANDADO } from '../reservas/candado';
import { fechaYMinutos } from '../reservas/dominio/tiempo';
import {
  arrancaEl, CUENTAN, motivoParaElNegocio, pagoDe, suscripcionPara, TIPOS_ASIGNABLES, usadasEnLaSemana, venceEl, type DatosDePago, type Pago, type Uso,
} from './dominio/planes';
import { AltaAlumnoDto, CambiarAlumnoDto, DefinirPagoDto, GuardarPlanesDto, PlanDto as PlanEntrada, ReservarConPlanDto } from './dto/gimnasio.dto';
import { alumnoDto, paraLasCuentas, suscripcionDto, type AlumnoDto, type PagoDto } from './gimnasio.types';

// Lo que Gimnasio guarda y no es una reserva: los planes, los alumnos y el
// plan de cada alumno. Vive al lado del motor de reservas (../reservas) y lo
// usa sin tocarlo: una clase, un lugar y la lista de espera siguen siendo
// suyos. Acá se decide con qué se paga un lugar.
//
// Cómo se cuenta un pack: la reserva dice con qué se pagó en su campo libre
// (`datos.gimnasio`: pago, suscripcionId) y las clases usadas se cuentan de
// las reservas (ver dominio/planes.ts). No hay un contador guardado que se
// pueda desfasar: si la reserva se cancela, la clase vuelve sola.
//
// Lo que cuenta lugares de un plan (anotar con plan, pasar un lugar al plan,
// asignar un plan) toma primero el candado del alumno: dos pedidos a la vez
// con la última clase de un pack entran de a uno, y el segundo ve la reserva
// del primero. Todo filtra por el businessId del token.

const MODULO = 'GIMNASIO' as const;

type Db = Prisma.TransactionClient | PrismaService;
type AlumnoCompleto = GimnasioAlumno & { cliente: { firstName: string; lastName: string | null; phone: string | null; email: string | null }; suscripciones: GimnasioSuscripcion[] };

const CON_FICHA = { cliente: { select: { firstName: true, lastName: true, phone: true, email: true } }, suscripciones: true } as const;
const PAGO_CON_PLAN = { path: ['gimnasio', 'pago'], equals: 'plan' };
const PAGO_DE_PRUEBA = { path: ['gimnasio', 'pago'], equals: 'prueba' };

@Injectable()
export class GimnasioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogo: ReservasCatalogoService,
    private readonly reservas: ReservasService,
    // Opcional solo para los tests unitarios; Nest lo inyecta siempre.
    private readonly audit?: AuditService,
  ) {}

  /** El negocio usa Gimnasio (tiene su config de reservas) o 404: es la puerta de todo el módulo. */
  private async negocioConGimnasio(businessId: string): Promise<void> {
    await this.catalogo.configOFalla(businessId, MODULO);
  }

  // ─── Planes ───────────────────────────────────────────────────────────────

  async planes(businessId: string): Promise<GimnasioPlan[]> {
    return this.prisma.gimnasioPlan.findMany({ where: { businessId, eliminadoEn: null }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });
  }

  /** Los que se ofrecen en el sitio. */
  async planesPublicos(businessId: string): Promise<GimnasioPlan[]> {
    return this.prisma.gimnasioPlan.findMany({ where: { businessId, eliminadoEn: null, activo: true }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });
  }

  /**
   * Guarda la lista entera de planes, como la edita Planes y precios: los que
   * traen `id` se cambian, los que no se crean y los que ya no vienen se
   * quitan. Todo o nada. Quitar es un borrado blando: lo que un alumno ya
   * compró conserva su foto del plan (nombre, precio, clases) y no cambia.
   */
  async guardarPlanes(businessId: string, memberId: string, dto: GuardarPlanesDto, ahora = new Date()): Promise<GimnasioPlan[]> {
    await this.negocioConGimnasio(businessId);
    const ids = dto.planes.flatMap((p) => (p.id ? [p.id] : []));
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Un mismo plan vino dos veces.');
    const antes = await this.planes(businessId);
    const existentes = new Set(antes.map((p) => p.id));
    if (ids.some((id) => !existentes.has(id))) throw new BadRequestException('Uno de los planes ya no existe. Actualizá el panel y probá de nuevo.');
    for (const p of dto.planes) {
      if (p.tipo === 'PACK' && !(Number.isInteger(p.clases) && (p.clases as number) >= 1)) throw new BadRequestException(`El pack "${p.nombre}" tiene que decir cuántas clases trae.`);
    }
    const quedan = new Set(ids);
    const quitar = antes.filter((p) => !quedan.has(p.id)).map((p) => p.id);

    await this.prisma.$transaction(async (tx) => {
      if (quitar.length) await tx.gimnasioPlan.updateMany({ where: { businessId, id: { in: quitar } }, data: { eliminadoEn: ahora, activo: false } });
      for (const [orden, p] of dto.planes.entries()) {
        const datos = GimnasioService.datosDePlan(p, orden);
        if (p.id) await tx.gimnasioPlan.updateMany({ where: { id: p.id, businessId }, data: datos });
        else await tx.gimnasioPlan.create({ data: { businessId, ...datos } });
      }
    });
    await this.audit?.registrar({
      businessId, memberId, entityType: 'gimnasio_planes', entityId: businessId, action: 'UPDATE',
      changes: [{ field: 'planes', before: antes.map((p) => `${p.nombre} (${Number(p.precio)})`).join(', '), after: dto.planes.map((p) => `${p.nombre} (${p.precio})`).join(', ') }],
    });
    return this.planes(businessId);
  }

  /** Lo que se guarda de un plan: las clases solo en un pack y el tope semanal solo en una membresía (0 = libre). */
  private static datosDePlan(p: PlanEntrada, orden: number) {
    return {
      tipo: p.tipo, nombre: p.nombre, precio: p.precio, vigenciaDias: p.vigenciaDias, activo: p.activo, orden,
      clases: p.tipo === 'PACK' ? (p.clases as number) : null,
      porSemana: p.tipo === 'MEMBRESIA' ? (p.porSemana ?? 0) : null,
    };
  }

  /** Un plan que se le puede asignar a un alumno: existe, no se quitó y es un pack o una membresía. */
  private async planAsignable(businessId: string, planId: string): Promise<GimnasioPlan> {
    const plan = await this.prisma.gimnasioPlan.findFirst({ where: { id: planId, businessId, eliminadoEn: null } });
    if (!plan) throw new NotFoundException('Ese plan ya no existe. Actualizá el panel.');
    if (!TIPOS_ASIGNABLES.includes(plan.tipo)) throw new BadRequestException('La clase de prueba y la clase suelta son de una sola clase: se eligen al anotar, no se asignan.');
    return plan;
  }

  // ─── Alumnos ──────────────────────────────────────────────────────────────

  async alumnos(businessId: string, ahora = new Date()): Promise<AlumnoDto[]> {
    const filas = await this.prisma.gimnasioAlumno.findMany({ where: { businessId }, include: CON_FICHA });
    return this.armar(this.prisma, businessId, filas, fechaYMinutos(ahora).fecha);
  }

  private async alumno(businessId: string, id: string, hoy: string): Promise<AlumnoDto> {
    const fila = await this.prisma.gimnasioAlumno.findFirst({ where: { id, businessId }, include: CON_FICHA });
    if (!fila) throw new NotFoundException('Ese alumno no existe.');
    return (await this.armar(this.prisma, businessId, [fila], hoy))[0];
  }

  /** Los alumnos con sus planes, lo que usó cada uno y si ya tomó la clase de prueba, por orden alfabético. */
  private async armar(db: Db, businessId: string, filas: AlumnoCompleto[], hoy: string): Promise<AlumnoDto[]> {
    if (filas.length === 0) return [];
    const clienteIds = filas.map((a) => a.clienteId);
    const desde = filas.flatMap((a) => a.suscripciones).reduce<string | null>((m, s) => (!m || s.desde < m ? s.desde : m), null);
    const [conPlan, deprueba] = await Promise.all([
      desde
        ? db.reserva.findMany({
          where: { businessId, modulo: MODULO, clienteId: { in: clienteIds }, estado: { in: [...CUENTAN] }, fecha: { gte: desde }, datos: PAGO_CON_PLAN },
          select: { clienteId: true, fecha: true, cantidad: true, datos: true },
        })
        : [],
      db.reserva.findMany({
        where: { businessId, modulo: MODULO, clienteId: { in: clienteIds }, estado: { in: [...CUENTAN] }, datos: PAGO_DE_PRUEBA },
        select: { clienteId: true },
        distinct: ['clienteId'],
      }),
    ]);
    const usos = new Map<string, Uso[]>();
    for (const r of conPlan) {
      const pago = pagoDe(r.datos);
      if (!r.clienteId || !pago?.suscripcionId) continue;
      usos.set(r.clienteId, [...(usos.get(r.clienteId) ?? []), { suscripcionId: pago.suscripcionId, fecha: r.fecha, cantidad: r.cantidad }]);
    }
    const probaron = new Set(deprueba.map((r) => r.clienteId));
    return filas
      .map((a) => alumnoDto(a, usos.get(a.clienteId) ?? [], probaron.has(a.clienteId), hoy))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  /**
   * La ficha de cliente de quien se anota o se da de alta: una que ya existe
   * (de este negocio) o la que el motor encuentra o crea con sus datos. Hace
   * falta un celular o un email: es con lo que se la reconoce la próxima vez.
   */
  private async ficha(businessId: string, quien: { clienteId?: string; cliente?: { nombre: string; telefono?: string; email?: string } }): Promise<string> {
    if (quien.clienteId) {
      const f = await this.prisma.customer.findFirst({ where: { id: quien.clienteId, businessId, deletedAt: null }, select: { id: true } });
      if (!f) throw new BadRequestException('Esa ficha de cliente no existe.');
      return f.id;
    }
    if (!quien.cliente) throw new BadRequestException('Elegí a alguien o cargá su nombre y un celular.');
    if (!quien.cliente.telefono && !quien.cliente.email) throw new BadRequestException('Hace falta un celular o un email: con eso se lo reconoce cuando reserva.');
    const id = await this.reservas.fichaDe(businessId, quien.cliente);
    if (!id) throw new BadRequestException('No se pudo guardar la ficha de esa persona. Probá de nuevo.');
    return id;
  }

  /**
   * Da de alta a un alumno (para quien se anota en el mostrador). Si esa
   * persona ya era alumna, devuelve la misma. Con `planId`, arranca con ese plan.
   */
  async alta(businessId: string, memberId: string, dto: AltaAlumnoDto, ahora = new Date()): Promise<AlumnoDto> {
    await this.negocioConGimnasio(businessId);
    const hoy = fechaYMinutos(ahora).fecha;
    const plan = dto.planId ? await this.planAsignable(businessId, dto.planId) : null;
    const clienteId = await this.ficha(businessId, dto);
    const { alumno, nuevo } = await this.alumnoDeFicha(businessId, clienteId, hoy, dto.nota);
    if (nuevo) await this.audit?.registrar({ businessId, memberId, entityType: 'gimnasio_alumno', entityId: alumno.id, action: 'CREATE' });
    if (plan) await this.asignar(businessId, memberId, alumno.id, plan, hoy);
    return this.alumno(businessId, alumno.id, hoy);
  }

  /** El alumno de una ficha de cliente; si todavía no lo era, lo crea (dos pedidos a la vez dejan uno solo). */
  private async alumnoDeFicha(businessId: string, clienteId: string, hoy: string, nota?: string): Promise<{ alumno: GimnasioAlumno; nuevo: boolean }> {
    const ya = await this.prisma.gimnasioAlumno.findFirst({ where: { businessId, clienteId } });
    if (ya) return { alumno: ya, nuevo: false };
    try {
      return { alumno: await this.prisma.gimnasioAlumno.create({ data: { businessId, clienteId, nota: nota ?? null, alta: hoy } }), nuevo: true };
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') throw e;
      const otra = await this.prisma.gimnasioAlumno.findFirst({ where: { businessId, clienteId } });
      if (!otra) throw e;
      return { alumno: otra, nuevo: false };
    }
  }

  async cambiarAlumno(businessId: string, memberId: string, id: string, dto: CambiarAlumnoDto, ahora = new Date()): Promise<AlumnoDto> {
    if (dto.nota !== undefined) {
      const r = await this.prisma.gimnasioAlumno.updateMany({ where: { id, businessId }, data: { nota: dto.nota.trim() || null } });
      if (r.count === 0) throw new NotFoundException('Ese alumno no existe.');
      await this.audit?.registrar({ businessId, memberId, entityType: 'gimnasio_alumno', entityId: id, action: 'UPDATE' });
    }
    return this.alumno(businessId, id, fechaYMinutos(ahora).fecha);
  }

  /** Le asigna o le renueva un plan a un alumno (el botón "Renovar" o "Asignar" de su ficha). */
  async asignarPlan(businessId: string, memberId: string, alumnoId: string, planId: string, ahora = new Date()): Promise<AlumnoDto> {
    await this.negocioConGimnasio(businessId);
    const hoy = fechaYMinutos(ahora).fecha;
    const plan = await this.planAsignable(businessId, planId);
    await this.asignar(businessId, memberId, alumnoId, plan, hoy);
    return this.alumno(businessId, alumnoId, hoy);
  }

  /**
   * Crea la suscripción, con el alumno tomado. Guarda una foto del plan.
   * - Renovar la misma membresía antes de que venza la continúa: arranca al
   *   día siguiente de que termine la que tiene (no pierde días).
   * - Una membresía de otro plan reemplaza a la que tenía: no se superponen dos.
   * - Un pack arranca hoy y convive con lo que tenga: las clases de un pack
   *   anterior siguen valiendo hasta que venza, y se gastan primero.
   */
  private async asignar(businessId: string, memberId: string, alumnoId: string, plan: GimnasioPlan, hoy: string): Promise<GimnasioSuscripcion> {
    const creada = await this.prisma.$transaction(
      async (tx) => {
        await this.tomarAlumno(tx, businessId, alumnoId);
        const suyas = await tx.gimnasioSuscripcion.findMany({ where: { businessId, alumnoId, estado: 'VIGENTE' } });
        const desde = arrancaEl(hoy, plan, suyas);
        const anterior = suyas.filter((s) => s.planId === plan.id).sort((a, b) => b.hasta.localeCompare(a.hasta))[0];
        if (plan.tipo === 'MEMBRESIA') {
          const reemplazadas = suyas.filter((s) => s.tipo === 'MEMBRESIA' && s.planId !== plan.id && s.hasta >= hoy).map((s) => s.id);
          if (reemplazadas.length) await tx.gimnasioSuscripcion.updateMany({ where: { businessId, id: { in: reemplazadas } }, data: { estado: 'CANCELADA' } });
        }
        return tx.gimnasioSuscripcion.create({
          data: {
            businessId, alumnoId, planId: plan.id, tipo: plan.tipo, nombre: plan.nombre, precio: plan.precio, clases: plan.clases, porSemana: plan.porSemana,
            desde, hasta: venceEl(desde, plan.vigenciaDias), renuevaId: anterior?.id ?? null, creadaPorMemberId: memberId,
          },
        });
      },
      TRANSACCION_CON_CANDADO,
    );
    await this.audit?.registrar({
      businessId, memberId, entityType: 'gimnasio_suscripcion', entityId: creada.id, action: 'CREATE',
      changes: [{ field: 'plan', before: null, after: `${creada.nombre} (${creada.desde} a ${creada.hasta})` }],
    });
    return creada;
  }

  /** Quita un plan asignado por error. Los lugares que ya se pagaron con él siguen reservados. Repetirlo no falla. */
  async quitarPlan(businessId: string, memberId: string, alumnoId: string, suscripcionId: string, ahora = new Date()): Promise<AlumnoDto> {
    const r = await this.prisma.gimnasioSuscripcion.updateMany({ where: { id: suscripcionId, businessId, alumnoId, estado: 'VIGENTE' }, data: { estado: 'CANCELADA' } });
    if (r.count === 0) {
      const existe = await this.prisma.gimnasioSuscripcion.findFirst({ where: { id: suscripcionId, businessId, alumnoId }, select: { id: true } });
      if (!existe) throw new NotFoundException('Ese plan no es de ese alumno.');
    } else {
      await this.audit?.registrar({ businessId, memberId, entityType: 'gimnasio_suscripcion', entityId: suscripcionId, action: 'DELETE' });
    }
    return this.alumno(businessId, alumnoId, fechaYMinutos(ahora).fecha);
  }

  // ─── Anotar con plan ──────────────────────────────────────────────────────

  /**
   * Anota a alguien en una clase desde el panel, diciendo cómo se paga:
   * - 'plan': con su pack o su membresía. Si no tiene, venció, no le quedan
   *   clases o ya usó las de esa semana, 409 con el motivo y no se reserva.
   * - 'aparte': se cobra en el gimnasio como clase suelta; el precio de la
   *   reserva es el de la clase suelta, si el negocio tiene una cargada.
   * - 'prueba': la clase de prueba, una sola vez por persona.
   * La reserva la crea el motor (cupo, candado del recurso, lista de espera);
   * si la clase está llena responde el 409 del motor. Repetir el pedido con la
   * misma `clave` devuelve la misma reserva, sin descontar dos veces.
   */
  async reservar(businessId: string, memberId: string, dto: ReservarConPlanDto, ahora = new Date()): Promise<{ reserva: Reserva; pago: PagoDto }> {
    await this.negocioConGimnasio(businessId);
    const repetida = await this.prisma.reserva.findUnique({ where: { businessId_claveIdempotencia: { businessId, claveIdempotencia: dto.clave } } });
    if (repetida) return { reserva: repetida, pago: await this.pagoDeReserva(businessId, repetida) };

    const cantidad = dto.cantidad ?? 1;
    const hoy = fechaYMinutos(ahora).fecha;
    let alumno: GimnasioAlumno | null = null;
    if (dto.alumnoId) {
      alumno = await this.prisma.gimnasioAlumno.findFirst({ where: { id: dto.alumnoId, businessId } });
      if (!alumno) throw new NotFoundException('Ese alumno no existe.');
    }
    const clienteId = alumno?.clienteId ?? (await this.ficha(businessId, dto));
    const pedido = { modulo: MODULO, recursoId: dto.recursoId, fecha: dto.fecha, inicioMinutos: dto.inicioMinutos, cantidad };
    // Con los datos que se cargaron, la reserva queda con ese nombre aunque la ficha sea de otra persona
    // (una madre que anota a sus hijos con su celular).
    const opciones: OpcionesCrear = { estado: 'CONFIRMADA', origen: 'PANEL', actor: 'NEGOCIO', memberId, clienteId, cliente: dto.cliente, clave: dto.clave };
    const conPago = (pago: DatosDePago) => ({ ...pedido, datos: { gimnasio: { ...pago } } });

    let reserva: Reserva;
    if (dto.pago === 'plan') {
      alumno ??= await this.prisma.gimnasioAlumno.findFirst({ where: { businessId, clienteId } });
      if (!alumno) throw new ConflictException(motivoParaElNegocio({ causa: 'sin-plan' }));
      const alumnoId = alumno.id;
      reserva = await this.prisma.$transaction(
        async (tx) => {
          await this.tomarAlumno(tx, businessId, alumnoId);
          const suscripcion = await this.suscripcionCon(tx, businessId, alumnoId, clienteId, dto.fecha, cantidad);
          return this.reservas.crear(businessId, conPago({ pago: 'plan', suscripcionId: suscripcion.id, planId: suscripcion.planId }), opciones, ahora);
        },
        TRANSACCION_CON_CANDADO,
      );
    } else if (dto.pago === 'prueba') {
      const prueba = await this.planDeUnaClase(businessId, 'PRUEBA');
      if (!prueba) throw new BadRequestException('Este negocio no tiene una clase de prueba cargada en Planes y precios.');
      if (cantidad !== 1) throw new BadRequestException('La clase de prueba es de un solo lugar.');
      if (await this.yaProbo(businessId, clienteId)) throw new ConflictException('Ya usó la clase de prueba: es una sola vez por persona. Anotalo con su plan o cobrale la clase aparte.');
      reserva = await this.reservas.crear(businessId, conPago({ pago: 'prueba', planId: prueba.id }), opciones, ahora);
    } else {
      const suelta = await this.planDeUnaClase(businessId, 'SUELTA');
      reserva = await this.reservas.crear(
        businessId, conPago({ pago: 'aparte', ...(suelta ? { planId: suelta.id } : {}) }),
        { ...opciones, ...(suelta ? { precioManual: Number(suelta.precio) * cantidad } : {}) }, ahora,
      );
    }
    // Quien se anota queda como alumno: así aparece en Alumnos aunque todavía no tenga plan.
    if (!alumno) await this.alumnoDeFicha(businessId, clienteId, hoy);
    return { reserva, pago: await this.pagoDeReserva(businessId, reserva) };
  }

  /**
   * Dice (o corrige) cómo se paga un lugar que ya está reservado: el de quien
   * pasó de la lista de espera o reservó desde el sitio, que nacen sin eso.
   * Pasarlo al plan descuenta la clase con las mismas reglas que al anotar.
   */
  async definirPago(businessId: string, memberId: string, reservaId: string, dto: DefinirPagoDto, ahora = new Date()): Promise<{ reserva: Reserva; pago: PagoDto }> {
    await this.negocioConGimnasio(businessId);
    const r = await this.prisma.reserva.findFirst({ where: { id: reservaId, businessId, modulo: MODULO } });
    if (!r) throw new NotFoundException('Esa reserva no existe.');
    if (!(CUENTAN as readonly string[]).includes(r.estado)) throw new ConflictException('Ese lugar ya no está reservado.');
    const hoy = fechaYMinutos(ahora).fecha;
    const previo = r.datos && typeof r.datos === 'object' && !Array.isArray(r.datos) ? (r.datos as Record<string, unknown>) : {};
    const guardar = async (db: Db, pago: DatosDePago) => {
      const cambio = await db.reserva.updateMany({
        where: { id: r.id, businessId, estado: { in: [...CUENTAN] } },
        data: { datos: { ...previo, gimnasio: { ...pago } } as Prisma.InputJsonValue },
      });
      if (cambio.count === 0) throw new ConflictException('Ese lugar ya no está reservado.');
    };

    if (dto.pago === 'aparte') {
      const suelta = await this.planDeUnaClase(businessId, 'SUELTA');
      await guardar(this.prisma, { pago: 'aparte', ...(suelta ? { planId: suelta.id } : {}) });
    } else {
      const clienteId = r.clienteId;
      if (!clienteId) throw new BadRequestException('Esa reserva no tiene los datos de la persona: no se le puede usar un plan. Anotala de nuevo con su celular.');
      if (dto.pago === 'prueba') {
        const prueba = await this.planDeUnaClase(businessId, 'PRUEBA');
        if (!prueba) throw new BadRequestException('Este negocio no tiene una clase de prueba cargada en Planes y precios.');
        if (r.cantidad !== 1) throw new BadRequestException('La clase de prueba es de un solo lugar.');
        if (await this.yaProbo(businessId, clienteId, r.id)) throw new ConflictException('Ya usó la clase de prueba: es una sola vez por persona.');
        await guardar(this.prisma, { pago: 'prueba', planId: prueba.id });
      } else {
        const { alumno } = await this.alumnoDeFicha(businessId, clienteId, hoy);
        await this.prisma.$transaction(
          async (tx) => {
            await this.tomarAlumno(tx, businessId, alumno.id);
            const suscripcion = await this.suscripcionCon(tx, businessId, alumno.id, clienteId, r.fecha, r.cantidad, r.id);
            await guardar(tx, { pago: 'plan', suscripcionId: suscripcion.id, planId: suscripcion.planId });
          },
          TRANSACCION_CON_CANDADO,
        );
      }
    }
    await this.audit?.registrar({
      businessId, memberId, entityType: 'reserva', entityId: r.id, action: 'UPDATE',
      changes: [{ field: 'pago', before: pagoDe(r.datos)?.pago ?? null, after: dto.pago }],
    });
    const final = await this.prisma.reserva.findFirst({ where: { id: r.id, businessId } });
    return { reserva: final ?? r, pago: await this.pagoDeReserva(businessId, final ?? r) };
  }

  // ─── Lo privado ───────────────────────────────────────────────────────────

  /** El candado del alumno: SELECT … FOR UPDATE sobre su fila. Todo lo que cuenta lugares de sus planes lo toma primero. */
  private async tomarAlumno(tx: Prisma.TransactionClient, businessId: string, alumnoId: string): Promise<void> {
    const filas = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "gimnasio_alumnos" WHERE "id" = ${alumnoId} AND "business_id" = ${businessId} FOR UPDATE`;
    if (filas.length === 0) throw new NotFoundException('Ese alumno no existe.');
  }

  /**
   * Con el alumno ya tomado: la suscripción con la que se paga ese lugar, o 409
   * con el motivo. `sinContar` es la reserva que se está pasando al plan (no se
   * cuenta a sí misma).
   */
  private async suscripcionCon(tx: Prisma.TransactionClient, businessId: string, alumnoId: string, clienteId: string, fecha: string, cantidad: number, sinContar?: string) {
    const suscripciones = (await tx.gimnasioSuscripcion.findMany({ where: { businessId, alumnoId } })).map(paraLasCuentas);
    const usos = await this.usosDe(tx, businessId, clienteId, suscripciones.map((s) => s.id), sinContar);
    const con = suscripcionPara(suscripciones, usos, fecha, cantidad);
    if (!('suscripcion' in con)) throw new ConflictException(motivoParaElNegocio(con));
    return con.suscripcion;
  }

  /** Los lugares que esa persona pagó con esas suscripciones (las reservas canceladas no cuentan). */
  private async usosDe(db: Db, businessId: string, clienteId: string, suscripcionIds: string[], sinContar?: string): Promise<Uso[]> {
    if (suscripcionIds.length === 0) return [];
    const propias = new Set(suscripcionIds);
    const filas = await db.reserva.findMany({
      where: { businessId, modulo: MODULO, clienteId, estado: { in: [...CUENTAN] }, datos: PAGO_CON_PLAN, ...(sinContar ? { id: { not: sinContar } } : {}) },
      select: { fecha: true, cantidad: true, datos: true },
    });
    return filas.flatMap((f) => {
      const pago = pagoDe(f.datos);
      return pago?.suscripcionId && propias.has(pago.suscripcionId) ? [{ suscripcionId: pago.suscripcionId, fecha: f.fecha, cantidad: f.cantidad }] : [];
    });
  }

  /** Si esa persona ya tomó (o tiene reservada) la clase de prueba. */
  private async yaProbo(businessId: string, clienteId: string, sinContar?: string): Promise<boolean> {
    const n = await this.prisma.reserva.count({
      where: { businessId, modulo: MODULO, clienteId, estado: { in: [...CUENTAN] }, datos: PAGO_DE_PRUEBA, ...(sinContar ? { id: { not: sinContar } } : {}) },
    });
    return n > 0;
  }

  /** La clase de prueba o la clase suelta del negocio (la primera de la lista, se ofrezca o no en el sitio). */
  private planDeUnaClase(businessId: string, tipo: 'PRUEBA' | 'SUELTA'): Promise<GimnasioPlan | null> {
    return this.prisma.gimnasioPlan.findFirst({ where: { businessId, tipo, eliminadoEn: null }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });
  }

  /** Cómo quedó pago un lugar: con qué y, si fue con un plan, cómo quedó ese plan. */
  async pagoDeReserva(businessId: string, r: Reserva): Promise<PagoDto> {
    const datos = pagoDe(r.datos);
    // Sin `datos.gimnasio` el lugar está sin definir: pasó de la lista de espera o se reservó desde el sitio.
    const pago: Pago | null = datos?.pago ?? null;
    if (datos?.pago !== 'plan' || !datos.suscripcionId || !r.clienteId) return { pago, plan: null, usadasEnLaSemana: null };
    const suscripcion = await this.prisma.gimnasioSuscripcion.findFirst({ where: { id: datos.suscripcionId, businessId } });
    if (!suscripcion) return { pago, plan: null, usadasEnLaSemana: null };
    const suyas = await this.prisma.gimnasioSuscripcion.findMany({ where: { businessId, alumnoId: suscripcion.alumnoId } });
    const usos = await this.usosDe(this.prisma, businessId, r.clienteId, suyas.map((s) => s.id));
    const conTope = suscripcion.tipo === 'MEMBRESIA' && !!suscripcion.porSemana && suscripcion.porSemana > 0;
    return { pago, plan: suscripcionDto(suscripcion, usos), usadasEnLaSemana: conTope ? usadasEnLaSemana(suyas.map(paraLasCuentas), usos, r.fecha) : null };
  }
}

