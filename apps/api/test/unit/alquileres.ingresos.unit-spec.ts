import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AlquileresIngresosService } from '../../src/alquileres/alquileres-ingresos.service';
import { AlquileresPanelController } from '../../src/alquileres/alquileres-panel.controller';
import { PERMISSION_KEY } from '../../src/common/decorators/require-permission.decorator';

// Importar las ganancias de Airbnb, sin base: qué queda guardado después de
// cada importación, y qué se rechaza sin guardar nada.

const BIZ = 'biz-1';
const AHORA = new Date('2026-11-26T13:00:00.000Z');
const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const AJENA = '99999999-9999-4999-8999-999999999999';
const CANCHA = '33333333-3333-4333-8333-333333333333';

type Fila = Record<string, unknown>;

/** Lo mínimo de los `where` de Prisma que usa el service: igualdad, in, lt/lte/gt/gte. */
function coincide(fila: Fila, where: Fila | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    const x = fila[k];
    if (v === null || typeof v !== 'object' || v instanceof Date) return x === v;
    const c = v as Record<string, never>;
    if ('in' in c && !(c.in as unknown[]).includes(x)) return false;
    if ('lt' in c && !((x as never) < c.lt)) return false;
    if ('lte' in c && !((x as never) <= c.lte)) return false;
    if ('gt' in c && !((x as never) > c.gt)) return false;
    if ('gte' in c && !((x as never) >= c.gte)) return false;
    return true;
  });
}

function tabla(filas: Fila[]) {
  let n = 0;
  const de = (a: { where?: Fila } = {}) => filas.filter((f) => coincide(f, a.where));
  return {
    filas,
    findMany: jest.fn(async (a: { where?: Fila } = {}) => de(a)),
    create: jest.fn(async (a: { data: Fila }) => { const f = { id: `id-${++n}`, ...a.data }; filas.push(f); return f; }),
    createMany: jest.fn(async (a: { data: Fila[] }) => { for (const d of a.data) filas.push({ id: `id-${++n}`, ...d }); return { count: a.data.length }; }),
    updateMany: jest.fn(async (a: { where?: Fila; data: Fila }) => { const r = de(a); r.forEach((f) => Object.assign(f, a.data)); return { count: r.length }; }),
    deleteMany: jest.fn(async (a: { where?: Fila } = {}) => { const fuera = de(a); fuera.forEach((f) => filas.splice(filas.indexOf(f), 1)); return { count: fuera.length }; }),
    aggregate: jest.fn(async (a: { where?: Fila } = {}) => {
      const r = de(a);
      const max = (k: string) => r.reduce<unknown>((m, f) => (m === null || (f[k] as never) > (m as never) ? f[k] : m), null);
      return { _count: { _all: r.length }, _max: { importadoEn: max('importadoEn'), salida: max('salida') } };
    }),
  };
}

const CABECERA = 'Date,Type,Confirmation Code,Start Date,Nights,Guest,Listing,Details,Reference,Currency,Amount,Paid Out,Host Fee,Cleaning Fee';
const fila = (codigo: string, inicio: string, noches: number, aviso: string, moneda: string, monto: number, huesped = 'Ana') =>
  `,Reservation,${codigo},${inicio},${noches},${huesped},${aviso},,,${moneda},${monto},,0,0`;
const csv = (...filas: string[]) => [CABECERA, ...filas].join('\n');
/** Dos estadías en pesos de la Cabaña y una en dólares del Depto. */
const TRES = csv(
  fila('HM1', '12/20/2026', 7, 'Cabaña del Monte', 'ARS', 580000),
  fila('HM2', '11/29/2026', 3, 'Cabaña del Monte', 'ARS', 120000, 'Luis'),
  fila('HM3', '12/28/2026', 2, 'Depto Centro', 'USD', 300, 'Sofía'),
);
const UNIONES = [{ nombre: 'Cabaña del Monte', recursoId: P1 }, { nombre: 'Depto Centro', recursoId: P2 }];

