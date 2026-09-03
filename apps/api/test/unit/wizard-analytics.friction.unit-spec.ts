import {
  buildFunnel,
  buildFriction,
  contarInsuficientes,
  type FieldStat,
  type StepCount,
} from '../../src/wizard-analytics/friction';

describe('buildFunnel', () => {
  const pasos: StepCount[] = [
    { step: 0, stepName: 'rubro', sessions: 100 },
    { step: 1, stepName: 'subrubros', sessions: 80 },
    { step: 2, stepName: 'tu-negocio', sessions: 40 },
    { step: 3, stepName: 'ubicacion', sessions: 36 },
  ];

  it('calcula % sobre el total que ENTRÓ al wizard, no sobre el paso anterior', () => {
    const f = buildFunnel(pasos);
    expect(f[2].pctDelTotal).toBe(40);
  });

  it('calcula la caída contra el paso anterior, que es donde se ve el problema', () => {
    const f = buildFunnel(pasos);
    expect(f[2].perdidos).toBe(40);
    expect(f[2].pctCaida).toBe(50);
  });

  it('marca como peorPaso el de mayor caída relativa', () => {
    const f = buildFunnel(pasos);
    expect(f.filter((p) => p.peorPaso).map((p) => p.stepName)).toEqual(['tu-negocio']);
  });

  it('el primer paso nunca tiene caída', () => {
    const f = buildFunnel(pasos);
    expect(f[0].perdidos).toBe(0);
    expect(f[0].pctCaida).toBe(0);
    expect(f[0].peorPaso).toBe(false);
  });

  it('no divide por cero cuando todavía no hay tráfico', () => {
    expect(buildFunnel([])).toEqual([]);
    const f = buildFunnel([{ step: 0, stepName: 'rubro', sessions: 0 }]);
    expect(f[0].pctDelTotal).toBe(0);
  });
});

describe('buildFriction', () => {
  const base: FieldStat = {
    field: 'x',
    stepName: 'tu-negocio',
    sesiones: 100,
    medianaSegundos: 5,
    sesionesConError: 0,
    sesionesAbandonadas: 0,
    reintentosPromedio: 1,
  };

  it('un campo rápido y sin errores puntúa casi cero', () => {
    const [r] = buildFriction([{ ...base, field: 'nombre' }]);
    expect(r.indiceFriccion).toBeLessThan(10);
  });

  it('los errores pesan más que la lentitud', () => {
    const lento = { ...base, field: 'lento', medianaSegundos: 60 };
    const conErrores = { ...base, field: 'errores', sesionesConError: 60 };
    const [primero] = buildFriction([lento, conErrores]);
    expect(primero.field).toBe('errores');
  });

  it('ordena de más pesado a más liviano', () => {
    const orden = buildFriction([
      { ...base, field: 'facil' },
      { ...base, field: 'infernal', medianaSegundos: 90, sesionesConError: 70, sesionesAbandonadas: 50 },
      { ...base, field: 'medio', sesionesConError: 20 },
    ]).map((r) => r.field);
    expect(orden).toEqual(['infernal', 'medio', 'facil']);
  });

  it('satura en 100 y nunca se pasa', () => {
    const [r] = buildFriction([
      { ...base, medianaSegundos: 9999, sesionesConError: 100, sesionesAbandonadas: 100, reintentosPromedio: 40 },
    ]);
    expect(r.indiceFriccion).toBeLessThanOrEqual(100);
  });

  it('ignora campos con muestra insuficiente en vez de mostrar ruido como si fuera señal', () => {
    const r = buildFriction([{ ...base, field: 'raro', sesiones: 3, sesionesConError: 3 }]);
    expect(r).toEqual([]);
  });

  it('no divide por cero con sesiones en cero', () => {
    const r = buildFriction([{ ...base, field: 'vacio', sesiones: 0 }]);
    expect(r).toEqual([]);
  });
});

describe('contarInsuficientes', () => {
  const base: FieldStat = {
    field: 'x',
    stepName: 'tu-negocio',
    sesiones: 100,
    medianaSegundos: 5,
    sesionesConError: 0,
    sesionesAbandonadas: 0,
    reintentosPromedio: 1,
  };

  // Sin este número, un ranking vacío es ambiguo: el panel no puede distinguir
  // "nadie completó nada" de "hay datos pero todavía son pocos".
  it('cuenta los campos que tienen datos pero no llegan a la muestra mínima', () => {
    expect(
      contarInsuficientes([
        { ...base, field: 'nombre', sesiones: 2 },
        { ...base, field: 'telefono', sesiones: 4 },
        { ...base, field: 'email', sesiones: 5 },
        { ...base, field: 'subdominio', sesiones: 30 },
      ]),
    ).toBe(2);
  });

  it('no cuenta campos sin ninguna persona', () => {
    expect(contarInsuficientes([{ ...base, sesiones: 0 }])).toBe(0);
  });

  it('devuelve cero cuando no hay nada', () => {
    expect(contarInsuficientes([])).toBe(0);
  });
});
