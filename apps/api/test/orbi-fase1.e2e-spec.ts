/**
 * Orbi fase 1 contra Postgres de verdad (spec §6, "Tests contra Postgres real").
 *
 * CI no tiene Postgres y los unitarios mockean Prisma, así que lo que de verdad
 * garantiza la fase 1 no lo prueba nadie ahí: el claim atómico de una acción
 * pendiente (UPDATE condicional pending → executing), el INSERT … ON CONFLICT
 * con tope de la cuota diaria y el UPDATE de un solo statement del historial
 * (con el recorte a los últimos 200). Esto se corre A MANO contra la base de
 * desarrollo antes de cada deploy que toque Orbi. Desde apps/api, en Git Bash
 * (e2e-guard.ts exige E2E_DATABASE_URL/E2E_DIRECT_URL de dev; se leen del .env
 * local, que es dev, dentro de $(...) para que la URL no se imprima nunca):
 *
 *   leer() { node -e 'require("dotenv").config({quiet:true});process.stdout.write(process.env[process.argv[1]]||"")' "$1"; }
 *   E2E_DATABASE_URL="$(leer DATABASE_URL)" E2E_DIRECT_URL="$(leer DIRECT_URL)" pnpm test:e2e -- orbi-fase1
 *
 * Detalle en DEPLOYMENT.md, "Correr los e2e contra dev". Tarda ~1 minuto.
 *
 * Se prueban los servicios reales contra la base, sin levantar la app entera
 * ni pasar por HTTP: lo que interesa es qué hace Postgres con los statements,
 * y el controller ya tiene sus unitarios.
 *
 * Crea dos negocios de prueba (subdominio con PREFIJO_SUBDOMINIO) y filas de
 * cuota con PREFIJO_CUOTA, y borra todo en el afterAll. Al arrancar barre lo
 * que haya dejado una corrida anterior que se cortó a la mitad. Las acciones y
 * las conversaciones no necesitan miembros de verdad: `member_id` y `user_id`
 * no tienen FK, solo `business_id` (que cae con `limpiarNegocios`).
 */
import * as path from 'path';
import { randomUUID } from 'crypto';
import { config as cargarEnv } from 'dotenv';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PendingActionService, type Consumo } from '../src/orbi/tools/pending-action.service';
import type { ToolResult } from '../src/orbi/tools/tool.interface';
import { CuotaService } from '../src/common/cuota/cuota.service';
import { ConversationService, type ConversationMessage } from '../src/orbi/conversation/conversation.service';
import { RetencionLogsService } from '../src/internal-cron/retencion-logs.service';
import { fechaArgentina } from '../src/common/utils/hora-argentina';
import { limpiarNegocios } from './helpers/limpiar-negocio';

// Carga el resto del .env local (dev) para los servicios. No pisa lo que ya
// venga seteado: DATABASE_URL/DIRECT_URL las dejó e2e-guard.ts desde
// E2E_DATABASE_URL/E2E_DIRECT_URL, ya verificadas contra la ref de dev.
cargarEnv({ path: path.resolve(__dirname, '../.env'), quiet: true });

// "Orbita Produccion". Estos tests escriben (negocios, acciones, cuotas): se
// niegan por su cuenta a correr contra producción, además del guard general
// (lista blanca de dev en e2e-base.ts). Si alguien afloja uno, queda el otro.
const REF_PRODUCCION = 'dgergykdihtvsglfumsb';

const PREFIJO_SUBDOMINIO = 'e2e-orbi-fase1-';
const PREFIJO_CUOTA = 'e2e-orbi-fase1:';
const DIA_MS = 24 * 60 * 60 * 1000;

const sufijo = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const mensaje = (content: string): ConversationMessage => ({ role: 'user', content, timestamp: new Date().toISOString() });

