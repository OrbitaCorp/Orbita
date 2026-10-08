/**
 * El presupuesto de las evals del panel: cuánto cuesta cada caso, cuánto se
 * lleva gastado entre todas las corridas (el libro, gasto.json) y el freno que
 * corta la corrida ANTES de pasarse del tope.
 *
 * Por qué existe: las evals corren con una key de Gemini aparte, con plata
 * contada, y el dueño puso un tope total para todas las corridas juntas
 * (varias, a lo largo de días). Un tope por corrida no alcanza: lo que importa
 * es la suma.
 *
 * El costo es un TECHO: precio de lista sin el descuento de la caché (la
 * entrada cacheada se cobra como entrada normal) y, si el modelo no está en la
 * tabla de precios, el modelo más caro del proveedor. La caché real se guarda
 * aparte (cachedTokens) para que el reporte muestre cuánto se cacheó, pero no
 * se descuenta: el freno tiene que pecar de cauto.
 *
 * Separado de run.ts para que el unit test lo pruebe sin red.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { PRECIOS_IA, costoDeConsumoUsd, precioTokens, tienePrecioPropio } from '../../../src/platform/costs/precios';
import type { ConsumoPorProveedor } from '../../../src/orbi/turno/motor-de-turno';
import type { Resultado } from './motor';

/** Lo que se estima para un caso cuando todavía no hay ninguno medido en esta corrida. Conservador a propósito. */
export const COSTO_POR_CASO_POR_DEFECTO_USD = 0.03;

// ─── Costo de un caso ────────────────────────────────────────────────────────

/**
 * Lo que cuesta un consumo a precio de lista, sin descuento de caché. Si el
 * modelo no tiene precio propio, se cobra con el más caro del proveedor (no
 * con el default, que podría ser más barato que el modelo de verdad).
 */
export function costoTechoUsd(consumo: ConsumoPorProveedor, fecha: Date): number {
  let usd = 0;
  for (const [provider, c] of consumo) {
    const modelo = tienePrecioPropio(provider, c.model) ? c.model : modeloMasCaro(provider, fecha);
    usd += costoDeConsumoUsd(
      { provider, model: modelo, promptTokens: c.promptTokens, cachedTokens: 0, completionTokens: c.completionTokens },
      fecha,
    );
  }
  return usd;
}

function modeloMasCaro(proveedor: string, fecha: Date): string | null {
  let peor: { modelo: string; precio: number } | null = null;
  for (const modelo of Object.keys(PRECIOS_IA[proveedor] ?? {})) {
    const p = precioTokens(proveedor, modelo, fecha)!;
    // La salida pesa más, pero en el panel la entrada es la mayor parte: se suman las dos.
    const precio = p.entrada + p.salida;
    if (!peor || precio > peor.precio) peor = { modelo, precio };
  }
  return peor?.modelo ?? null;
}

// ─── El libro: lo gastado entre todas las corridas ───────────────────────────

export type CorridaDelLibro = {
  fecha: string;
  etiqueta: string;
  /** Casos corridos (cada repetición cuenta). */
  casos: number;
  /** Llamadas al modelo. */
  llamadas: number;
  /** Techo de lo que costó, en USD. */
  usd: number;
  /** 'corriendo' que quedó así = la corrida se cortó (crash): su último caso puede no estar contado. */
  estado: 'corriendo' | 'completa' | 'frenada' | 'interrumpida';
};

export type Libro = { topeUsd: number; gastadoUsd: number; corridas: CorridaDelLibro[] };

export function leerLibro(ruta: string): Libro | null {
  if (!existsSync(ruta)) return null;
  const libro = JSON.parse(readFileSync(ruta, 'utf8')) as Libro;
  if (typeof libro.topeUsd !== 'number' || typeof libro.gastadoUsd !== 'number' || !Array.isArray(libro.corridas)) {
    throw new Error(`${ruta} no tiene la forma de un libro de gasto ({ topeUsd, gastadoUsd, corridas })`);
  }
  return libro;
}

