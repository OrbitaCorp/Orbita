import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReservasCalendariosService } from '../../src/reservas/calendarios/reservas-calendarios.service';
import { instante } from '../../src/reservas/dominio/tiempo';
import { ReservasCatalogoService } from '../../src/reservas/reservas-catalogo.service';
import { ReservasPanelController } from '../../src/reservas/reservas-panel.controller';
import { PERMISSION_KEY } from '../../src/common/decorators/require-permission.decorator';

// La sincronización con el calendario de Airbnb, sin base y sin internet: qué
// bloqueos quedan después de cada corrida, y qué pasa cuando algo falla.

const BIZ = 'biz-1';
const AHORA = instante('2026-11-25', 10 * 60);
const URL_OK = 'https://www.airbnb.com.ar/calendar/ical/123.ics?s=abc';

type Fila = Record<string, unknown>;

/** Lo mínimo de los `where` de Prisma que usa el service: igualdad, in, not, lt/gt/lte/gte, null y OR. */
function coincide(fila: Fila, where: Fila | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return (v as Fila[]).some((w) => coincide(fila, w));
    const x = fila[k];
    if (v === null || typeof v !== 'object' || v instanceof Date) return v instanceof Date ? (x as Date)?.getTime() === v.getTime() : x === v;
    const c = v as Record<string, unknown>;
    const num = (y: unknown) => (y instanceof Date ? y.getTime() : (y as number));
    if ('in' in c && !(c.in as unknown[]).includes(x)) return false;
    if ('not' in c && x === c.not) return false;
    if ('lt' in c && !(x != null && num(x) < num(c.lt))) return false;
    if ('lte' in c && !(x != null && num(x) <= num(c.lte))) return false;
    if ('gt' in c && !(x != null && num(x) > num(c.gt))) return false;
    if ('gte' in c && !(x != null && num(x) >= num(c.gte))) return false;
    return true;
  });
}

function tabla(filas: Fila[]) {
  let n = 0;
  return {
    filas,
    findMany: jest.fn(async (a: { where?: Fila; take?: number; orderBy?: unknown } = {}) => {
      const r = filas.filter((f) => coincide(f, a.where));
      return a.take ? r.slice(0, a.take) : r;
    }),
    findFirst: jest.fn(async (a: { where?: Fila } = {}) => filas.find((f) => coincide(f, a.where)) ?? null),
    count: jest.fn(async (a: { where?: Fila } = {}) => filas.filter((f) => coincide(f, a.where)).length),
    create: jest.fn(async (a: { data: Fila }) => { const f = { id: `id-${++n}`, createdAt: AHORA, activo: true, ultimaSync: null, ultimoError: null, ...a.data }; filas.push(f); return f; }),
    createMany: jest.fn(async (a: { data: Fila[] }) => { for (const d of a.data) filas.push({ id: `b-${++n}`, ...d }); return { count: a.data.length }; }),
    updateMany: jest.fn(async (a: { where?: Fila; data: Fila }) => { const r = filas.filter((f) => coincide(f, a.where)); r.forEach((f) => Object.assign(f, a.data)); return { count: r.length }; }),
    deleteMany: jest.fn(async (a: { where?: Fila } = {}) => {
      const fuera = filas.filter((f) => coincide(f, a.where));
      fuera.forEach((f) => filas.splice(filas.indexOf(f), 1));
      return { count: fuera.length };
    }),
  };
}

const cabana = (over: Fila = {}): Fila => ({ id: 'r-cab', businessId: BIZ, modulo: 'ALQUILERES', tipo: 'ALOJAMIENTO', nombre: 'Cabaña del Monte', activo: true, eliminadoEn: null, datos: { checkIn: 900, checkOut: 600 }, ...over });
const calendario = (over: Fila = {}): Fila => ({ id: 'cal-1', businessId: BIZ, modulo: 'ALQUILERES', recursoId: 'r-cab', nombre: 'Airbnb', url: URL_OK, activo: true, ultimaSync: null, ultimoError: null, createdAt: AHORA, ...over });
const reserva = (entrada: string, salida: string, over: Fila = {}): Fila => ({ id: `res-${entrada}`, businessId: BIZ, recursoId: 'r-cab', codigo: 'Q2R4PS', estado: 'CONFIRMADA', inicio: instante(entrada, 900), fin: instante(salida, 600), retenidaHasta: null, ...over });
const bloqueoDueno = (entrada: string, salida: string, over: Fila = {}): Fila => ({ id: `blo-${entrada}`, businessId: BIZ, modulo: 'ALQUILERES', recursoId: 'r-cab', inicio: instante(entrada, 900), fin: instante(salida, 600), motivo: 'Uso propio', origen: 'DUENO', calendarioId: null, ...over });

