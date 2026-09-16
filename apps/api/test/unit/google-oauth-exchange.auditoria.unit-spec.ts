import { createHash } from 'crypto';
import { GoogleOAuthExchangeStore } from '../../src/auth/google-oauth-exchange.store';
import { PrismaService } from '../../src/prisma/prisma.service';

// Hallazgo `auth-estado-en-memoria` de la auditoría interna.
//
// El canje entre /auth/google/callback y el BFF de Next.js vivía en un Map del
// proceso. Cloud Run puede tener más de una instancia: si el callback lo
// atiende una y el POST /exchange cae en otra, el código no existe y el login
// por Google falla. Estos tests fijan que el canje vive en Postgres, que es de
// un solo uso aunque dos pedidos lleguen a la vez (el UPDATE condicional es lo
// que lo garantiza entre instancias) y que en la tabla queda el hash, no el
// código.

/** Tabla en memoria que se comporta como el UPDATE condicional de Postgres. */
function prismaFalso() {
  const filas: Array<{ codeHash: string; payload: unknown; expiresAt: Date; consumedAt: Date | null }> = [];
  return {
    filas,
    googleOAuthExchange: {
      create: jest.fn(async ({ data }: any) => {
        filas.push({ codeHash: data.codeHash, payload: data.payload, expiresAt: data.expiresAt, consumedAt: null });
        return data;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const f = filas.find((x) => x.codeHash === where.codeHash && x.consumedAt === null);
        if (!f) return { count: 0 };
        f.consumedAt = data.consumedAt;
        return { count: 1 };
      }),
      findUnique: jest.fn(async ({ where }: any) => filas.find((x) => x.codeHash === where.codeHash) ?? null),
      deleteMany: jest.fn(async ({ where }: any) => {
        const corte: Date = where.expiresAt.lt;
        let count = 0;
        for (let i = filas.length - 1; i >= 0; i--) {
          if (filas[i].expiresAt < corte) {
            filas.splice(i, 1);
            count++;
          }
        }
        return { count };
      }),
    },
  };
}

const sesion = { type: 'member', token: 'jwt-de-prueba', refreshToken: 'refresh-de-prueba' } as any;

describe('Canje de Google OAuth (hallazgo auth-estado-en-memoria)', () => {
  let prisma: ReturnType<typeof prismaFalso>;
  let store: GoogleOAuthExchangeStore;

  beforeEach(() => {
    prisma = prismaFalso();
    store = new GoogleOAuthExchangeStore(prisma as unknown as PrismaService);
  });

  it('el código se canjea contra la base, no contra memoria del proceso', async () => {
    const code = await store.create(sesion);
    expect(prisma.googleOAuthExchange.create).toHaveBeenCalledTimes(1);

    // Una instancia distinta = otro objeto, misma base: tiene que canjear igual.
    const otraInstancia = new GoogleOAuthExchangeStore(prisma as unknown as PrismaService);
    await expect(otraInstancia.consume(code)).resolves.toEqual(sesion);
  });

  it('guarda el SHA-256 del código, nunca el código', async () => {
    const code = await store.create(sesion);
    expect(prisma.filas[0].codeHash).toBe(createHash('sha256').update(code).digest('hex'));
    expect(prisma.filas[0].codeHash).not.toBe(code);
  });

  it('es de un solo uso, incluso con dos canjes en paralelo', async () => {
    const code = await store.create(sesion);
    const [a, b] = await Promise.all([store.consume(code), store.consume(code)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it('un código que no existe devuelve null', async () => {
    await expect(store.consume('no-existe')).resolves.toBeNull();
  });

  it('un código vencido no sirve aunque la fila siga estando', async () => {
    const code = await store.create(sesion);
    prisma.filas[0].expiresAt = new Date(Date.now() - 1000);
    await expect(store.consume(code)).resolves.toBeNull();
  });

  it('limpia las filas vencidas viejas al crear un canje nuevo', async () => {
    await store.create(sesion);
    prisma.filas[0].expiresAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // más de una hora vencida
    await store.create(sesion);
    expect(prisma.filas).toHaveLength(1);
  });

  it('no rompe el login si la limpieza falla', async () => {
    prisma.googleOAuthExchange.deleteMany.mockRejectedValueOnce(new Error('base caída'));
    await expect(store.create(sesion)).resolves.toEqual(expect.any(String));
  });
});
