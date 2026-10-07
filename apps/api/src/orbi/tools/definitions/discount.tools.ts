import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { DiscountsService } from '../../../discounts/discounts.service';
import type { CouponsService } from '../../../coupons/coupons.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import { UpsertDiscountDto } from '../../../discounts/dto/upsert-discount.dto';
import { UpsertCouponDto } from '../../../coupons/dto/upsert-coupon.dto';
import { AccionInvalida, validarConDto, validarConServicio, type ArgsInvalidos, type Invalido, type ResultadoDeValidacion } from '../acciones/validar-args';
import { dato, entreComillas, monto, presente } from '../acciones/formato';
import { DIAS_DE_LA_SEMANA, FICHAS, descripcionDe, fallaDeDatos, faltantes, invalidoDelDto, parametrosDe, tieneValor, type FichaDeAccion } from '../acciones/requisitos';
import {
  CATEGORIA,
  PRODUCTO,
  cargarCategorias,
  cargarProductos,
  normalizarNombre,
  resolverLista,
  type Candidato,
} from '../acciones/resolver-nombres';

export class ListDiscountsTool implements OrbiTool {
  name = 'listDiscounts';
  description = 'Listar los descuentos automáticos del negocio (sin código). Úsalo para mostrar qué descuentos existen o dar contexto antes de crear uno nuevo.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['discounts.view'];
  parameters = {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Texto para buscar por nombre (opcional)' },
    },
  };

  constructor(private readonly discountsService: DiscountsService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const result = await this.discountsService.findAll(ctx.businessId, {
        search: args.search as string | undefined,
        page: 1,
        limit: 10,
      });

      return {
        success: true,
        label: `Encontré ${result.total} descuento${result.total === 1 ? '' : 's'}`,
        data: {
          discounts: result.data.map(d => ({ id: d.id, name: d.name, type: d.type, value: d.value, estado: d.estado })),
          total: result.total,
        },
      };
    } catch (error) {
      return { success: false, error: `Error al listar descuentos: ${error}`, label: 'Error listando descuentos' };
    }
  }
}

/**
 * "20% off en cada producto" o "$500 off sobre el total de la compra", según
 * el tipo. Va en el botón de confirmación: la persona tiene que poder ver de
 * un vistazo si el modelo entendió bien, y "PERCENT_TICKET / 20" no se lee de
 * un vistazo.
 */
function formatearValor(tipo: unknown, valor: unknown): string {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return 'valor inválido';
  const cuanto = String(tipo).startsWith('PERCENT') ? `${n}% off` : `$${n} off`;
  const donde = String(tipo).endsWith('_TICKET') ? 'sobre el total de la compra' : 'en cada producto';
  return `${cuanto} ${donde}`;
}

const ALCANCE: Record<string, string> = {
  PRODUCT: 'productos elegidos',
  CATEGORY: 'categorías elegidas',
  TICKET: 'toda la compra',
};

const TIPOS_DE_TICKET = ['PERCENT_TICKET', 'AMOUNT_TICKET'];
const TIPOS_DE_PRODUCTO = ['PERCENT_PRODUCT', 'AMOUNT_PRODUCT'];
const A_QUE_APLICA = 'a qué aplica';

/**
 * El alcance sale del tipo y de lo que se eligió, como en el panel (tipo ×
 * alcance, ver couponApi.ts del front): un tipo "sobre el total" es TICKET; uno
 * "por producto" es PRODUCT con productos o CATEGORY con categorías. El motor
 * de descuentos NO aplica un tipo por producto con alcance TICKET ni uno de
 * ticket con productos: esa mezcla quedaba guardada y no descontaba nada.
 *
 * `scope`, si el modelo lo manda, tiene que coincidir.
 */