const ics = (...eventos: [uid: string, titulo: string, desde: string, hasta: string][]) => [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  ...eventos.flatMap(([uid, titulo, d, h]) => ['BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${titulo}`, `DTSTART;VALUE=DATE:${d.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${h.replace(/-/g, '')}`, 'END:VEVENT']),
  'END:VCALENDAR',
].join('\r\n');

function armar(o: { calendarios?: Fila[]; bloqueos?: Fila[]; reservas?: Fila[]; recursos?: Fila[]; descarga?: unknown } = {}) {
  const t = {
    reservaCalendarioExterno: tabla(o.calendarios ?? [calendario()]),
    reservaBloqueo: tabla(o.bloqueos ?? []),
    reserva: tabla(o.reservas ?? []),
    reservaRecurso: tabla(o.recursos ?? [cabana()]),
  };
  const prisma = { ...t, $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)) } as Record<string, unknown>;
  const catalogo = {
    recurso: jest.fn(async (_b: string, id: string) => {
      const r = t.reservaRecurso.filas.find((x) => x.id === id);
      if (!r) throw new NotFoundException('Ese recurso no existe.');
      return r;
    }),
  };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const svc = new ReservasCalendariosService(prisma as never, catalogo as never, audit as never);
  const descargar = jest.fn(async () => o.descarga ?? { ok: true, texto: ics() });
  svc.descargar = descargar as never;
  const deCalendario = (id = 'cal-1') => t.reservaBloqueo.filas.filter((b) => b.calendarioId === id);
  return { svc, t, descargar, audit, deCalendario };
}