function armar(o: { ingresos?: Fila[]; avisos?: Fila[] } = {}) {
  const t = { alquilerIngresoExterno: tabla(o.ingresos ?? []), alquilerAvisoExterno: tabla(o.avisos ?? []) };
  const prisma = { ...t, $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)) } as Record<string, unknown>;
  const recursos: Record<string, Fila> = {
    [P1]: { id: P1, businessId: BIZ, modulo: 'ALQUILERES', tipo: 'ALOJAMIENTO' },
    [P2]: { id: P2, businessId: BIZ, modulo: 'ALQUILERES', tipo: 'ALOJAMIENTO' },
    [CANCHA]: { id: CANCHA, businessId: BIZ, modulo: 'ALQUILERES', tipo: 'CANCHA' },
    [AJENA]: { id: AJENA, businessId: 'otro-negocio', modulo: 'ALQUILERES', tipo: 'ALOJAMIENTO' },
  };
  const catalogo = {
    recurso: jest.fn(async (businessId: string, id: string) => {
      const r = recursos[id];
      if (!r || r.businessId !== businessId) throw new NotFoundException('Ese recurso no existe.');
      return r;
    }),
  };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const svc = new AlquileresIngresosService(prisma as never, catalogo as never, audit as never);
  return { svc, t, audit, recursos };
}

describe('AlquileresIngresosService · vista previa', () => {
  it('cuenta estadías, rango y totales por moneda, y no guarda nada', async () => {
    const { svc, t } = armar();
    const v = await svc.vistaPrevia(BIZ, TRES);
    expect(v).toMatchObject({ estadias: 3, desde: '2026-11-29', hasta: '2026-12-30', descartadas: [], otrasFilas: 0 });
    expect(v.totales).toEqual([{ moneda: 'ARS', neto: 700000, estadias: 2 }, { moneda: 'USD', neto: 300, estadias: 1 }]);
    expect(t.alquilerIngresoExterno.filas).toEqual([]);
    expect(t.alquilerAvisoExterno.filas).toEqual([]);
  });

  it('trae cada aviso con la propiedad que ya tiene unida; una unión a una propiedad que ya no está no cuenta', async () => {
    const { svc, recursos } = armar({ avisos: [
      { id: 'a1', businessId: BIZ, canal: 'airbnb', nombreExterno: 'Cabaña del Monte', recursoId: P1 },
      { id: 'a2', businessId: BIZ, canal: 'airbnb', nombreExterno: 'Depto Centro', recursoId: P2 },
      { id: 'a3', businessId: 'otro-negocio', canal: 'airbnb', nombreExterno: 'Depto Centro', recursoId: AJENA },
    ] });
    delete recursos[P2]; // la borraron
    expect((await svc.vistaPrevia(BIZ, TRES)).avisos).toEqual([
      { nombre: 'Cabaña del Monte', estadias: 2, recursoId: P1 },
      { nombre: 'Depto Centro', estadias: 1, recursoId: null },
    ]);
  });

  it('un archivo que no se entiende es un 400 con el motivo del lector', async () => {
    const { svc } = armar();
    await expect(svc.vistaPrevia(BIZ, 'hola')).rejects.toThrow(BadRequestException);
    await expect(svc.vistaPrevia(BIZ, 'hola')).rejects.toThrow(/No parece el archivo de ganancias de Airbnb/);
  });
});

