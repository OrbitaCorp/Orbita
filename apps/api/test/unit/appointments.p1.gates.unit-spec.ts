import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSION_KEY } from '../../src/common/decorators/require-permission.decorator';
import { REQUIRES_ADDON_KEY } from '../../src/common/decorators/requires-addon.decorator';
import { AppointmentsSettingsController } from '../../src/appointments/panel/appointments-settings.controller';
import { AppointmentServicesController } from '../../src/appointments/panel/appointment-services.controller';
import { AppointmentResourcesController } from '../../src/appointments/panel/appointment-resources.controller';
import { AppointmentsController, PERMISO_DETALLE } from '../../src/appointments/panel/appointments.controller';
import { AppointmentsAgendaController } from '../../src/appointments/panel/appointments-agenda.controller';
import { AppointmentsPanelModule } from '../../src/appointments/panel/appointments-panel.module';
import { AppointmentsModule } from '../../src/appointments/appointments.module';

// Gates de permiso de P1 (CONTRATO.md § P1, columna "Permiso"). Se mira el
// metadato del decorador, como en funciones-pagas.gates: lo que se olvida es
// poner el decorador, no la lógica del guard.

type Ctrl = new (...args: never[]) => object;
const permisoDe = (c: Ctrl, metodo: string): string | undefined => {
  const handler = (c.prototype as Record<string, unknown>)[metodo];
  expect(typeof handler).toBe('function'); // atrapa un método renombrado
  return Reflect.getMetadata(PERMISSION_KEY, handler as object);
};

const GATES: [string, Ctrl, string, string | undefined][] = [
  ['GET settings (cualquier miembro)', AppointmentsSettingsController, 'get', undefined],
  ['PUT settings/business', AppointmentsSettingsController, 'updateBusiness', 'appointments.settings.manage'],
  ['PUT settings/site', AppointmentsSettingsController, 'updateSite', 'appointments.settings.manage'],
  ['PUT settings/schedule', AppointmentsSettingsController, 'updateSchedule', 'appointments.settings.manage'],
  ['PUT settings/booking', AppointmentsSettingsController, 'updateBooking', 'appointments.settings.manage'],
  ['PUT settings/messages', AppointmentsSettingsController, 'updateMessages', 'appointments.settings.manage'],
  ['PUT settings/payments', AppointmentsSettingsController, 'updatePayments', 'appointments.settings.manage'],
  ['PUT settings/whatsapp', AppointmentsSettingsController, 'updateWhatsapp', 'appointments.settings.manage'],
  ['GET services', AppointmentServicesController, 'list', 'appointments.agenda.view'],
  ['POST services', AppointmentServicesController, 'create', 'appointments.services.manage'],
  ['PUT services/order', AppointmentServicesController, 'order', 'appointments.services.manage'],
  ['PUT services/:id', AppointmentServicesController, 'update', 'appointments.services.manage'],
  ['DELETE services/:id', AppointmentServicesController, 'remove', 'appointments.services.manage'],
  ['GET resources', AppointmentResourcesController, 'list', 'appointments.agenda.view'],
  ['POST resources', AppointmentResourcesController, 'create', 'appointments.team.manage'],
  ['PUT resources/:id', AppointmentResourcesController, 'update', 'appointments.team.manage'],
  ['DELETE resources/:id', AppointmentResourcesController, 'remove', 'appointments.team.manage'],
  ['GET appointments', AppointmentsController, 'list', 'appointments.agenda.view'],
  ['GET appointments/availability', AppointmentsController, 'availability', 'appointments.agenda.manage'],
  ['GET appointments/availability/range', AppointmentsController, 'availabilityRange', 'appointments.agenda.manage'],
  ['POST appointments', AppointmentsController, 'create', 'appointments.agenda.manage'],
  ['PATCH appointments/:id/status', AppointmentsController, 'changeStatus', 'appointments.agenda.manage'],
  ['POST appointments/:id/move', AppointmentsController, 'move', 'appointments.agenda.manage'],
  ['POST appointments/:id/deposit', AppointmentsController, 'deposit', 'appointments.cash.charge'],
  ['PATCH appointments/:id/note', AppointmentsController, 'note', 'appointments.agenda.manage'],
  ['GET appointments/:id/message', AppointmentsController, 'message', 'appointments.clients.contact'],
  ['POST appointments/:id/messages', AppointmentsController, 'sendMessage', 'appointments.clients.contact'],
  ['GET appointments/agenda/day', AppointmentsAgendaController, 'day', 'appointments.agenda.view'],
  ['GET appointments/agenda/range', AppointmentsAgendaController, 'range', 'appointments.agenda.view'],
  ['GET appointments/summary', AppointmentsAgendaController, 'summary', 'appointments.agenda.view'],
];