describe('ReservasCalendariosService · sincronizar', () => {
  it('reemplaza los bloqueos del calendario: borra los suyos y crea uno por evento, de check-in a check-out', async () => {
    const viejo = { id: 'viejo', businessId: BIZ, modulo: 'ALQUILERES', recursoId: 'r-cab', origen: 'ICAL', calendarioId: 'cal-1', inicio: instante('2026-12-01', 900), fin: instante('2026-12-03', 600) };
    const { svc, deCalendario, t } = armar({ bloqueos: [viejo], descarga: { ok: true, texto: ics(['a@airbnb.com', 'Reserved', '2026-12-20', '2026-12-27'], ['b@airbnb.com', 'Airbnb (Not available)', '2027-01-05', '2027-01-07']) } });
    await svc.sincronizar(BIZ, 'cal-1', AHORA);
    const quedaron = deCalendario();
    expect(quedaron.map((b) => b.externoUid)).toEqual(['a@airbnb.com', 'b@airbnb.com']);
    expect(quedaron[0]).toMatchObject({ businessId: BIZ, modulo: 'ALQUILERES', recursoId: 'r-cab', origen: 'ICAL', externoTipo: 'RESERVADO', motivo: 'Airbnb' });
    expect((quedaron[0].inicio as Date).toISOString()).toBe(instante('2026-12-20', 900).toISOString());
    expect((quedaron[0].fin as Date).toISOString()).toBe(instante('2026-12-27', 600).toISOString());
    expect(quedaron[1].externoTipo).toBe('CERRADO');
    expect(t.reservaCalendarioExterno.filas[0]).toMatchObject({ ultimaSync: AHORA, ultimoError: null });
  });

  it('no toca los bloqueos del dueño ni los de otro calendario', async () => {
    const dueno = bloqueoDueno('2026-12-10', '2026-12-12');
    const otro = { id: 'otro', businessId: BIZ, modulo: 'ALQUILERES', recursoId: 'r-cab', origen: 'ICAL', calendarioId: 'cal-2', inicio: instante('2026-12-14', 900), fin: instante('2026-12-16', 600) };
    const { svc, t } = armar({ bloqueos: [dueno, otro], descarga: { ok: true, texto: ics(['a', 'Reserved', '2026-12-20', '2026-12-27']) } });
    await svc.sincronizar(BIZ, 'cal-1', AHORA);
    expect(t.reservaBloqueo.filas.map((b) => b.id)).toEqual(expect.arrayContaining(['blo-2026-12-10', 'otro']));
    expect(t.reservaBloqueo.filas).toHaveLength(3);
  });

  it('si la descarga falla, guarda el motivo y deja los bloqueos como estaban', async () => {
    const viejo = { id: 'viejo', businessId: BIZ, modulo: 'ALQUILERES', recursoId: 'r-cab', origen: 'ICAL', calendarioId: 'cal-1', inicio: instante('2026-12-01', 900), fin: instante('2026-12-03', 600) };
    const { svc, deCalendario, t } = armar({ bloqueos: [viejo], descarga: { ok: false, motivo: 'Airbnb respondió 403.' } });
    const dto = await svc.sincronizar(BIZ, 'cal-1', AHORA);
    expect(deCalendario().map((b) => b.id)).toEqual(['viejo']);
    expect(t.reservaCalendarioExterno.filas[0]).toMatchObject({ ultimaSync: AHORA, ultimoError: 'Airbnb respondió 403.' });
    expect(dto.ultimoError).toBe('Airbnb respondió 403.');
  });

  it('un archivo que baja bien pero viene vacío libera lo que había: Airbnb ya no tiene nada tomado', async () => {
    const viejo = { id: 'viejo', businessId: BIZ, modulo: 'ALQUILERES', recursoId: 'r-cab', origen: 'ICAL', calendarioId: 'cal-1', inicio: instante('2026-12-01', 900), fin: instante('2026-12-03', 600) };
    const { svc, deCalendario } = armar({ bloqueos: [viejo], descarga: { ok: true, texto: ics() } });
    await svc.sincronizar(BIZ, 'cal-1', AHORA);
    expect(deCalendario()).toEqual([]);
  });

  it('el eco: lo que Órbita exportó y Airbnb devuelve como no disponible no se vuelve a bloquear', async () => {
    const { svc, deCalendario } = armar({
      reservas: [reserva('2026-12-10', '2026-12-13')],
      bloqueos: [bloqueoDueno('2026-12-15', '2026-12-17')],
      descarga: { ok: true, texto: ics(['e1', 'Airbnb (Not available)', '2026-12-10', '2026-12-13'], ['e2', 'Airbnb (Not available)', '2026-12-15', '2026-12-17'], ['e3', 'Airbnb (Not available)', '2026-12-20', '2026-12-22']) },
    });
    await svc.sincronizar(BIZ, 'cal-1', AHORA);
    expect(deCalendario().map((b) => b.externoUid)).toEqual(['e3']);
  });

  it('cancelar en Órbita libera las noches aunque Airbnb las siga publicando como no disponibles', async () => {
    const { svc, deCalendario } = armar({
      reservas: [reserva('2026-12-10', '2026-12-13', { estado: 'CANCELADA' })],
      descarga: { ok: true, texto: ics(['e1', 'Airbnb (Not available)', '2026-12-10', '2026-12-13']) },
    });
    await svc.sincronizar(BIZ, 'cal-1', AHORA);
    expect(deCalendario()).toEqual([]);
  });

  it('una reserva hecha en Airbnb bloquea siempre, aunque coincida con algo de Órbita', async () => {
    const { svc, deCalendario } = armar({
      reservas: [reserva('2026-12-10', '2026-12-13', { estado: 'CANCELADA' })],
      descarga: { ok: true, texto: ics(['e1', 'Reserved', '2026-12-10', '2026-12-13']) },
    });
    await svc.sincronizar(BIZ, 'cal-1', AHORA);
    expect(deCalendario()).toHaveLength(1);
  });

  it('el mismo UID dos veces crea un solo bloqueo, y lo que ya pasó no se trae', async () => {
    const { svc, deCalendario } = armar({ descarga: { ok: true, texto: ics(['a', 'Reserved', '2026-12-20', '2026-12-27'], ['a', 'Reserved', '2026-12-20', '2026-12-27'], ['viejo', 'Reserved', '2026-10-01', '2026-10-05']) } });
    await svc.sincronizar(BIZ, 'cal-1', AHORA);
    expect(deCalendario().map((b) => b.externoUid)).toEqual(['a']);
  });

  it('si el calendario se desconectó mientras bajaba, no deja bloqueos', async () => {
    const a = armar({ descarga: { ok: true, texto: ics(['a', 'Reserved', '2026-12-20', '2026-12-27']) } });
    a.descargar.mockImplementation(async () => { a.t.reservaCalendarioExterno.filas.splice(0, 1); return { ok: true, texto: ics(['a', 'Reserved', '2026-12-20', '2026-12-27']) }; });
    await expect(a.svc.sincronizar(BIZ, 'cal-1', AHORA)).rejects.toThrow(NotFoundException);
    expect(a.t.reservaBloqueo.filas).toEqual([]);
  });

  it('si la propiedad se borró, el calendario se desconecta solo', async () => {
    const { svc, t } = armar({ recursos: [cabana({ eliminadoEn: AHORA })], descarga: { ok: true, texto: ics(['a', 'Reserved', '2026-12-20', '2026-12-27']) } });
    await expect(svc.sincronizar(BIZ, 'cal-1', AHORA)).rejects.toThrow(NotFoundException);
    expect(t.reservaCalendarioExterno.filas).toEqual([]);
    expect(t.reservaBloqueo.filas).toEqual([]);
  });

  it('el calendario de otro negocio no existe', async () => {
    const { svc, descargar } = armar();
    await expect(svc.sincronizar('otro-negocio', 'cal-1', AHORA)).rejects.toThrow(NotFoundException);
    expect(descargar).not.toHaveBeenCalled();
  });
});

