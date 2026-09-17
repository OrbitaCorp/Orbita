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
 * datos de negocio se suma ahí, no se escribe un test nuevo. Los módulos que
 * NO entran en este patrón (juegos, singletons de configuración, módulos que
 * solo listan) están enumerados con su motivo justo debajo de la tabla, para
 * que la ausencia se lea como una decisión y no como un olvido.
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

/**
 * Lo que se creó en A: cada módulo guarda acá el id de su recurso, bajo su
 * propio nombre. Además lleva los INSUMOS que un módulo le deja al siguiente
 * (la variante que deja products para el pedido, la sesión de la clienta del
 * storefront, el pedido ya entregado): claves con nombre propio, distinto del
 * de cualquier módulo, para que no se pisen.
 */
type Recursos = Record<string, string>;

interface Modulo {
  nombre: string;
  /** Crea el recurso en el negocio A. Devuelve su id, o null si no se pudo armar. */
  crear: (app: INestApplication, a: Negocio, recursos: Recursos) => Promise<string | null>;
  /** Rutas que, con el token de B y el id de A, tienen que dar 404. */
  rutas: (id: string) => Array<{ metodo: 'get' | 'put' | 'patch' | 'delete' | 'post'; ruta: string; body?: unknown }>;
}

const api = (app: INestApplication) => request(app.getHttpServer());

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Registra una clienta en la TIENDA de A y deja su token y su id en `recursos`.
 *
 * Hace falta porque hay módulos cuyo recurso no nace del lado del panel: la
 * conversación la abre el cliente cuando escribe, la reseña la deja quien
 * compró, y la solicitud de cancelación la pide el cliente. Con el token del
 * dueño de A no hay forma de crear ninguno de los tres.
 */
async function registrarClientaDeA(app: INestApplication, a: Negocio, recursos: Recursos): Promise<void> {
  const email = `clienta-a-${sufijo()}@prueba.orbita.test`;
  await api(app)
    .post('/api/v1/auth/register')
    .set('X-Business-Slug', a.slug)
    .send({ email, password: PASSWORD, firstName: 'Clienta', lastName: 'De A' });

  const login = await api(app)
    .post('/api/v1/auth/login')
    .set('X-Business-Slug', a.slug)
    .send({ email, password: PASSWORD });

  if (login.body?.token) recursos.clientaToken = login.body.token;
  if (login.body?.customer?.id) recursos.clientaId = login.body.customer.id;
}

/**
 * Pedido de A ya entregado y a nombre de la clienta del storefront. Es el
 * insumo de reseñas (solo reseña quien compró Y ya recibió) y de devoluciones
 * (solo se devuelve lo que efectivamente salió del inventario). Deja el id del
 * pedido y el de su renglón en `recursos`, igual que products deja `variante`.
 */