function alcanceDe(args: Record<string, unknown>): { scope?: string; faltan: string[]; invalidos: Invalido[] } {
  const tipo = String(args.type ?? '');
  const hayProductos = tieneValor(args.productos);
  const hayCategorias = tieneValor(args.categorias);
  const faltan: string[] = [];
  const invalidos: Invalido[] = [];
  let scope: string | undefined;

  if (TIPOS_DE_TICKET.includes(tipo)) {
    scope = 'TICKET';
    if (hayProductos || hayCategorias) {
      invalidos.push({
        campo: A_QUE_APLICA,
        motivo: 'un descuento sobre el total de la compra no lleva productos ni categorías: o es sobre el total, o es de un tipo "en productos o categorías elegidos"',
        opciones: TIPOS_DE_PRODUCTO,
      });
    }
  } else if (TIPOS_DE_PRODUCTO.includes(tipo)) {
    if (hayProductos && hayCategorias) {
      invalidos.push({ campo: A_QUE_APLICA, motivo: 'va productos o categorías, no las dos a la vez' });
    } else if (hayProductos) {
      scope = 'PRODUCT';
    } else if (hayCategorias) {
      scope = 'CATEGORY';
    } else if (args.scope === 'TICKET') {
      invalidos.push({ campo: 'tipo', motivo: 'para toda la compra el tipo es "sobre el total de la compra"', opciones: TIPOS_DE_TICKET });
    } else {
      faltan.push('a qué productos o categorías aplica (o si es sobre el total de la compra)');
    }
  }
  if (scope && presente(args.scope) && args.scope !== scope) {
    invalidos.push({ campo: A_QUE_APLICA, motivo: `scope ${dato(args.scope)} no coincide con lo pedido (${ALCANCE[scope]}): mandalo como ${scope} o no lo mandes` });
  }
  return { scope: scope ?? (presente(args.scope) ? String(args.scope) : undefined), faltan, invalidos };
}

/** Los productos y categorías por nombre (o id), acotados al negocio de la sesión. */
async function resolverElegidos(args: Record<string, unknown>, ctx: ToolExecutionContext, prisma: PrismaService, ficha: FichaDeAccion) {
  const invalidos: Invalido[] = [];
  let productos: Candidato[] = [];
  let categorias: Candidato[] = [];
  if (tieneValor(args.productos)) {
    const r = resolverLista(ficha.campos.productos.etiqueta, args.productos, await cargarProductos(prisma, ctx.businessId), PRODUCTO);
    productos = r.entidades;
    invalidos.push(...r.invalidos);
  }
  if (tieneValor(args.categorias)) {
    const r = resolverLista(ficha.campos.categorias.etiqueta, args.categorias, await cargarCategorias(prisma, ctx.businessId), CATEGORIA);
    categorias = r.entidades;
    invalidos.push(...r.invalidos);
  }
  return { productos, categorias, invalidos };
}

/** "martes", "Miércoles" → 2, 3 (0 = domingo, como el DTO). */
function diasDe(args: Record<string, unknown>): { dias?: number[]; invalidos: Invalido[] } {
  if (!tieneValor(args.activeDays)) return { invalidos: [] };
  const valores = DIAS_DE_LA_SEMANA.map((d) => d.valor);
  const dias: number[] = [];
  const invalidos: Invalido[] = [];
  for (const d of (Array.isArray(args.activeDays) ? args.activeDays : []) as unknown[]) {
    const i = valores.indexOf(normalizarNombre(String(d)));
    if (i >= 0) dias.push(i);
    else invalidos.push({ campo: 'días', motivo: `"${dato(d)}" no es un día de la semana`, opciones: valores });
  }
  return { dias: [...new Set(dias)].sort(), invalidos };
}

const nombresEnLista = (lista: Candidato[]) => {
  const muestra = lista.slice(0, 5).map((c) => entreComillas(c.name)).join(', ');
  return lista.length > 5 ? `${muestra} y ${lista.length - 5} más` : muestra;
};