describe('ReservasCalendariosService · conflictos', () => {
  it('una reserva de Airbnb que pisa una reserva activa de Órbita aparece con su código', async () => {
    const { svc } = armar({
      reservas: [reserva('2026-12-21', '2026-12-24'), reserva('2027-02-01', '2027-02-03', { id: 'lejos', codigo: 'ZZZZZZ' }), reserva('2026-12-22', '2026-12-23', { id: 'cancelada', estado: 'CANCELADA', codigo: 'CANCEL' })],
      descarga: { ok: true, texto: ics(['a', 'Reserved', '2026-12-20', '2026-12-27'], ['b', 'Airbnb (Not available)', '2027-02-01', '2027-02-03']) },
    });
    const dto = await svc.sincronizar(BIZ, 'cal-1', AHORA);
    // Solo lo RESERVADO es un conflicto: un "no disponible" sobre una reserva propia es, casi seguro, su eco.
    expect(dto.conflictos).toEqual([{ reservaId: 'res-2026-12-21', codigo: 'Q2R4PS', desde: '2026-12-21', hasta: '2026-12-24' }]);
  });

  it('dos estadías que se tocan (una sale el día que entra la otra) no son un conflicto', async () => {
    const { svc } = armar({ reservas: [reserva('2026-12-27', '2026-12-29')], descarga: { ok: true, texto: ics(['a', 'Reserved', '2026-12-20', '2026-12-27']) } });
    expect((await svc.sincronizar(BIZ, 'cal-1', AHORA)).conflictos).toEqual([]);
  });
});

