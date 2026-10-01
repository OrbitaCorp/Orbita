/**
 * Vuelve a puntuar corridas ya guardadas con las reglas ACTUALES, sin llamar al
 * modelo (cero costo). Sirve para corregir una regla y volver a medir la línea
 * de base sin repetir la corrida: lo que dijo el modelo no cambia, cambia cómo
 * se lo juzga.
 *
 *   pnpm exec ts-node -P tsconfig.json test/evals/panel/recalcular.ts base.json rama.json
 *   pnpm exec ts-node -P tsconfig.json test/evals/panel/recalcular.ts base.json --salida=base-recalculada.json
 *
 * Los casos y las reglas son los del checkout; el dataset se arma con el
 * "ahora" de cada archivo. Las instrucciones que no se pueden filtrar salen del
 * prompt de ESTE checkout (la base de `main` puede haber tenido otras: no
 * cambia el resultado salvo que el prompt haya cambiado mucho).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { crearNegocioDePrueba } from './negocio-de-prueba';
import { CASOS_PANEL, CATEGORIAS_DE_CASOS } from './casos';
import { instruccionesDelCaso, pedidosConocidos, type Resultado } from './motor';
import { escriturasPermitidas, evaluarReglasGlobales, verificarExpectativas } from './reglas';

type Corrida = { fecha: string; ahora?: string; modelo: string; variante: string; resultados: Resultado[] };

export function recalcular(corrida: Corrida): Corrida {
  const d = crearNegocioDePrueba(new Date(corrida.ahora ?? corrida.fecha));
  const casos = new Map(CASOS_PANEL.map((c) => [c.id, c]));
  const resultados = corrida.resultados.map((r) => {
    const caso = casos.get(r.id);
    if (r.infra || !caso) return r;
    const globales = evaluarReglasGlobales(r.turno, {
      escriturasPermitidas: escriturasPermitidas(caso.expectativas),
      instrucciones: instruccionesDelCaso(caso),
      topeDeLargo: caso.topeDeLargo,
      pedidosConocidos: pedidosConocidos(caso, d),
    });
    const { violaciones, noAplica } = verificarExpectativas(r.turno, caso.expectativas, d);
    const todas = [...globales, ...violaciones];
    return { ...r, ok: todas.length === 0, violaciones: todas, noAplica };
  });
  return { ...corrida, resultados };
}

function resumen(nombre: string, c: Corrida): void {
  const validos = c.resultados.filter((r) => !r.infra);
  console.log(`\n${nombre}: ${validos.filter((r) => r.ok).length}/${validos.length} limpias (${c.modelo}, ${c.variante})`);
  console.log('  ' + CATEGORIAS_DE_CASOS.map((cat) => {
    const de = validos.filter((r) => r.categoria === cat);
    return de.length ? `${cat} ${de.filter((r) => r.ok).length}/${de.length}` : '';
  }).filter(Boolean).join(' · '));
  const porRegla = new Map<string, number>();
  for (const r of validos) for (const v of r.violaciones) porRegla.set(v.regla, (porRegla.get(v.regla) ?? 0) + 1);
  console.log('  ' + [...porRegla].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · '));
}

function main(): void {
  const args = process.argv.slice(2);
  const salida = args.find((a) => a.startsWith('--salida='))?.slice('--salida='.length);
  const archivos = args.filter((a) => !a.startsWith('--'));
  if (!archivos.length) {
    console.error('Uso: recalcular.ts <corrida.json>... [--salida=archivo.json (solo con un archivo)]');
    process.exit(1);
  }
  for (const archivo of archivos) {
    const original = JSON.parse(readFileSync(archivo, 'utf8')) as Corrida;
    const nueva = recalcular(original);
    resumen(`${archivo} (guardada)`, original);
    resumen(`${archivo} (recalculada)`, nueva);
    if (salida && archivos.length === 1) writeFileSync(salida, JSON.stringify(nueva, null, 2));
  }
}

if (require.main === module) main();
