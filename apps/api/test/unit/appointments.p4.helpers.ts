// Ayudas compartidas por los tests de Avanzado de Turnos (P4): un negocio de
// turnos con su configuración, el servicio de contexto real armado sobre un
// Prisma mockeado a mano, y un auditor que no hace nada.
import { AvanzadoContextoService } from '../../src/appointments/avanzado/comun/contexto.service';
import type { AvanzadoTurnos } from '../../src/appointments/appointments.types';

export const BIZ = 'biz-p4';
export const OTRO_BIZ = 'biz-ajeno';

const H = (h: number) => h * 60;
/** Lunes a viernes 9–13 y 16–20; sábado 9–13; domingo cerrado. */
export const SEMANA = [
  [[H(9), H(13)], [H(16), H(20)]], [[H(9), H(13)], [H(16), H(20)]], [[H(9), H(13)], [H(16), H(20)]],
  [[H(9), H(13)], [H(16), H(20)]], [[H(9), H(13)], [H(16), H(20)]], [[H(9), H(13)]], [],
];

export function settings(over: Record<string, unknown> = {}) {
  return {
    id: 'set-1', businessId: BIZ, rubroKey: 'barberia', agendaMode: 'PROFESSIONAL', advanced: null as AvanzadoTurnos | null,
    weekSchedule: SEMANA, vacationEnabled: false, vacationFrom: null, vacationTo: null, vacationMessage: null,
    slotMin: 30, bufferMin: 0, minAdvanceMin: 0, maxAdvanceDays: 30, letChooseResource: true, offerAnyResource: true,
    waitlistEnabled: true, waitlistAcceptMin: 30, loyaltyStamps: 0, messages: null,
    ...over,
  };
}

/** advanced con las funciones dadas prendidas (y su config, si viene). */
export function avanzado(funciones: Record<string, Record<string, unknown> | true>): AvanzadoTurnos {
  return Object.fromEntries(Object.entries(funciones).map(([f, c]) => [f, c === true ? { on: true } : { on: true, config: c }])) as AvanzadoTurnos;
}

export function negocioFila(over: Record<string, unknown> = {}, settingsOver: Record<string, unknown> = {}) {
  return {
    id: BIZ, name: 'Barbería Don Julio', subdomain: 'donjulio', isActive: true, isPaused: false, isDemo: false, vertical: 'APPOINTMENTS',
    appointmentSettings: settings(settingsOver), ...over,
  };
}

/**
 * El contexto real (verifica vertical, interruptor y add-on) sobre un
 * `prisma.business.findFirst` mockeado. Devuelve también los mocks para
 * afirmar sobre ellos.
 */
export function contexto(opts: { addon?: boolean; settings?: Record<string, unknown>; negocio?: Record<string, unknown> | null } = {}) {
  const fila = opts.negocio === null ? null : negocioFila(opts.negocio ?? {}, opts.settings ?? {});
  const business = { findFirst: jest.fn().mockResolvedValue(fila) };
  const businesses = { hasActiveAddon: jest.fn().mockResolvedValue(opts.addon ?? true) };
  const svc = new AvanzadoContextoService({ business } as never, businesses as never);
  return { svc, business, businesses };
}

export const auditor = () => ({ registrar: jest.fn().mockResolvedValue(undefined) });

/** Un `$transaction` interactivo que corre el callback con el mismo objeto (o con `tx` si se pasa). */
export function conTransaccion<T extends Record<string, unknown>>(prisma: T, tx?: Record<string, unknown>): T & { $transaction: jest.Mock; $executeRaw: jest.Mock; $executeRawUnsafe: jest.Mock } {
  const p = prisma as T & { $transaction: jest.Mock; $executeRaw: jest.Mock; $executeRawUnsafe: jest.Mock };
  p.$executeRaw = jest.fn().mockResolvedValue(1);
  p.$executeRawUnsafe = jest.fn().mockResolvedValue(0);
  p.$transaction = jest.fn((fn: (t: unknown) => unknown) => fn(tx ?? p));
  return p;
}

export const OWNER = { type: 'member' as const, memberId: 'm-owner', businessId: BIZ, businessMode: 'FULL' as const, roleId: 'r-1', roleName: 'owner', permissions: [] as string[] };
export const empleado = (permissions: string[]) => ({ ...OWNER, memberId: 'm-emp', roleName: 'Empleado', permissions });

// ── Una tabla en memoria con la semántica mínima de Prisma ──────────────────
// Para probar concurrencia de verdad: `updateMany` evalúa la condición y
// escribe en el mismo instante (como una fila bloqueada por Postgres), y cada
// lectura cede el turno (await) para que dos operaciones se intercalen.

type Fila = Record<string, unknown>;
const tick = () => new Promise((r) => setImmediate(r));

function cumple(fila: Fila, where: Fila): boolean {
  return Object.entries(where).every(([k, cond]) => {
    const v = fila[k];
    if (cond === null) return v === null || v === undefined;
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ('gte' in c && !(Number(v) >= Number(c.gte))) return false;
      if ('gt' in c && !(v !== null && v !== undefined && +(v as number) > +(c.gt as number))) return false;
      if ('lt' in c && !(v !== null && v !== undefined && +(v as number) < +(c.lt as number))) return false;
      if ('in' in c && !(c.in as unknown[]).includes(v)) return false;
      if ('not' in c && c.not === null && (v === null || v === undefined)) return false;
      return true;
    }
    return v === cond;
  });
}

export function tabla(filas: Fila[]) {
  const datos = filas.map((f) => ({ ...f }));
  return {
    datos,
    findFirst: jest.fn(async ({ where }: { where: Fila }) => { await tick(); const f = datos.find((x) => cumple(x, where)); return f ? { ...f } : null; }),
    updateMany: jest.fn(async ({ where, data }: { where: Fila; data: Fila }) => {
      await tick();
      let count = 0;
      for (const f of datos) {
        if (!cumple(f, where)) continue;
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'decrement' in (v as Fila)) f[k] = Math.round((Number(f[k]) - Number((v as Fila).decrement)) * 100) / 100;
          else if (v && typeof v === 'object' && 'increment' in (v as Fila)) f[k] = Number(f[k]) + Number((v as Fila).increment);
          else f[k] = v;
        }
        count++;
      }
      return { count };
    }),
  };
}
