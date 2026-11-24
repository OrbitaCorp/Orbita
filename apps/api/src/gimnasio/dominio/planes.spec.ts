import {
  arrancaEl, motivoParaElNegocio, pagoDe, restantesDe, semanaDe, suscripcionPara, usadasDe, usadasEnLaSemana, venceEl, type Suscripcion, type Uso,
} from './planes';

// Las cuentas de los planes, sin base ni reloj. El lunes 23/11/2026 arranca la
// semana de las pruebas; el domingo 29 la cierra.
const LUNES = '2026-11-23';
const MARTES = '2026-11-24';
const DOMINGO = '2026-11-29';
const LUNES_QUE_VIENE = '2026-11-30';

const pack = (over: Partial<Suscripcion> = {}): Suscripcion => ({ id: 'pack', planId: 'pl-pack', tipo: 'PACK', clases: 8, porSemana: null, desde: '2026-11-01', hasta: '2026-12-01', estado: 'VIGENTE', ...over });
const membresia = (over: Partial<Suscripcion> = {}): Suscripcion => ({ id: 'mem', planId: 'pl-mem', tipo: 'MEMBRESIA', clases: null, porSemana: 2, desde: '2026-11-01', hasta: '2026-12-01', estado: 'VIGENTE', ...over });
const uso = (suscripcionId: string, fecha: string, cantidad = 1): Uso => ({ suscripcionId, fecha, cantidad });

describe('Gimnasio · cuándo arranca y hasta cuándo vale un plan', () => {
  it('vale el día que arranca más los días de vigencia', () => {
    expect(venceEl('2026-11-24', 30)).toBe('2026-12-24');
    expect(venceEl('2026-12-20', 30)).toBe('2027-01-19');
  });

  it('renovar la misma membresía antes de que venza la continúa: arranca al día siguiente de que termine', () => {
    expect(arrancaEl(MARTES, { id: 'pl-mem', tipo: 'MEMBRESIA' }, [membresia({ hasta: '2026-11-30' })])).toBe('2026-12-01');
    // Con dos períodos ya comprados, sigue al último.
    expect(arrancaEl(MARTES, { id: 'pl-mem', tipo: 'MEMBRESIA' }, [membresia({ hasta: '2026-11-30' }), membresia({ id: 'mem2', desde: '2026-12-01', hasta: '2026-12-31' })])).toBe('2027-01-01');
  });

  it('una membresía que ya venció, una de otro plan o una cancelada no corren el arranque: es hoy', () => {
    expect(arrancaEl(MARTES, { id: 'pl-mem', tipo: 'MEMBRESIA' }, [membresia({ hasta: '2026-11-20' })])).toBe(MARTES);
    expect(arrancaEl(MARTES, { id: 'pl-mem', tipo: 'MEMBRESIA' }, [membresia({ planId: 'pl-otra', hasta: '2026-12-15' })])).toBe(MARTES);
    expect(arrancaEl(MARTES, { id: 'pl-mem', tipo: 'MEMBRESIA' }, [membresia({ hasta: '2026-12-15', estado: 'CANCELADA' })])).toBe(MARTES);
    expect(arrancaEl(MARTES, { id: 'pl-mem', tipo: 'MEMBRESIA' }, [])).toBe(MARTES);
  });

  it('un pack arranca hoy aunque tenga otro igual todavía vigente', () => {
    expect(arrancaEl(MARTES, { id: 'pl-pack', tipo: 'PACK' }, [pack({ hasta: '2026-12-15' })])).toBe(MARTES);
  });

  it('la semana va de lunes a domingo', () => {
    expect(semanaDe(LUNES)).toEqual({ lunes: LUNES, domingo: DOMINGO });
    expect(semanaDe('2026-11-26')).toEqual({ lunes: LUNES, domingo: DOMINGO });
    expect(semanaDe(DOMINGO)).toEqual({ lunes: LUNES, domingo: DOMINGO });
    expect(semanaDe(LUNES_QUE_VIENE).lunes).toBe(LUNES_QUE_VIENE);
  });
});

