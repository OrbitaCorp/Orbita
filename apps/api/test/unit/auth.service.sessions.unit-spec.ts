import { createHash } from 'crypto';
import { AuthService } from '../../src/auth/auth.service';

// Unit test de "sesiones activas" (RBT-631): listSessions() tiene que marcar
// isCurrent SOLO en la fila cuyo hash matchea el refresh token de ESTA
// pestaña. El bug real que motivó este test: el frontend pegaba directo al
// backend sin poder mandar ese token (vive en una cookie httpOnly), así que
// isCurrent nunca daba true — se arregló con un proxy BFF (pages/api/me/
// sessions/*) que sí puede leer la cookie. Este test cubre la lógica del
// servicio en sí, independiente de ese fix de transporte.

function hashOf(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function svcCon(rows: any[]) {
  const prisma = { refreshToken: { findMany: jest.fn().mockResolvedValue(rows) } };
  const noop = {} as any;
  const svc = new AuthService(prisma as any, noop, { getOrThrow: () => 'secret', get: () => undefined } as any);
  return { svc, prisma };
}

describe('AuthService.listSessions — isCurrent (unit)', () => {
  const rowA = { id: 's-a', tokenHash: hashOf('token-a'), deviceInfo: { userAgent: 'Chrome' }, createdAt: new Date(), expiresAt: new Date() };
  const rowB = { id: 's-b', tokenHash: hashOf('token-b'), deviceInfo: { userAgent: 'Firefox' }, createdAt: new Date(), expiresAt: new Date() };

  it('marca isCurrent=true solo en la fila cuyo hash matchea el refresh token recibido', async () => {
    const { svc } = svcCon([rowA, rowB]);
    const result = await svc.listSessions('user-1', 'CUSTOMER', 'token-a');
    expect(result.find((r) => r.id === 's-a')?.isCurrent).toBe(true);
    expect(result.find((r) => r.id === 's-b')?.isCurrent).toBe(false);
  });

  it('sin refresh token (el bug original: no se pudo mandar), ninguna fila queda marcada', async () => {
    const { svc } = svcCon([rowA, rowB]);
    const result = await svc.listSessions('user-1', 'CUSTOMER', undefined);
    expect(result.every((r) => r.isCurrent === false)).toBe(true);
  });

  it('con un refresh token que no matchea ninguna fila, ninguna queda marcada', async () => {
    const { svc } = svcCon([rowA, rowB]);
    const result = await svc.listSessions('user-1', 'CUSTOMER', 'token-que-no-existe');
    expect(result.every((r) => r.isCurrent === false)).toBe(true);
  });
});