async function crearPedidoEntregadoDeA(app: INestApplication, a: Negocio, recursos: Recursos): Promise<void> {
  if (!recursos.variante || !recursos.clientaId) return;

  const alta = await api(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${a.token}`)
    .send({
      channel: 'ONLINE',
      customerId: recursos.clientaId,
      items: [{ variantId: recursos.variante, quantity: 1 }],
      buyer: { name: 'Clienta De A' },
    });
  const id = alta.body?.id;
  if (!id) return;

  // PENDING → DELIVERED es una transición válida de un pedido ONLINE (ver
  // TRANSICIONES en orders.service): no hace falta pasar por CONFIRMED.
  await api(app)
    .patch(`/api/v1/orders/${id}/status`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({ status: 'DELIVERED' });

  const detalle = await api(app).get(`/api/v1/orders/${id}`).set('Authorization', `Bearer ${a.token}`);
  recursos.pedidoEntregado = id;
  const renglon = (detalle.body?.items ?? []).find((i: { isConcept?: boolean }) => !i.isConcept);
  if (renglon?.id) recursos.renglonEntregado = renglon.id;
}

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
  {
    // El agujero que motivó todo esto: la conversación del panel se buscaba
    // solo por id, sin filtrar por negocio. Con el token de B alcanzaba para
    // LEER y CONTESTAR el chat entre A y su clienta.
    nombre: 'conversations',
    crear: async (app, a, recursos) => {
      if (!recursos.clientaToken) return null;
      // No hay alta de conversación desde el panel: nace con el primer
      // mensaje del cliente desde la tienda.
      await api(app)
        .post('/api/v1/me/conversation/messages')
        .set('Authorization', `Bearer ${recursos.clientaToken}`)
        .set('X-Business-Slug', a.slug)
        .send({ text: 'Hola, una consulta sobre mi pedido' });

      const mia = await api(app)
        .get('/api/v1/me/conversation')
        .set('Authorization', `Bearer ${recursos.clientaToken}`)
        .set('X-Business-Slug', a.slug);
      return mia.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'get', ruta: `/api/v1/conversations/${id}/messages` },
      { metodo: 'post', ruta: `/api/v1/conversations/${id}/messages`, body: { text: 'Mensaje colado por B' } },
      { metodo: 'patch', ruta: `/api/v1/conversations/${id}`, body: { isArchived: true } },
    ],
  },
  {
    // La reseña la escribe la clienta de A sobre el pedido que ya recibió; lo
    // que se prueba es la moderación desde el panel: B no tiene que poder
    // tapar (ni destapar) una reseña de la tienda de al lado.
    nombre: 'reviews',
    crear: async (app, a, recursos) => {
      // El pedido entregado es insumo de este módulo y del de devoluciones:
      // se arma acá, la primera vez que hace falta (mismo criterio que la
      // variante que deja products).
      await crearPedidoEntregadoDeA(app, a, recursos);
      if (!recursos.clientaToken || !recursos.pedidoEntregado || !recursos.products) return null;

      const res = await api(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${recursos.clientaToken}`)
        .set('X-Business-Slug', a.slug)
        .send({ productId: recursos.products, orderId: recursos.pedidoEntregado, text: 'Muy bueno, llegó rápido.' });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'patch', ruta: `/api/v1/reviews/${id}/hide`, body: { hiddenReason: 'B tapando una reseña ajena' } },
      { metodo: 'patch', ruta: `/api/v1/reviews/${id}/show` },
    ],
  },
  {
    // Aprobar una devolución ajena reingresa stock y emite una nota de
    // crédito en el negocio de al lado: por eso vale probarlo aparte de
    // pedidos, aunque cuelgue de uno.
    nombre: 'returns',
    crear: async (app, a, recursos) => {
      if (!recursos.pedidoEntregado || !recursos.renglonEntregado) return null;
      const res = await api(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${a.token}`)
        .send({
          orderId: recursos.pedidoEntregado,
          orderItemId: recursos.renglonEntregado,
          quantity: 1,
          amount: 100,
          reason: 'Devolución de prueba de A',
          refundMethod: 'CREDIT_NOTE',
        });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      // No hay GET por id (la devolución se lee desde el listado), así que el
      // caso es el PATCH: resolverla es lo que tiene efectos.
      { metodo: 'patch', ruta: `/api/v1/returns/${id}`, body: { status: 'REJECTED' } },
    ],
  },
  {
    // Plata a favor de un cliente: si B pudiera anular o reactivar una nota de
    // A, le estaría moviendo el saldo a un cliente que no es suyo.
    nombre: 'credit-notes',
    crear: async (app, a, recursos) => {
      if (!recursos.pedidoEntregado) return null;
      const res = await api(app)
        .post('/api/v1/credit-notes')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ orderId: recursos.pedidoEntregado, amount: 100, type: 'BALANCE' });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'patch', ruta: `/api/v1/credit-notes/${id}/cancel` },
      { metodo: 'patch', ruta: `/api/v1/credit-notes/${id}/reactivate` },
    ],
  },
  {
    // Aceptar una solicitud ajena CANCELA el pedido de A (y le reingresa el
    // stock): es de los pocos endpoints donde un 200 cruzado se nota en la
    // caja del otro negocio.
    nombre: 'cancellations',
    crear: async (app, a, recursos) => {
      if (!recursos.variante || !recursos.clientaId || !recursos.clientaToken) return null;

      // Un negocio nuevo solo trae habilitado el reembolso por Mercado Pago, y
      // este pedido no se pagó por ahí: sin un método posible, la solicitud se
      // rechaza antes de nacer (resolveRefundMethod).
      await api(app)
        .put('/api/v1/business/config')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ cancellationsEnabled: true, cancellationsCreditNoteEnabled: true });

      const alta = await api(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${a.token}`)
        .send({
          channel: 'ONLINE',
          customerId: recursos.clientaId,
          items: [{ variantId: recursos.variante, quantity: 1 }],
          buyer: { name: 'Clienta De A' },
        });
      const pedido = alta.body?.id;
      if (!pedido) return null;

      // CONFIRMED y no PENDING: un pedido pendiente se autocancela solo y no
      // deja ninguna solicitud para que el negocio resuelva.
      await api(app)
        .patch(`/api/v1/orders/${pedido}/status`)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ status: 'CONFIRMED' });

      await api(app)
        .patch(`/api/v1/me/orders/${pedido}/cancel`)
        .set('Authorization', `Bearer ${recursos.clientaToken}`)
        .set('X-Business-Slug', a.slug)
        .send({ reason: 'Me arrepentí de la compra', refundMethod: 'CREDIT_NOTE' });

      const lista = await api(app).get('/api/v1/cancellations').set('Authorization', `Bearer ${a.token}`);
      const solicitud = (lista.body?.data ?? []).find((s: { orderId: string }) => s.orderId === pedido);
      return solicitud?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'patch', ruta: `/api/v1/cancellations/${id}/approve` },
      { metodo: 'patch', ruta: `/api/v1/cancellations/${id}/reject`, body: { rejectionMessage: 'No' } },
    ],
  },
  {
    // La campana del panel. No hay endpoint para crear una notificación a
    // mano: nacen de eventos del negocio (el alta de la clienta disparó
    // `cliente_nuevo`, cada pedido dispara `nuevo_pedido`). El emit no se
    // espera, así que se reintenta un rato antes de darla por perdida.
    nombre: 'notifications',
    crear: async (app, a) => {
      for (let intento = 0; intento < 15; intento++) {
        const res = await api(app).get('/api/v1/notifications').set('Authorization', `Bearer ${a.token}`);
        const id = res.body?.data?.[0]?.id;
        if (id) return id;
        await esperar(200);
      }
      return null;
    },
    rutas: (id) => [{ metodo: 'patch', ruta: `/api/v1/notifications/${id}/read` }],
  },
  {
    // Respuestas rápidas del chat: texto que el negocio escribió, con sus
    // precios y sus condiciones adentro.
    nombre: 'message-templates',
    crear: async (app, a) => {
      const res = await api(app)
        .post('/api/v1/message-templates')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ name: `Plantilla A ${sufijo()}`, text: 'Hola, tu pedido ya está listo.', category: 'PEDIDO' });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'put', ruta: `/api/v1/message-templates/${id}`, body: { name: 'Robada por B', text: 'Texto de B', category: 'OTRO' } },
      { metodo: 'delete', ruta: `/api/v1/message-templates/${id}` },
    ],
  },
  {
    // Proveedores (inventario): nombre, contacto y email de con quién compra
    // el negocio — dato sensible de un competidor.
    nombre: 'suppliers',
    crear: async (app, a) => {
      const res = await api(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ name: `Proveedor A ${sufijo()}`, contact: 'Juan', phone: '1122334455' });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'put', ruta: `/api/v1/suppliers/${id}`, body: { name: 'Robado por B' } },
      { metodo: 'delete', ruta: `/api/v1/suppliers/${id}` },
    ],
  },
  {
    // Roles del equipo. Editar un rol ajeno es repartir permisos en el panel
    // de otro negocio, así que el aislamiento acá es de los más caros.
    // `permissions: []` alcanza: el rol se crea igual y el caso es la tenencia,
    // no qué permisos tiene.
    nombre: 'roles',
    crear: async (app, a) => {
      const res = await api(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ name: `Rol A ${sufijo()}`, permissions: [] });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'put', ruta: `/api/v1/roles/${id}`, body: { name: 'Robado por B', permissions: [] } },
      { metodo: 'delete', ruta: `/api/v1/roles/${id}` },
    ],
  },
  {
    // Miembros del equipo de A. El peor caso de todos: `reset-password` de un
    // miembro ajeno devuelve una contraseña temporal usable — sería entrar al
    // panel del otro negocio con una cuenta suya.
    nombre: 'members',
    crear: async (app, a, recursos) => {
      if (!recursos.roles) return null;
      const res = await api(app)
        .post('/api/v1/members/invite')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ name: 'Empleado de A', email: `empleado-a-${sufijo()}@prueba.orbita.test`, roleId: recursos.roles });
      return res.body?.id ?? null;
    },
    rutas: (id) => [
      { metodo: 'put', ruta: `/api/v1/members/${id}`, body: { name: 'Robado por B' } },
      { metodo: 'post', ruta: `/api/v1/members/${id}/reset-password`, body: { sendEmail: false } },
      { metodo: 'delete', ruta: `/api/v1/members/${id}` },
    ],
  },
];

