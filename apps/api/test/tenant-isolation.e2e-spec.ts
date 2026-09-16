/**
 * Aislamiento entre negocios, módulo por módulo (hallazgo
 * `e2e-aislamiento-por-modulo` y check 1 de `trans.multi-tenant-e2e`).
 *
 * `auth-isolation.e2e-spec.ts` cubre el login cruzado: quién puede entrar a
 * dónde. Lo que faltaba es lo de después — con una sesión válida de B, ¿se
 * llega a los datos de A? Es el agujero que ya apareció dos veces en la misma
 * semana con Orbi (el businessId salía del body, y la conversación del panel
 * se buscaba solo por id), así que acá se prueba una vez por módulo en vez de
 * confiar en que cada consulta filtró bien.
 *
 * La tabla MODULOS de abajo es el punto de extensión: un módulo nuevo con
 * datos de negocio se suma ahí, no se escribe un test nuevo.
 *
 * Crea dos negocios de prueba y **los borra enteros al terminar**
 * (`limpiarNegocios`, hallazgo `tiendas-prueba-publicadas`: los e2e viejos
 * dejaron 24 tiendas publicadas en producción). Igual no corre contra
 * producción salvo que se lo pidan a propósito — ver `e2e-base.ts`.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { limpiarNegocios } from './helpers/limpiar-negocio';

const PASSWORD = 'Test1234!';
const sufijo = () => `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

interface Negocio {
  id: string;
  slug: string;
  token: string;
}

/** Lo que se creó en A: cada módulo guarda acá el id de su recurso. */
type Recursos = Record<string, string>;

interface Modulo {
  nombre: string;
  /** Crea el recurso en el negocio A. Devuelve su id, o null si no se pudo armar. */
  crear: (app: INestApplication, a: Negocio, recursos: Recursos) => Promise<string | null>;
  /** Rutas que, con el token de B y el id de A, tienen que dar 404. */
  rutas: (id: string) => Array<{ metodo: 'get' | 'put' | 'patch' | 'delete' | 'post'; ruta: string; body?: unknown }>;
}

const api = (app: INestApplication) => request(app.getHttpServer());

