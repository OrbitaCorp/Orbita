/**
 * Corre el golden set del panel contra Orbi de verdad (Gemini) y aplica las
 * reglas (spec 2026-10-01-orbi-fase-2).
 *
 *   pnpm test:evals:panel -- --tope=4                  # la primera vez: fija el tope TOTAL en USD
 *   pnpm test:evals:panel                              # todo (el tope sale del libro de gasto)
 *   pnpm test:evals:panel -- --ensayo                  # qué correría y cuánto costaría, SIN llamar a nada
 *   pnpm test:evals:panel -- --etiqueta=linea-base     # nombre de la corrida en el libro de gasto
 *   pnpm test:evals:panel -- --gasto=otro.json         # otro libro de gasto (default: gasto.json, al lado de este archivo)
 *   pnpm test:evals:panel -- --caso=cupon              # ids que contengan "cupon" (varios: --caso=a,b)
 *   pnpm test:evals:panel -- --categoria=ataque        # una categoría (o varias: accion,permisos)
 *   pnpm test:evals:panel -- --repeticiones=3          # cada caso N veces, marca inestables
 *   pnpm test:evals:panel -- --salida=base.json        # guarda la corrida (con el reporte de gasto)
 *   pnpm test:evals:panel -- --comparar=base.json      # compara contra una corrida guardada
 *   pnpm test:evals:panel -- --variante=<nombre>       # otra configuración (ver VARIANTES en motor.ts)
 *   pnpm test:evals:panel -- --ahora=2026-09-18T18:00:00Z  # fija el "ahora" del dataset
 *   ORBI_MODEL_PANEL=gemini-3.6-pro pnpm test:evals:panel
 *
 * Qué es real y qué no: el prompt (ContextBuilderService), las tools y el
 * registry (permisos, propuestas, validación con el DTO) son los de
 * producción. Los datos salen del negocio de prueba en memoria (fakes.ts).
 * Ninguna escritura se ejecuta: igual que el chat, las escrituras solo se
 * proponen.
 *
 * El loop replica OrbiController.chat, con las mismas piezas
 * (src/orbi/turno/vuelta.ts): proponer → error al modelo / escritura no
 * disponible / tarjeta pendiente / lectura ejecutada, y las calls de una vuelta
 * vuelven al historial juntas (tools paralelas de Gemini 3). Lo que se juzga es
 * lo que se ve: el texto de la vuelta final más tarjetas y botones.
 *
 * OJO: llama a Gemini de verdad. Cuesta plata y tarda. No corre en CI.
 *
 * TOPE DE GASTO (presupuesto.ts): las evals corren con una key aparte, con
 * plata contada. El libro de gasto (gasto.json, ignorado por git) suma lo que
 * costaron TODAS las corridas. Antes de cada caso se estima lo que va a costar
 * (el promedio de los casos ya corridos; el primero, USD 0,03): si con eso se
 * pasa del tope, la corrida para sin llamar, guarda lo que tiene (en --salida
 * o en parcial-<fecha>.json) y sale con código 2. Sin libro y sin --tope no
 * corre. El costo es un techo (precio de lista, sin el descuento de la caché):
 * lo que cobre Google debería ser menos, no más. No borres gasto.json para
 * "resetear": lo gastado no vuelve; si hace falta margen, subí el tope a
 * conciencia con --tope. Antes de una corrida grande, --ensayo.
 *
 * Aparte está el tope de gasto del PROYECTO en Google (AI Studio): si Google
 * contesta 429 "exceeded its monthly spending cap", la corrida para en ese
 * caso (los que siguen darían lo mismo), guarda lo que tiene y sale con
 * código 3. Ese caso no se anota como corrido ni se le cobra el estimado.
 */