describe('AlquileresIngresosService · importar', () => {
  it('guarda una fila por estadía, con su propiedad, y la unión de cada aviso', async () => {
    const { svc, t, audit } = armar();
    expect(await svc.importar(BIZ, 'm-1', { texto: TRES, avisos: UNIONES }, AHORA)).toEqual({ creadas: 3, actualizadas: 0, sinImportar: 0 });
    expect(t.alquilerIngresoExterno.filas).toHaveLength(3);
    expect(t.alquilerIngresoExterno.filas.find((f) => f.codigoExterno === 'HM1')).toMatchObject({
      businessId: BIZ, recursoId: P1, canal: 'airbnb', entrada: '2026-12-20', salida: '2026-12-27', noches: 7, huesped: 'Ana', montoNeto: 580000, moneda: 'ARS', importadoEn: AHORA,
    });
    expect(t.alquilerIngresoExterno.filas.find((f) => f.codigoExterno === 'HM3')).toMatchObject({ recursoId: P2, moneda: 'USD' });
    expect(t.alquilerAvisoExterno.filas.map((a) => [a.businessId, a.canal, a.nombreExterno, a.recursoId])).toEqual([
      [BIZ, 'airbnb', 'Cabaña del Monte', P1], [BIZ, 'airbnb', 'Depto Centro', P2],
    ]);
    // Queda en el registro, sin nombres de huéspedes ni el texto del archivo.
    expect(audit.registrar).toHaveBeenCalledTimes(1);
    const registrado = JSON.stringify(audit.registrar.mock.calls[0][0]);
    expect(registrado).toContain('alquiler_ingresos');
    expect(registrado).not.toContain('Ana');
  });

  it('importar el mismo archivo otra vez no duplica; uno más nuevo con otro monto actualiza', async () => {
    const { svc, t } = armar();
    await svc.importar(BIZ, 'm-1', { texto: TRES, avisos: UNIONES }, AHORA);
    expect(await svc.importar(BIZ, 'm-1', { texto: TRES, avisos: UNIONES }, AHORA)).toEqual({ creadas: 0, actualizadas: 3, sinImportar: 0 });
    expect(t.alquilerIngresoExterno.filas).toHaveLength(3);
    expect(t.alquilerAvisoExterno.filas).toHaveLength(2);
    const corregido = csv(fila('HM1', '12/20/2026', 7, 'Cabaña del Monte', 'ARS', 500000), fila('HM4', '01/05/2027', 2, 'Cabaña del Monte', 'ARS', 90000));
    expect(await svc.importar(BIZ, 'm-1', { texto: corregido, avisos: [UNIONES[0]] }, AHORA)).toEqual({ creadas: 1, actualizadas: 1, sinImportar: 0 });
    expect(t.alquilerIngresoExterno.filas).toHaveLength(4);
    expect(t.alquilerIngresoExterno.filas.find((f) => f.codigoExterno === 'HM1')?.montoNeto).toBe(500000);
  });

  it('un aviso marcado "no importar" deja sus estadías afuera y se cuenta', async () => {
    const { svc, t } = armar();
    const r = await svc.importar(BIZ, 'm-1', { texto: TRES, avisos: [UNIONES[0], { nombre: 'Depto Centro', recursoId: null }] }, AHORA);
    expect(r).toEqual({ creadas: 2, actualizadas: 0, sinImportar: 1 });
    expect(t.alquilerIngresoExterno.filas.map((f) => f.codigoExterno).sort()).toEqual(['HM1', 'HM2']);
    expect(t.alquilerAvisoExterno.filas.map((a) => a.nombreExterno)).toEqual(['Cabaña del Monte']);
  });

  it('un aviso del archivo que no viene en la lista es un 400: hay que decidir cada uno', async () => {
    const { svc, t } = armar();
    await expect(svc.importar(BIZ, 'm-1', { texto: TRES, avisos: [UNIONES[0]] }, AHORA)).rejects.toThrow('Falta decir a qué propiedad corresponde "Depto Centro".');
    expect(t.alquilerIngresoExterno.filas).toEqual([]);
  });

  it('una propiedad de otro negocio, o que no es un alojamiento, es un rechazo y no se guarda nada', async () => {
    const ajena = armar();
    await expect(ajena.svc.importar(BIZ, 'm-1', { texto: TRES, avisos: [UNIONES[0], { nombre: 'Depto Centro', recursoId: AJENA }] }, AHORA)).rejects.toThrow(NotFoundException);
    expect(ajena.t.alquilerIngresoExterno.filas).toEqual([]);
    expect(ajena.t.alquilerAvisoExterno.filas).toEqual([]);
    const cancha = armar();
    await expect(cancha.svc.importar(BIZ, 'm-1', { texto: TRES, avisos: [UNIONES[0], { nombre: 'Depto Centro', recursoId: CANCHA }] }, AHORA)).rejects.toThrow('Las ganancias de Airbnb se unen a un alojamiento.');
    expect(cancha.t.alquilerIngresoExterno.filas).toEqual([]);
    expect(cancha.t.alquilerAvisoExterno.filas).toEqual([]);
  });

  it('cambiar la unión de un aviso al reimportar mueve sus estadías a la otra propiedad', async () => {
    const { svc, t } = armar();
    await svc.importar(BIZ, 'm-1', { texto: TRES, avisos: UNIONES }, AHORA);
    await svc.importar(BIZ, 'm-1', { texto: TRES, avisos: [{ nombre: 'Cabaña del Monte', recursoId: P2 }, UNIONES[1]] }, AHORA);
    expect(t.alquilerIngresoExterno.filas.find((f) => f.codigoExterno === 'HM1')?.recursoId).toBe(P2);
    expect(t.alquilerAvisoExterno.filas.find((a) => a.nombreExterno === 'Cabaña del Monte')?.recursoId).toBe(P2);
    expect(t.alquilerAvisoExterno.filas).toHaveLength(2);
  });

  it('un archivo que no se entiende no guarda nada', async () => {
    const { svc, t } = armar();
    await expect(svc.importar(BIZ, 'm-1', { texto: 'Date,Type\n1,2', avisos: [] }, AHORA)).rejects.toThrow(BadRequestException);
    expect(t.alquilerIngresoExterno.filas).toEqual([]);
  });
});

