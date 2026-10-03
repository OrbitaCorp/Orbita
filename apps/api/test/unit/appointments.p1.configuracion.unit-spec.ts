import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppointmentsSettingsService } from '../../src/appointments/panel/appointments-settings.service';
import { SEMANA_PARTIDA, reglasInicialesDe, rubroTurnosPorKey } from '../../src/appointments/catalogo/rubros';
import { instanteDe } from '../../src/appointments/horarios/horarios';
import type { MemberContext } from '../../src/common/types/auth-context.type';

// Configuración de Turnos (CONTRATO.md § P1.1) con Prisma mockeado.

const BIZ = 'biz-1';
const dueno: MemberContext = { type: 'member', memberId: 'm-1', businessId: BIZ, businessMode: 'FULL', roleId: 'r', roleName: 'owner', permissions: [] };
const empleado: MemberContext = { ...dueno, memberId: 'm-2', roleName: 'Barbero', permissions: ['appointments.agenda.view'] };

const settings = (s: Record<string, unknown> = {}) => ({
  id: 's-1', businessId: BIZ, rubroKey: 'barberia', agendaMode: 'PROFESSIONAL', siteForm: 'web', simpleDesign: 'tarjeta', appearance: null,
  weekSchedule: SEMANA_PARTIDA, vacationEnabled: false, vacationFrom: null, vacationTo: null, vacationMessage: null,
  modalities: ['ON_SITE'], city: null, neighborhood: null, floor: null, directions: null, homeZones: null, phone: null,
  ...reglasInicialesDe(rubroTurnosPorKey('barberia')!), onlineCharge: 'deposit', onSiteMethods: ['CASH'], showTransferData: true,
  messages: null, whatsappConnected: false, whatsappNumber: '5491155550101', whatsappProviderData: null, advanced: null, ...s,
});

function armar(o: { settings?: Record<string, unknown> | null; addon?: boolean; turnos?: unknown[] } = {}) {
  const fila = o.settings === null ? null : settings(o.settings);
  const tx = {
    business: { update: jest.fn() },
    branch: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    businessConfig: { upsert: jest.fn() },
    appointmentSettings: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    appointmentSpecialDay: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    appointmentSettings: { findFirst: jest.fn().mockResolvedValue(fila), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    business: { findUnique: jest.fn().mockResolvedValue({ name: 'Barbería', description: null, subdomain: 'barberia' }) },
    storefrontConfig: { findFirst: jest.fn().mockResolvedValue({ logoUrl: null }) },
    branch: { findFirst: jest.fn().mockResolvedValue({ address: 'Calle 1', latitude: '-34.600000', longitude: null }) },
    businessConfig: { findFirst: jest.fn().mockResolvedValue({ whatsapp: '11', email: null, instagram: null, transferAlias: 'alias.mp', transferCbu: '0'.repeat(22), transferHolder: 'Ana' }) },
    appointmentSpecialDay: { findMany: jest.fn().mockResolvedValue([]) },
    appointment: { findMany: jest.fn().mockResolvedValue(o.turnos ?? []) },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const businesses = { hasActiveAddon: jest.fn().mockResolvedValue(o.addon ?? false) };
  const mp = { getStatus: jest.fn().mockResolvedValue({ connected: true, mpUserId: '1', mpUserName: 'Ana MP', scopes: [] }) };
  const audit = { registrar: jest.fn() };
  const svc = new AppointmentsSettingsService(prisma as any, businesses as any, mp as any, audit as any);
  return { svc, prisma, tx, businesses, audit };
}

describe('delNegocio', () => {
  it('pide vertical APPOINTMENTS, settings y negocio no borrado; si no, 404 "Este negocio no usa Turnos"', async () => {
    const { svc, prisma } = armar({ settings: null });
    await expect(svc.delNegocio(BIZ)).rejects.toThrow(new NotFoundException('Este negocio no usa Turnos'));
    expect(prisma.appointmentSettings.findFirst).toHaveBeenCalledWith({ where: { businessId: BIZ, business: { vertical: 'APPOINTMENTS', deletedAt: null } } });
  });
});

describe('GET settings', () => {
  it('arma SettingsDto: datos de cada tabla, mensajes de fábrica y el proveedor stub', async () => {
    const { svc } = armar();
    const s = await svc.leer(dueno);
    expect(s.business).toMatchObject({ name: 'Barbería', subdomain: 'barberia', address: 'Calle 1', latitude: -34.6, longitude: null, whatsapp: '11' });
    expect(s.payments).toMatchObject({ mercadopago: { connected: true, mpUserName: 'Ana MP' }, transferCbu: '0'.repeat(22) });
    expect(s.whatsapp).toEqual({ connected: false, number: '5491155550101', provider: 'stub' });
    expect(s.messages.mensajes[0].id).toBe('confirmacion');
    expect(s.rules.slotMin).toBe(30);
    expect(s.advanced).toEqual({});
    expect(s.hasAdvanced).toBe(false);
  });

  it('sin settings.manage: alias, CBU, titular y número de WhatsApp en null', async () => {
    const { svc } = armar();
    const s = await svc.leer(empleado);
    expect(s.payments).toMatchObject({ transferAlias: null, transferCbu: null, transferHolder: null });
    expect(s.whatsapp.number).toBeNull();
  });
});

describe('PUT business', () => {
  const dto = { name: '  Barbería Lorena ', modalities: ['ON_SITE'] as ('ON_SITE' | 'HOME')[], address: '', email: 'HOLA@x.com', city: 'CABA' };

  it('al menos una modalidad, y ninguna que el rubro no permita', async () => {
    await expect(armar().svc.actualizarNegocio(dueno, { ...dto, modalities: [] })).rejects.toThrow(new BadRequestException('Elegí al menos una forma de atender.'));
    await expect(armar({ settings: { agendaMode: 'COURT' } }).svc.actualizarNegocio(dueno, { ...dto, modalities: ['HOME'] }))
      .rejects.toThrow(new BadRequestException('Una cancha o una clase no se llevan a domicilio.'));
    await expect(armar({ settings: { agendaMode: 'CLASS' } }).svc.actualizarNegocio(dueno, { ...dto, modalities: ['ON_SITE', 'HOME'] })).rejects.toThrow(BadRequestException);
  });

  it('escribe cada dato en su tabla, siempre con el businessId del token', async () => {
    const { svc, tx } = armar();
    await svc.actualizarNegocio(dueno, dto);
    expect(tx.business.update).toHaveBeenCalledWith({ where: { id: BIZ }, data: { name: 'Barbería Lorena' } });
    expect(tx.branch.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ, isDefault: true }, data: { address: null } });
    expect(tx.businessConfig.upsert).toHaveBeenCalledWith({ where: { businessId: BIZ }, create: { businessId: BIZ, email: 'hola@x.com' }, update: { email: 'hola@x.com' } });
    expect(tx.appointmentSettings.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: { city: 'CABA', modalities: ['ON_SITE'] } });
  });
});

