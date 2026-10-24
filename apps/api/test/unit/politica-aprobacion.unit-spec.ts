import { aprobacionCompleta, puedeAprobar, puedeRechazar, reglasDeConfig, rolDe, type Persona } from '../../src/marketing/videos/politica-aprobacion';

// La política de aprobación de la cola de videos, completa: quién aprueba, cuándo alcanza y quién rechaza.
// Es lógica interna (el panel no la muestra): acá se prueba cada combinación. Depende de quién subió el video.

const ceo: Persona = { id: 'ceo', email: 'ceo@orbita-corp.com' };
const cto: Persona = { id: 'cto', email: 'CTO@orbita-corp.com' }; // mayúsculas a propósito
const cpo: Persona = { id: 'cpo', email: 'cpo@orbita-corp.com' };
const milagros: Persona = { id: 'mili', email: 'milagros@orbita.site' };
const reglas = reglasDeConfig({ get: () => undefined });

const video = (creador: Persona | null, aprobaron: Persona[] = []) => ({ creador, aprobaron, reglas });

// El mismo rol tiene dos cuentas: la de orbita-corp.com y la de orbita.site (son la misma persona).
const ceo2: Persona = { id: 'ceo2', email: 'ceo@orbita.site' };
const cto2: Persona = { id: 'cto2', email: 'cto@orbita.site' };
const cpo2: Persona = { id: 'cpo2', email: 'CPO@orbita.site' };

describe('configuración', () => {
  it('por defecto la dirección son tres roles (CEO, CTO y CPO, en ese orden), cada uno con sus dos correos', () => {
    expect(reglas.direccion).toEqual([
      ['ceo@orbita-corp.com', 'ceo@orbita.site'],
      ['cto@orbita-corp.com', 'cto@orbita.site'],
      ['cpo@orbita-corp.com', 'cpo@orbita.site'],
    ]);
  });
  it('MARKETING_DIRECCION la cambia: roles separados por coma, correos de cada rol por «|», con espacios y mayúsculas', () => {
    expect(reglasDeConfig({ get: () => ' Uno@x.com | uno@y.com , dos@x.com ' }).direccion).toEqual([['uno@x.com', 'uno@y.com'], ['dos@x.com']]);
  });
  it('rolDe reconoce los dos correos de cada rol y nada más', () => {
    expect([rolDe('ceo@orbita.site', reglas), rolDe('CTO@orbita-corp.com', reglas), rolDe('cpo@orbita.site', reglas), rolDe('milagros@orbita.site', reglas)]).toEqual([0, 1, 2, -1]);
  });
});

describe('un socio con dos cuentas es una sola persona', () => {
  it('con una cuenta no se aprueba lo que subió la otra cuenta de otro rol, pero sí lo que subió la otra cuenta del mismo rol', () => {
    expect(puedeAprobar(video(ceo), ceo2)).toBe(true); // misma persona
    expect(puedeAprobar(video(ceo), cto2)).toBe(false); // otro socio
    expect(puedeAprobar(video(cto2), cto)).toBe(true);
    expect(puedeAprobar(video(cto2), cpo2)).toBe(false);
  });
  it('lo que sube un socio con una cuenta lo cierra él mismo con la otra', () => {
    expect(aprobacionCompleta(video(ceo, [ceo2]))).toBe(true);
    expect(aprobacionCompleta(video(cto2, [cto]))).toBe(true);
  });
  it('no aprueba dos veces: ni con la otra cuenta', () => {
    expect(puedeAprobar(video(milagros, [ceo]), ceo2)).toBe(false);
    expect(puedeAprobar(video(cto, [cto2]), cto)).toBe(false);
  });
  it('lo de Milagros: el CEO con cualquiera de sus cuentas alcanza; el CTO y el CPO tienen que ser los dos roles, no dos cuentas del mismo', () => {
    expect(aprobacionCompleta(video(milagros, [ceo2]))).toBe(true);
    expect(aprobacionCompleta(video(milagros, [cto, cto2]))).toBe(false);
    expect(aprobacionCompleta(video(milagros, [cto, cpo2]))).toBe(true);
    expect(aprobacionCompleta(video(milagros, [cto2, cpo]))).toBe(true);
  });
  it('rechazar: un socio descarta lo suyo con cualquiera de sus cuentas, y ningún otro socio', () => {
    expect(puedeRechazar(video(cto), cto2)).toBe(true);
    expect(puedeRechazar(video(cto), ceo2)).toBe(false);
    expect(puedeRechazar(video(milagros), cpo2)).toBe(true);
  });
});