/** El nombre que se le pone si la persona no dio uno: "15% en Perfumería", "$2000 sobre el total". */
function nombrePorDefecto(tipo: unknown, valor: unknown, productos: Candidato[], categorias: Candidato[]): string {
  const cuanto = String(tipo).startsWith('PERCENT') ? `${dato(valor)}%` : `$${dato(valor)}`;
  const elegidos = [...categorias, ...productos];
  const donde = String(tipo).endsWith('_TICKET') || elegidos.length === 0
    ? 'sobre el total'
    : elegidos.length === 1 ? `en ${elegidos[0].name}` : `en ${elegidos.length} ${categorias.length ? 'categorías' : 'productos'}`;
  return `${cuanto} ${donde}`.slice(0, 120);
}

const DIAS_EN_PALABRAS = DIAS_DE_LA_SEMANA.map((d) => d.dice);

/**
 * Lo que va en la tarjeta además del valor: a qué aplica (con los nombres
 * reales de productos y categorías), la vigencia y las condiciones. Cada
 * valor que se escribe se ve (invariante 4 del catálogo).
 */
function alcanceYCondiciones(args: Record<string, unknown>, scope: string | undefined, productos: Candidato[], categorias: Candidato[], dias?: number[]): string {
  const partes = [`para ${ALCANCE[String(scope)] ?? dato(scope)}`];
  if (productos.length) partes.push(`${productos.length === 1 ? 'el producto' : `${productos.length} productos:`} ${nombresEnLista(productos)}`);
  if (categorias.length) partes.push(`${categorias.length === 1 ? 'la categoría' : `${categorias.length} categorías:`} ${nombresEnLista(categorias)}`);
  const desde = presente(args.startDate) ? `desde ${dato(args.startDate)}` : 'desde ahora';
  const hasta = presente(args.endDate) ? `hasta ${dato(args.endDate)}` : 'sin fecha de fin';
  const condiciones: string[] = [];
  if (presente(args.minAmount)) condiciones.push(`con compra mínima de ${monto(args.minAmount)}`);
  if (presente(args.maxUsesTotal)) condiciones.push(`hasta ${dato(args.maxUsesTotal)} usos en total`);
  if (presente(args.maxUsesPerCustomer)) condiciones.push(`hasta ${dato(args.maxUsesPerCustomer)} por cliente`);
  if (dias?.length) condiciones.push(`solo ${dias.map((d) => DIAS_EN_PALABRAS[d]).join(', ')}`);
  if (presente(args.startTime) || presente(args.endTime)) {
    condiciones.push(`de ${presente(args.startTime) ? dato(args.startTime) : '00:00'} a ${presente(args.endTime) ? dato(args.endTime) : '23:59'}`);
  }
  return [`${partes.join(', ')}; ${desde}, ${hasta}`, ...condiciones].join('; ');
}

type PromoArmada<T> = { dto: T; scope: string; productos: Candidato[]; categorias: Candidato[]; dias?: number[] };

/**
 * Lo que se le manda al service, armado en un solo lugar: validarArgs() lo
 * pasa por el DTO del endpoint y execute() lo escribe, así lo validado es
 * exactamente lo escrito. Un null del modelo en un opcional es "no mandar":
 * no se escribe nada que la tarjeta no muestre. Sin conversiones de tipo: si
 * el modelo manda "20" en vez de 20, el DTO lo rechaza, igual que por HTTP.
 *
 * Faltantes, alcance y nombres se juntan antes de devolver: el modelo recibe
 * TODO lo que hay que preguntar de una vez.
 */