describe('AlquileresIngresosService · listar y borrar', () => {
  const guardada = (codigo: string, entrada: string, salida: string, over: Fila = {}): Fila => ({
    id: codigo, businessId: BIZ, recursoId: P1, canal: 'airbnb', codigoExterno: codigo, entrada, salida, noches: 2, huesped: null,
    montoBruto: { toString: () => '110.5' }, comision: { toString: () => '10.5' }, limpieza: { toString: () => '0' }, montoNeto: { toString: () => '100' }, moneda: 'ARS',
    importadoEn: new Date('2026-11-20T10:00:00.000Z'), ...over,
  });

  it('listar devuelve las que tocan el rango, con los montos como números, y el resumen de todo', async () => {
    const { svc } = armar({ ingresos: [
      guardada('SALE-EL-1', '2026-11-28', '2026-12-01'),
      guardada('SALE-EL-2', '2026-11-28', '2026-12-02'),
      guardada('ENTRA-EL-31', '2026-12-31', '2027-01-03', { importadoEn: new Date('2026-11-25T10:00:00.000Z') }),
      guardada('ENERO', '2027-01-01', '2027-01-04'),
      guardada('DE-OTRO', '2026-12-10', '2026-12-12', { businessId: 'otro-negocio' }),
    ] });
    const r = await svc.listar(BIZ, '2026-12-01', '2026-12-31');
    expect(r.filas.map((f) => f.codigo)).toEqual(['SALE-EL-2', 'ENTRA-EL-31']);
    expect(r.filas[0]).toEqual({
      id: 'SALE-EL-2', recursoId: P1, canal: 'airbnb', codigo: 'SALE-EL-2', entrada: '2026-11-28', salida: '2026-12-02', noches: 2, huesped: null,
      montoBruto: 110.5, comision: 10.5, limpieza: 0, montoNeto: 100, moneda: 'ARS',
    });
    expect(r.resumen).toEqual({ estadias: 4, ultimaImportacion: '2026-11-25T10:00:00.000Z', hasta: '2027-01-04' });
  });

  it('sin nada importado, el resumen lo dice', async () => {
    expect((await armar().svc.listar(BIZ, '2026-12-01', '2026-12-31')).resumen).toEqual({ estadias: 0, ultimaImportacion: null, hasta: null });
  });

  it('un rango que no son dos fechas en orden es un 400', async () => {
    const { svc } = armar();
    await expect(svc.listar(BIZ, 'ayer', '2026-12-31')).rejects.toThrow(BadRequestException);
    await expect(svc.listar(BIZ, '2026-12-31', '2026-12-01')).rejects.toThrow(BadRequestException);
  });

  it('borrar todo quita las estadías del canal y conserva las uniones; nada de otro negocio se toca', async () => {
    const { svc, t, audit } = armar({
      ingresos: [guardada('A', '2026-12-01', '2026-12-03'), guardada('B', '2026-12-05', '2026-12-07'), guardada('DE-OTRO', '2026-12-10', '2026-12-12', { businessId: 'otro-negocio' })],
      avisos: [{ id: 'a1', businessId: BIZ, canal: 'airbnb', nombreExterno: 'Cabaña del Monte', recursoId: P1 }],
    });
    expect(await svc.borrarTodo(BIZ, 'm-1', 'airbnb')).toEqual({ ok: true, borradas: 2 });
    expect(t.alquilerIngresoExterno.filas.map((f) => f.codigoExterno)).toEqual(['DE-OTRO']);
    expect(t.alquilerAvisoExterno.filas).toHaveLength(1);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ, memberId: 'm-1', entityType: 'alquiler_ingresos', action: 'DELETE' }));
  });
});

describe('Ganancias de Airbnb · quién puede qué en el panel', () => {
  const permiso = (metodo: keyof AlquileresPanelController) => Reflect.getMetadata(PERMISSION_KEY, AlquileresPanelController.prototype[metodo] as object);

  it('ver pide reservas.view; vista previa, importar y borrar, reservas.config', () => {
    expect(permiso('ingresos')).toBe('reservas.view');
    expect(permiso('vistaPrevia')).toBe('reservas.config');
    expect(permiso('importar')).toBe('reservas.config');
    expect(permiso('borrar')).toBe('reservas.config');
  });
});