describe('Orbi fase 1 contra Postgres (e2e)', () => {
  let modulo: TestingModule;
  let prisma: PrismaService;
  let pendientes: PendingActionService;
  let cuota: CuotaService;
  let conversaciones: ConversationService;

  let negocioA: string;
  let negocioB: string;
  // Sin FK: alcanzan ids inventados, como los que vendrían en el JWT.
  const duenio = randomUUID();
  const otraPersona = randomUUID();

  /** Borra negocios de prueba y cuotas con los prefijos de este archivo. */
  async function limpiarResiduos(): Promise<void> {
    const viejos = await prisma.business.findMany({
      where: { subdomain: { startsWith: PREFIJO_SUBDOMINIO } },
      select: { id: true },
    });
    await limpiarNegocios(prisma, viejos.map((n) => n.id));
    await prisma.dailyQuota.deleteMany({ where: { key: { startsWith: PREFIJO_CUOTA } } });
  }

  async function crearNegocio(letra: string): Promise<string> {
    const negocio = await prisma.business.create({
      data: {
        name: `E2E Orbi fase 1 ${letra}`,
        industry: 'Pruebas',
        subdomain: `${PREFIJO_SUBDOMINIO}${letra.toLowerCase()}-${sufijo()}`,
        // Que no quede nunca una tienda publicada, ni durante la corrida.
        isActive: false,
      },
      select: { id: true },
    });
    return negocio.id;
  }

  function crearAccion(businessId = negocioA, memberId = duenio): Promise<string> {
    return pendientes.crear({
      tool: 'createCoupon',
      args: { code: 'E2EORBI10', discountType: 'percentage', discountValue: 10 },
      businessId,
      memberId,
      conversationId: null,
      resumen: 'Crear el cupón E2EORBI10 de 10%',
    });
  }

  const fila = (id: string) => prisma.orbiPendingAction.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    const url = process.env.DATABASE_URL ?? '';
    if (!url || url.includes(REF_PRODUCCION)) {
      throw new Error('orbi-fase1.e2e-spec corre solo contra la base de desarrollo, nunca contra producción.');
    }

    modulo = await Test.createTestingModule({
      providers: [PrismaService, PendingActionService, CuotaService, ConversationService],
    }).compile();
    await modulo.init();

    prisma = modulo.get(PrismaService);
    pendientes = modulo.get(PendingActionService);
    cuota = modulo.get(CuotaService);
    conversaciones = modulo.get(ConversationService);

    // OJO: la base de dev es compartida; si otra persona corre este archivo a la vez, este barrido le borra sus negocios y su corrida falla.
    await limpiarResiduos();
    negocioA = await crearNegocio('A');
    negocioB = await crearNegocio('B');
  }, 120_000);

  afterAll(async () => {
    try {
      if (prisma) await limpiarResiduos();
    } finally {
      await modulo?.close();
    }
  }, 120_000);

  // ── (a) Confirmar la misma acción dos veces a la vez ─────────────────────

  describe('acciones pendientes: el claim es atómico', () => {
    it('dos confirmar simultáneos: la herramienta corre una sola vez y el otro ve que ya se aplica', async () => {
      const id = await crearAccion();
      const resultado: ToolResult = { success: true, label: 'Cupón creado' };
      const herramienta = jest.fn(async () => resultado);

      // Lo mismo que hace el controller: si gana el claim ejecuta y resuelve.
      const confirmar = async (): Promise<Consumo> => {
        const consumo = await pendientes.consumir(id, negocioA, duenio);
        if (consumo.tipo === 'ejecutar') {
          await pendientes.resolver(id, negocioA, 'executed', await herramienta());
        }
        return consumo;
      };

      const tipos = (await Promise.all([confirmar(), confirmar()])).map((c) => c.tipo);

      expect(herramienta).toHaveBeenCalledTimes(1);
      expect(tipos.filter((t) => t === 'ejecutar')).toHaveLength(1);
      expect(['aplicando', 'resuelta']).toContain(tipos.find((t) => t !== 'ejecutar'));
      expect((await fila(id)).status).toBe('executed');
    });

    it('diez confirmar simultáneos: exactamente uno toma la fila', async () => {
      const id = await crearAccion();

      const consumos = await Promise.all(Array.from({ length: 10 }, () => pendientes.consumir(id, negocioA, duenio)));

      expect(consumos.filter((c) => c.tipo === 'ejecutar')).toHaveLength(1);
      // Nadie la resolvió todavía: los otros nueve la ven aplicándose.
      expect(consumos.filter((c) => c.tipo === 'aplicando')).toHaveLength(9);
      const guardada = await fila(id);
      expect(guardada.status).toBe('executing');
      expect(guardada.startedAt).not.toBeNull();
    });

    it('ya resuelta: el próximo confirmar devuelve el mismo resultado sin ejecutar de nuevo', async () => {
      const id = await crearAccion();
      const resultado: ToolResult = { success: true, data: { id: 'x' }, label: 'Cupón creado' };

      expect((await pendientes.consumir(id, negocioA, duenio)).tipo).toBe('ejecutar');
      await pendientes.resolver(id, negocioA, 'executed', resultado);

      const [otra, otraMas] = await Promise.all([
        pendientes.consumir(id, negocioA, duenio),
        pendientes.consumir(id, negocioA, duenio),
      ]);
      expect(otra).toEqual({ tipo: 'resuelta', result: resultado });
      expect(otraMas).toEqual({ tipo: 'resuelta', result: resultado });
    });

    it('confirmar y cancelar a la vez: gana uno solo y la fila queda coherente con el ganador', async () => {
      const id = await crearAccion();

      const [consumo, rechazo] = await Promise.all([
        pendientes.consumir(id, negocioA, duenio),
        pendientes.rechazar(id, negocioA, duenio),
      ]);

      const ganoConfirmar = consumo.tipo === 'ejecutar';
      const ganoCancelar = rechazo.tipo === 'ok';
      expect(Number(ganoConfirmar) + Number(ganoCancelar)).toBe(1);
      expect((await fila(id)).status).toBe(ganoConfirmar ? 'executing' : 'rejected');
    });

    it('vencida: no se ejecuta y la fila sigue pending', async () => {
      const id = await crearAccion();
      await prisma.orbiPendingAction.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });

      expect(await pendientes.consumir(id, negocioA, duenio)).toEqual({ tipo: 'no_disponible' });
      const guardada = await fila(id);
      expect(guardada.status).toBe('pending');
      expect(guardada.startedAt).toBeNull();
    });
  });

  // ── (d) La acción de otro ────────────────────────────────────────────────

  describe('acciones pendientes: la de otro no se toca', () => {
    it('cancelar o confirmar desde otra persona u otro negocio no cambia la fila', async () => {
      const id = await crearAccion();
      const antes = await fila(id);

      const intentos = await Promise.all([
        pendientes.rechazar(id, negocioA, otraPersona),
        pendientes.rechazar(id, negocioB, duenio),
        pendientes.consumir(id, negocioA, otraPersona),
        pendientes.consumir(id, negocioB, duenio),
        // Un JWT sin memberId no puede volverse un comodín del negocio.
        pendientes.rechazar(id, negocioA, ''),
        pendientes.consumir(id, negocioA, ''),
      ]);

      for (const intento of intentos) expect(intento).toEqual({ tipo: 'no_disponible' });
      expect(await fila(id)).toEqual(antes);
      expect(antes.status).toBe('pending');

      // Y la dueña la sigue teniendo entera: la puede cancelar ella.
      expect((await pendientes.rechazar(id, negocioA, duenio)).tipo).toBe('ok');
      expect(await pendientes.rechazar(id, negocioA, duenio)).toEqual({ tipo: 'ya_rechazada' });
      expect(await pendientes.consumir(id, negocioA, duenio)).toEqual({ tipo: 'no_disponible' });
      expect((await fila(id)).status).toBe('rejected');
    });
  });

  // ── (b) Cuota diaria ─────────────────────────────────────────────────────

  describe('cuota diaria compartida', () => {
    it('10 consumos simultáneos con límite 3: exactamente 3 entran y el contador queda en 3', async () => {
      const clave = `${PREFIJO_CUOTA}limite-${sufijo()}`;
      // Otro día de la misma clave, ya lleno: no tiene que influir en el de hoy.
      const diaViejo = '2001-01-01';
      await prisma.dailyQuota.create({ data: { key: clave, day: diaViejo, count: 3 } });
      const hoyAntes = fechaArgentina(new Date());

      const resultados = await Promise.all(Array.from({ length: 10 }, () => cuota.consumir(clave, 3)));

      expect(resultados.filter(Boolean)).toHaveLength(3);
      const deHoy = await prisma.dailyQuota.findMany({ where: { key: clave, day: { not: diaViejo } } });
      expect(deHoy).toHaveLength(1);
      expect(deHoy[0].count).toBe(3);
      // El día es el de Argentina (con margen por si la corrida cruzó la medianoche).
      expect([hoyAntes, fechaArgentina(new Date())]).toContain(deHoy[0].day);

      // Pasado el tope sigue rechazando y el contador no se infla.
      expect(await cuota.consumir(clave, 3)).toBe(false);
      expect((await prisma.dailyQuota.findUniqueOrThrow({ where: { key_day: { key: clave, day: deHoy[0].day } } })).count).toBe(3);
      expect((await prisma.dailyQuota.findUniqueOrThrow({ where: { key_day: { key: clave, day: diaViejo } } })).count).toBe(3);
    });

    it('otra clave tiene su propio contador', async () => {
      const llena = `${PREFIJO_CUOTA}llena-${sufijo()}`;
      const otra = `${PREFIJO_CUOTA}otra-${sufijo()}`;
      expect(await cuota.consumir(llena, 1)).toBe(true);
      expect(await cuota.consumir(llena, 1)).toBe(false);

      expect(await cuota.consumir(otra, 1)).toBe(true);
      const filas = await prisma.dailyQuota.findMany({ where: { key: otra } });
      expect(filas.map((f) => f.count)).toEqual([1]);
    });

    it('la retención borra la cuota y las acciones viejas y deja las recientes', async () => {
      const clave = `${PREFIJO_CUOTA}retencion-${sufijo()}`;
      const ahora = Date.now();
      const diaDeHace = (dias: number) => fechaArgentina(new Date(ahora - dias * DIA_MS));
      await prisma.dailyQuota.createMany({
        data: [
          { key: clave, day: diaDeHace(40), count: 5 },
          { key: clave, day: diaDeHace(10), count: 5 },
        ],
      });
      const vieja = await crearAccion(negocioB);
      const nueva = await crearAccion(negocioB);
      await prisma.orbiPendingAction.update({ where: { id: vieja }, data: { createdAt: new Date(ahora - 40 * DIA_MS) } });

      // El servicio real, con su regla y su corte, pero sobre un Prisma que
      // acota cada borrado a lo que creó este test: la base de desarrollo es
      // compartida y la purga de verdad no se corre desde acá. Las otras
      // tablas no importan en este test.
      const nada = { deleteMany: async () => ({ count: 0 }) };
      const acotado = {
        platformAdminLog: nada,
        auditLog: nada,
        emailLog: nada,
        orbiTurn: nada,
        dailyQuota: {
          deleteMany: ({ where }: { where: Prisma.DailyQuotaWhereInput }) =>
            prisma.dailyQuota.deleteMany({ where: { AND: [where, { key: clave }] } }),
        },
        orbiPendingAction: {
          deleteMany: ({ where }: { where: Prisma.OrbiPendingActionWhereInput }) =>
            prisma.orbiPendingAction.deleteMany({ where: { AND: [where, { businessId: negocioB }] } }),
        },
      };

      const variables = ['DAILY_QUOTA_RETENTION_DAYS', 'ORBI_PENDING_ACTIONS_RETENTION_DAYS'] as const;
      const previas = variables.map((v) => process.env[v]);
      variables.forEach((v) => delete process.env[v]); // los defaults: 30 días
      try {
        const resultado = await new RetencionLogsService(acotado as unknown as PrismaService).purgar();
        expect(resultado.daily_quota).toBe(1);
        expect(resultado.orbi_pending_actions).toBe(1);
      } finally {
        variables.forEach((v, i) => {
          if (previas[i] !== undefined) process.env[v] = previas[i];
        });
      }

      const quedan = await prisma.dailyQuota.findMany({ where: { key: clave } });
      expect(quedan.map((f) => f.day)).toEqual([diaDeHace(10)]);
      expect(await prisma.orbiPendingAction.findUnique({ where: { id: vieja } })).toBeNull();
      expect(await prisma.orbiPendingAction.findUnique({ where: { id: nueva } })).not.toBeNull();
    });
  });

  // ── (c) Historial de la conversación ─────────────────────────────────────

  describe('historial: append atómico con tope de 200', () => {
    async function precargar(conversationId: string, contenidos: string[]): Promise<void> {
      await prisma.orbiConversation.update({
        where: { id: conversationId },
        data: { messages: contenidos.map(mensaje) as unknown as Prisma.InputJsonValue },
      });
    }

    async function contenidos(conversationId: string): Promise<string[]> {
      const mensajes = await conversaciones.historialSiEsPropia(conversationId, negocioA, duenio);
      return (mensajes ?? []).map((m) => m.content);
    }

    it('20 appends simultáneos: no se pierde ninguno', async () => {
      const conv = await conversaciones.crear(negocioA, duenio, 'panel');
      const esperados = Array.from({ length: 20 }, (_, i) => `c-${i}`);

      await Promise.all(esperados.map((c) => conversaciones.appendMessage(conv.id, negocioA, duenio, mensaje(c))));

      const guardados = await contenidos(conv.id);
      expect(guardados).toHaveLength(20);
      expect([...guardados].sort()).toEqual([...esperados].sort());
    });

    it('pasado el tope se quedan los últimos 200, en orden', async () => {
      const conv = await conversaciones.crear(negocioA, duenio, 'panel');
      await precargar(conv.id, Array.from({ length: 195 }, (_, i) => `m-${i}`));

      // De a uno, para que el orden esperado sea exacto.
      for (let i = 195; i < 210; i++) {
        await conversaciones.appendMessage(conv.id, negocioA, duenio, mensaje(`m-${i}`));
      }

      expect(await contenidos(conv.id)).toEqual(Array.from({ length: 200 }, (_, i) => `m-${i + 10}`));
    }, 60_000);

    it('20 simultáneos cerca del tope: entran todos y se caen los más viejos', async () => {
      const conv = await conversaciones.crear(negocioA, duenio, 'panel');
      await precargar(conv.id, Array.from({ length: 190 }, (_, i) => `p-${i}`));
      const nuevos = Array.from({ length: 20 }, (_, i) => `n-${i}`);

      await Promise.all(nuevos.map((c) => conversaciones.appendMessage(conv.id, negocioA, duenio, mensaje(c))));

      const guardados = await contenidos(conv.id);
      expect(guardados).toHaveLength(200);
      // 190 + 20 = 210: se caen los 10 más viejos. Primero los 180 precargados
      // que quedan, en su orden; después los 20 nuevos (en el orden en que la
      // base serializó los UPDATE, que no es el de arriba).
      expect(guardados.slice(0, 180)).toEqual(Array.from({ length: 180 }, (_, i) => `p-${i + 10}`));
      expect([...guardados.slice(180)].sort()).toEqual([...nuevos].sort());
    });

    it('otra persona, otro negocio o un id inexistente: el mismo not found y la fila no cambia', async () => {
      const conv = await conversaciones.crear(negocioA, duenio, 'panel');
      await conversaciones.appendMessage(conv.id, negocioA, duenio, mensaje('propio'));
      const antes = await prisma.orbiConversation.findUniqueOrThrow({ where: { id: conv.id } });

      const intentos = [
        conversaciones.appendMessage(conv.id, negocioA, otraPersona, mensaje('intruso')),
        conversaciones.appendMessage(conv.id, negocioB, duenio, mensaje('intruso')),
        conversaciones.appendMessage(randomUUID(), negocioA, duenio, mensaje('intruso')),
      ];
      const errores = await Promise.all(intentos.map((p) => p.then(() => null, (e: unknown) => e)));

      // Ajena e inexistente responden idéntico: si no, el endpoint serviría
      // para averiguar qué ids existen.
      for (const error of errores) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as NotFoundException).message).toBe('Conversación no encontrada');
      }
      const despues = await prisma.orbiConversation.findUniqueOrThrow({ where: { id: conv.id } });
      expect(despues.messages).toEqual(antes.messages);
      expect(despues.updatedAt).toEqual(antes.updatedAt);

      expect(await conversaciones.historialSiEsPropia(conv.id, negocioA, otraPersona)).toBeNull();
      expect(await conversaciones.historialSiEsPropia(conv.id, negocioB, duenio)).toBeNull();
    });
  });
});
