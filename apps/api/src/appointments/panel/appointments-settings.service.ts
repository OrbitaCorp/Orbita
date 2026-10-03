import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AppointmentSettings, Prisma } from '@prisma/client';
import { AuditService, CambioAuditoria } from '../../audit/audit.service';
import { BusinessesService } from '../../businesses/businesses.service';
import type { MemberContext } from '../../common/types/auth-context.type';
import { whereSucursalPrincipal } from '../../common/utils/sucursal-principal';
import { MercadopagoService } from '../../mercadopago/mercadopago.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { AparienciaTurnos, AvanzadoTurnos, SettingsDto } from '../appointments.types';
import { ESTADOS_ACTIVOS } from '../appointments.types';
import { RubroTurnos, grillasDe, modalidadesPosibles } from '../catalogo/rubros';
import { errorSemana, errorTramos, esFecha, fechaYMinutos, leerSemana, leerTramos, tramosDelNegocio, tramosDelRecurso } from '../horarios/horarios';
import {
  UpdateBookingDto, UpdateBusinessDto, UpdateMessagesDto, UpdatePaymentsDto, UpdateScheduleDto, UpdateSiteDto, UpdateWhatsappDto,
} from './dto/settings.dto';
import { errorTextoMensaje, leerMensajes } from './lib/mensajes';
import { tiene } from './lib/permisos';
import { horarioNegocioDe, num } from './lib/serializar';

/** Texto opcional: undefined = no se toca; null o '' = se borra. */
const texto = (v: string | null | undefined): string | null | undefined => (v === undefined ? undefined : v === null || v.trim() === '' ? null : v.trim());

/** Solo lo que vino (sin los undefined), para no pisar lo que no se mandó. */
const definidos = <T extends Record<string, unknown>>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Las funciones del catálogo de rubros que dependen solo del modo de agenda. */
const segunModo = (s: Pick<AppointmentSettings, 'agendaMode'>): RubroTurnos => ({ modo: s.agendaMode }) as RubroTurnos;

const CAMPOS_NEGOCIO = ['name', 'description', 'address', 'latitude', 'longitude', 'city', 'neighborhood', 'floor', 'directions', 'homeZones', 'modalities', 'phone', 'whatsapp', 'email', 'instagram'];

/**
 * Configuración de un negocio de Turnos (CONTRATO.md § P1.1) y el helper único
 * del módulo que verifica que el negocio sea de turnos (`delNegocio`).
 */
