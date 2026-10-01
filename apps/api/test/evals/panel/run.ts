/**
 * Corre el golden set del panel contra Orbi de verdad (Gemini) y aplica las
 * reglas (spec 2026-10-01-orbi-fase-2).
 *
 *   pnpm test:evals:panel                              # todo
 *   pnpm test:evals:panel -- --caso=cupon              # ids que contengan "cupon"
 *   pnpm test:evals:panel -- --categoria=ataque        # una categoría
 *   pnpm test:evals:panel -- --repeticiones=3          # cada caso N veces, marca inestables
 *   pnpm test:evals:panel -- --salida=base.json        # guarda la corrida
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
 * OJO: llama a Gemini de verdad. Cuesta plata (del orden de USD 0,5 la tanda
 * completa con flash) y tarda. No corre en CI.
 */

import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { config as cargarDotenv } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { GeminiAdapter } from '../../../src/orbi/llm/gemini.adapter';
import { crearNegocioDePrueba } from './negocio-de-prueba';
import { CASOS_PANEL, CATEGORIAS_DE_CASOS, type CasoPanel } from './casos';
import { VARIANTES, correrCaso, type Resultado } from './motor';

// dotenv NO pisa lo que ya está en el entorno: `ORBI_MODEL_PANEL=x pnpm …` manda.
cargarDotenv({ path: resolve(__dirname, '../../../.env') });

const config = new ConfigService();
const llm = new GeminiAdapter(config);
const modelo = process.env.ORBI_MODEL_PANEL ?? process.env.ORBI_MODEL ?? llm.modelo;

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

function resumen(resultados: Resultado[], variante: string): void {
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

type CorridaGuardada = {
  fecha: string;
  /** El "ahora" del dataset de esa corrida (ver --ahora). */
  ahora?: string;
  modelo: string;
  razonamiento: string;
  temperatura: string;
  variante: string;
  resultados: Resultado[];
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const arg = (nombre: string) => args.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);
  const filtro = arg('caso');
  const categoria = arg('categoria');
  const repeticiones = Number(arg('repeticiones')) || 1;
  const salida = arg('salida');
  const contra = arg('comparar');
  const nombreVariante = arg('variante') ?? 'actual';
  // El "ahora" del dataset. Al comparar contra una corrida guardada se reusa
  // el suyo: si no, el día 1 del mes "ventas del mes" vale casi nada y la
  // comparación mide el calendario, no el modelo. El prompt no tiene la
  // fecha, así que fijarla no cambia lo que ve el modelo.
  const ahoraGuardado = contra ? (JSON.parse(readFileSync(contra, 'utf8')) as { ahora?: string }).ahora : undefined;
  const ahoraIso = arg('ahora') ?? ahoraGuardado;
  const ahora = ahoraIso ? new Date(ahoraIso) : new Date();
  if (isNaN(ahora.getTime())) {
    console.error(`--ahora inválido: ${ahoraIso}`);
    process.exit(1);
  }

  const variante = VARIANTES[nombreVariante];
  if (!variante) {
    console.error(`No existe la variante "${nombreVariante}". Hay: ${Object.keys(VARIANTES).join(', ')}`);
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('Falta GEMINI_API_KEY (sale de apps/api/.env). Estas evals llaman a la API de verdad.');
    process.exit(1);
  }

  const casos = CASOS_PANEL
    .filter((c) => !filtro || c.id.includes(filtro))
    .filter((c) => !categoria || c.categoria === categoria);
  if (!casos.length) {
    console.error('Ningún caso matchea ese filtro.');
    process.exit(1);
  }

  // Un solo "ahora" para toda la corrida: los números esperados y los que
  // devuelven los fakes salen del mismo dataset.
  const d = crearNegocioDePrueba(ahora);
  console.log(`Corriendo ${casos.length} caso(s) x ${repeticiones} con ${modelo}, variante ${nombreVariante}, ahora ${ahora.toISOString()}…`);

  const resultados: Resultado[] = [];
  for (let intento = 1; intento <= repeticiones; intento++) {
    // En serie a propósito: en paralelo los 429 se leerían como fallas del modelo.
    for (const caso of casos) resultados.push(await correrCaso(caso, intento, d, variante, { llm, nombre: modelo }));
  }

  imprimir(resultados, new Map(CASOS_PANEL.map((c) => [c.id, c])));
  resumen(resultados, nombreVariante);
  if (contra) comparar(resultados, contra);

  if (salida) {
    const corrida: CorridaGuardada = {
      fecha: new Date().toISOString(),
      ahora: ahora.toISOString(),
      modelo,
      razonamiento: process.env.ORBI_REASONING_EFFORT ?? 'low',
      temperatura: process.env.ORBI_TEMPERATURE ?? '0.3',
      variante: nombreVariante,
      resultados,
    };
    writeFileSync(salida, JSON.stringify(corrida, null, 2));
    console.log(`Guardado en ${salida}`);
  }

  process.exit(resultados.some((r) => !r.ok) ? 1 : 0);
}

void main();