describe('Gimnasio · con qué se pagó un lugar', () => {
  it('lee datos.gimnasio de la reserva; lo que no tiene la forma esperada es "sin definir"', () => {
    expect(pagoDe({ gimnasio: { pago: 'plan', suscripcionId: 's1', planId: 'p1' } })).toEqual({ pago: 'plan', suscripcionId: 's1', planId: 'p1' });
    expect(pagoDe({ gimnasio: { pago: 'aparte' }, otro: 1 })).toEqual({ pago: 'aparte' });
    expect(pagoDe({ gimnasio: { pago: 'prueba', planId: 'p9' } })).toEqual({ pago: 'prueba', planId: 'p9' });
    for (const raro of [null, undefined, 'plan', 7, [], {}, { gimnasio: null }, { gimnasio: 'plan' }, { gimnasio: { pago: 'gratis' } }, { gimnasio: { suscripcionId: 's1' } }]) {
      expect(pagoDe(raro)).toBeNull();
    }
    // Un id que no es un texto no se toma.
    expect(pagoDe({ gimnasio: { pago: 'plan', suscripcionId: 7 } })).toEqual({ pago: 'plan' });
  });
});

describe('Gimnasio · lo que se usó de un plan', () => {
  it('las clases que le quedan a un pack son las que trae menos los lugares tomados con él; nunca menos de cero', () => {
    const usos = [uso('pack', LUNES), uso('pack', MARTES, 2), uso('otro', MARTES, 5)];
    expect(usadasDe('pack', usos)).toBe(3);
    expect(restantesDe(pack(), usos)).toBe(5);
    expect(restantesDe(pack({ clases: 2 }), usos)).toBe(0);
    expect(restantesDe(membresia(), usos)).toBeNull();
  });

  it('las clases de la semana cuentan lo tomado con cualquiera de sus membresías, de lunes a domingo, y no los packs', () => {
    const suyas = [membresia(), membresia({ id: 'mem-vieja', estado: 'CANCELADA' }), pack()];
    const usos = [uso('mem', LUNES), uso('mem-vieja', MARTES), uso('pack', MARTES), uso('mem', DOMINGO), uso('mem', LUNES_QUE_VIENE), uso('mem', '2026-11-22')];
    expect(usadasEnLaSemana(suyas, usos, MARTES)).toBe(3);
    expect(usadasEnLaSemana(suyas, usos, LUNES_QUE_VIENE)).toBe(1);
  });
});