describe('P1 — permisos de cada endpoint', () => {
  it.each(GATES)('%s', (_n, c, metodo, permiso) => {
    expect(permisoDe(c, metodo)).toBe(permiso);
    // Nada de P1 es de Avanzado.
    expect(Reflect.getMetadata(REQUIRES_ADDON_KEY, (c.prototype as Record<string, object>)[metodo])).toBeUndefined();
  });

  it('todos los handlers de los controllers de P1 están en la lista (o es el detalle, que chequea adentro)', () => {
    for (const c of [AppointmentsSettingsController, AppointmentServicesController, AppointmentResourcesController, AppointmentsController, AppointmentsAgendaController]) {
      const metodos = Object.getOwnPropertyNames(c.prototype).filter((m) => m !== 'constructor');
      for (const m of metodos) {
        const listado = GATES.some(([, cc, mm]) => cc === c && mm === m) || (c === AppointmentsController && m === 'detail');
        expect(`${c.name}.${m}: ${listado}`).toBe(`${c.name}.${m}: true`);
      }
    }
  });

  it('las rutas son las del contrato', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AppointmentsSettingsController)).toBe('appointments/settings');
    expect(Reflect.getMetadata(PATH_METADATA, AppointmentServicesController)).toBe('appointments/services');
    expect(Reflect.getMetadata(PATH_METADATA, AppointmentResourcesController)).toBe('appointments/resources');
    expect(Reflect.getMetadata(PATH_METADATA, AppointmentsController)).toBe('appointments');
    expect(Reflect.getMetadata(PATH_METADATA, AppointmentServicesController.prototype.order)).toBe('order');
    expect(Reflect.getMetadata(PATH_METADATA, AppointmentsAgendaController.prototype.summary)).toBe('summary');
  });

  it('PUT services/order se declara antes que PUT services/:id', () => {
    const metodos = Object.getOwnPropertyNames(AppointmentServicesController.prototype);
    expect(metodos.indexOf('order')).toBeLessThan(metodos.indexOf('update'));
  });

  it('el controller con GET :id va último en el módulo, y el módulo está registrado en AppointmentsModule', () => {
    const controllers = Reflect.getMetadata('controllers', AppointmentsPanelModule) as Ctrl[];
    expect(controllers[controllers.length - 1]).toBe(AppointmentsController);
    expect(Reflect.getMetadata('imports', AppointmentsModule)).toContain(AppointmentsPanelModule);
  });
});

describe('GET appointments/:id — deja pasar lo que no es un id', () => {
  const ctx = (permissions: string[], roleName = 'Recepción') => ({ type: 'member', memberId: 'm-1', businessId: 'biz-1', businessMode: 'FULL', roleId: 'r', roleName, permissions });
  const armar = () => {
    const panel = { detalle: jest.fn().mockResolvedValue({ id: 'x' }) };
    const c = new AppointmentsController(panel as any);
    const res = { json: jest.fn() };
    const next = jest.fn();
    return { c, panel, res, next };
  };

  it('"clients", "team" o un id inválido siguen de largo sin chequear permisos', async () => {
    const { c, panel, res, next } = armar();
    for (const id of ['clients', 'team', 'roles', 'earnings', '123']) {
      await c.detail(ctx([]) as any, id, res as any, next);
    }
    expect(next).toHaveBeenCalledTimes(5);
    expect(panel.detalle).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it(`un UUID pide ${PERMISO_DETALLE} (el dueño pasa siempre)`, async () => {
    const id = '8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e';
    const { c, panel, res, next } = armar();
    await expect(c.detail(ctx([]) as any, id, res as any, next)).rejects.toThrow(new ForbiddenException('Permiso requerido: appointments.agenda.view'));
    await c.detail(ctx(['appointments.agenda.view']) as any, id, res as any, next);
    await c.detail(ctx([], 'owner') as any, id, res as any, next);
    expect(panel.detalle).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ id: 'x' });
    expect(next).not.toHaveBeenCalled();
  });

  it('un cliente de la tienda (JWT de customer) no entra', async () => {
    const { c, res, next } = armar();
    await expect(c.detail({ type: 'customer', customerId: 'c', businessId: 'biz-1' } as any, '8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e', res as any, next)).rejects.toThrow(ForbiddenException);
  });
});
