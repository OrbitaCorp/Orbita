import { nocheDeFinDeSemana, precioDeEstadia, tarifaDeAlojamiento, temporadaDe, type TarifaEstadia } from './estadia';

// Los mismos casos que apps/web/src/lib/reservas/__tests__/estadia.test.ts: el
// total que ve la persona en el sitio tiene que ser el que cobra el servidor.
const tarifa: TarifaEstadia = {
  precioNoche: 60000,
  temporadas: [{ nombre: 'Temporada alta', desde: '2026-12-20', hasta: '2027-02-28', precioNoche: 95000 }],
  finDeSemanaPct: 20,
  limpieza: 25000,
};

describe('reservas · precio de una estadía', () => {
  it('las noches de fin de semana son la del viernes y la del sábado, no la del domingo', () => {
    expect(nocheDeFinDeSemana('2026-11-12')).toBe(false); // jueves
    expect(nocheDeFinDeSemana('2026-11-13')).toBe(true); // viernes: se sale el sábado
    expect(nocheDeFinDeSemana('2026-11-14')).toBe(true); // sábado
    expect(nocheDeFinDeSemana('2026-11-15')).toBe(false); // domingo: se sale el lunes
  });

  it('cobra por noche según temporada y fin de semana, más la limpieza', () => {
    // 13/11 (viernes, +20 %), 14/11 (sábado, +20 %), 15/11 (domingo, base)
    const p = precioDeEstadia('2026-11-13', '2026-11-16', tarifa);
    expect(p.noches.map((n) => n.precio)).toEqual([72000, 72000, 60000]);
    expect(p.subtotal).toBe(204000);
    expect(p.limpieza).toBe(25000);
    expect(p.total).toBe(229000);
    // En temporada alta manda el precio de la temporada.
    const alta = precioDeEstadia('2026-12-21', '2026-12-23', tarifa); // lunes y martes
    expect(alta.noches.map((n) => n.precio)).toEqual([95000, 95000]);
    expect(alta.total).toBe(215000);
  });

  it('sin recargo configurado, el fin de semana vale lo mismo', () => {
    expect(precioDeEstadia('2026-11-13', '2026-11-15', { ...tarifa, finDeSemanaPct: 0 }).subtotal).toBe(120000);
  });

  it('el recargo de fin de semana redondea a los cien, sin coma flotante', () => {
    // Viernes 13/11 a $45.000 con +15 %: 51.750 → 51.800 (con × 1,15 daba 51.749,999… → 51.700).
    const p = precioDeEstadia('2026-11-13', '2026-11-14', { precioNoche: 45000, temporadas: [], finDeSemanaPct: 15, limpieza: 0 });
    expect(p.noches[0].precio).toBe(51800);
  });

  it('el recargo se aplica también sobre el precio de la temporada', () => {
    // Sábado 26/12, en temporada alta: 95.000 + 20 % = 114.000
    expect(precioDeEstadia('2026-12-26', '2026-12-27', tarifa).noches[0].precio).toBe(114000);
  });

  it('si dos temporadas se pisan, manda la más corta (Carnaval adentro de la alta)', () => {
    const temporadas = [...tarifa.temporadas, { nombre: 'Carnaval', desde: '2027-02-13', hasta: '2027-02-16', precioNoche: 120000 }];
    expect(temporadaDe('2027-02-14', temporadas)?.nombre).toBe('Carnaval');
    expect(temporadaDe('2027-02-20', temporadas)?.nombre).toBe('Temporada alta');
    expect(temporadaDe('2026-11-14', temporadas)).toBeNull();
    // El último día de la temporada está adentro.
    expect(temporadaDe('2027-02-28', temporadas)?.nombre).toBe('Temporada alta');
    expect(temporadaDe('2027-03-01', temporadas)).toBeNull();
  });

  it('sin noches no cobra nada, ni la limpieza', () => {
    expect(precioDeEstadia('2026-11-13', '2026-11-13', tarifa)).toEqual({ noches: [], subtotal: 0, limpieza: 0, total: 0 });
  });
});

describe('reservas · la tarifa de un alojamiento, leída de sus datos', () => {
  it('sin tarifa cargada es el precio del recurso por noche, sin más (como antes)', () => {
    expect(tarifaDeAlojamiento(80000, null)).toEqual({ precioNoche: 80000, temporadas: [], finDeSemanaPct: 0, limpieza: 0 });
    expect(tarifaDeAlojamiento(80000, { checkIn: 840 })).toEqual({ precioNoche: 80000, temporadas: [], finDeSemanaPct: 0, limpieza: 0 });
    expect(precioDeEstadia('2026-11-10', '2026-11-13', tarifaDeAlojamiento(80000, {})).total).toBe(240000);
  });

  it('lee temporadas, recargo y limpieza de datos.tarifa', () => {
    const t = tarifaDeAlojamiento(60000, { tarifa: { temporadas: [{ id: 'alta', nombre: 'Temporada alta', desde: '2026-12-20', hasta: '2027-02-28', precioNoche: 95000 }], finDeSemanaPct: 20, limpieza: 25000 } });
    expect(t).toEqual({ precioNoche: 60000, temporadas: [{ nombre: 'Temporada alta', desde: '2026-12-20', hasta: '2027-02-28', precioNoche: 95000 }], finDeSemanaPct: 20, limpieza: 25000 });
  });

  it('lo que viene mal cargado no se aplica: nunca rompe una reserva ni cobra un disparate', () => {
    const t = tarifaDeAlojamiento(60000, {
      tarifa: {
        temporadas: [
          { nombre: 'Sin fechas', precioNoche: 1 },
          { nombre: 'Al revés', desde: '2027-02-01', hasta: '2027-01-01', precioNoche: 1 },
          { nombre: 'Negativa', desde: '2027-01-01', hasta: '2027-01-02', precioNoche: -5 },
          { nombre: 'Fecha rota', desde: '2027-13-01', hasta: '2027-13-02', precioNoche: 1 },
          'texto',
          { nombre: 'Buena', desde: '2027-01-01', hasta: '2027-01-10', precioNoche: 70000 },
        ],
        finDeSemanaPct: 'mucho',
        limpieza: -100,
      },
    });
    expect(t.temporadas).toEqual([{ nombre: 'Buena', desde: '2027-01-01', hasta: '2027-01-10', precioNoche: 70000 }]);
    expect(t.finDeSemanaPct).toBe(0);
    expect(t.limpieza).toBe(0);
    expect(tarifaDeAlojamiento(60000, { tarifa: 'x' }).temporadas).toEqual([]);
    expect(tarifaDeAlojamiento(60000, { tarifa: { finDeSemanaPct: 900 } }).finDeSemanaPct).toBe(0);
    expect(tarifaDeAlojamiento(-10, {}).precioNoche).toBe(0);
  });
});