const MODULOS: Modulo[] = [
  {
    nombre: 'categories',
    crear: async (app, a) => {
      const res = await api(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ name: `Categoría A ${sufijo()}` });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'put', ruta: `/api/v1/categories/${id}`, body: { name: 'Robada por B' } },
      { metodo: 'delete', ruta: `/api/v1/categories/${id}` },
    ],
  },
  {
    nombre: 'tags',
    crear: async (app, a) => {
      const res = await api(app)
        .post('/api/v1/tags')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ name: `Etiqueta A ${sufijo()}` });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'put', ruta: `/api/v1/tags/${id}`, body: { name: 'Robada por B' } },
      { metodo: 'delete', ruta: `/api/v1/tags/${id}` },
    ],
  },
  {
    nombre: 'branches',
    crear: async (app, a) => {
      const res = await api(app)
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ name: `Sucursal A ${sufijo()}` });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'get', ruta: `/api/v1/branches/${id}` },
      { metodo: 'put', ruta: `/api/v1/branches/${id}`, body: { name: 'Robada por B' } },
      { metodo: 'delete', ruta: `/api/v1/branches/${id}` },
    ],
  },
  {
    nombre: 'customers',
    crear: async (app, a) => {
      const res = await api(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ firstName: 'Cliente', lastName: 'De A', email: `cliente-a-${sufijo()}@prueba.orbita.test` });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'get', ruta: `/api/v1/customers/${id}` },
      { metodo: 'put', ruta: `/api/v1/customers/${id}`, body: { firstName: 'Robado por B' } },
    ],
  },
  {
    nombre: 'products',
    crear: async (app, a, recursos) => {
      const res = await api(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${a.token}`)
        .send({
          name: `Producto A ${sufijo()}`,
          categoryId: recursos.categories,
          basePrice: 1000,
          variants: [{ price: 1000, optionValues: [], initialStock: 10 }],
        });
      // El id de la variante lo necesita el pedido de más abajo.
      if (res.body?.variants?.[0]?.id) recursos.variante = res.body.variants[0].id;
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'get', ruta: `/api/v1/products/${id}` },
      { metodo: 'delete', ruta: `/api/v1/products/${id}` },
      { metodo: 'patch', ruta: `/api/v1/products/${id}/featured`, body: { isFeatured: true } },
    ],
  },
  {
    nombre: 'discounts',
    crear: async (app, a) => {
      const res = await api(app)
        .post('/api/v1/discounts')
        .set('Authorization', `Bearer ${a.token}`)
        .send({
          name: `Descuento A ${sufijo()}`,
          type: 'PERCENT_TICKET',
          value: 10,
          scope: 'TICKET',
          startDate: new Date().toISOString(),
        });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'get', ruta: `/api/v1/discounts/${id}` },
      { metodo: 'put', ruta: `/api/v1/discounts/${id}`, body: { name: 'Robado por B', type: 'PERCENT_TICKET', value: 50, scope: 'TICKET', startDate: new Date().toISOString() } },
      { metodo: 'patch', ruta: `/api/v1/discounts/${id}/toggle` },
      { metodo: 'delete', ruta: `/api/v1/discounts/${id}` },
    ],
  },
  {
    nombre: 'coupons',
    crear: async (app, a) => {
      const res = await api(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${a.token}`)
        .send({
          code: `CUPONA${Math.floor(Math.random() * 1_000_000)}`,
          name: `Cupón A ${sufijo()}`,
          type: 'PERCENT_TICKET',
          value: 10,
          scope: 'TICKET',
          startDate: new Date().toISOString(),
        });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'get', ruta: `/api/v1/coupons/${id}` },
      { metodo: 'patch', ruta: `/api/v1/coupons/${id}/toggle` },
      { metodo: 'delete', ruta: `/api/v1/coupons/${id}` },
    ],
  },
  {
    nombre: 'orders',
    crear: async (app, a, recursos) => {
      if (!recursos.variante) return null;
      const res = await api(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${a.token}`)
        .send({
          channel: 'ONLINE',
          items: [{ variantId: recursos.variante, quantity: 1 }],
          buyer: { name: 'Comprador de A' },
        });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'get', ruta: `/api/v1/orders/${id}` },
      { metodo: 'patch', ruta: `/api/v1/orders/${id}/status`, body: { status: 'COMPLETED' } },
    ],
  },
];

describe('Aislamiento entre negocios por módulo', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let a: Negocio;
  let b: Negocio;
  const recursos: Recursos = {};

  async function crearNegocio(nombre: string): Promise<Negocio> {
    const email = `owner-${nombre}-${sufijo()}@prueba.orbita.test`;
    const alta = await api(app).post('/api/v1/onboarding/register-business').send({
      ownerName: `Dueño ${nombre}`,
      email,
      password: PASSWORD,
      businessName: `Tienda ${nombre} ${sufijo()}`,
    });
    expect(alta.status).toBe(201);

    const login = await api(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(201);

    return { id: alta.body.business.id, slug: alta.body.business.subdomain, token: login.body.token };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    a = await crearNegocio('A');
    b = await crearNegocio('B');

    for (const modulo of MODULOS) {
      const id = await modulo.crear(app, a, recursos);
      if (id) recursos[modulo.nombre] = id;
    }
  }, 120_000);

  afterAll(async () => {
    try {
      await limpiarNegocios(prisma, [a?.id, b?.id].filter(Boolean) as string[]);
    } finally {
      await prisma.$disconnect();
      await closeTestApp();
    }
  }, 120_000);

  it.each(MODULOS.map((m) => m.nombre))('el recurso de A existe para armar el caso de %s', (nombre) => {
    expect(recursos[nombre]).toBeDefined();
  });

  describe.each(MODULOS.map((m) => [m.nombre, m] as const))('%s', (nombre, modulo) => {
    it('con el token de B, los recursos de A no existen', async () => {
      const id = recursos[nombre];
      expect(id).toBeDefined();

      for (const { metodo, ruta, body } of modulo.rutas(id)) {
        const res = await api(app)[metodo](ruta).set('Authorization', `Bearer ${b.token}`).send(body ?? {});
        // 404 y no 403: B no tiene que poder distinguir "existe pero no es tuyo"
        // de "no existe". Un 200/201 acá es una fuga entre negocios.
        expect({ metodo, ruta, status: res.status }).toEqual({ metodo, ruta, status: 404 });
      }
    });

    it('con el token de A, el mismo recurso sí se ve (el test prueba algo)', async () => {
      const id = recursos[nombre];
      const lectura = modulo.rutas(id).find((r) => r.metodo === 'get');
      if (!lectura) return; // módulos sin GET por id (categorías, etiquetas)
      const res = await api(app).get(lectura.ruta).set('Authorization', `Bearer ${a.token}`);
      expect(res.status).toBe(200);
    });
  });

  it('los listados de B no traen nada de A', async () => {
    for (const ruta of ['/api/v1/products', '/api/v1/orders', '/api/v1/customers', '/api/v1/discounts', '/api/v1/coupons']) {
      const res = await api(app).get(ruta).set('Authorization', `Bearer ${b.token}`);
      expect(res.status).toBe(200);
      const filas = Array.isArray(res.body) ? res.body : (res.body.data ?? res.body.items ?? []);
      const ids = filas.map((f: { id: string }) => f.id);
      for (const id of Object.values(recursos)) expect(ids).not.toContain(id);
    }
  });
});
