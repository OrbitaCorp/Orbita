import 'reflect-metadata';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PERMISSION_KEY } from '../../src/common/decorators/require-permission.decorator';
import { REQUIRES_ADDON_KEY } from '../../src/common/decorators/requires-addon.decorator';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../../src/common/decorators/optional-auth.decorator';
import { HubAvanzadoController } from '../../src/appointments/avanzado/hub/hub.controller';
import { PaquetesController } from '../../src/appointments/avanzado/paquetes/paquetes.controller';
import { MembresiasController } from '../../src/appointments/avanzado/membresias/membresias.controller';
import { GiftCardsController } from '../../src/appointments/avanzado/gift-cards/gift-cards.controller';
import { PreciosHorarioController } from '../../src/appointments/avanzado/precios-horario/precios-horario.controller';
import { FidelidadController } from '../../src/appointments/avanzado/fidelidad/fidelidad.controller';
import { TurnoFijoController } from '../../src/appointments/avanzado/turno-fijo/turno-fijo.controller';
import { RecuperarController } from '../../src/appointments/avanzado/recuperar/recuperar.controller';
import { ListaEsperaController } from '../../src/appointments/avanzado/lista-espera/lista-espera.controller';
import { StorefrontAvanzadoController } from '../../src/appointments/avanzado/publico/storefront-avanzado.controller';
import { UpsertPackageDto } from '../../src/appointments/avanzado/paquetes/dto/paquetes.dto';
import { UpsertPriceRuleDto } from '../../src/appointments/avanzado/precios-horario/dto/upsert-price-rule.dto';
import { BuyGiftCardDto, EmitGiftCardDto } from '../../src/appointments/avanzado/gift-cards/dto/gift-cards.dto';
import { JoinWaitlistDto } from '../../src/appointments/avanzado/lista-espera/dto/lista-espera.dto';
import { UpsertWinbackDto } from '../../src/appointments/avanzado/recuperar/dto/recuperar.dto';
import { CreateRecurringDto } from '../../src/appointments/avanzado/turno-fijo/dto/turno-fijo.dto';
import { PauseMembershipDto, UpsertMembershipPlanDto } from '../../src/appointments/avanzado/membresias/dto/membresias.dto';
import { SellPackageDto } from '../../src/appointments/avanzado/paquetes/dto/paquetes.dto';

// Avanzado de Turnos (P4): barridos que fallan solos cuando alguien suma un
// endpoint o una consulta sin el cuidado de las demás.

type Ctrl = new (...args: never[]) => object;
const PANEL_AVANZADO: Ctrl[] = [HubAvanzadoController, PaquetesController, MembresiasController, GiftCardsController, PreciosHorarioController, FidelidadController, TurnoFijoController, RecuperarController];

function handlers(c: Ctrl) {
  const proto = c.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((m) => m !== 'constructor' && typeof proto[m] === 'function' && Reflect.getMetadata(METHOD_METADATA, proto[m] as object) !== undefined)
    .map((m) => {
      const h = proto[m] as object;
      return {
        nombre: `${c.name}.${m}`,
        metodo: Reflect.getMetadata(METHOD_METADATA, h) as RequestMethod,
        ruta: `${Reflect.getMetadata(PATH_METADATA, c)}/${Reflect.getMetadata(PATH_METADATA, h)}`,
        addon: Reflect.getMetadata(REQUIRES_ADDON_KEY, h) as string | undefined,
        permiso: Reflect.getMetadata(PERMISSION_KEY, h) as string | undefined,
        publico: Reflect.getMetadata(IS_PUBLIC_KEY, h) === true,
        opcional: Reflect.getMetadata(IS_OPTIONAL_AUTH_KEY, h) === true,
        throttle: Reflect.getMetadataKeys(h).some((k) => String(k).startsWith('THROTTLER:LIMIT')),
      };
    });
}