describe('ReservasCalendariosService · conectar y desconectar', () => {
  const dto = { modulo: 'ALQUILERES' as const, recursoId: 'r-cab', nombre: 'Airbnb', url: URL_OK };

  it('conectar guarda el calendario, lo sincroniza en el momento y lo devuelve con su estado', async () => {
    const { svc, t, descargar, audit } = armar({ calendarios: [], descarga: { ok: true, texto: ics(['a', 'Reserved', '2026-12-20', '2026-12-27']) } });
    const r = await svc.conectar(BIZ, 'm-1', dto, AHORA);
    expect(r).toMatchObject({ recursoId: 'r-cab', nombre: 'Airbnb', url: URL_OK, ultimoError: null, conflictos: [] });
    expect(r.ultimaSync).toBe(AHORA.toISOString());
    expect(descargar).toHaveBeenCalledWith(URL_OK);
    expect(t.reservaBloqueo.filas).toHaveLength(1);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ, memberId: 'm-1', entityType: 'reserva_calendario', action: 'CREATE' }));
  });

  it('rechaza una URL que no es de Airbnb sin guardar nada', async () => {
    const { svc, t } = armar({ calendarios: [] });
    await expect(svc.conectar(BIZ, 'm-1', { ...dto, url: 'https://evil.example/a.ics' }, AHORA)).rejects.toThrow(/enlace de Airbnb/);
    expect(t.reservaCalendarioExterno.filas).toEqual([]);
  });

  it('solo se conecta a un alojamiento, del mismo módulo', async () => {
    await expect(armar({ calendarios: [], recursos: [cabana({ tipo: 'CANCHA' })] }).svc.conectar(BIZ, 'm-1', dto, AHORA)).rejects.toThrow(BadRequestException);
    await expect(armar({ calendarios: [], recursos: [cabana({ modulo: 'TURNOS' })] }).svc.conectar(BIZ, 'm-1', dto, AHORA)).rejects.toThrow(BadRequestException);
  });

  it('hasta 3 calendarios por propiedad, y el mismo enlace no se conecta dos veces', async () => {
    const tres = [1, 2, 3].map((n) => calendario({ id: `c${n}`, url: `https://www.airbnb.com/calendar/ical/${n}.ics` }));
    await expect(armar({ calendarios: tres }).svc.conectar(BIZ, 'm-1', dto, AHORA)).rejects.toThrow(/Hasta 3 calendarios/);
    await expect(armar({ calendarios: [calendario()] }).svc.conectar(BIZ, 'm-1', dto, AHORA)).rejects.toThrow(ConflictException);
  });

  it('desconectar borra el calendario y solo sus bloqueos, y dice cuántos eran', async () => {
    const suyos = [1, 2].map((n) => ({ id: `s${n}`, businessId: BIZ, modulo: 'ALQUILERES', recursoId: 'r-cab', origen: 'ICAL', calendarioId: 'cal-1', inicio: AHORA, fin: AHORA }));
    const { svc, t } = armar({ bloqueos: [...suyos, bloqueoDueno('2026-12-10', '2026-12-12')] });
    expect(await svc.desconectar(BIZ, 'm-1', 'cal-1')).toEqual({ ok: true, bloqueos: 2 });
    expect(t.reservaCalendarioExterno.filas).toEqual([]);
    expect(t.reservaBloqueo.filas.map((b) => b.id)).toEqual(['blo-2026-12-10']);
    await expect(svc.desconectar(BIZ, 'm-1', 'cal-1')).rejects.toThrow(NotFoundException);
  });
});

describe('ReservasCalendariosService · la corrida automática', () => {
  it('toma hasta 5, los de hace más de 30 minutos o los que nunca corrieron, y un error en uno no frena a los demás', async () => {
    const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000);
    const cals = [
      calendario({ id: 'reciente', ultimaSync: hace(10) }),
      calendario({ id: 'viejo-1', ultimaSync: hace(45) }),
      calendario({ id: 'nunca', ultimaSync: null }),
      calendario({ id: 'apagado', ultimaSync: null, activo: false }),
      ...[2, 3, 4, 5].map((n) => calendario({ id: `viejo-${n}`, ultimaSync: hace(40 + n) })),
    ];
    const a = armar({ calendarios: cals });
    a.descargar.mockImplementation(async () => { if (a.descargar.mock.calls.length === 1) throw new Error('se rompió'); return { ok: true, texto: ics() }; });
    const r = await a.svc.sincronizarVencidos(AHORA);
    expect(r).toEqual({ revisados: 5, conError: 1 });
    expect(a.descargar).toHaveBeenCalledTimes(5);
    expect(a.t.reservaCalendarioExterno.filas.find((c) => c.id === 'reciente')?.ultimaSync).toEqual(hace(10));
    expect(a.t.reservaCalendarioExterno.filas.find((c) => c.id === 'apagado')?.ultimaSync).toBeNull();
  });
});