describe('PUT site', () => {
  it('cambiar a una plantilla puntual pide Avanzado (403 ADDON_REQUIRED:ADVANCED)', async () => {
    const { svc, prisma } = armar();
    await expect(svc.actualizarSitio(dueno, { siteForm: 'web', simpleDesign: 'tarjeta', appearance: { plantilla: 'barberia-nocturno' } }))
      .rejects.toThrow(new ForbiddenException('ADDON_REQUIRED:ADVANCED'));
    expect(prisma.appointmentSettings.updateMany).not.toHaveBeenCalled();
  });

  it('con Avanzado se guarda; sin cambiar la plantilla, o volviendo a la de fábrica, no hace falta', async () => {
    const con = armar({ addon: true });
    await con.svc.actualizarSitio(dueno, { siteForm: 'web', simpleDesign: 'tarjeta', appearance: { plantilla: 'barberia-nocturno' } });
    expect(con.prisma.appointmentSettings.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: { siteForm: 'web', simpleDesign: 'tarjeta', appearance: { plantilla: 'barberia-nocturno' } } });
    // (sin add-on: hasActiveAddon da false, y aun así se guarda)
    const misma = armar({ settings: { appearance: { plantilla: 'barberia-nocturno' } } });
    await misma.svc.actualizarSitio(dueno, { siteForm: 'web', simpleDesign: 'tarjeta', appearance: { plantilla: 'barberia-nocturno', color: '#000000' } });
    expect(misma.prisma.appointmentSettings.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: expect.objectContaining({ appearance: { plantilla: 'barberia-nocturno', color: '#000000' } }) });
    const fabrica = armar({ settings: { appearance: { plantilla: 'barberia-nocturno' } } });
    await fabrica.svc.actualizarSitio(dueno, { siteForm: 'simple', simpleDesign: 'portada', appearance: null });
    expect(fabrica.prisma.appointmentSettings.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: expect.objectContaining({ siteForm: 'simple', simpleDesign: 'portada' }) });
  });
});