describe('Gates de los endpoints del panel de Avanzado', () => {
  const todos = PANEL_AVANZADO.flatMap(handlers);

  it('el barrido encuentra los endpoints (si no, no está mirando nada)', () => {
    expect(todos.length).toBeGreaterThan(30);
  });

  it('toda ESCRITURA lleva @RequiresAddon(ADVANCED) y un permiso de Turnos', () => {
    const escrituras = todos.filter((h) => h.metodo !== RequestMethod.GET);
    const mal = escrituras.filter((h) => h.addon !== 'ADVANCED' || !h.permiso?.startsWith('appointments.')).map((h) => h.nombre);
    expect(mal).toEqual([]);
    // El permiso es settings.manage (CONTRATO § 0 "Avanzado"), salvo registrar la cuota a mano, que el contrato pone en cash.charge.
    const otros = escrituras.filter((h) => h.permiso !== 'appointments.settings.manage').map((h) => `${h.nombre}:${h.permiso}`);
    expect(otros).toEqual(['MembresiasController.registrarCuota:appointments.cash.charge']);
  });

  it('toda LECTURA lleva el add-on, salvo el GET del hub (se muestra con el candado)', () => {
    const lecturas = todos.filter((h) => h.metodo === RequestMethod.GET);
    expect(lecturas.filter((h) => h.addon !== 'ADVANCED').map((h) => h.nombre)).toEqual(['HubAvanzadoController.obtener']);
    expect(lecturas.filter((h) => h.permiso).map((h) => h.nombre)).toEqual([]);
  });

  it('la lista de espera no es una función de Avanzado: sin add-on, con permisos de agenda', () => {
    const espera = handlers(ListaEsperaController);
    expect(espera.map((h) => [h.nombre, h.addon, h.permiso])).toEqual([
      ['ListaEsperaController.listar', undefined, 'appointments.agenda.view'],
      ['ListaEsperaController.ofrecer', undefined, 'appointments.agenda.manage'],
      ['ListaEsperaController.sacar', undefined, 'appointments.agenda.manage'],
    ]);
  });

  it('los públicos: @Public en lecturas y @OptionalAuth en compras/anotarse, siempre con throttle propio y sin add-on por guard', () => {
    const pub = handlers(StorefrontAvanzadoController);
    expect(pub.length).toBe(7);
    for (const h of pub) {
      expect([h.nombre, h.publico || h.opcional, h.throttle, h.addon]).toEqual([h.nombre, true, true, undefined]);
      expect(h.ruta.startsWith('storefront/:slug/appointments/')).toBe(true);
    }
    expect(pub.filter((h) => h.opcional).map((h) => h.nombre).sort()).toEqual([
      'StorefrontAvanzadoController.anotarseEnEspera', 'StorefrontAvanzadoController.comprarGiftCard', 'StorefrontAvanzadoController.comprarPaquete',
    ]);
  });
});

// ── Aislamiento entre negocios, más estricto que el global ──────────────────
// Toda consulta de src/appointments/avanzado a un modelo lleva businessId (sin
// la "segunda oportunidad" del barrido global), y nada se actualiza ni se
// borra por id solo: updateMany/deleteMany con businessId + chequeo de count.

const AVANZADO = join(__dirname, '..', '..', 'src', 'appointments', 'avanzado');
const archivos = (dir: string): string[] => readdirSync(dir).flatMap((e) => {
  const p = join(dir, e);
  return statSync(p).isDirectory() ? archivos(p) : p.endsWith('.ts') ? [p] : [];
});

function llamadas(src: string, re: RegExp): { op: string; modelo: string; arg: string; linea: number }[] {
  const salida: { op: string; modelo: string; arg: string; linea: number }[] = [];
  for (const m of src.matchAll(re)) {
    let i = (m.index ?? 0) + m[0].length;
    let prof = 1;
    let arg = '';
    while (i < src.length && prof > 0) {
      const c = src[i];
      if (c === '(') prof++;
      else if (c === ')') prof--;
      if (prof > 0) arg += c;
      i++;
    }
    salida.push({ modelo: m[1], op: m[2], arg, linea: src.slice(0, m.index).split('\n').length });
  }
  return salida;
}