export function guardarLibro(ruta: string, libro: Libro): void {
  writeFileSync(ruta, `${JSON.stringify(libro, null, 2)}\n`);
}

/**
 * El tope que vale para esta corrida: el de --tope si vino (y pasa a ser el
 * del libro), si no el del libro. Sin ninguno de los dos no se corre: sin tope
 * no hay freno.
 */
export function resolverTope(libro: Libro | null, flag: string | undefined): { topeUsd: number } | { error: string } {
  if (flag !== undefined) {
    const n = Number(flag.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return { error: `--tope inválido: "${flag}" (va en USD, por ejemplo --tope=4)` };
    return { topeUsd: n };
  }
  if (libro) return { topeUsd: libro.topeUsd };
  return {
    error:
      'No hay tope de gasto: no existe el libro de gasto y no vino --tope. ' +
      'La primera corrida tiene que fijarlo, por ejemplo --tope=4 (USD, para todas las corridas juntas).',
  };
}

// ─── Estimación y freno ──────────────────────────────────────────────────────

/** Lo que se espera que cueste el próximo caso: el promedio de lo que vienen costando en esta corrida. */
export function estimarProximoCaso(costosDeEstaCorrida: number[]): number {
  if (!costosDeEstaCorrida.length) return COSTO_POR_CASO_POR_DEFECTO_USD;
  return costosDeEstaCorrida.reduce((a, b) => a + b, 0) / costosDeEstaCorrida.length;
}

export const usd = (n: number, decimales = 4): string => `USD ${n.toFixed(decimales)}`;

export type Trabajo<C> = { caso: C; intento: number };

// ─── El tope de gasto del proveedor ──────────────────────────────────────────

/**
 * Lo que se le dice a la persona cuando Google corta por el tope de gasto
 * mensual del proyecto (AI Studio), que es otro tope: el de Google, no el
 * nuestro del libro.
 */
export const MENSAJE_TOPE_DEL_PROVEEDOR =
  'Google frenó por el tope de gasto del proyecto en AI Studio: subilo en https://ai.studio/spend y volvé a correr';

/**
 * Si el error del proveedor es el tope de gasto del proyecto: un 429
 * RESOURCE_EXHAUSTED que dice "exceeded its monthly spending cap". No es un
 * rate limit: esperar no sirve y cada caso que siga va a dar lo mismo.
 */
export function esTopeDeGastoDelProveedor(mensaje: string): boolean {
  return /spend(?:ing)?[\s_-]*cap/i.test(mensaje);
}

export type CorridaConTope = {
  resultados: Resultado[];
  /**
   * Si la corrida se cortó: cuántos casos quedaron sin correr, el mensaje para
   * la persona y por qué ('tope': el nuestro, del libro; 'proveedor': el tope
   * de gasto del proyecto en Google).
   */
  frenada: { quedan: number; mensaje: string; motivo: 'tope' | 'proveedor' } | null;
  /** La entrada de esta corrida en el libro (ya guardada). */
  entrada: CorridaDelLibro;
};

/**
 * Corre los trabajos en serie con el freno: antes de cada caso estima lo que
 * va a costar y, si con eso se pasa del tope, para SIN llamar. Después de cada
 * caso suma lo que costó al libro y lo escribe en el acto, para que un crash o
 * un Ctrl+C no pierdan la cuenta.
 */
export async function correrConTope<C>(p: {
  trabajos: Trabajo<C>[];
  correr: (t: Trabajo<C>) => Promise<Resultado>;
  libro: Libro;
  rutaLibro: string;
  etiqueta: string;
  fecha?: Date;
  /** Para avisarle a la CLI qué caso está en vuelo (Ctrl+C). */
  alEmpezarCaso?: (estimado: number) => void;
}): Promise<CorridaConTope> {
  const { libro, rutaLibro } = p;
  const entrada: CorridaDelLibro = {
    fecha: (p.fecha ?? new Date()).toISOString(),
    etiqueta: p.etiqueta,
    casos: 0,
    llamadas: 0,
    usd: 0,
    estado: 'corriendo',
  };
  libro.corridas.push(entrada);
  guardarLibro(rutaLibro, libro);

  const resultados: Resultado[] = [];
  const costos: number[] = [];
  for (let i = 0; i < p.trabajos.length; i++) {
    const estimado = estimarProximoCaso(costos);
    if (libro.gastadoUsd + estimado > libro.topeUsd) {
      const quedan = p.trabajos.length - i;
      entrada.estado = 'frenada';
      guardarLibro(rutaLibro, libro);
      return {
        resultados,
        entrada,
        frenada: {
          quedan,
          motivo: 'tope',
          mensaje:
            `Tope de ${usd(libro.topeUsd, 2)} alcanzado: se gastaron ${usd(libro.gastadoUsd)}; ` +
            `quedan ${quedan} caso(s) sin correr (el próximo se estimaba en ${usd(estimado)}).`,
        },
      };
    }

    p.alEmpezarCaso?.(estimado);
    const r = await p.correr(p.trabajos[i]);

    // Google cortó por el tope de gasto del proyecto: los casos que siguen
    // darían el mismo 429, cada uno anotado como "error de infraestructura".
    // Se para acá. Este caso no entra en los resultados (no llegó a correr) y
    // no se le anota el estimado: el pedido rechazado no se factura. Si antes
    // del 429 alguna vuelta del caso sí terminó (raro), lo medido se anota,
    // porque eso Google sí lo cobró.
    if (r.infra && r.error && esTopeDeGastoDelProveedor(r.error)) {
      const medido = r.costoUsd ?? 0;
      entrada.llamadas += r.llamadas ?? 0;
      entrada.usd += medido;
      libro.gastadoUsd += medido;
      entrada.estado = 'frenada';
      guardarLibro(rutaLibro, libro);
      const quedan = p.trabajos.length - i;
      return {
        resultados,
        entrada,
        frenada: { quedan, motivo: 'proveedor', mensaje: `${MENSAJE_TOPE_DEL_PROVEEDOR} (quedan ${quedan} caso(s) sin correr).` },
      };
    }

    resultados.push(r);
    const costo = r.costoUsd ?? 0;
    costos.push(costo);
    entrada.casos += 1;
    entrada.llamadas += r.llamadas ?? 0;
    entrada.usd += costo;
    libro.gastadoUsd += costo;
    guardarLibro(rutaLibro, libro);
  }

  entrada.estado = 'completa';
  guardarLibro(rutaLibro, libro);
  return { resultados, entrada, frenada: null };
}

// ─── Ensayo ──────────────────────────────────────────────────────────────────

export type Ensayo = {
  casos: number;
  repeticiones: number;
  corridas: number;
  /** Rango estimado de lo que costaría, en USD. */
  desdeUsd: number;
  hastaUsd: number;
  topeUsd: number | null;
  gastadoUsd: number;
  disponibleUsd: number | null;
  /** Cuántos casos entrarían con el techo del rango antes de que frene. */
  entranConElTecho: number | null;
};

/**
 * Lo que haría una corrida, sin correrla: no toca el adapter ni la red. El
 * rango sale de lo que costaron por caso las corridas anteriores del libro y,
 * sin historia, del default por caso (techo) y un tercio de eso (piso).
 */
export function ensayar(p: { casos: number; repeticiones: number; libro: Libro | null; topeUsd: number | null }): Ensayo {
  const corridas = p.casos * p.repeticiones;
  const porCaso = (p.libro?.corridas ?? []).filter((c) => c.casos > 0).map((c) => c.usd / c.casos);
  const piso = porCaso.length ? Math.min(...porCaso) : COSTO_POR_CASO_POR_DEFECTO_USD / 3;
  const techo = Math.max(COSTO_POR_CASO_POR_DEFECTO_USD, ...porCaso);
  const gastadoUsd = p.libro?.gastadoUsd ?? 0;
  const disponibleUsd = p.topeUsd === null ? null : Math.max(0, p.topeUsd - gastadoUsd);
  return {
    casos: p.casos,
    repeticiones: p.repeticiones,
    corridas,
    desdeUsd: corridas * piso,
    hastaUsd: corridas * techo,
    topeUsd: p.topeUsd,
    gastadoUsd,
    disponibleUsd,
    entranConElTecho: disponibleUsd === null ? null : Math.min(corridas, Math.floor(disponibleUsd / techo + 1e-9)),
  };
}

// ─── Reporte ─────────────────────────────────────────────────────────────────

export type ReporteDeGasto = {
  pasaron: number;
  fallaron: number;
  infra: number;
  /** Techo de lo que costó esta corrida. */
  usdCorrida: number;
  /** Lo gastado entre todas las corridas, según el libro. */
  usdAcumulado: number;
  topeUsd: number;
  promedioTokensDeEntrada: number;
  /** De los tokens de entrada, qué porcentaje salió de la caché (0–100). */
  porcentajeCacheado: number;
  promedioTokensDePensamiento: number;
  latenciaPromedioMs: number;
  frenada: boolean;
  casosSinCorrer: number;
};

export function reporteDeGasto(resultados: Resultado[], libro: Libro, frenada: CorridaConTope['frenada']): ReporteDeGasto {
  const validos = resultados.filter((r) => !r.infra);
  const n = resultados.length || 1;
  const entrada = resultados.reduce((a, r) => a + r.tokens.entrada, 0);
  const cacheados = resultados.reduce((a, r) => a + (r.cachedTokens ?? 0), 0);
  const pensamiento = resultados.reduce((a, r) => a + (r.thinkingTokens ?? 0), 0);
  return {
    pasaron: validos.filter((r) => r.ok).length,
    fallaron: validos.filter((r) => !r.ok).length,
    infra: resultados.length - validos.length,
    usdCorrida: resultados.reduce((a, r) => a + (r.costoUsd ?? 0), 0),
    usdAcumulado: libro.gastadoUsd,
    topeUsd: libro.topeUsd,
    promedioTokensDeEntrada: Math.round(entrada / n),
    porcentajeCacheado: entrada ? Math.round((cacheados / entrada) * 1000) / 10 : 0,
    promedioTokensDePensamiento: Math.round(pensamiento / n),
    latenciaPromedioMs: Math.round(resultados.reduce((a, r) => a + r.ms, 0) / n),
    frenada: !!frenada,
    casosSinCorrer: frenada?.quedan ?? 0,
  };
}

export function imprimirReporteDeGasto(r: ReporteDeGasto): void {
  console.log('Gasto:');
  console.log(`  Casos: ${r.pasaron} pasaron, ${r.fallaron} fallaron${r.infra ? `, ${r.infra} con error de infraestructura` : ''}${r.casosSinCorrer ? `, ${r.casosSinCorrer} sin correr (tope)` : ''}`);
  console.log(`  Esta corrida: ${usd(r.usdCorrida)} (techo: precio de lista sin descuento de caché)`);
  console.log(`  Acumulado: ${usd(r.usdAcumulado)} de ${usd(r.topeUsd, 2)} (quedan ${usd(Math.max(0, r.topeUsd - r.usdAcumulado))})`);
  console.log(`  Tokens de entrada por caso: ${r.promedioTokensDeEntrada.toLocaleString('es-AR')} (${r.porcentajeCacheado}% cacheados)`);
  console.log(`  Tokens de pensamiento por caso: ${r.promedioTokensDePensamiento.toLocaleString('es-AR')}`);
  console.log(`  Latencia promedio: ${r.latenciaPromedioMs}ms`);
}