describe('Gimnasio · con qué plan se paga un lugar', () => {
  it('con un pack que vale ese día y tiene clases', () => {
    expect(suscripcionPara([pack()], [uso('pack', LUNES, 7)], MARTES, 1)).toEqual({ suscripcion: pack() });
  });

  it('sin clases en el pack no se paga con el plan; y si quedan menos de las pedidas, tampoco', () => {
    expect(suscripcionPara([pack()], [uso('pack', LUNES, 8)], MARTES, 1)).toEqual({ causa: 'sin-clases', restantes: 0 });
    expect(suscripcionPara([pack()], [uso('pack', LUNES, 7)], MARTES, 2)).toEqual({ causa: 'sin-clases', restantes: 1 });
  });

  it('con dos packs que valen ese día se gasta primero el que vence antes; si ese no alcanza, el otro', () => {
    const viejo = pack({ id: 'viejo', hasta: '2026-11-28' });
    const nuevo = pack({ id: 'nuevo', desde: MARTES, hasta: '2026-12-24' });
    expect(suscripcionPara([nuevo, viejo], [], MARTES, 1)).toEqual({ suscripcion: viejo });
    expect(suscripcionPara([nuevo, viejo], [uso('viejo', LUNES, 8)], MARTES, 1)).toEqual({ suscripcion: nuevo });
    // Los dos agotados: el motivo es el del primero.
    expect(suscripcionPara([nuevo, viejo], [uso('viejo', LUNES, 8), uso('nuevo', MARTES, 8)], MARTES, 1)).toEqual({ causa: 'sin-clases', restantes: 0 });
  });

  it('una membresía libre siempre paga; una con tope, hasta sus clases de esa semana', () => {
    expect(suscripcionPara([membresia({ porSemana: 0 })], [uso('mem', LUNES), uso('mem', MARTES)], MARTES, 1)).toEqual({ suscripcion: membresia({ porSemana: 0 }) });
    expect(suscripcionPara([membresia()], [uso('mem', LUNES)], MARTES, 1)).toEqual({ suscripcion: membresia() });
    expect(suscripcionPara([membresia()], [uso('mem', LUNES), uso('mem', MARTES)], '2026-11-27', 1)).toEqual({ causa: 'tope-semanal', porSemana: 2, usadas: 2 });
    // La semana que viene arranca de cero.
    expect(suscripcionPara([membresia()], [uso('mem', LUNES), uso('mem', MARTES)], LUNES_QUE_VIENE, 1)).toEqual({ suscripcion: membresia() });
  });

  it('cambiar de membresía a mitad de semana no regala clases: cuentan las que tomó con la anterior', () => {
    const anterior = membresia({ id: 'anterior', planId: 'pl-vieja', estado: 'CANCELADA' });
    const nueva = membresia({ id: 'nueva', desde: MARTES, hasta: '2026-12-24' });
    expect(suscripcionPara([anterior, nueva], [uso('anterior', LUNES), uso('anterior', MARTES)], '2026-11-26', 1)).toEqual({ causa: 'tope-semanal', porSemana: 2, usadas: 2 });
  });

  it('la membresía cubre un lugar por clase', () => {
    expect(suscripcionPara([membresia()], [], MARTES, 2)).toEqual({ causa: 'un-lugar' });
  });

  it('con membresía y pack, el lugar que la membresía no cubre lo paga el pack si alcanza', () => {
    const mem = membresia({ hasta: '2026-11-30' });
    const pk = pack({ hasta: '2026-12-20' });
    // La membresía vence antes: va primero. Ya usó sus dos de la semana: paga el pack.
    expect(suscripcionPara([pk, mem], [uso('mem', LUNES), uso('mem', MARTES)], '2026-11-26', 1)).toEqual({ suscripcion: pk });
  });

  it('sin plan, con el plan vencido o con uno que todavía no arrancó, dice cuál es el caso', () => {
    expect(suscripcionPara([], [], MARTES, 1)).toEqual({ causa: 'sin-plan' });
    expect(suscripcionPara([pack({ estado: 'CANCELADA' })], [], MARTES, 1)).toEqual({ causa: 'sin-plan' });
    expect(suscripcionPara([pack({ hasta: '2026-11-20' })], [], MARTES, 1)).toEqual({ causa: 'vencido', hasta: '2026-11-20' });
    expect(suscripcionPara([membresia({ desde: '2026-12-01', hasta: '2026-12-31' })], [], MARTES, 1)).toEqual({ causa: 'no-empezo', desde: '2026-12-01' });
    // Vale el último día y no el siguiente.
    expect(suscripcionPara([pack({ hasta: MARTES })], [], MARTES, 1)).toEqual({ suscripcion: pack({ hasta: MARTES }) });
    expect(suscripcionPara([pack({ hasta: LUNES })], [], MARTES, 1)).toEqual({ causa: 'vencido', hasta: LUNES });
  });

  it('el motivo se le dice al negocio en una frase, con el número en singular o en plural', () => {
    expect(motivoParaElNegocio({ causa: 'sin-plan' })).toMatch(/No tiene un plan/);
    expect(motivoParaElNegocio({ causa: 'vencido', hasta: '2026-11-20' })).toMatch(/venció el 20\/11/);
    expect(motivoParaElNegocio({ causa: 'no-empezo', desde: '2026-12-01' })).toMatch(/arranca el 01\/12/);
    expect(motivoParaElNegocio({ causa: 'sin-clases', restantes: 0 })).toMatch(/No le quedan clases en el pack/);
    expect(motivoParaElNegocio({ causa: 'sin-clases', restantes: 1 })).toMatch(/Le queda 1 clase en el pack/);
    expect(motivoParaElNegocio({ causa: 'sin-clases', restantes: 3 })).toMatch(/Le quedan 3 clases en el pack/);
    expect(motivoParaElNegocio({ causa: 'tope-semanal', porSemana: 1, usadas: 1 })).toMatch(/Ya usó su clase de esa semana/);
    expect(motivoParaElNegocio({ causa: 'tope-semanal', porSemana: 3, usadas: 3 })).toMatch(/Ya usó sus 3 clases de esa semana/);
    expect(motivoParaElNegocio({ causa: 'un-lugar' })).toMatch(/un lugar por clase/);
  });
});