describe('Aislamiento de las consultas de Avanzado', () => {
  const fuentes = archivos(AVANZADO).map((f) => ({ f: f.split(sep).slice(-2).join('/'), src: readFileSync(f, 'utf8') }));
  const RE = /\b(?:prisma|tx|t)\.(\w+)\.(findMany|findFirst|findUnique|count|aggregate|groupBy|updateMany|deleteMany|update|delete|create|createMany|upsert)\(/g;
  const todas = fuentes.flatMap(({ f, src }) => llamadas(src, RE).map((c) => ({ ...c, f })));

  it('el barrido encuentra las consultas', () => {
    expect(todas.length).toBeGreaterThan(80);
  });

  // Un `where` armado unas líneas antes: vale si ese objeto arranca con businessId.
  const whereArmado = (c: { f: string; linea: number; arg: string }) => {
    if (!/\bwhere\b(?!:)/.test(c.arg)) return false;
    const lineas = fuentes.find((x) => x.f === c.f)!.src.split('\n').slice(Math.max(0, c.linea - 25), c.linea).join('\n');
    return /const where[^=]*=\s*\{\s*businessId/.test(lineas);
  };

  it('todas llevan businessId (o, en business, el id del negocio)', () => {
    const sin = todas
      .filter((c) => !(c.modelo === 'business' && /id: businessId/.test(c.arg)))
      .filter((c) => !/businessId/.test(c.arg) && !whereArmado(c))
      // crearConCodigo recibe `data` tipado como UncheckedCreateInput: businessId es obligatorio por tipo.
      .filter((c) => !(c.f === 'gift-cards/gift-cards.service.ts' && c.op === 'create' && /\.\.\.data, code/.test(c.arg)))
      // Las únicas excepciones: la corrida automática de "Recuperar clientes", que
      // recorre las campañas de todos los negocios y corre cada una con su businessId.
      .filter((c) => !(c.f === 'recuperar/recuperar.service.ts' && c.modelo === 'appointmentWinbackCampaign' && c.op === 'findMany' && /mode: 'auto'/.test(c.arg)))
      .map((c) => `${c.f}:${c.linea} ${c.modelo}.${c.op}`);
    expect(sin).toEqual([]);
  });

  it('no hay update/delete por id solo ni upsert: siempre updateMany/deleteMany con businessId', () => {
    const mal = todas.filter((c) => ['update', 'delete', 'upsert'].includes(c.op)).map((c) => `${c.f}:${c.linea} ${c.modelo}.${c.op}`);
    expect(mal).toEqual([]);
  });
});

describe('DTOs de Avanzado', () => {
  const errores = async (cls: new () => object, body: object) => (await validate(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property);
  const SRV = '11111111-1111-4111-8111-111111111111';

  it('paquete: 2–100 sesiones, precio > 0 con hasta 2 decimales, validez 0–730', async () => {
    const ok = { serviceId: SRV, sessions: 10, price: 80_000.5, validDays: 90 };
    expect(await errores(UpsertPackageDto, ok)).toEqual([]);
    expect(await errores(UpsertPackageDto, { ...ok, sessions: 1 })).toEqual(['sessions']);
    expect(await errores(UpsertPackageDto, { ...ok, sessions: 101 })).toEqual(['sessions']);
    expect(await errores(UpsertPackageDto, { ...ok, price: 0 })).toEqual(['price']);
    expect(await errores(UpsertPackageDto, { ...ok, price: 1.234 })).toEqual(['price']);
    expect(await errores(UpsertPackageDto, { ...ok, validDays: 731 })).toEqual(['validDays']);
    expect(await errores(UpsertPackageDto, { ...ok, serviceId: 'no-uuid' })).toEqual(['serviceId']);
  });

  it('vender un pack: medio de pago del local (no Mercado Pago) y cliente válido', async () => {
    expect(await errores(SellPackageDto, { packageId: SRV, customerId: SRV, method: 'CASH' })).toEqual([]);
    expect(await errores(SellPackageDto, { packageId: SRV, customerId: SRV, method: 'MERCADOPAGO' })).toEqual(['method']);
    expect(await errores(SellPackageDto, { packageId: SRV, customer: { name: 'A' }, method: 'CASH' })).toEqual(['customer']);
  });

  it('franja de precio: días 0–6 sin repetir (mínimo uno), minutos 0–1440, ajuste −90..100 y distinto de 0', async () => {
    const ok = { weekdays: [0, 1], fromMin: 540, toMin: 720, adjustPercent: -15 };
    expect(await errores(UpsertPriceRuleDto, ok)).toEqual([]);
    expect(await errores(UpsertPriceRuleDto, { ...ok, weekdays: [] })).toEqual(['weekdays']);
    expect(await errores(UpsertPriceRuleDto, { ...ok, weekdays: [0, 0] })).toEqual(['weekdays']);
    expect(await errores(UpsertPriceRuleDto, { ...ok, weekdays: [7] })).toEqual(['weekdays']);
    expect(await errores(UpsertPriceRuleDto, { ...ok, adjustPercent: 0 })).toEqual(['adjustPercent']);
    expect(await errores(UpsertPriceRuleDto, { ...ok, adjustPercent: -91 })).toEqual(['adjustPercent']);
    expect(await errores(UpsertPriceRuleDto, { ...ok, toMin: 1441 })).toEqual(['toMin']);
  });

  it('gift card: AMOUNT exige monto, SERVICE exige servicio; estilo de la lista; la compra pública exige email', async () => {
    expect(await errores(EmitGiftCardDto, { kind: 'AMOUNT', amount: 10_000, style: 'noche', method: 'CASH' })).toEqual([]);
    expect(await errores(EmitGiftCardDto, { kind: 'AMOUNT', style: 'noche', method: 'CASH' })).toEqual(['amount']);
    expect(await errores(EmitGiftCardDto, { kind: 'SERVICE', style: 'noche', method: 'CASH' })).toEqual(['serviceId']);
    expect(await errores(EmitGiftCardDto, { kind: 'AMOUNT', amount: 1, style: 'neon', method: 'CASH' })).toEqual(['style']);
    expect(await errores(EmitGiftCardDto, { kind: 'AMOUNT', amount: 1, style: 'noche', method: 'CASH', message: 'x'.repeat(301) })).toEqual(['message']);
    const compra = { kind: 'AMOUNT', amount: 10_000, style: 'papel', buyerName: 'Juli', buyerPhone: '1155550101', buyerEmail: 'j@mail.com' };
    expect(await errores(BuyGiftCardDto, compra)).toEqual([]);
    expect(await errores(BuyGiftCardDto, { ...compra, buyerEmail: undefined })).toEqual(['buyerEmail']);
  });

  it('lista de espera pública: "cualquiera" vale como agenda; franja en minutos', async () => {
    const ok = { serviceId: SRV, date: '2026-10-05', name: 'Sofía R', phone: '1155550101' };
    expect(await errores(JoinWaitlistDto, { ...ok, resourceId: 'cualquiera' })).toEqual([]);
    expect(await errores(JoinWaitlistDto, { ...ok, resourceId: 'otra-cosa' })).toEqual(['resourceId']);
    expect(await errores(JoinWaitlistDto, { ...ok, date: '05/10/2026' })).toEqual(['date']);
    expect(await errores(JoinWaitlistDto, { ...ok, fromMin: -1, toMin: 2000 })).toEqual(['fromMin', 'toMin']);
  });

  it('recuperar clientes: días de la lista, mensaje ≤ 600, cupón 5–50 % y 7–60 días', async () => {
    const ok = { inactiveDays: 60, message: 'Hola {nombre}', couponEnabled: true, couponPercent: 15, couponValidDays: 15, mode: 'auto', isActive: true };
    expect(await errores(UpsertWinbackDto, ok)).toEqual([]);
    expect(await errores(UpsertWinbackDto, { ...ok, inactiveDays: 50 })).toEqual(['inactiveDays']);
    expect(await errores(UpsertWinbackDto, { ...ok, message: 'x'.repeat(601) })).toEqual(['message']);
    expect(await errores(UpsertWinbackDto, { ...ok, couponPercent: 60 })).toEqual(['couponPercent']);
    expect(await errores(UpsertWinbackDto, { ...ok, couponValidDays: 5 })).toEqual(['couponValidDays']);
    expect(await errores(UpsertWinbackDto, { ...ok, mode: 'ahora' })).toEqual(['mode']);
  });

  it('turno fijo, plan y pausa', async () => {
    const tf = { customerId: SRV, resourceId: SRV, serviceId: SRV, frequency: 'WEEKLY', startDate: '2026-10-05', startMin: 600, occurrences: 8 };
    expect(await errores(CreateRecurringDto, tf)).toEqual([]);
    expect(await errores(CreateRecurringDto, { ...tf, occurrences: 53 })).toEqual(['occurrences']);
    expect(await errores(CreateRecurringDto, { ...tf, frequency: 'DAILY' })).toEqual(['frequency']);
    expect(await errores(CreateRecurringDto, { ...tf, startMin: 1440 })).toEqual(['startMin']);
    expect(await errores(UpsertMembershipPlanDto, { name: 'Libre', perWeek: 0, price: 50_000 })).toEqual([]);
    expect(await errores(UpsertMembershipPlanDto, { name: 'L', perWeek: 15, price: 0 })).toEqual(['name', 'perWeek', 'price']);
    expect(await errores(PauseMembershipDto, { until: '2026-10-15' })).toEqual([]);
    expect(await errores(PauseMembershipDto, { until: 'mañana' })).toEqual(['until']);
  });
});
