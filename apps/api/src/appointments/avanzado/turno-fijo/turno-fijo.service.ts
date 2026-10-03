import { BadRequestException, ConflictException, HttpException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { AppointmentOrigin, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { fechaArgentina } from '../../../common/utils/hora-argentina';
import type { Fecha, TurnoFijoDto } from '../../appointments.types';
import { diaDeSemana, esFecha, sumarDias } from '../../horarios/horarios';
import { ClienteNuevo, ClienteResuelto, resolverCliente } from '../comun/clientes';
import { AvanzadoContextoService, Db, horarioDelNegocioDb } from '../comun/contexto.service';
import { CrearTurno, NUCLEO_TURNOS, NucleoTurnos } from '../comun/nucleo-turnos';
import { enTransaccion } from '../comun/transacciones';
import { CreateRecurringDto } from './dto/turno-fijo.dto';
import { SerieTurnoFijo, generarOcurrencias } from './turno-fijo.puro';

type SerieConNombres = Prisma.AppointmentRecurringSeriesGetPayload<{
  include: { resource: { select: { name: true } }; service: { select: { name: true } }; appointments: { select: { id: true; startsAt: true; status: true } } };
}>;

/** Hasta dónde se miran fechas para armar una serie: un año (52 semanas o 12 meses). */
const HORIZONTE_DIAS = 400;
const NO_HAY_NUCLEO = 'Todavía no se pueden dar turnos fijos: falta el módulo de turnos. Probá más tarde.';

export interface ResultadoSerie {
  series: TurnoFijoDto;
  /** Turnos que se dieron. */
  created: { id: string; date: Fecha }[];
  /** Fechas que tocaban y no se dieron: feriado, vacaciones, horario ocupado (CONTRATO § P4.6). */
  skipped: Fecha[];
}

/**
 * Turno fijo (P4.6). La serie es una fila de appointment_recurring_series y
 * sus turnos son filas normales de appointments con recurringSeriesId. Los
 * turnos los crea SIEMPRE el núcleo de P1 (`crearTurno`, § 1.1): este service
 * calcula las fechas (`generarOcurrencias`, puro) y los pide uno por uno en la
 * MISMA transacción, con un SAVEPOINT por turno para que uno ocupado no
 * aborte el resto.
 */
@Injectable()
export class TurnoFijoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: AvanzadoContextoService,
    private readonly audit: AuditService,
    @Optional() @Inject(NUCLEO_TURNOS) private readonly nucleo?: NucleoTurnos,
  ) {}

  async listar(businessId: string): Promise<TurnoFijoDto[]> {
    await this.contexto.delNegocio(businessId);
    const series = await this.prisma.appointmentRecurringSeries.findMany({
      where: { businessId },
      include: this.incluir(),
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    return series.map(aDto);
  }

  /** POST appointments/recurring: crea la serie con el núcleo inyectado (503 si todavía no existe). */
  async crearDesdePanel(businessId: string, memberId: string, dto: CreateRecurringDto): Promise<ResultadoSerie> {
    if (!this.nucleo) throw new ServiceUnavailableException(NO_HAY_NUCLEO);
    return this.crearSerie(businessId, dto, this.nucleo.crearTurno, { memberId, origin: 'PANEL' });
  }

  /**
   * Crea la serie y sus turnos. `crearTurno` es la función del núcleo (P1);
   * la reserva pública (P2, `recurring` en CreateBookingDto) llama a este mismo
   * método con `origin: 'STOREFRONT'`.
   */
  async crearSerie(
    businessId: string,
    dto: Omit<CreateRecurringDto, 'customer'> & { customer?: ClienteNuevo },
    crearTurno: CrearTurno,
    opciones: { memberId: string | null; origin: AppointmentOrigin },
  ): Promise<ResultadoSerie> {
    const negocio = await this.contexto.delNegocio(businessId);
    this.contexto.exigirPrendida(negocio.settings, 'turno-fijo');
    const { config } = this.contexto.funcion(negocio.settings, 'turno-fijo');
    if (!config.frecuencias.includes(dto.frequency)) throw new BadRequestException('Esa frecuencia no está habilitada para el turno fijo.');
    if (!config.serviceIds.includes(dto.serviceId)) throw new BadRequestException('Ese servicio no admite turno fijo. Sumalo en Avanzado → Turno fijo.');
    if (!esFecha(dto.startDate)) throw new BadRequestException('Esa fecha no existe.');
    if (dto.startDate < fechaArgentina(new Date())) throw new BadRequestException('El turno fijo tiene que empezar hoy o más adelante.');

    const [servicio, recurso] = await Promise.all([
      this.prisma.appointmentService.findFirst({ where: { id: dto.serviceId, businessId, deletedAt: null, isActive: true }, select: { id: true } }),
      this.prisma.appointmentResource.findFirst({ where: { id: dto.resourceId, businessId, deletedAt: null, isActive: true, isBookable: true }, select: { id: true } }),
    ]);
    if (!servicio) throw new NotFoundException('Ese servicio no existe.');
    if (!recurso) throw new NotFoundException('Esa agenda no existe.');

    const maxOccurrences = config.maximo > 0 ? Math.min(dto.occurrences, config.maximo) : dto.occurrences;
    const horario = await horarioDelNegocioDb(this.prisma, businessId, negocio.settings);
    const serie: SerieTurnoFijo = { frequency: dto.frequency, startDate: dto.startDate, maxOccurrences };
    const { fechas, salteadas } = generarOcurrencias(serie, dto.startDate, sumarDias(dto.startDate, HORIZONTE_DIAS), { horario, saltearFeriados: config.saltearFeriados });

    const resultado = await this.prisma.$transaction(async (tx) => {
      const cliente = await resolverCliente(tx, businessId, dto);
      const s = await tx.appointmentRecurringSeries.create({
        data: {
          businessId, customerId: cliente.id, customerName: cliente.name.slice(0, 120), customerPhone: cliente.phone.slice(0, 40),
          resourceId: dto.resourceId, serviceId: dto.serviceId, frequency: dto.frequency, weekday: diaDeSemana(dto.startDate),
          startMin: dto.startMin, startDate: dto.startDate, maxOccurrences,
        },
      });
      const { creados, salteados } = await this.materializarOcurrencias(tx, {
        businessId, seriesId: s.id, fechas, cliente, serviceId: dto.serviceId, resourceId: dto.resourceId, startMin: dto.startMin, crearTurno, ...opciones,
      });
      // Ningún turno entró: no se deja una serie vacía.
      if (creados.length === 0) throw new ConflictException('Ninguno de esos horarios está libre. Probá otro día u otra hora.');
      return { seriesId: s.id, creados, salteados };
    }, { timeout: 60_000, maxWait: 10_000 });

    await this.audit.registrar({
      businessId, memberId: opciones.memberId, entityType: 'appointment_recurring_series', entityId: resultado.seriesId, action: 'CREATE',
      changes: [{ field: 'frequency', before: null, after: dto.frequency }, { field: 'appointments', before: null, after: resultado.creados.length }],
    });
    const fila = await this.prisma.appointmentRecurringSeries.findFirst({ where: { id: resultado.seriesId, businessId }, include: this.incluir() });
    return {
      series: aDto(fila!),
      created: resultado.creados,
      skipped: [...salteadas.map((x) => x.fecha), ...resultado.salteados].sort(),
    };
  }

  /**
   * Materializa las fechas de una serie pidiéndole cada turno a `crearTurno`
   * (inyectado: el núcleo de P1), dentro de `tx`. Un turno que no entra (400 /
   * 409 del núcleo) se saltea y se informa; cualquier otro error corta todo.
   */
  async materializarOcurrencias(
    tx: Prisma.TransactionClient,
    p: {
      businessId: string; seriesId: string; fechas: string[]; cliente: Pick<ClienteResuelto, 'id' | 'name' | 'phone' | 'email'>;
      serviceId: string; resourceId: string; startMin: number; crearTurno: CrearTurno; memberId: string | null; origin: AppointmentOrigin;
    },
  ): Promise<{ creados: { id: string; date: Fecha }[]; salteados: Fecha[] }> {
    const creados: { id: string; date: Fecha }[] = [];
    const salteados: Fecha[] = [];
    for (const date of p.fechas) {
      await tx.$executeRawUnsafe('SAVEPOINT turno_fijo');
      try {
        const t = await p.crearTurno({
          businessId: p.businessId, serviceId: p.serviceId, resourceId: p.resourceId, date, startMin: p.startMin,
          customerId: p.cliente.id, customerName: p.cliente.name, customerPhone: p.cliente.phone, customerEmail: p.cliente.email,
          origin: p.origin, createdByMemberId: p.memberId, recurringSeriesId: p.seriesId,
        }, tx);
        await tx.$executeRawUnsafe('RELEASE SAVEPOINT turno_fijo');
        creados.push({ id: t.id, date });
      } catch (err) {
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT turno_fijo');
        if (err instanceof HttpException && [400, 409].includes(err.getStatus())) { salteados.push(date); continue; }
        throw err;
      }
    }
    return { creados, salteados };
  }

  /** Terminar la serie: deja de estar activa y se cancelan los turnos que quedan por delante. */
  async terminar(businessId: string, memberId: string | null, id: string, motivo = 'Terminó el turno fijo', txExterna?: Db): Promise<TurnoFijoDto> {
    await this.contexto.delNegocio(businessId, txExterna);
    const ahora = new Date();
    const cancelados = await enTransaccion(this.prisma, txExterna, async (tx) => {
      const s = await tx.appointmentRecurringSeries.findFirst({ where: { id, businessId }, select: { id: true } });
      if (!s) throw new NotFoundException('Ese turno fijo no existe.');
      await tx.appointmentRecurringSeries.updateMany({ where: { id, businessId, isActive: true }, data: { isActive: false, endedAt: ahora } });
      // Los turnos de una serie se dan desde el panel, sin seña online: cancelarlos
      // no tiene reembolsos. Los avisos y la lista de espera los dispara el
      // núcleo cuando exista una cancelación en lote (ver informe de P4).
      const { count } = await tx.appointment.updateMany({
        where: { businessId, recurringSeriesId: id, startsAt: { gt: ahora }, status: { in: ['PENDING', 'CONFIRMED'] } },
        data: { status: 'CANCELLED', cancelledAt: ahora, cancelledBy: 'BUSINESS', cancelReason: motivo.slice(0, 300) },
      });
      return count;
    });
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_recurring_series', entityId: id, action: 'DEACTIVATE', changes: [{ field: 'cancelledAppointments', before: null, after: cancelados }] });
    const fila = await (txExterna ?? this.prisma).appointmentRecurringSeries.findFirst({ where: { id, businessId }, include: this.incluir() });
    return aDto(fila!);
  }

  /**
   * Un turno de la serie quedó ausente (NO_SHOW): con `liberarAusencias` de la
   * config (0 = nunca), a la N-ésima ausencia la serie se termina y el horario
   * se libera. Para llamar desde la transición de estado del núcleo.
   */
  async registrarAusencia(businessId: string, seriesId: string, tx: Db = this.prisma): Promise<{ terminada: boolean }> {
    const negocio = await this.contexto.delNegocio(businessId, tx);
    const { config } = this.contexto.funcion(negocio.settings, 'turno-fijo');
    if (config.liberarAusencias <= 0) return { terminada: false };
    const ausencias = await tx.appointment.count({ where: { businessId, recurringSeriesId: seriesId, status: 'NO_SHOW' } });
    if (ausencias < config.liberarAusencias) return { terminada: false };
    await this.terminar(businessId, null, seriesId, `Se liberó el turno fijo después de ${ausencias} ausencias`, tx);
    return { terminada: true };
  }

  private incluir() {
    return {
      resource: { select: { name: true } },
      service: { select: { name: true } },
      appointments: { where: { startsAt: { gte: new Date() } }, select: { id: true, startsAt: true, status: true }, orderBy: { startsAt: 'asc' as const } },
    };
  }
}

const aDto = (s: SerieConNombres): TurnoFijoDto => ({
  id: s.id, customerName: s.customerName, resourceId: s.resourceId, resourceName: s.resource.name, serviceId: s.serviceId, serviceName: s.service.name,
  frequency: s.frequency, weekday: s.weekday, startMin: s.startMin, startDate: s.startDate, maxOccurrences: s.maxOccurrences, isActive: s.isActive,
  upcoming: s.appointments.map((a) => ({ id: a.id, date: fechaArgentina(a.startsAt), status: a.status })),
});