describe('ReservasCalendariosService · el .ics que se le da a Airbnb', () => {
  it('exporta reservas activas y bloqueos del dueño como eventos de día entero, sin datos personales', async () => {
    const { svc } = armar({
      reservas: [reserva('2026-12-10', '2026-12-13', { clienteNombre: 'Ana Ríos', clienteTelefono: '3757 55-0101', clienteEmail: 'ana@ejemplo.com', precio: 316000, notas: 'Llegamos tarde' })],
      bloqueos: [bloqueoDueno('2026-12-15', '2026-12-17'), bloqueoDueno('2026-12-28', '2026-12-30', { id: 'de-todo-el-negocio', recursoId: null, motivo: 'Vacaciones de Juan' })],
    });
    const texto = await svc.feed(BIZ, 'r-cab', AHORA);
    expect(texto).toContain('X-WR-CALNAME:Cabaña del Monte');
    expect(texto).toContain('UID:res-2026-12-10@orbita.site');
    expect(texto).toContain('DTSTART;VALUE=DATE:20261210');
    expect(texto).toContain('DTEND;VALUE=DATE:20261213');
    expect(texto).toContain('SUMMARY:Reservado');
    expect(texto).toContain('DTSTART;VALUE=DATE:20261215');
    expect(texto).toContain('DTEND;VALUE=DATE:20261217');
    expect(texto).toContain('SUMMARY:No disponible');
    expect(texto).toContain('UID:de-todo-el-negocio@orbita.site');
    for (const privado of ['Ana', '3757', 'ejemplo.com', '316000', 'Llegamos', 'Vacaciones', 'Uso propio', 'Q2R4PS']) expect(texto).not.toContain(privado);
  });

  it('no exporta lo que vino de Airbnb, ni las reservas canceladas o vencidas, ni lo que ya pasó', async () => {
    const { svc } = armar({
      reservas: [
        reserva('2026-12-10', '2026-12-13', { id: 'cancelada', estado: 'CANCELADA' }),
        reserva('2026-12-14', '2026-12-16', { id: 'vencida', estado: 'VENCIDA' }),
        reserva('2026-12-17', '2026-12-19', { id: 'retenida-vencida', estado: 'RETENIDA', retenidaHasta: new Date(AHORA.getTime() - 60_000) }),
        reserva('2026-12-20', '2026-12-22', { id: 'retenida-viva', estado: 'RETENIDA', retenidaHasta: new Date(AHORA.getTime() + 60_000) }),
        reserva('2026-10-01', '2026-10-05', { id: 'pasada' }),
      ],
      bloqueos: [{ id: 'de-airbnb', businessId: BIZ, modulo: 'ALQUILERES', recursoId: 'r-cab', origen: 'ICAL', calendarioId: 'cal-1', inicio: instante('2027-01-05', 900), fin: instante('2027-01-07', 600) }],
    });
    const texto = await svc.feed(BIZ, 'r-cab', AHORA);
    expect(texto).toContain('UID:retenida-viva@orbita.site');
    for (const id of ['cancelada', 'vencida', 'retenida-vencida', 'pasada', 'de-airbnb']) expect(texto).not.toContain(`UID:${id}@`);
  });

  it('un recurso de otro negocio, inactivo, borrado o que no es alojamiento no tiene calendario', async () => {
    await expect(armar().svc.feed('otro-negocio', 'r-cab', AHORA)).rejects.toThrow(NotFoundException);
    await expect(armar({ recursos: [cabana({ activo: false })] }).svc.feed(BIZ, 'r-cab', AHORA)).rejects.toThrow(NotFoundException);
    await expect(armar({ recursos: [cabana({ eliminadoEn: AHORA })] }).svc.feed(BIZ, 'r-cab', AHORA)).rejects.toThrow(NotFoundException);
    await expect(armar({ recursos: [cabana({ tipo: 'CANCHA' })] }).svc.feed(BIZ, 'r-cab', AHORA)).rejects.toThrow(NotFoundException);
    await expect(armar().svc.feed(BIZ, 'no-existe', AHORA)).rejects.toThrow(NotFoundException);
  });

  it('sin nada ocupado devuelve un calendario válido y vacío', async () => {
    const texto = await armar().svc.feed(BIZ, 'r-cab', AHORA);
    expect(texto.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(texto.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(texto).not.toContain('BEGIN:VEVENT');
  });

  it('lo que exporta y lo que reconoce como eco usan las mismas fechas: ida y vuelta sin bloquear de más', async () => {
    const a = armar({ reservas: [reserva('2026-12-10', '2026-12-13')], bloqueos: [bloqueoDueno('2026-12-15', '2026-12-17')] });
    // Airbnb importa el calendario de Órbita y lo devuelve entero como "no disponible".
    const devuelto = (await a.svc.feed(BIZ, 'r-cab', AHORA)).replace(/SUMMARY:[^\r\n]*/g, 'SUMMARY:Airbnb (Not available)').replace(/@orbita\.site/g, '@airbnb.com');
    a.descargar.mockResolvedValue({ ok: true, texto: devuelto });
    await a.svc.sincronizar(BIZ, 'cal-1', AHORA);
    expect(a.deCalendario()).toEqual([]);
  });
});

describe('Calendarios externos · guardas del catálogo', () => {
  const catalogoCon = (o: { bloqueos?: Fila[]; calendarios?: Fila[]; reservas?: Fila[] } = {}) => {
    const t = { reservaBloqueo: tabla(o.bloqueos ?? []), reservaCalendarioExterno: tabla(o.calendarios ?? []), reserva: tabla(o.reservas ?? []), reservaRecurso: tabla([cabana()]) };
    const prisma = { ...t, $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)) } as Record<string, unknown>;
    return { t, svc: new ReservasCatalogoService(prisma as never, { registrar: jest.fn().mockResolvedValue(undefined) } as never) };
  };
  const deAirbnb = (id: string, calendarioId = 'cal-1'): Fila => ({ id, businessId: BIZ, modulo: 'ALQUILERES', recursoId: 'r-cab', origen: 'ICAL', calendarioId, inicio: AHORA, fin: AHORA });

  it('un bloqueo que vino de Airbnb no se quita a mano: se dice cómo se va', async () => {
    const { svc, t } = catalogoCon({ bloqueos: [deAirbnb('b-ical'), bloqueoDueno('2026-12-10', '2026-12-12')] });
    await expect(svc.borrarBloqueo(BIZ, 'm-1', 'b-ical')).rejects.toThrow(/viene de Airbnb/);
    expect(t.reservaBloqueo.filas).toHaveLength(2);
    await expect(svc.borrarBloqueo(BIZ, 'm-1', 'blo-2026-12-10')).resolves.toEqual({ ok: true });
    expect(t.reservaBloqueo.filas.map((b) => b.id)).toEqual(['b-ical']);
  });

  it('borrar una propiedad se lleva sus calendarios y lo que habían bloqueado, y nada de otra propiedad', async () => {
    const { svc, t } = catalogoCon({
      calendarios: [calendario(), calendario({ id: 'cal-otra', recursoId: 'r-otra' })],
      bloqueos: [deAirbnb('b1'), deAirbnb('b2'), { ...deAirbnb('b-otra', 'cal-otra'), recursoId: 'r-otra' }],
    });
    await svc.borrarRecurso(BIZ, 'm-1', 'r-cab', AHORA);
    expect(t.reservaCalendarioExterno.filas.map((c) => c.id)).toEqual(['cal-otra']);
    expect(t.reservaBloqueo.filas.map((b) => b.id)).toEqual(['b-otra']);
  });
});

describe('Calendarios externos · quién puede qué en el panel', () => {
  const permiso = (metodo: keyof ReservasPanelController) => Reflect.getMetadata(PERMISSION_KEY, ReservasPanelController.prototype[metodo] as object);

  it('ver pide reservas.view; conectar y desconectar, reservas.config; sincronizar ahora, reservas.manage', () => {
    expect(permiso('calendarios')).toBe('reservas.view');
    expect(permiso('conectarCalendario')).toBe('reservas.config');
    expect(permiso('desconectarCalendario')).toBe('reservas.config');
    expect(permiso('sincronizarCalendario')).toBe('reservas.manage');
  });

  it('bloquear y desbloquear a mano siguen siendo de quien gestiona las reservas', () => {
    expect(permiso('crearBloqueo')).toBe('reservas.manage');
    expect(permiso('borrarBloqueo')).toBe('reservas.manage');
  });
});