@Injectable()
export class AppointmentsSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    private readonly mercadopago: MercadopagoService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  /**
   * Las settings de Turnos del negocio. Si el negocio no es de turnos
   * (`vertical !== APPOINTMENTS`, o no tiene appointment_settings, o está
   * borrado): 404 "Este negocio no usa Turnos". Todo endpoint del panel
   * empieza por acá (CONTRATO.md § 0, "Vertical").
   */
  async delNegocio(businessId: string): Promise<AppointmentSettings> {
    const settings = await this.prisma.appointmentSettings.findFirst({
      where: { businessId, business: { vertical: 'APPOINTMENTS', deletedAt: null } },
    });
    if (!settings) throw new NotFoundException('Este negocio no usa Turnos');
    return settings;
  }

  // ── GET ────────────────────────────────────────────────────────────────────

  async leer(member: MemberContext): Promise<SettingsDto> {
    const businessId = member.businessId;
    const s = await this.delNegocio(businessId);
    const [negocio, sitio, sucursal, config, especiales, mp, hasAdvanced] = await Promise.all([
      this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true, description: true, subdomain: true } }),
      this.prisma.storefrontConfig.findFirst({ where: { businessId }, select: { logoUrl: true } }),
      this.prisma.branch.findFirst({ where: whereSucursalPrincipal(businessId), select: { address: true, latitude: true, longitude: true } }),
      this.prisma.businessConfig.findFirst({
        where: { businessId },
        select: { whatsapp: true, email: true, instagram: true, transferAlias: true, transferCbu: true, transferHolder: true },
      }),
      this.prisma.appointmentSpecialDay.findMany({ where: { businessId }, orderBy: { date: 'asc' } }),
      this.mercadopago.getStatus(businessId),
      this.businesses.hasActiveAddon(businessId, 'ADVANCED'),
    ]);
    // Alias/CBU y el número de WhatsApp: solo para quien configura.
    const configura = tiene(member, 'appointments.settings.manage');

    return {
      rubroKey: s.rubroKey,
      agendaMode: s.agendaMode,
      business: {
        name: negocio?.name ?? '',
        description: negocio?.description ?? null,
        logoUrl: sitio?.logoUrl ?? null,
        subdomain: negocio?.subdomain ?? '',
        address: sucursal?.address ?? null,
        latitude: sucursal?.latitude === null || sucursal?.latitude === undefined ? null : Number(sucursal.latitude),
        longitude: sucursal?.longitude === null || sucursal?.longitude === undefined ? null : Number(sucursal.longitude),
        city: s.city,
        neighborhood: s.neighborhood,
        floor: s.floor,
        directions: s.directions,
        homeZones: s.homeZones,
        modalities: s.modalities,
        phone: s.phone,
        whatsapp: config?.whatsapp ?? null,
        email: config?.email ?? null,
        instagram: config?.instagram ?? null,
      },
      site: { siteForm: s.siteForm === 'simple' ? 'simple' : 'web', simpleDesign: s.simpleDesign, appearance: (s.appearance as AparienciaTurnos | null) ?? null },
      schedule: {
        weekSchedule: leerSemana(s.weekSchedule),
        specialDays: especiales.map((e) => ({ id: e.id, date: e.date, kind: e.kind, ranges: e.kind === 'SPECIAL' ? leerTramos(e.ranges) : [], reason: e.reason })),
        vacation: { enabled: s.vacationEnabled, from: s.vacationFrom, to: s.vacationTo, message: s.vacationMessage },
      },
      rules: {
        minAdvanceMin: s.minAdvanceMin,
        maxAdvanceDays: s.maxAdvanceDays,
        slotMin: s.slotMin,
        bufferMin: s.bufferMin,
        confirmation: s.confirmation === 'manual' ? 'manual' : 'auto',
        letChooseResource: s.letChooseResource,
        offerAnyResource: s.offerAnyResource,
        maxActivePerCustomer: s.maxActivePerCustomer,
        waitlistEnabled: s.waitlistEnabled,
        waitlistAcceptMin: s.waitlistAcceptMin,
        classDefaultCapacity: s.classDefaultCapacity,
        classOpenDays: s.classOpenDays,
        classMinEnrolled: s.classMinEnrolled,
        askInsurance: s.askInsurance,
        askDni: s.askDni,
        askReason: s.askReason,
        rescheduleEnabled: s.rescheduleEnabled,
        rescheduleUntilHours: s.rescheduleUntilHours,
        rescheduleMax: s.rescheduleMax,
        depositEnabled: s.depositEnabled,
        depositType: s.depositType === 'fixed' ? 'fixed' : 'percent',
        depositPercent: s.depositPercent,
        depositFixed: num(s.depositFixed),
        depositForNoShows: s.depositForNoShows,
      },
      policy: {
        cancelUntilHours: s.cancelUntilHours,
        depositOutOfWindow: s.depositOutOfWindow === 'credit' ? 'credit' : 'forfeit',
        toleranceMin: s.toleranceMin,
      },
      account: {
        accountEnabled: s.accountEnabled,
        welcomeDiscountPercent: s.welcomeDiscountPercent,
        loyaltyStamps: s.loyaltyStamps,
        promosEnabled: s.promosEnabled,
      },
      payments: {
        mercadopago: { connected: mp.connected, mpUserName: mp.mpUserName },
        onlineCharge: (['deposit', 'total', 'customer_choice'].includes(s.onlineCharge) ? s.onlineCharge : 'deposit') as SettingsDto['payments']['onlineCharge'],
        onSiteMethods: s.onSiteMethods,
        transferAlias: configura ? config?.transferAlias ?? null : null,
        transferCbu: configura ? config?.transferCbu ?? null : null,
        transferHolder: configura ? config?.transferHolder ?? null : null,
        showTransferData: s.showTransferData,
      },
      messages: leerMensajes(s.messages, s.agendaMode),
      whatsapp: { connected: s.whatsappConnected, number: configura ? s.whatsappNumber : null, provider: process.env.WHATSAPP_PROVIDER || 'stub' },
      advanced: (s.advanced as AvanzadoTurnos | null) ?? {},
      hasAdvanced,
    };
  }

  // ── PUT por pestaña ────────────────────────────────────────────────────────

  async actualizarNegocio(member: MemberContext, dto: UpdateBusinessDto): Promise<SettingsDto> {
    const businessId = member.businessId;
    const s = await this.delNegocio(businessId);
    if (dto.modalities.length === 0) throw new BadRequestException('Elegí al menos una forma de atender.');
    const posibles = modalidadesPosibles(segunModo(s));
    if (dto.modalities.some((m) => !posibles.includes(m))) throw new BadRequestException('Una cancha o una clase no se llevan a domicilio.');

    const antes = await this.leer(member);
    const sucursal = definidos({ address: texto(dto.address), latitude: dto.latitude, longitude: dto.longitude });
    const email = texto(dto.email);
    const contacto = definidos({ whatsapp: texto(dto.whatsapp), email: email ? email.toLowerCase() : email, instagram: texto(dto.instagram) });

    await this.prisma.$transaction(async (tx) => {
      await tx.business.update({ where: { id: businessId }, data: definidos({ name: dto.name.trim(), description: texto(dto.description) }) });
      if (Object.keys(sucursal).length > 0) await tx.branch.updateMany({ where: whereSucursalPrincipal(businessId), data: sucursal });
      if (Object.keys(contacto).length > 0) {
        await tx.businessConfig.upsert({ where: { businessId }, create: { businessId, ...contacto }, update: contacto });
      }
      await tx.appointmentSettings.updateMany({
        where: { businessId },
        data: definidos({
          city: texto(dto.city), neighborhood: texto(dto.neighborhood), floor: texto(dto.floor), directions: texto(dto.directions),
          homeZones: texto(dto.homeZones), phone: texto(dto.phone), modalities: dto.modalities,
        }),
      });
    });

    const despues = await this.leer(member);
    await this.registrar(member, s.id, AuditService.diferencias(antes.business as unknown as Record<string, unknown>, despues.business as unknown as Record<string, unknown>, CAMPOS_NEGOCIO));
    return despues;
  }

  async actualizarSitio(member: MemberContext, dto: UpdateSiteDto): Promise<SettingsDto> {
    const businessId = member.businessId;
    const s = await this.delNegocio(businessId);
    const actual = (s.appearance as AparienciaTurnos | null)?.plantilla ?? null;
    const nueva = dto.appearance === undefined ? actual : dto.appearance?.plantilla ?? null;
    // Aplicar una plantilla que no es la de fábrica es de Avanzado (`plantillas`).
    // El backend no conoce el catálogo de plantillas del front: cualquier
    // cambio a una plantilla puntual pide el add-on; volver a la de fábrica
    // (sin `plantilla`, o appearance null) no.
    if (nueva && nueva !== actual && !(await this.businesses.hasActiveAddon(businessId, 'ADVANCED'))) {
      throw new ForbiddenException('ADDON_REQUIRED:ADVANCED');
    }
    const appearance = dto.appearance === undefined ? undefined : dto.appearance === null ? Prisma.DbNull : (JSON.parse(JSON.stringify(dto.appearance)) as Prisma.InputJsonValue);

    await this.guardar(businessId, { siteForm: dto.siteForm, simpleDesign: dto.simpleDesign, ...(appearance === undefined ? {} : { appearance }) });
    await this.registrar(member, s.id, AuditService.diferencias(
      { siteForm: s.siteForm, simpleDesign: s.simpleDesign, plantilla: actual },
      { siteForm: dto.siteForm, simpleDesign: dto.simpleDesign, plantilla: nueva },
      ['siteForm', 'simpleDesign', 'plantilla'],
    ));
    return this.leer(member);
  }

  async actualizarHorarios(member: MemberContext, dto: UpdateScheduleDto): Promise<SettingsDto & { affected: number }> {
    const businessId = member.businessId;
    const s = await this.delNegocio(businessId);

    const errorDeSemana = errorSemana(dto.weekSchedule, { exigirUnDiaAbierto: true });
    if (errorDeSemana) throw new BadRequestException(errorDeSemana);
    const fechas = new Set<string>();
    for (const d of dto.specialDays) {
      if (!esFecha(d.date)) throw new BadRequestException(`La fecha ${d.date} no existe.`);
      if (fechas.has(d.date)) throw new BadRequestException('Hay dos días especiales con la misma fecha.');
      fechas.add(d.date);
      const errorDeTramos = errorTramos(d.ranges);
      if (errorDeTramos) throw new BadRequestException(errorDeTramos);
      if (d.kind === 'SPECIAL' && d.ranges.length === 0) throw new BadRequestException('Un día con horario especial necesita al menos un horario.');
    }
    const v = dto.vacation;
    if (v.enabled) {
      if (!v.from || !v.to || !esFecha(v.from) || !esFecha(v.to)) throw new BadRequestException('Elegí desde y hasta cuándo son las vacaciones.');
      if (v.from > v.to) throw new BadRequestException('Las vacaciones tienen que terminar después de empezar.');
    } else if ((v.from && !esFecha(v.from)) || (v.to && !esFecha(v.to))) {
      throw new BadRequestException('Las fechas de las vacaciones no son válidas.');
    }

    const semana = leerSemana(dto.weekSchedule);
    await this.prisma.$transaction(async (tx) => {
      await tx.appointmentSpecialDay.deleteMany({ where: { businessId } });
      if (dto.specialDays.length > 0) {
        await tx.appointmentSpecialDay.createMany({
          data: dto.specialDays.map((d) => ({
            businessId, date: d.date, kind: d.kind, ranges: d.kind === 'SPECIAL' ? leerTramos(d.ranges) : [], reason: texto(d.reason) ?? null,
          })),
        });
      }
      const n = await tx.appointmentSettings.updateMany({
        where: { businessId },
        data: {
          weekSchedule: semana as unknown as Prisma.InputJsonValue,
          vacationEnabled: v.enabled,
          vacationFrom: v.from ?? null,
          vacationTo: v.to ?? null,
          vacationMessage: texto(v.message) ?? null,
        },
      });
      if (n.count === 0) throw new NotFoundException('Este negocio no usa Turnos');
    });

    await this.registrar(member, s.id, AuditService.diferencias(
      { weekSchedule: leerSemana(s.weekSchedule), vacationEnabled: s.vacationEnabled, vacationFrom: s.vacationFrom, vacationTo: s.vacationTo },
      { weekSchedule: semana, vacationEnabled: v.enabled, vacationFrom: v.from ?? null, vacationTo: v.to ?? null },
      ['weekSchedule', 'vacationEnabled', 'vacationFrom', 'vacationTo'],
    ).concat(dto.specialDays.length > 0 ? [{ field: 'specialDays', before: null, after: dto.specialDays.length }] : []));

    const affected = await this.turnosFueraDeHorario(businessId);
    return { ...(await this.leer(member)), affected };
  }

  async actualizarReglas(member: MemberContext, dto: UpdateBookingDto): Promise<SettingsDto> {
    const businessId = member.businessId;
    const s = await this.delNegocio(businessId);
    if (!grillasDe(segunModo(s)).includes(dto.rules.slotMin)) {
      throw new BadRequestException(`La grilla tiene que ser de ${grillasDe(segunModo(s)).join(', ')} minutos.`);
    }
    const data = { ...dto.rules, ...dto.policy, ...dto.account };
    await this.guardar(businessId, data);
    const antes: Record<string, unknown> = { ...s, depositFixed: num(s.depositFixed) };
    await this.registrar(member, s.id, AuditService.diferencias(antes, data, Object.keys(data)));
    return this.leer(member);
  }

  async actualizarMensajes(member: MemberContext, dto: UpdateMessagesDto): Promise<SettingsDto> {
    const businessId = member.businessId;
    const s = await this.delNegocio(businessId);
    const ids = new Set<string>();
    for (const m of dto.mensajes) {
      if (ids.has(m.id)) throw new BadRequestException('Hay dos mensajes iguales en la lista.');
      ids.add(m.id);
      const error = errorTextoMensaje(m.texto);
      if (error) throw new BadRequestException(error);
    }
    const messages = JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue;
    await this.guardar(businessId, { messages });
    await this.registrar(member, s.id, [{ field: 'messages', before: s.messages === null ? null : 'personalizados', after: 'personalizados' }]);
    return this.leer(member);
  }

  async actualizarPagos(member: MemberContext, dto: UpdatePaymentsDto): Promise<SettingsDto> {
    const businessId = member.businessId;
    const s = await this.delNegocio(businessId);
    const transferencia = definidos({ transferAlias: texto(dto.transferAlias), transferCbu: texto(dto.transferCbu), transferHolder: texto(dto.transferHolder) });
    await this.prisma.$transaction(async (tx) => {
      await tx.appointmentSettings.updateMany({
        where: { businessId },
        data: { onlineCharge: dto.onlineCharge, onSiteMethods: dto.onSiteMethods, showTransferData: dto.showTransferData },
      });
      if (Object.keys(transferencia).length > 0) {
        await tx.businessConfig.upsert({ where: { businessId }, create: { businessId, ...transferencia }, update: transferencia });
      }
    });
    // El CBU no se guarda en el registro: alcanza con saber que cambió.
    await this.registrar(member, s.id, [
      ...AuditService.diferencias(
        { onlineCharge: s.onlineCharge, onSiteMethods: s.onSiteMethods, showTransferData: s.showTransferData },
        { onlineCharge: dto.onlineCharge, onSiteMethods: dto.onSiteMethods, showTransferData: dto.showTransferData },
        ['onlineCharge', 'onSiteMethods', 'showTransferData'],
      ),
      ...(Object.keys(transferencia).length > 0 ? [{ field: 'transferData', before: null, after: 'actualizado' }] : []),
    ]);
    return this.leer(member);
  }

  async actualizarWhatsapp(member: MemberContext, dto: UpdateWhatsappDto): Promise<SettingsDto> {
    const businessId = member.businessId;
    const s = await this.delNegocio(businessId);
    // `connected` no se escribe a mano: lo pone el flujo del proveedor (con el STUB, siempre false).
    const numero = dto.number === undefined ? s.whatsappNumber : dto.number || null;
    await this.guardar(businessId, { whatsappNumber: numero });
    await this.registrar(member, s.id, AuditService.diferencias({ whatsappNumber: s.whatsappNumber }, { whatsappNumber: numero }, ['whatsappNumber']));
    return this.leer(member);
  }

  // ── Internos ───────────────────────────────────────────────────────────────

  private async guardar(businessId: string, data: Prisma.AppointmentSettingsUpdateManyMutationInput): Promise<void> {
    const n = await this.prisma.appointmentSettings.updateMany({ where: { businessId }, data });
    if (n.count === 0) throw new NotFoundException('Este negocio no usa Turnos');
  }

  private async registrar(member: MemberContext, settingsId: string, changes: CambioAuditoria[]): Promise<void> {
    if (changes.length === 0) return;
    await this.audit?.registrar({ businessId: member.businessId, memberId: member.memberId, entityType: 'appointment_settings', entityId: settingsId, action: 'UPDATE', changes });
  }

  /**
   * Turnos futuros activos que quedaron fuera del horario (del negocio o de su
   * agenda). No se cancelan: el panel avisa y el dueño decide.
   */
  async turnosFueraDeHorario(businessId: string, ahora = new Date()): Promise<number> {
    const [s, especiales, turnos] = await Promise.all([
      this.delNegocio(businessId),
      this.prisma.appointmentSpecialDay.findMany({ where: { businessId } }),
      this.prisma.appointment.findMany({
        where: { businessId, status: { in: ESTADOS_ACTIVOS }, startsAt: { gte: ahora } },
        select: { startsAt: true, endsAt: true, resource: { select: { workDays: true, ownSchedule: true } } },
      }),
    ]);
    const horario = horarioNegocioDe(s, especiales);
    return turnos.filter((t) => {
      const { fecha, minutos } = fechaYMinutos(t.startsAt);
      const fin = minutos + Math.round((t.endsAt.getTime() - t.startsAt.getTime()) / 60_000);
      const agenda = { workDays: t.resource.workDays, ownSchedule: t.resource.ownSchedule ? leerSemana(t.resource.ownSchedule) : null };
      const tramos = tramosDelRecurso(agenda, tramosDelNegocio(horario, fecha), fecha);
      return !tramos.some(([a, b]) => minutos >= a && fin <= b);
    }).length;
  }
}
