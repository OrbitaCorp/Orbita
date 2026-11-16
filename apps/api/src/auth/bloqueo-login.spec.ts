import { LOCKOUT_DURATION_MS, LOCKOUT_THRESHOLD, trasIntentoFallido } from './bloqueo-login';

describe('trasIntentoFallido', () => {
  const ahora = new Date('2026-11-12T20:00:00Z');
  const antes = (min: number) => new Date(ahora.getTime() - min * 60_000);
  const despues = (min: number) => new Date(ahora.getTime() + min * 60_000);

  it('suma un intento sin bloquear mientras no llega al tope', () => {
    expect(trasIntentoFallido(0, null, ahora)).toEqual({ failedLoginAttempts: 1 });
    expect(trasIntentoFallido(LOCKOUT_THRESHOLD - 2, null, ahora)).toEqual({ failedLoginAttempts: LOCKOUT_THRESHOLD - 1 });
  });

  it('el intento que llega al tope bloquea 15 minutos', () => {
    expect(trasIntentoFallido(LOCKOUT_THRESHOLD - 1, null, ahora)).toEqual({
      failedLoginAttempts: LOCKOUT_THRESHOLD,
      lockedUntil: new Date(ahora.getTime() + LOCKOUT_DURATION_MS),
    });
  });

  it('con el bloqueo vencido, un fallo más cuenta desde 1 y no vuelve a bloquear (el caso de Milagros)', () => {
    expect(trasIntentoFallido(LOCKOUT_THRESHOLD, antes(1), ahora)).toEqual({ failedLoginAttempts: 1, lockedUntil: null });
    expect(trasIntentoFallido(12, antes(60 * 24), ahora)).toEqual({ failedLoginAttempts: 1, lockedUntil: null });
  });

  it('después de un bloqueo vencido, recién 5 fallos nuevos vuelven a bloquear', () => {
    let estado = trasIntentoFallido(LOCKOUT_THRESHOLD, antes(1), ahora);
    for (let i = 1; i < LOCKOUT_THRESHOLD; i++) estado = trasIntentoFallido(estado.failedLoginAttempts, estado.lockedUntil ?? null, ahora);
    expect(estado.failedLoginAttempts).toBe(LOCKOUT_THRESHOLD);
    expect(estado.lockedUntil).toEqual(new Date(ahora.getTime() + LOCKOUT_DURATION_MS));
  });

  it('con un bloqueo vigente sigue contando (no se acorta ni se reinicia)', () => {
    const r = trasIntentoFallido(LOCKOUT_THRESHOLD, despues(10), ahora);
    expect(r.failedLoginAttempts).toBe(LOCKOUT_THRESHOLD + 1);
    expect(r.lockedUntil!.getTime()).toBeGreaterThan(ahora.getTime());
  });

  it('un fallo suelto con un bloqueo vigente pero por debajo del tope no toca lockedUntil', () => {
    expect(trasIntentoFallido(1, despues(10), ahora)).toEqual({ failedLoginAttempts: 2 });
  });
});