/**
 * Módulos con datos de negocio que NO están en la tabla de arriba, y por qué.
 * Se dejan escritos para que la próxima lectura no tenga que redescubrirlos:
 * ninguno se puede probar con el patrón "id de A + token de B = 404".
 *
 * - **Turnos**: no existe. Ningún módulo de `apps/api/src/` ni modelo del
 *   schema implementa reservas/turnos todavía; lo nombra la descripción del
 *   hallazgo, no el código. Cuando exista, se suma acá.
 * - **Juegos** (`/games/:type`): el parámetro de la URL es el TIPO de juego
 *   (ruleta, raspadita…), no un id. `/games/ruleta` de B resuelve contra el
 *   juego de B: no hay id ajeno que pedir, así que el 404 no se puede dar. Su
 *   aislamiento es el `where businessId` del service, cubierto por unit tests.
 * - **Singletons del negocio** — countdown, promo-modal, social-proof,
 *   two-for-one, `business/config`, `storefront-config`, `notification-config`:
 *   hay una sola fila por negocio y la URL no lleva ningún id; el businessId
 *   sale siempre del token. No hay caso A-vs-B que armar.
 * - **Solo listados/agregados** — inventario (`/inventory/stock`,
 *   `/inventory/movements`), auditoría (`/audit-logs`), reportes y búsqueda:
 *   no tienen ruta de detalle por id. Lo que corresponde probar ahí es que el
 *   listado de B no traiga filas de A, y eso es el último test del archivo.
 * - **Dominios** (`/domains`): el alta (`POST /domains/link`) necesita un
 *   dominio real y un plan que lo habilite; montar eso en un e2e prueba más
 *   sobre el proveedor de DNS que sobre el aislamiento. Queda pendiente.
 * - **Orbi** (`/orbi/chat`): el businessId sale del token y la conversación se
 *   resuelve contra él (fue uno de los dos agujeros que motivaron este
 *   archivo). No expone ninguna ruta con el id de la conversación en la URL,
 *   así que no entra en este patrón.
 */

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

    // Antes de la tabla: hay módulos cuyo recurso lo crea el cliente desde la
    // tienda, no el dueño desde el panel (ver el helper).
    await registrarClientaDeA(app, a, recursos);

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
      // Módulos sin GET por id (categorías, etiquetas, devoluciones, roles…):
      // no hay nada que leer, el caso se agota en el 404 del test de arriba.
      if (!lectura) return;
      const res = await api(app).get(lectura.ruta).set('Authorization', `Bearer ${a.token}`);
      expect(res.status).toBe(200);
    });
  });

  // El otro lado del mismo problema: además de no poder pedir un recurso de A
  // por id, los listados de B no tienen que traerlo "de arrastre". Acá entran
  // también los módulos que solo exponen listados (ver el bloque de descartes).
  it('los listados de B no traen nada de A', async () => {
    for (const ruta of [
      '/api/v1/products',
      '/api/v1/orders',
      '/api/v1/customers',
      '/api/v1/discounts',
      '/api/v1/coupons',
      '/api/v1/conversations',
      '/api/v1/notifications',
      '/api/v1/message-templates',
      '/api/v1/suppliers',
      '/api/v1/roles',
      '/api/v1/members',
      '/api/v1/returns',
      '/api/v1/credit-notes',
      '/api/v1/cancellations',
      '/api/v1/inventory/movements',
      '/api/v1/audit-logs',
    ]) {
      const res = await api(app).get(ruta).set('Authorization', `Bearer ${b.token}`);
      expect(res.status).toBe(200);
      const filas = Array.isArray(res.body) ? res.body : (res.body.data ?? res.body.items ?? []);
      const ids = filas.map((f: { id: string }) => f.id);
      for (const id of Object.values(recursos)) expect(ids).not.toContain(id);
    }
  });
});
