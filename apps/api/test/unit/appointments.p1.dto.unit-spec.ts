import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AvailabilityQueryDto, ChangeStatusDto, CreateAppointmentDto, ListAppointmentsQueryDto, MessageTemplateDto, MoveAppointmentDto, NoteDto, RegisterDepositDto,
} from '../../src/appointments/panel/dto/appointments.dto';
import { UpsertSpaceDto, ListResourcesQueryDto } from '../../src/appointments/panel/dto/resources.dto';
import { ListServicesQueryDto, OrderServicesDto, UpsertServiceDto } from '../../src/appointments/panel/dto/services.dto';
import {
  UpdateBookingDto, UpdateBusinessDto, UpdateMessagesDto, UpdatePaymentsDto, UpdateScheduleDto, UpdateSiteDto, UpdateWhatsappDto,
} from '../../src/appointments/panel/dto/settings.dto';
import { mensajesDeFabrica } from '../../src/appointments/panel/lib/mensajes';
import { reglasInicialesDe, rubroTurnosPorKey } from '../../src/appointments/catalogo/rubros';

// Validación de los DTOs de P1 (ValidationPipe global: whitelist + transform).

const UUID = '8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e';

async function errores<T extends object>(clase: new () => T, plano: object): Promise<string[]> {
  const dto = plainToInstance(clase, plano);
  const lista = await validate(dto, { whitelist: true });
  const props = (es: typeof lista, prefijo = ''): string[] =>
    es.flatMap((e) => [...(e.constraints ? [`${prefijo}${e.property}`] : []), ...props(e.children ?? [], `${prefijo}${e.property}.`)]);
  return props(lista);
}
const valido = async <T extends object>(clase: new () => T, plano: object) => expect(await errores(clase, plano)).toEqual([]);

describe('Servicios', () => {
  const ok = { name: 'Corte', durationMin: 30, price: 12000.5, bookableOnline: true };
  it('acepta lo del contrato', () => valido(UpsertServiceDto, ok));
  it.each([
    ['name vacío', { name: '' }, 'name'],
    ['name de 121', { name: 'x'.repeat(121) }, 'name'],
    ['duración < 5', { durationMin: 4 }, 'durationMin'],
    ['duración > 600', { durationMin: 601 }, 'durationMin'],
    ['duración con decimales', { durationMin: 30.5 }, 'durationMin'],
    ['precio negativo', { price: -1 }, 'price'],
    ['precio con 3 decimales', { price: 1.234 }, 'price'],
    ['precio > 100.000.000', { price: 100_000_001 }, 'price'],
    ['descripción de 501', { description: 'x'.repeat(501) }, 'description'],
    ['bookableOnline faltante', { bookableOnline: undefined }, 'bookableOnline'],
  ])('rechaza %s', async (_n, cambio, campo) => {
    expect(await errores(UpsertServiceDto, { ...ok, ...cambio })).toContain(campo);
  });
  it('order: ids uuid, sin repetir, hasta 200', async () => {
    await valido(OrderServicesDto, { ids: [UUID] });
    expect(await errores(OrderServicesDto, { ids: [UUID, UUID] })).toContain('ids');
    expect(await errores(OrderServicesDto, { ids: ['no'] })).toContain('ids');
    expect(await errores(OrderServicesDto, { ids: Array.from({ length: 201 }, (_, i) => `8b1f0f1e-3b8a-4f7e-9d6e-${String(i).padStart(12, '0')}`) })).toContain('ids');
  });
  it('includeInactive viene como texto en la query', () => {
    expect(plainToInstance(ListServicesQueryDto, { includeInactive: 'true' }).includeInactive).toBe(true);
    expect(plainToInstance(ListServicesQueryDto, { includeInactive: 'false' }).includeInactive).toBe(false);
  });
});