async function armarDescuento(
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
  prisma: PrismaService,
  ficha: FichaDeAccion,
): Promise<{ ok: true; promo: PromoArmada<UpsertDiscountDto> } | ArgsInvalidos> {
  const alcance = alcanceDe(args);
  const elegidos = await resolverElegidos(args, ctx, prisma, ficha);
  const { dias, invalidos: diasInvalidos } = diasDe(args);
  const faltan = [...faltantes(ficha, args), ...alcance.faltan];
  const invalidos = [...alcance.invalidos, ...elegidos.invalidos, ...diasInvalidos];
  if (faltan.length || invalidos.length || !alcance.scope) return fallaDeDatos(faltan, invalidos);

  const scope = alcance.scope;
  const opcional = <T>(v: unknown) => (presente(v) ? (v as T) : undefined);
  const dto: UpsertDiscountDto = {
    name: tieneValor(args.name) ? (args.name as string) : nombrePorDefecto(args.type, args.value, elegidos.productos, elegidos.categorias),
    type: args.type as string,
    value: args.value as number,
    scope,
    productIds: elegidos.productos.length ? elegidos.productos.map((p) => p.id) : undefined,
    // Orbi elige productos, nunca variantes. El service exige el nivel con
    // scope PRODUCT: sin esto, todo descuento por producto de Orbi fallaba
    // DESPUÉS de que la persona lo confirmara.
    productLevel: scope === 'PRODUCT' ? 'padre' : undefined,
    categoryIds: elegidos.categorias.length ? elegidos.categorias.map((c) => c.id) : undefined,
    startDate: (args.startDate as string | undefined) ?? new Date().toISOString(),
    endDate: opcional<string>(args.endDate),
    minAmount: opcional<number>(args.minAmount),
    maxUsesTotal: opcional<number>(args.maxUsesTotal),
    maxUsesPerCustomer: opcional<number>(args.maxUsesPerCustomer),
    activeDays: dias,
    startTime: opcional<string>(args.startTime),
    endTime: opcional<string>(args.endTime),
  };
  // Lo que no vino no viaja: el DTO del cupón no declara días ni horario.
  for (const k of Object.keys(dto) as (keyof UpsertDiscountDto)[]) if (dto[k] === undefined) delete dto[k];
  return { ok: true, promo: { dto, scope, productos: elegidos.productos, categorias: elegidos.categorias, dias } };
}

// Las propiedades del DTO que en la tool se llaman distinto.
const PARAMETRO_DEL_DTO = { productIds: 'productos', categoryIds: 'categorias' };

/** Validación completa: datos, alcance y nombres; el DTO del endpoint; y las reglas del service. */
async function validarPromo<T extends object>(
  armado: { ok: true; promo: PromoArmada<T> } | ArgsInvalidos,
  Dto: new () => T,
  ficha: FichaDeAccion,
  servicio: (dto: T) => Promise<unknown>,
): Promise<ResultadoDeValidacion> {
  if (!armado.ok) return armado;
  const forma = await validarConDto(Dto, { ...armado.promo.dto } as Record<string, unknown>);
  if (!forma.ok) return invalidoDelDto(ficha, forma, PARAMETRO_DEL_DTO);
  return validarConServicio(() => servicio(armado.promo.dto));
}

/** Para la tarjeta: los nombres reales (si alguno no existe, no hay tarjeta) y el alcance que se va a escribir. */
async function vistaDePromo(args: Record<string, unknown>, ctx: ToolExecutionContext, prisma: PrismaService, ficha: FichaDeAccion) {
  const elegidos = await resolverElegidos(args, ctx, prisma, ficha);
  const { dias, invalidos } = diasDe(args);
  if (elegidos.invalidos.length || invalidos.length) {
    const falla = fallaDeDatos([], [...elegidos.invalidos, ...invalidos]);
    throw new AccionInvalida(falla.error, falla);
  }
  return { productos: elegidos.productos, categorias: elegidos.categorias, dias, scope: alcanceDe(args).scope };
}

const FICHA_DESCUENTO = FICHAS.createDiscount;

export class CreateDiscountTool implements OrbiTool {
  name = 'createDiscount';
  description = descripcionDe(FICHA_DESCUENTO);
  parameters = parametrosDe(FICHA_DESCUENTO);
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['discounts.manage'];
  requiresConfirmation = true;