describe('PUT schedule', () => {
  const semana = SEMANA_PARTIDA;
  const ok = { weekSchedule: semana, specialDays: [], vacation: { enabled: false } };

  it.each([
    ['semana incompleta', { weekSchedule: semana.slice(0, 5) }, 'La semana tiene que traer los siete días, de lunes a domingo.'],
    ['todo cerrado', { weekSchedule: Array(7).fill([]) }, 'Dejá abierto al menos un día de la semana.'],
    ['tramo al revés', { weekSchedule: [[[600, 500]], [], [], [], [], [], []] }, 'El lunes: A la mañana, el cierre tiene que ser después de la apertura.'],
    ['días especiales repetidos', { specialDays: [{ date: '2026-12-25', kind: 'CLOSED', ranges: [] }, { date: '2026-12-25', kind: 'CLOSED', ranges: [] }] }, 'Hay dos días especiales con la misma fecha.'],
    ['especial sin tramos', { specialDays: [{ date: '2026-12-24', kind: 'SPECIAL', ranges: [] }] }, 'Un día con horario especial necesita al menos un horario.'],
    ['tramos de un especial', { specialDays: [{ date: '2026-12-24', kind: 'SPECIAL', ranges: [[600, 700], [650, 800]] }] }, 'La tarde tiene que empezar cuando termina la mañana, o después.'],
    ['fecha que no existe', { specialDays: [{ date: '2026-02-30', kind: 'CLOSED', ranges: [] }] }, 'La fecha 2026-02-30 no existe.'],
    ['vacaciones al revés', { vacation: { enabled: true, from: '2026-02-10', to: '2026-02-01' } }, 'Las vacaciones tienen que terminar después de empezar.'],
    ['vacaciones sin fechas', { vacation: { enabled: true } }, 'Elegí desde y hasta cuándo son las vacaciones.'],
  ])('%s → 400', async (_n, cambio, mensaje) => {
    await expect(armar().svc.actualizarHorarios(dueno, { ...ok, ...cambio } as any)).rejects.toThrow(new BadRequestException(mensaje));
  });

  it('reemplaza la lista entera de días especiales en una transacción y devuelve affected', async () => {
    const lunes = '2030-01-07';
    const { svc, tx } = armar({
      turnos: [
        { startsAt: instanteDe(lunes, 600), endsAt: instanteDe(lunes, 630), resource: { workDays: [0, 1, 2, 3, 4, 5], ownSchedule: null } },
        { startsAt: instanteDe(lunes, 900), endsAt: instanteDe(lunes, 930), resource: { workDays: [0, 1, 2, 3, 4, 5], ownSchedule: null } },
      ],
    });
    const res = await svc.actualizarHorarios(dueno, { ...ok, specialDays: [{ date: '2026-12-24', kind: 'SPECIAL', ranges: [[600, 720]], reason: 'Nochebuena' }] });
    expect(tx.appointmentSpecialDay.deleteMany).toHaveBeenCalledWith({ where: { businessId: BIZ } });
    expect(tx.appointmentSpecialDay.createMany).toHaveBeenCalledWith({ data: [{ businessId: BIZ, date: '2026-12-24', kind: 'SPECIAL', ranges: [[600, 720]], reason: 'Nochebuena' }] });
    // 15:00 cae en el corte del mediodía: queda fuera del horario.
    expect(res.affected).toBe(1);
  });
});

describe('PUT booking / messages / payments / whatsapp', () => {
  it('la grilla tiene que estar en grillasDe(rubro)', async () => {
    const r = reglasInicialesDe(rubroTurnosPorKey('barberia')!);
    const body = { rules: { ...r, slotMin: 90 }, policy: { cancelUntilHours: 24, depositOutOfWindow: 'forfeit' as const, toleranceMin: 10 }, account: { accountEnabled: true, welcomeDiscountPercent: 10, loyaltyStamps: 6, promosEnabled: true } };
    await expect(armar().svc.actualizarReglas(dueno, body as any)).rejects.toThrow(new BadRequestException('La grilla tiene que ser de 15, 30, 60 minutos.'));
    await expect(armar({ settings: { agendaMode: 'COURT' } }).svc.actualizarReglas(dueno, body as any)).resolves.toBeDefined();
  });

  it('mensajes: variable desconocida o repetidos → 400', async () => {
    const base = { wa: true, email: true, numero: '', firma: true };
    const m = { id: 'confirmacion' as const, on: true, canales: ['wa' as const], cuando: '', texto: 'Hola {nombre}' };
    await expect(armar().svc.actualizarMensajes(dueno, { ...base, mensajes: [{ ...m, texto: 'Hola {apellido}' }] }))
      .rejects.toThrow(new BadRequestException('La variable {apellido} no existe. Podés usar: {nombre}, {servicio}, {fecha}, {hora}, {profesional}, {negocio}, {link}.'));
    await expect(armar().svc.actualizarMensajes(dueno, { ...base, mensajes: [m, m] })).rejects.toThrow(new BadRequestException('Hay dos mensajes iguales en la lista.'));
  });

  it('pagos: alias/CBU/titular a business_config; el CBU no queda en la auditoría', async () => {
    const { svc, tx, audit } = armar();
    await svc.actualizarPagos(dueno, { onlineCharge: 'total', onSiteMethods: ['CASH', 'QR'], transferCbu: '1'.repeat(22), showTransferData: false });
    expect(tx.businessConfig.upsert).toHaveBeenCalledWith({ where: { businessId: BIZ }, create: { businessId: BIZ, transferCbu: '1'.repeat(22) }, update: { transferCbu: '1'.repeat(22) } });
    expect(JSON.stringify(audit.registrar.mock.calls)).not.toContain('1'.repeat(22));
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'appointment_settings', action: 'UPDATE', memberId: 'm-1' }));
  });

  it('WhatsApp: solo el número; connected no se toca', async () => {
    const { svc, prisma } = armar();
    await svc.actualizarWhatsapp(dueno, { number: '1155550101' });
    expect(prisma.appointmentSettings.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: { whatsappNumber: '1155550101' } });
  });
});
