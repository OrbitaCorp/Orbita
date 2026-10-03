import { ALFABETO_CODIGO, generarAccessToken, generarCodigo } from '../../src/appointments/panel/lib/codigos';
import { esChoqueDeHorario, esCodigoRepetido } from '../../src/appointments/panel/lib/errores';
import {
  MENSAJE_IDS, armarTexto, canalesActivos, errorTextoMensaje, fechaParaMensaje, leerMensajes, mensajesDeFabrica, textosDeFabrica,
} from '../../src/appointments/panel/lib/mensajes';
import { agendasPropias, dentroDelAlcance, tiene } from '../../src/appointments/panel/lib/permisos';
import { normalizarTelefono, taparTelefono } from '../../src/appointments/panel/lib/telefono';
import { normalizarNombre } from '../../src/appointments/panel/lib/serializar';
import type { MemberContext } from '../../src/common/types/auth-context.type';

const miembro = (m: Partial<MemberContext> = {}): MemberContext => ({
  type: 'member', memberId: 'm-1', businessId: 'biz-1', businessMode: 'FULL', roleId: 'r-1', roleName: 'Barbero', permissions: [], ...m,
});

describe('Teléfono (§ 0)', () => {
  it.each([
    ['11 5555-0101', '1155550101'],
    ['011 15 5555-0101', '1155550101'],
    ['+54 9 11 5555-0101', '1155550101'],
    ['5491155550101', '1155550101'],
    ['(0351) 15-555-0101', '3515550101'],
    ['0 2954 15 55-0101', '2954550101'],
    ['1-800-123', '1800123'],
  ])('normaliza %s → %s', (entrada, salida) => {
    expect(normalizarTelefono(entrada)).toBe(salida);
  });

  it('tapado: quedan los dos últimos dígitos', () => {
    expect(taparTelefono('1155550101')).toBe('••••••••01');
    expect(taparTelefono('11 5555-0101')).toBe('•• ••••-••01');
    expect(taparTelefono('')).toBe('');
  });
});

describe('code y accessToken (§ 1.5)', () => {
  it('code: 6 caracteres del alfabeto sin 0/O/1/I', () => {
    for (let i = 0; i < 200; i++) {
      const c = generarCodigo();
      expect(c).toHaveLength(6);
      expect([...c].every((x) => ALFABETO_CODIGO.includes(x))).toBe(true);
    }
    expect(ALFABETO_CODIGO).not.toMatch(/[0O1I]/);
  });

  it('accessToken: 32 bytes en base64url (43 caracteres) y distintos', () => {
    const a = generarAccessToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generarAccessToken()).not.toBe(a);
  });
});

describe('Errores de la base', () => {
  it('reconoce la constraint de exclusión (23P01) como venga', () => {
    expect(esChoqueDeHorario({ code: 'P2010', message: 'Raw query failed. Code: `23P01`. Message: conflicting key value violates exclusion constraint "appointments_no_overlap"' })).toBe(true);
    expect(esChoqueDeHorario(new Error('Invalid `prisma.appointment.create()` invocation: ... appointments_no_overlap'))).toBe(true);
    expect(esChoqueDeHorario({ code: 'P2004', meta: { database_error: '23P01' } })).toBe(true);
    expect(esChoqueDeHorario(new Error('connection lost'))).toBe(false);
    expect(esChoqueDeHorario(null)).toBe(false);
  });

  it('un P2002 sobre code / access_token se reintenta; otro P2002 no', () => {
    expect(esCodigoRepetido({ code: 'P2002', meta: { target: ['business_id', 'code'] } })).toBe(true);
    expect(esCodigoRepetido({ code: 'P2002', meta: { target: ['access_token'] } })).toBe(true);
    expect(esCodigoRepetido({ code: 'P2002', meta: { target: ['business_id', 'email'] } })).toBe(false);
    expect(esCodigoRepetido({ code: 'P2025' })).toBe(false);
  });
});