describe('Espacios', () => {
  it('días: al menos uno, sin repetir, 0 a 6', async () => {
    await valido(UpsertSpaceDto, { name: 'Cancha 1', workDays: [0, 1], color: '#AABBCC' });
    const sinDias = plainToInstance(UpsertSpaceDto, { name: 'Cancha 1', workDays: [] });
    const [e] = await validate(sinDias);
    expect(Object.values(e.constraints ?? {})).toContain('Elegí al menos un día.');
    expect(await errores(UpsertSpaceDto, { name: 'C', workDays: [0, 0] })).toContain('workDays');
    expect(await errores(UpsertSpaceDto, { name: 'C', workDays: [7] })).toContain('workDays');
    expect(await errores(UpsertSpaceDto, { name: 'C', workDays: [0], color: 'rojo' })).toContain('color');
    expect(await errores(UpsertSpaceDto, { name: '', workDays: [0] })).toContain('name');
  });
  it('filtro de kind', async () => {
    await valido(ListResourcesQueryDto, { kind: 'SPACE', bookable: 'true' });
    expect(await errores(ListResourcesQueryDto, { kind: 'ROBOT' })).toContain('kind');
  });
});

describe('Turnos', () => {
  const alta = { serviceId: UUID, resourceId: UUID, date: '2026-10-05', startMin: 600, customer: { name: 'José Pérez' } };
  it('alta: acepta un id o "cualquiera"', async () => {
    await valido(CreateAppointmentDto, alta);
    await valido(CreateAppointmentDto, { ...alta, resourceId: 'cualquiera' });
    await valido(CreateAppointmentDto, { ...alta, customer: undefined, customerId: UUID, priceOverride: 1500.25, modality: 'HOME', internalNote: 'ok' });
  });
  it.each([
    ['agenda inventada', { resourceId: 'cualquier-cosa' }, 'resourceId'],
    ['fecha mal escrita', { date: '05/10/2026' }, 'date'],
    ['hora > 1439', { startMin: 1440 }, 'startMin'],
    ['hora negativa', { startMin: -1 }, 'startMin'],
    ['nombre corto', { customer: { name: 'Jo' } }, 'customer.name'],
    ['email inválido', { customer: { name: 'José', email: 'no' } }, 'customer.email'],
    ['precio a mano negativo', { priceOverride: -1 }, 'priceOverride'],
    ['modalidad inventada', { modality: 'ONLINE' }, 'modality'],
    ['nota de 501', { internalNote: 'x'.repeat(501) }, 'internalNote'],
  ])('alta: rechaza %s', async (_n, cambio, campo) => {
    expect(await errores(CreateAppointmentDto, { ...alta, ...cambio })).toContain(campo);
  });
  it('estado: solo los cuatro del panel (PENDING no se elige a mano)', async () => {
    await valido(ChangeStatusDto, { status: 'NO_SHOW', reason: 'x', keepDeposit: true });
    expect(await errores(ChangeStatusDto, { status: 'PENDING' })).toContain('status');
    expect(await errores(ChangeStatusDto, { status: 'CANCELLED', reason: 'x'.repeat(301) })).toContain('reason');
  });
  it('mover, seña, nota y plantilla', async () => {
    await valido(MoveAppointmentDto, { date: '2026-10-05', startMin: 0 });
    expect(await errores(MoveAppointmentDto, { date: '2026-10-05', startMin: 600, resourceId: 'x' })).toContain('resourceId');
    await valido(RegisterDepositDto, { method: 'QR', amount: 10.5, kind: 'BALANCE', reference: 'op' });
    expect(await errores(RegisterDepositDto, { method: 'MERCADOPAGO' })).toContain('method');
    expect(await errores(RegisterDepositDto, { method: 'CASH', amount: 0 })).toContain('amount');
    expect(await errores(RegisterDepositDto, { method: 'CASH', kind: 'PACKAGE' })).toContain('kind');
    await valido(NoteDto, { internalNote: null });
    await valido(NoteDto, { internalNote: 'Trae foto' });
    expect(await errores(NoteDto, {})).toContain('internalNote');
    expect(await errores(NoteDto, { internalNote: 'x'.repeat(501) })).toContain('internalNote');
    await valido(MessageTemplateDto, { template: 'reprogramacion' });
    expect(await errores(MessageTemplateDto, { template: 'hola' })).toContain('template');
  });
  it('listado y disponibilidad', async () => {
    await valido(ListAppointmentsQueryDto, { from: '2026-10-01', to: '2026-10-31', status: 'PENDING,CONFIRMED', q: 'josé', page: '2', limit: '100' });
    expect(await errores(ListAppointmentsQueryDto, { limit: '101' })).toContain('limit');
    expect(await errores(ListAppointmentsQueryDto, { page: '0' })).toContain('page');
    expect(await errores(ListAppointmentsQueryDto, { resourceId: 'x' })).toContain('resourceId');
    await valido(AvailabilityQueryDto, { serviceId: UUID, date: '2026-10-05', resourceId: 'cualquiera', except: UUID });
    expect(await errores(AvailabilityQueryDto, { serviceId: UUID })).toContain('date');
  });
});