import { resolve, join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { config as cargarDotenv } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { GeminiAdapter } from '../../../src/orbi/llm/gemini.adapter';
import { DEFAULT_MODEL } from '../../../src/orbi/llm/gemini-client';
import { tienePrecioPropio } from '../../../src/platform/costs/precios';
import { crearNegocioDePrueba } from './negocio-de-prueba';
import { CASOS_PANEL, CATEGORIAS_DE_CASOS, type CasoPanel } from './casos';
import { VARIANTES, correrCaso, type Modelo, type Resultado } from './motor';
import { correrRelojA } from './reloj';
import {
  correrConTope,
  ensayar,
  guardarLibro,
  imprimirReporteDeGasto,
  leerLibro,
  reporteDeGasto,
  resolverTope,
  usd,
  type Ensayo,
  type Libro,
  type ReporteDeGasto,
} from './presupuesto';

/** Dónde vive el libro de gasto si no viene --gasto. */
export const LIBRO_POR_DEFECTO = join(__dirname, 'gasto.json');

/** El nombre del modelo sin construir el adapter (lo usa --ensayo). */
function nombreDelModelo(): string {
  return process.env.ORBI_MODEL_PANEL ?? process.env.ORBI_MODEL ?? DEFAULT_MODEL;
}

/** El modelo de verdad. Solo se construye cuando la corrida va en serio (nunca con --ensayo). */
function modeloDeVerdad(): Required<Modelo> {
  const llm = new GeminiAdapter(new ConfigService());
  return { llm, nombre: process.env.ORBI_MODEL_PANEL ?? process.env.ORBI_MODEL ?? llm.modelo };
}

// ─── Reporte ─────────────────────────────────────────────────────────────────

const VERDE = '\x1b[32m';
const ROJO = '\x1b[31m';
const AMARILLO = '\x1b[33m';
const GRIS = '\x1b[90m';
const FIN = '\x1b[0m';

function unaLinea(texto: string, max = 140): string {
  const plano = texto.replace(/\s+/g, ' ').trim();
  return plano.length > max ? `${plano.slice(0, max)}…` : plano;
}

function imprimir(resultados: Resultado[], casos: Map<string, CasoPanel>): void {
  for (const r of resultados) {
    const marca = r.infra ? `${AMARILLO}!${FIN}` : r.ok ? `${VERDE}✓${FIN}` : `${ROJO}✗${FIN}`;
    const sufijo = r.intento > 1 ? ` ${GRIS}(intento ${r.intento})${FIN}` : '';
    console.log(`\n${marca} ${r.id}${sufijo} ${GRIS}${r.ms}ms${FIN}`);
    console.log(`  ${GRIS}${casos.get(r.id)?.descripcion ?? ''}${FIN}`);
    if (r.error) {
      console.log(`  ${r.infra ? AMARILLO : ROJO}${r.infra ? 'infraestructura' : 'error'}: ${r.error}${FIN}`);
      continue;
    }
    console.log(`  ${GRIS}dijo:${FIN} ${unaLinea(r.turno.texto)}`);
    const llamadas = r.turno.toolCalls.map((c) => `${c.name}(${unaLinea(JSON.stringify(c.arguments), 80)})`).join(' + ');
    console.log(`  ${GRIS}llamó:${FIN} ${llamadas || `${GRIS}nada${FIN}`}`);
    for (const p of r.turno.propuestas) console.log(`  ${GRIS}tarjeta:${FIN} ${p.resumen}`);
    for (const v of r.violaciones) console.log(`  ${ROJO}✗ [${v.regla}] ${v.detalle}${FIN}`);
    for (const n of r.noAplica) console.log(`  ${GRIS}· no aplica [${n.tipo}]: ${n.motivo}${FIN}`);
  }
}

function resumen(resultados: Resultado[], variante: string, modelo: string): void {
  const validos = resultados.filter((r) => !r.infra);
  const limpias = validos.filter((r) => r.ok).length;

  console.log(`\n${'─'.repeat(72)}`);
  console.log(`Modelo: ${modelo} | Razonamiento: ${process.env.ORBI_REASONING_EFFORT ?? 'low'} | Temperatura: ${process.env.ORBI_TEMPERATURE ?? '0.3'} | Variante: ${variante}`);

  const porRegla = new Map<string, number>();
  for (const r of validos) for (const v of r.violaciones) porRegla.set(v.regla, (porRegla.get(v.regla) ?? 0) + 1);
  if (porRegla.size) {
    console.log('\nViolaciones por regla:');
    for (const [regla, n] of [...porRegla].sort((a, b) => b[1] - a[1])) console.log(`  ${regla.padEnd(28)} ${n}`);
  }

  console.log('\nPor categoría (corridas limpias / total):');
  for (const cat of CATEGORIAS_DE_CASOS) {
    const deCat = validos.filter((r) => r.categoria === cat);
    if (deCat.length) console.log(`  ${cat.padEnd(20)} ${deCat.filter((r) => r.ok).length}/${deCat.length}`);
  }

  // Inestables: el mismo caso pasa a veces y a veces no (con --repeticiones).
  const porId = new Map<string, boolean[]>();
  for (const r of validos) porId.set(r.id, [...(porId.get(r.id) ?? []), r.ok]);
  const inestables = [...porId].filter(([, oks]) => oks.includes(true) && oks.includes(false));
  if (inestables.length) {
    console.log(`\n${AMARILLO}Inestables:${FIN} ${inestables.map(([id, oks]) => `${id} (${oks.filter(Boolean).length}/${oks.length})`).join(', ')}`);
  }

  const noAplica = validos.reduce((n, r) => n + r.noAplica.length, 0);
  if (noAplica) console.log(`\n${GRIS}Expectativas que no aplican en esta variante: ${noAplica}${FIN}`);

  const infra = resultados.length - validos.length;
  if (infra) console.log(`\n${AMARILLO}${infra} corrida(s) con error de infraestructura (no cuentan)${FIN}`);

  const latencias = validos.filter((r) => !r.error).map((r) => r.ms).sort((a, b) => a - b);
  if (latencias.length) console.log(`\nLatencia mediana: ${latencias[Math.floor(latencias.length / 2)]}ms`);
  const entrada = validos.reduce((n, r) => n + r.tokens.entrada, 0);
  const salida = validos.reduce((n, r) => n + r.tokens.salida, 0);
  console.log(`Tokens: ${entrada.toLocaleString('es-AR')} de entrada, ${salida.toLocaleString('es-AR')} de salida`);

  const color = limpias === validos.length ? VERDE : ROJO;
  console.log(`\n${color}${limpias}/${validos.length} corridas limpias${FIN}\n`);
}

function imprimirEnsayo(e: Ensayo, rutaLibro: string, libro: Libro | null, modelo: string): void {
  console.log(`Ensayo (no se llama a nada): ${e.casos} caso(s) x ${e.repeticiones} = ${e.corridas} corrida(s) con ${modelo}.`);
  console.log(`Costo estimado: entre ${usd(e.desdeUsd, 2)} y ${usd(e.hastaUsd, 2)} (techo: precio de lista, sin descuento de caché).`);
  if (!libro) console.log(`Libro de gasto: no existe todavía (${rutaLibro}).`);
  else console.log(`Libro de gasto: ${usd(libro.gastadoUsd)} gastados en ${libro.corridas.length} corrida(s) (${rutaLibro}).`);
  if (e.topeUsd === null) {
    console.log(`${ROJO}Sin tope: una corrida de verdad se negaría a arrancar. Pasá --tope=<USD>.${FIN}`);
    return;
  }
  console.log(`Tope: ${usd(e.topeUsd, 2)}; quedan ${usd(e.disponibleUsd ?? 0)}.`);
  if (e.entranConElTecho !== null && e.entranConElTecho < e.corridas) {
    console.log(`${AMARILLO}Con el techo de la estimación entran ~${e.entranConElTecho} de ${e.corridas}: el freno cortaría antes de terminar.${FIN}`);
  }
}

type CorridaGuardada = {
  fecha: string;
  /** El "ahora" del dataset de esa corrida (ver --ahora). */
  ahora?: string;
  modelo: string;
  razonamiento: string;
  temperatura: string;
  variante: string;
  /** La etiqueta de la corrida en el libro de gasto (desde 2026-10-07). */
  etiqueta?: string;
  resultados: Resultado[];
  /** Gasto, tokens y latencia de la corrida (desde 2026-10-07). */
  gasto?: ReporteDeGasto;
};

/** Compara contra una corrida guardada: qué casos se arreglaron, cuáles se rompieron, y por regla. */
function comparar(actual: Resultado[], archivo: string): void {
  const previa = JSON.parse(readFileSync(archivo, 'utf8')) as CorridaGuardada;
  const tasa = (rs: Resultado[], id: string) => {
    const de = rs.filter((r) => r.id === id && !r.infra);
    return de.length ? de.filter((r) => r.ok).length / de.length : null;
  };
  const ids = [...new Set([...actual.map((r) => r.id), ...previa.resultados.map((r) => r.id)])];
  const arreglados: string[] = [];
  const rotos: string[] = [];
  for (const id of ids) {
    const antes = tasa(previa.resultados, id);
    const ahora = tasa(actual, id);
    if (antes === null || ahora === null) continue;
    if (ahora > antes) arreglados.push(`${id} (${Math.round(antes * 100)}% → ${Math.round(ahora * 100)}%)`);
    if (ahora < antes) rotos.push(`${id} (${Math.round(antes * 100)}% → ${Math.round(ahora * 100)}%)`);
  }
  const porRegla = (rs: Resultado[]) => {
    const m = new Map<string, number>();
    for (const r of rs.filter((x) => !x.infra)) for (const v of r.violaciones) m.set(v.regla, (m.get(v.regla) ?? 0) + 1);
    return m;
  };
  const a = porRegla(previa.resultados);
  const b = porRegla(actual);

  console.log(`${'─'.repeat(72)}`);
  console.log(`Comparado con ${archivo} (${previa.fecha}, ${previa.modelo}, variante ${previa.variante})`);
  console.log(`\n${VERDE}Mejoraron (${arreglados.length}):${FIN} ${arreglados.join(', ') || '—'}`);
  console.log(`${ROJO}Empeoraron (${rotos.length}):${FIN} ${rotos.join(', ') || '—'}`);
  console.log('\nViolaciones por regla (antes → ahora):');
  for (const regla of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    console.log(`  ${regla.padEnd(28)} ${a.get(regla) ?? 0} → ${b.get(regla) ?? 0}`);
  }
  console.log('');
}

// ─── Main ────────────────────────────────────────────────────────────────────

export type Dependencias = {
  /** Cómo se arma el modelo. Solo se llama si la corrida va en serio. */
  crearModelo: () => Required<Modelo>;
};

/**
 * Devuelve el código de salida: 0 todo limpio, 1 fallas o error de uso, 2
 * frenada por nuestro tope (el libro), 3 frenada por el tope de gasto del
 * proyecto en Google.
 */
export async function main(args: string[], deps: Dependencias = { crearModelo: modeloDeVerdad }): Promise<number> {
  const arg = (nombre: string) => args.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);
  const filtro = arg('caso');
  const categoria = arg('categoria');
  const repeticiones = Number(arg('repeticiones')) || 1;
  const salida = arg('salida');
  const contra = arg('comparar');
  const nombreVariante = arg('variante') ?? 'actual';
  const ensayo = args.includes('--ensayo');
  const rutaLibro = arg('gasto') ?? LIBRO_POR_DEFECTO;
  const etiqueta = arg('etiqueta') ?? 'sin-etiqueta';
  // El "ahora" del dataset. Al comparar contra una corrida guardada se reusa
  // el suyo: si no, el día 1 del mes "ventas del mes" vale casi nada y la
  // comparación mide el calendario, no el modelo. El prompt no tiene la
  // fecha, así que fijarla no cambia lo que ve el modelo.
  const ahoraGuardado = contra ? (JSON.parse(readFileSync(contra, 'utf8')) as { ahora?: string }).ahora : undefined;
  const ahoraIso = arg('ahora') ?? ahoraGuardado;
  const ahora = ahoraIso ? new Date(ahoraIso) : new Date();
  if (isNaN(ahora.getTime())) {
    console.error(`--ahora inválido: ${ahoraIso}`);
    return 1;
  }

  const variante = VARIANTES[nombreVariante];
  if (!variante) {
    console.error(`No existe la variante "${nombreVariante}". Hay: ${Object.keys(VARIANTES).join(', ')}`);
    return 1;
  }

  const casos = CASOS_PANEL
    .filter((c) => !filtro || filtro.split(',').some((f) => c.id.includes(f)))
    .filter((c) => !categoria || categoria.split(',').includes(c.categoria));
  if (!casos.length) {
    console.error('Ningún caso matchea ese filtro.');
    return 1;
  }

  const libroPrevio = leerLibro(rutaLibro);
  const tope = resolverTope(libroPrevio, arg('tope'));

  // El ensayo no construye el adapter, no pide la key y no escribe nada.
  if (ensayo) {
    if ('error' in tope && arg('tope') !== undefined) console.error(tope.error);
    const topeUsd = 'topeUsd' in tope ? tope.topeUsd : null;
    imprimirEnsayo(ensayar({ casos: casos.length, repeticiones, libro: libroPrevio, topeUsd }), rutaLibro, libroPrevio, nombreDelModelo());
    return 0;
  }

  if ('error' in tope) {
    console.error(tope.error);
    return 1;
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('Falta GEMINI_API_KEY (sale de apps/api/.env). Estas evals llaman a la API de verdad.');
    return 1;
  }

  const libro: Libro = { ...(libroPrevio ?? { gastadoUsd: 0, corridas: [] }), topeUsd: tope.topeUsd };

  const modelo = deps.crearModelo();
  if (!tienePrecioPropio('gemini', modelo.nombre)) {
    console.log(`${AMARILLO}${modelo.nombre} no está en la tabla de precios: se cobra como el modelo más caro de Gemini.${FIN}`);
  }

  // Un solo "ahora" para toda la corrida: los números esperados y los que
  // devuelven los fakes salen del mismo dataset.
  // Con un "ahora" fijo, el código real (ModuleDataService) tiene que ver la
  // misma fecha que el dataset.
  if (ahoraIso) correrRelojA(ahora);
  const d = crearNegocioDePrueba(ahora);
  console.log(`Corriendo ${casos.length} caso(s) x ${repeticiones} con ${modelo.nombre}, variante ${nombreVariante}, ahora ${ahora.toISOString()}…`);
  console.log(`Gasto: ${usd(libro.gastadoUsd)} de ${usd(libro.topeUsd, 2)} (libro ${rutaLibro}, etiqueta ${etiqueta}).`);

  // Ctrl+C a mitad de un caso: ese caso ya puede estar facturado y su costo
  // real no se llega a saber. Se anota lo estimado, para no quedarse corto.
  let enVuelo = 0;
  const alCortar = () => {
    const entrada = libro.corridas[libro.corridas.length - 1];
    if (entrada?.estado === 'corriendo') {
      entrada.estado = 'interrumpida';
      entrada.usd += enVuelo;
      libro.gastadoUsd += enVuelo;
      guardarLibro(rutaLibro, libro);
    }
    console.error(`\nInterrumpida. Libro: ${usd(libro.gastadoUsd)} de ${usd(libro.topeUsd, 2)} (el caso en vuelo se anotó con lo estimado, ${usd(enVuelo)}).`);
    process.exit(130);
  };
  process.once('SIGINT', alCortar);

  // En serie a propósito: en paralelo los 429 se leerían como fallas del modelo.
  const trabajos: { caso: CasoPanel; intento: number }[] = [];
  for (let intento = 1; intento <= repeticiones; intento++) for (const caso of casos) trabajos.push({ caso, intento });
  const { resultados, frenada } = await correrConTope({
    trabajos,
    correr: ({ caso, intento }) => correrCaso(caso, intento, d, variante, modelo),
    libro,
    rutaLibro,
    etiqueta,
    alEmpezarCaso: (estimado) => { enVuelo = estimado; },
  });
  process.removeListener('SIGINT', alCortar);

  imprimir(resultados, new Map(CASOS_PANEL.map((c) => [c.id, c])));
  if (resultados.length) resumen(resultados, nombreVariante, modelo.nombre);
  const gasto = reporteDeGasto(resultados, libro, frenada);
  imprimirReporteDeGasto(gasto);
  if (frenada) console.error(`\n${ROJO}${frenada.mensaje}${FIN}`);

  // Se guarda ANTES de comparar: comparar relee el archivo de la base al final
  // y, si se movió mientras corría (2026-10-01), tiraba y la corrida pagada se
  // perdía sin escribirse. Si el freno cortó, lo pagado se guarda igual.
  const parcial = frenada && resultados.length ? join(__dirname, `parcial-${new Date().toISOString().replace(/[:.]/g, '-')}.json`) : undefined;
  const destino = salida ?? parcial;
  if (destino) {
    const corrida: CorridaGuardada = {
      fecha: new Date().toISOString(),
      ahora: ahora.toISOString(),
      modelo: modelo.nombre,
      razonamiento: process.env.ORBI_REASONING_EFFORT ?? 'low',
      temperatura: process.env.ORBI_TEMPERATURE ?? '0.3',
      variante: nombreVariante,
      etiqueta,
      resultados,
      gasto,
    };
    writeFileSync(destino, JSON.stringify(corrida, null, 2));
    console.log(`Guardado en ${destino}`);
  }

  if (frenada) return frenada.motivo === 'proveedor' ? 3 : 2;
  if (contra) comparar(resultados, contra);

  return resultados.some((r) => !r.ok) ? 1 : 0;
}

if (require.main === module) {
  // dotenv NO pisa lo que ya está en el entorno: `ORBI_MODEL_PANEL=x pnpm …` manda.
  cargarDotenv({ path: resolve(__dirname, '../../../.env') });
  void main(process.argv.slice(2)).then((codigo) => process.exit(codigo));
}
