import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_DATOS_CONFIG, MAX_DATOS_RESERVA } from './comunes.dto';
import { UpsertConfigDto } from './catalogo.dto';
import { ReservarDto } from './reservas.dto';
import { configDto, configPublicaDto, datosPublicos } from '../reservas.types';

// El campo libre `datos` de la reserva y de la config: el motor no mira
// adentro, pero le pone un tope (el de la reserva llega desde el sitio
// público) y, de la config, solo deja salir al sitio lo que esté en `publico`.

const pedido = (datos?: unknown) => plainToInstance(ReservarDto, {
  modulo: 'ALQUILERES', recursoId: '3f2b8c1e-6a4d-4e2b-9c1a-5d7e8f9a0b1c', fecha: '2026-12-10', fechaHasta: '2026-12-13',
  clave: '9b1d6f0a-2c3e-4f5a-8b7c-1d2e3f4a5b6c', cliente: { nombre: 'Ana Ríos', telefono: '0000 55-0101' }, ...(datos !== undefined ? { datos } : {}),
});
const erroresDe = async (dto: object) => (await validate(dto)).flatMap((e) => Object.values(e.constraints ?? {}));

describe('reservas · el campo libre `datos`', () => {
  it('una reserva puede venir sin datos o con un objeto chico', async () => {
    expect(await erroresDe(pedido())).toEqual([]);
    expect(await erroresDe(pedido({ huespedes: 3, canal: 'sitio' }))).toEqual([]);
    expect(await erroresDe(pedido({}))).toEqual([]);
  });

  it('lo que no es un objeto no entra: una lista, un texto, un número', async () => {
    for (const malo of [['a'], 'texto', 7, true]) {
      expect(await erroresDe(pedido(malo))).toEqual([`Los datos tienen que ser un objeto de hasta ${MAX_DATOS_RESERVA} caracteres.`]);
    }
  });

  it('un objeto que pasa el tope no entra: el sitio no es un lugar para guardar cualquier cosa', async () => {
    expect(await erroresDe(pedido({ nota: 'x'.repeat(MAX_DATOS_RESERVA) }))).toHaveLength(1);
    expect(await erroresDe(pedido({ nota: 'x'.repeat(MAX_DATOS_RESERVA - 20) }))).toEqual([]);
  });

  it('la config acepta más (plantillas de mensajes), también con tope', async () => {
    const config = (datos: unknown) => plainToInstance(UpsertConfigDto, { modulo: 'ALQUILERES', datos });
    expect(await erroresDe(config({ publico: { alias: 'monte.cabanas' }, mensajes: { confirmada: 'x'.repeat(5000) } }))).toEqual([]);
    expect(await erroresDe(config({ mensajes: 'x'.repeat(MAX_DATOS_CONFIG) }))).toHaveLength(1);
    expect(await erroresDe(plainToInstance(UpsertConfigDto, { modulo: 'ALQUILERES' }))).toEqual([]);
  });
});

describe('reservas · lo que la config deja ver al sitio', () => {
  const fila = (datos: unknown) => ({
    modulo: 'ALQUILERES', activo: true, confirmacion: 'MANUAL', retencionMinutos: 10, anticipacionMinimaMinutos: 0, anticipacionMaximaDias: 365,
    cancelacionHastaHoras: 48, reprogramacionHastaHoras: 48, reprogramacionesMaximas: 1, senaPorcentaje: 30, senaReembolsable: true,
    maximoActivasPorCliente: 3, listaDeEspera: false, margenMinutos: 0, horario: {}, datos,
  }) as never;

  it('el panel ve todo el `datos`; el sitio, solo lo de `publico`', () => {
    const datos = { publico: { alias: 'monte.cabanas', titular: 'Monte SRL' }, mensajes: { confirmada: 'Hola {nombre}' } };
    expect(configDto(fila(datos)).datos).toEqual(datos);
    const publica = configPublicaDto(fila(datos));
    expect(publica.publico).toEqual({ alias: 'monte.cabanas', titular: 'Monte SRL' });
    expect(JSON.stringify(publica)).not.toContain('Hola {nombre}');
    expect(publica).not.toHaveProperty('datos');
  });

  it('sin datos, o con un `publico` que no es un objeto, el sitio no recibe nada', () => {
    expect(configPublicaDto(fila(null)).publico).toBeNull();
    expect(configDto(fila(null)).datos).toBeNull();
    expect(datosPublicos({ publico: 'texto' })).toBeNull();
    expect(datosPublicos({ publico: ['a'] })).toBeNull();
    expect(datosPublicos(['publico'])).toBeNull();
    expect(datosPublicos({ otra: 1 })).toBeNull();
  });
});