describe('lo sube un socio: se aprueba a sí mismo y nadie más', () => {
  it.each([[ceo], [cto], [cpo]])('quien lo subió (%#) puede aprobarlo y con eso alcanza', (socio) => {
    expect(puedeAprobar(video(socio), socio)).toBe(true);
    expect(aprobacionCompleta(video(socio, [socio]))).toBe(true);
    expect(aprobacionCompleta(video(socio))).toBe(false);
  });
  it('ningún otro socio puede aprobar el de un compañero, ni siquiera el CEO', () => {
    expect(puedeAprobar(video(cto), ceo)).toBe(false);
    expect(puedeAprobar(video(cto), cpo)).toBe(false);
    expect(puedeAprobar(video(ceo), cto)).toBe(false);
    expect(puedeAprobar(video(ceo), cpo)).toBe(false);
    expect(puedeAprobar(video(cpo), ceo)).toBe(false);
  });
  it('Milagros tampoco aprueba el de un socio', () => {
    expect(puedeAprobar(video(ceo), milagros)).toBe(false);
  });
  it('la aprobación de otro socio no completa el video (aunque se registrara)', () => {
    expect(aprobacionCompleta(video(cto, [ceo]))).toBe(false);
    expect(aprobacionCompleta(video(cto, [ceo, cpo]))).toBe(false);
  });
  it('no se puede aprobar dos veces', () => {
    expect(puedeAprobar(video(cto, [cto]), cto)).toBe(false);
  });
});

describe('lo sube Milagros (no es socia): lo aprueba la dirección', () => {
  it('pueden aprobar los tres socios; ella no', () => {
    expect([ceo, cto, cpo].map((p) => puedeAprobar(video(milagros), p))).toEqual([true, true, true]);
    expect(puedeAprobar(video(milagros), milagros)).toBe(false);
    expect(puedeAprobar(video(milagros), { id: 'otro', email: 'cm@orbita-corp.com' })).toBe(false);
  });
  it('alcanza con el CEO', () => {
    expect(aprobacionCompleta(video(milagros, [ceo]))).toBe(true);
  });
  it('el CTO solo no alcanza, ni el CPO solo', () => {
    expect(aprobacionCompleta(video(milagros, [cto]))).toBe(false);
    expect(aprobacionCompleta(video(milagros, [cpo]))).toBe(false);
  });
  it('los otros dos juntos sí alcanzan, en cualquier orden', () => {
    expect(aprobacionCompleta(video(milagros, [cto, cpo]))).toBe(true);
    expect(aprobacionCompleta(video(milagros, [cpo, cto]))).toBe(true);
  });
  it('sin aprobaciones no alcanza, y una persona no aprueba dos veces', () => {
    expect(aprobacionCompleta(video(milagros))).toBe(false);
    expect(puedeAprobar(video(milagros, [cto]), cto)).toBe(false);
    expect(puedeAprobar(video(milagros, [cto]), cpo)).toBe(true);
  });
  it('la aprobación de la propia Milagros nunca cuenta', () => {
    expect(aprobacionCompleta(video(milagros, [milagros]))).toBe(false);
  });
});

describe('casos borde', () => {
  it('si la cuenta de quien lo subió ya no existe, la dirección puede aprobar por cualquiera de los dos caminos', () => {
    expect(aprobacionCompleta(video(null, [ceo]))).toBe(true);
    expect(aprobacionCompleta(video(null, [cto, cpo]))).toBe(true);
    expect(aprobacionCompleta(video(null, [cto]))).toBe(false);
    expect(puedeAprobar(video(null), cto)).toBe(true);
    expect(puedeAprobar(video(null), milagros)).toBe(false);
  });
  it('con una dirección de una sola persona, solo ella cierra lo de Milagros', () => {
    const sola = { ...video(milagros, [ceo]), reglas: { direccion: [['ceo@orbita-corp.com']] } };
    expect(aprobacionCompleta(sola)).toBe(true);
    expect(aprobacionCompleta({ ...sola, aprobaron: [] })).toBe(false);
  });
  it('sin dirección configurada nadie aprueba lo de Milagros (falla del lado seguro)', () => {
    const vacia = { ...video(milagros), reglas: { direccion: [] } };
    expect(puedeAprobar(vacia, ceo)).toBe(false);
    expect(aprobacionCompleta({ ...vacia, aprobaron: [ceo, cto, cpo] })).toBe(false);
  });
});

describe('rechazar', () => {
  it('quien lo subió siempre puede descartar el suyo', () => {
    expect(puedeRechazar(video(milagros), milagros)).toBe(true);
    expect(puedeRechazar(video(cto), cto)).toBe(true);
  });
  it('lo de Milagros lo puede rechazar la dirección; el resto del equipo no', () => {
    expect([ceo, cto, cpo].every((p) => puedeRechazar(video(milagros), p))).toBe(true);
    expect(puedeRechazar(video(milagros), { id: 'otro', email: 'cm@orbita-corp.com' })).toBe(false);
  });
  it('el video de un socio solo lo descarta él: ni otro socio ni Milagros', () => {
    expect(puedeRechazar(video(cto), ceo)).toBe(false);
    expect(puedeRechazar(video(ceo), cto)).toBe(false);
    expect(puedeRechazar(video(cto), milagros)).toBe(false);
  });
  it('si la cuenta del creador ya no existe, la dirección puede descartarlo', () => {
    expect(puedeRechazar(video(null), ceo)).toBe(true);
    expect(puedeRechazar(video(null), milagros)).toBe(false);
  });
});