describe('Mensajes (§ 1.6)', () => {
  it('textos de fábrica: los de la demo, con la palabra del rubro', () => {
    expect(textosDeFabrica('PROFESSIONAL').confirmacion).toBe('¡Hola {nombre}! Tu turno de {servicio} quedó confirmado para el {fecha} a las {hora} con {profesional}. Si necesitás cambiarlo: {link}');
    expect(textosDeFabrica('CLASS').cancelacion).toContain('tu clase del {fecha}');
    expect(textosDeFabrica('COURT').recordatorio).toContain('tu reserva de mañana');
    for (const t of Object.values(textosDeFabrica('PROFESSIONAL'))) expect(errorTextoMensaje(t)).toBeNull();
  });

  it('configuración de fábrica: "Te extrañamos" apagado y solo por WhatsApp; "espera" no va en sala/cabina', () => {
    const f = mensajesDeFabrica('PROFESSIONAL');
    expect(f.mensajes.map((m) => m.id)).toEqual(MENSAJE_IDS);
    expect(f.mensajes.find((m) => m.id === 'extranamos')).toMatchObject({ on: false, canales: ['wa'], cuando: '30' });
    expect(f.mensajes.find((m) => m.id === 'recordatorio')).toMatchObject({ on: true, cuando: '24' });
    expect(mensajesDeFabrica('RESOURCE').mensajes.some((m) => m.id === 'espera')).toBe(false);
  });

  it('leerMensajes: lo guardado manda; lo que falta o no se entiende vale lo de fábrica', () => {
    expect(leerMensajes(null, 'PROFESSIONAL')).toEqual(mensajesDeFabrica('PROFESSIONAL'));
    expect(leerMensajes('basura', 'PROFESSIONAL')).toEqual(mensajesDeFabrica('PROFESSIONAL'));
    const leido = leerMensajes({ wa: false, mensajes: [{ id: 'confirmacion', on: false, canales: ['email'], cuando: '', texto: 'Hola {nombre}' }, { id: 'inventado' }] }, 'PROFESSIONAL');
    expect(leido.wa).toBe(false);
    expect(leido.email).toBe(true);
    expect(leido.mensajes.find((m) => m.id === 'confirmacion')).toEqual({ id: 'confirmacion', on: false, canales: ['email'], cuando: '', texto: 'Hola {nombre}' });
    expect(leido.mensajes.find((m) => (m.id as string) === 'inventado')).toBeUndefined();
    expect(leido.mensajes.find((m) => m.id === 'reprogramacion')?.on).toBe(true);
  });

  it('variable desconocida: el mensaje del contrato', () => {
    expect(errorTextoMensaje('Hola {cliente}')).toBe('La variable {cliente} no existe. Podés usar: {nombre}, {servicio}, {fecha}, {hora}, {profesional}, {negocio}, {link}.');
    expect(errorTextoMensaje('Hola {}')).toContain('La variable {} no existe');
    expect(errorTextoMensaje('Hola {nombre}, sin llaves raras')).toBeNull();
  });

  it('armarTexto: reemplaza variables y firma con el negocio', () => {
    const valores = { nombre: 'José', servicio: 'Corte', fecha: 'lunes 05/10', hora: '10:30', profesional: 'Juan', negocio: 'Barbería', link: 'https://x/mi-turno/abc' };
    expect(armarTexto('Hola {nombre}, {servicio} el {fecha} a las {hora} con {profesional}. {link}', valores, 'Barbería'))
      .toBe('Hola José, Corte el lunes 05/10 a las 10:30 con Juan. https://x/mi-turno/abc\n\n— Barbería');
    expect(armarTexto('Hola {nombre}', valores, null)).toBe('Hola José');
  });

  it('fechaParaMensaje: "lunes 05/10" (día argentino)', () => {
    expect(fechaParaMensaje('2026-10-05')).toBe('lunes 05/10');
    expect(fechaParaMensaje('2026-09-27')).toBe('domingo 27/09');
  });

  it('canales activos: los de la plantilla Y los que el negocio tiene prendidos', () => {
    const f = { ...mensajesDeFabrica('PROFESSIONAL'), wa: false };
    expect(canalesActivos(f, f.mensajes[0])).toEqual(['email']);
  });
});

describe('Permisos y alcance (§ 0)', () => {
  it('el dueño tiene todo; el resto, lo que dice su rol', () => {
    expect(tiene(miembro({ roleName: 'owner' }), 'appointments.settings.manage')).toBe(true);
    expect(tiene(miembro({ permissions: ['appointments.agenda.view'] }), 'appointments.agenda.view')).toBe(true);
    expect(tiene(miembro({ permissions: ['appointments.agenda.view'] }), 'appointments.agenda.view_all')).toBe(false);
  });

  it('agendas propias: null con _all o dueño; su agenda y su espacio si no; [] sin agenda', async () => {
    const prisma = { appointmentResource: { findFirst: jest.fn().mockResolvedValue({ id: 'r-juan', assignedSpaceId: 'r-cabina' }) } };
    expect(await agendasPropias(prisma as any, miembro({ roleName: 'owner' }), 'appointments.agenda.view_all')).toBeNull();
    expect(await agendasPropias(prisma as any, miembro({ permissions: ['appointments.agenda.view_all'] }), 'appointments.agenda.view_all')).toBeNull();
    expect(prisma.appointmentResource.findFirst).not.toHaveBeenCalled();
    expect(await agendasPropias(prisma as any, miembro(), 'appointments.agenda.view_all')).toEqual(['r-juan', 'r-cabina']);
    expect(prisma.appointmentResource.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz-1', memberId: 'm-1', deletedAt: null } }));
    prisma.appointmentResource.findFirst.mockResolvedValueOnce(null);
    expect(await agendasPropias(prisma as any, miembro(), 'appointments.agenda.manage_all')).toEqual([]);
    expect(dentroDelAlcance(null, 'x')).toBe(true);
    expect(dentroDelAlcance([], 'x')).toBe(false);
  });

  it('normalizarNombre: sin acentos, mayúsculas ni espacios de más', () => {
    expect(normalizarNombre('  Corte   CLÁSICO ')).toBe(normalizarNombre('corte clasico'));
  });
});
