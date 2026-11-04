import { franjasDelDia, seguidasDesde, sesionesConCupo } from './disponibilidad';

const reglas = { duracion: 30, paso: 30, margen: 0, cupo: 1 };

describe('reservas · disponibilidad', () => {
  it('arma las franjas de la apertura y marca ocupadas las que se pisan con una reserva', () => {
    const f = franjasDelDia([[540, 660]], [], [{ tramo: [570, 600], cantidad: 1 }], reglas);
    expect(f.map((x) => [x.inicio, x.libres])).toEqual([[540, 1], [570, 0], [600, 1], [630, 1]]);
  });

  it('un bloqueo le saca ese pedazo a la apertura', () => {
    const f = franjasDelDia([[540, 660]], [[600, 630]], [], reglas);
    expect(f.map((x) => x.inicio)).toEqual([540, 570, 630]);
  });

  it('el margen agranda cada ocupación hacia los dos lados', () => {
    const f = franjasDelDia([[540, 720]], [], [{ tramo: [600, 630], cantidad: 1 }], { ...reglas, margen: 15 });
    // 570-600 termina pegada a la ocupación (que con margen arranca en 585): choca.
    expect(f.find((x) => x.inicio === 570)?.libres).toBe(0);
    expect(f.find((x) => x.inicio === 540)?.libres).toBe(1);
    expect(f.find((x) => x.inicio === 630)?.libres).toBe(0);
    expect(f.find((x) => x.inicio === 660)?.libres).toBe(1);
  });

  it('con desdeMinuto no se ofrecen las franjas que ya pasaron', () => {
    const f = franjasDelDia([[540, 660]], [], [], { ...reglas, desdeMinuto: 585 });
    expect(f.map((x) => x.inicio)).toEqual([600, 630]);
  });

  it('turnos de 60 cada 30: la que sigue es la que arranca donde termina la anterior', () => {
    const f = franjasDelDia([[540, 720]], [], [{ tramo: [660, 720], cantidad: 1 }], { ...reglas, duracion: 60, paso: 30 });
    expect(f.map((x) => [x.inicio, x.libres])).toEqual([[540, 1], [570, 1], [600, 1], [630, 0], [660, 0]]);
    expect(seguidasDesde(f, 540, 4)).toBe(2); // 540-600 y 600-660; 660 está ocupada
    expect(seguidasDesde(f, 570, 4)).toBe(1); // 570-630 libre, 630-690 no
    expect(seguidasDesde(f, 999, 4)).toBe(0);
  });

  it('las sesiones de una clase descuentan el cupo y una tapada por un bloqueo no se da', () => {
    const s = sesionesConCupo([[1140, 1200], [1200, 1260]], [[1230, 1240]], [{ tramo: [1140, 1200], cantidad: 8 }, { tramo: [1140, 1200], cantidad: 2 }], 10);
    expect(s).toEqual([{ inicio: 1140, fin: 1200, libres: 0, cupo: 10 }]);
  });
});