describe('Configuración', () => {
  it('negocio: nombre 2–80, modalidades del enum, email válido', async () => {
    await valido(UpdateBusinessDto, { name: 'Barbería', modalities: ['ON_SITE'], email: 'a@b.com', latitude: -34.6, longitude: -58.4 });
    expect(await errores(UpdateBusinessDto, { name: 'B', modalities: ['ON_SITE'] })).toContain('name');
    expect(await errores(UpdateBusinessDto, { name: 'Barbería', modalities: ['ONLINE'] })).toContain('modalities');
    expect(await errores(UpdateBusinessDto, { name: 'Barbería', modalities: ['ON_SITE'], email: 'no' })).toContain('email');
    expect(await errores(UpdateBusinessDto, { name: 'Barbería', modalities: ['ON_SITE'], latitude: 91 })).toContain('latitude');
    expect(await errores(UpdateBusinessDto, { name: 'Barbería', modalities: ['ON_SITE'], directions: 'x'.repeat(401) })).toContain('directions');
  });
  it('sitio: diseño de la lista, apariencia validada (color, radio, foto, secciones)', async () => {
    await valido(UpdateSiteDto, { siteForm: 'web', simpleDesign: 'enlaces', appearance: { color: '#aabbcc', radio: 40, foto: '/turnos/barberia/1.jpg', secciones: [{ id: 'equipo', on: false }] } });
    await valido(UpdateSiteDto, { siteForm: 'web', simpleDesign: 'tarjeta', appearance: { foto: 'https://pub-123abc.r2.dev/negocios/x/foto.webp' } });
    await valido(UpdateSiteDto, { siteForm: 'simple', simpleDesign: 'tarjeta', appearance: null });
    expect(await errores(UpdateSiteDto, { siteForm: 'app', simpleDesign: 'tarjeta' })).toContain('siteForm');
    expect(await errores(UpdateSiteDto, { siteForm: 'web', simpleDesign: 'otro' })).toContain('simpleDesign');
    expect(await errores(UpdateSiteDto, { siteForm: 'web', simpleDesign: 'tarjeta', appearance: { radio: 41 } })).toContain('appearance.radio');
    expect(await errores(UpdateSiteDto, { siteForm: 'web', simpleDesign: 'tarjeta', appearance: { foto: 'https://malicioso.com/x.jpg' } })).toContain('appearance.foto');
    expect(await errores(UpdateSiteDto, { siteForm: 'web', simpleDesign: 'tarjeta', appearance: { secciones: Array(13).fill({ id: 'a', on: true }) } })).toContain('appearance.secciones');
    expect(await errores(UpdateSiteDto, { siteForm: 'web', simpleDesign: 'tarjeta', appearance: { frase: 'x'.repeat(161) } })).toContain('appearance.frase');
  });
  it('horarios: hasta 60 días especiales, kind del enum', async () => {
    await valido(UpdateScheduleDto, { weekSchedule: [], specialDays: [{ date: '2026-12-25', kind: 'CLOSED', ranges: [] }], vacation: { enabled: false } });
    expect(await errores(UpdateScheduleDto, { weekSchedule: [], specialDays: Array(61).fill({ date: '2026-12-25', kind: 'CLOSED', ranges: [] }), vacation: { enabled: false } })).toContain('specialDays');
    expect(await errores(UpdateScheduleDto, { weekSchedule: [], specialDays: [{ date: '25/12', kind: 'FERIADO', ranges: [] }], vacation: { enabled: false } })).toEqual(expect.arrayContaining(['specialDays.0.date', 'specialDays.0.kind']));
  });
  it('reglas: los valores de fábrica son válidos y cada rango del contrato se respeta', async () => {
    const r = reglasInicialesDe(rubroTurnosPorKey('peluqueria')!);
    const body = {
      rules: r, policy: { cancelUntilHours: r.cancelUntilHours, depositOutOfWindow: r.depositOutOfWindow, toleranceMin: r.toleranceMin },
      account: { accountEnabled: true, welcomeDiscountPercent: 10, loyaltyStamps: 6, promosEnabled: true },
    };
    await valido(UpdateBookingDto, body);
    for (const [campo, valor] of [['minAdvanceMin', 30], ['maxAdvanceDays', 10], ['bufferMin', 7], ['maxActivePerCustomer', 4], ['waitlistAcceptMin', 45], ['classDefaultCapacity', 501], ['classOpenDays', 5], ['rescheduleUntilHours', 3], ['rescheduleMax', 4], ['depositPercent', 33], ['depositPercent', 5], ['depositFixed', 10_000_001], ['confirmation', 'nunca']] as const) {
      expect(await errores(UpdateBookingDto, { ...body, rules: { ...r, [campo]: valor } })).toContain(`rules.${campo}`);
    }
    expect(await errores(UpdateBookingDto, { ...body, policy: { ...body.policy, cancelUntilHours: 1 } })).toContain('policy.cancelUntilHours');
    expect(await errores(UpdateBookingDto, { ...body, account: { ...body.account, loyaltyStamps: 7 } })).toContain('account.loyaltyStamps');
  });
  it('mensajes: hasta 10, ids y canales de la lista, texto 1–600', async () => {
    const f = mensajesDeFabrica('PROFESSIONAL');
    await valido(UpdateMessagesDto, f);
    expect(await errores(UpdateMessagesDto, { ...f, mensajes: [{ ...f.mensajes[0], id: 'otro' }] })).toContain('mensajes.0.id');
    expect(await errores(UpdateMessagesDto, { ...f, mensajes: [{ ...f.mensajes[0], canales: ['sms'] }] })).toContain('mensajes.0.canales');
    expect(await errores(UpdateMessagesDto, { ...f, mensajes: [{ ...f.mensajes[0], texto: '' }] })).toContain('mensajes.0.texto');
    expect(await errores(UpdateMessagesDto, { ...f, mensajes: [{ ...f.mensajes[0], cuando: '12345' }] })).toContain('mensajes.0.cuando');
    expect(await errores(UpdateMessagesDto, { ...f, mensajes: Array(11).fill(f.mensajes[0]) })).toContain('mensajes');
  });
  it('pagos y WhatsApp', async () => {
    await valido(UpdatePaymentsDto, { onlineCharge: 'customer_choice', onSiteMethods: ['CASH'], transferCbu: '1'.repeat(22), showTransferData: false });
    expect(await errores(UpdatePaymentsDto, { onlineCharge: 'deposit', onSiteMethods: ['MERCADOPAGO'], showTransferData: true })).toContain('onSiteMethods');
    expect(await errores(UpdatePaymentsDto, { onlineCharge: 'deposit', onSiteMethods: [], transferCbu: '123', showTransferData: true })).toContain('transferCbu');
    await valido(UpdateWhatsappDto, { number: '5491155550101' });
    await valido(UpdateWhatsappDto, {});
    expect(await errores(UpdateWhatsappDto, { number: '+54 11' })).toContain('number');
  });
});