  constructor(
    private readonly discountsService: DiscountsService,
    private readonly prisma: PrismaService,
  ) {}

  async describirAccion(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<string> {
    const v = await vistaDePromo(args, ctx, this.prisma, FICHA_DESCUENTO);
    const nombre = tieneValor(args.name) ? args.name : nombrePorDefecto(args.type, args.value, v.productos, v.categorias);
    return `Crear el descuento ${entreComillas(nombre)} de ${formatearValor(args.type, args.value)}, ${alcanceYCondiciones(args, v.scope, v.productos, v.categorias, v.dias)}`;
  }

  async validarArgs(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ResultadoDeValidacion> {
    const armado = await armarDescuento(args, ctx, this.prisma, FICHA_DESCUENTO);
    return validarPromo(armado, UpsertDiscountDto, FICHA_DESCUENTO, (dto) => this.discountsService.validarAlta(ctx.businessId, dto));
  }

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const armado = await armarDescuento(args, ctx, this.prisma, FICHA_DESCUENTO);
      if (!armado.ok) return { success: false, error: `No pude crear el descuento: ${armado.error}`, label: 'Error creando descuento' };
      const discount = await this.discountsService.create(ctx.businessId, ctx.userId, armado.promo.dto);

      return {
        success: true,
        label: `Descuento "${discount.name}" creado`,
        data: { discountId: discount.id, name: discount.name },
      };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude crear el descuento: ${msg}`, label: 'Error creando descuento' };
    }
  }
}

const FICHA_CUPON = FICHAS.createCoupon;

// Mismo criterio que armarDescuento, con el código. Sin nombre, va el código.
async function armarCupon(
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
  prisma: PrismaService,
): Promise<{ ok: true; promo: PromoArmada<UpsertCouponDto> } | ArgsInvalidos> {
  const armado = await armarDescuento(args, ctx, prisma, FICHA_CUPON);
  if (!armado.ok) return armado;
  const { dto, ...resto } = armado.promo;
  const cupon: UpsertCouponDto = { ...dto, code: args.code as string, name: tieneValor(args.name) ? (args.name as string) : String(args.code) };
  return { ok: true, promo: { dto: cupon, ...resto } };
}

export class CreateCouponTool implements OrbiTool {
  name = 'createCoupon';
  description = descripcionDe(FICHA_CUPON);
  parameters = parametrosDe(FICHA_CUPON);
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['discounts.manage'];
  requiresConfirmation = true;

  constructor(
    private readonly couponsService: CouponsService,
    private readonly prisma: PrismaService,
  ) {}

  async describirAccion(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<string> {
    const v = await vistaDePromo(args, ctx, this.prisma, FICHA_CUPON);
    const nombre = tieneValor(args.name) && args.name !== args.code ? ` (${entreComillas(args.name)})` : '';
    return `Crear el cupón ${entreComillas(args.code ?? '(sin código)')}${nombre} de ${formatearValor(args.type, args.value)}, ${alcanceYCondiciones(args, v.scope, v.productos, v.categorias)}`;
  }

  async validarArgs(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ResultadoDeValidacion> {
    const armado = await armarCupon(args, ctx, this.prisma);
    return validarPromo(armado, UpsertCouponDto, FICHA_CUPON, (dto) => this.couponsService.validarAlta(ctx.businessId, dto));
  }

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const armado = await armarCupon(args, ctx, this.prisma);
      if (!armado.ok) return { success: false, error: `No pude crear el cupón: ${armado.error}`, label: 'Error creando cupón' };
      const coupon = await this.couponsService.create(ctx.businessId, ctx.userId, armado.promo.dto);

      return {
        success: true,
        label: `Cupón "${args.code}" creado`,
        data: { couponId: coupon.id, code: coupon.code, name: coupon.name },
      };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude crear el cupón: ${msg}`, label: 'Error creando cupón' };
    }
  }
}
