// Copia el cuadro CRUDO de una toma más cercano a un tiempo (segundos desde la
// marca 'inicio') → out/cuadro-<t>.jpg. Para revisar una toma antes de editar.
//   node herramientas/cuadro.mjs <toma> <t1> [t2 …]
import fs from 'node:fs'

const [toma, ...ts] = process.argv.slice(2)
const L = JSON.parse(fs.readFileSync(`tomas/${toma}/log.json`, 'utf8'))
const t0 = L.log.find(e => e.type === 'mark' && e.name === 'inicio').t
const F = [...L.frames].sort((a, b) => a.s - b.s)
fs.mkdirSync('out', { recursive: true })
for (const t of ts) {
  let best = F[0]
  for (const f of F) { if (f.s <= t0 + Number(t)) best = f; else break }
  fs.copyFileSync(`tomas/${toma}/${best.f}`, `out/cuadro-${t}.jpg`)
  console.log(`${t} s → out/cuadro-${t}.jpg`)
}
// Resumen de eventos (tiempos relativos) para ubicar marcas
if (!ts.length) for (const e of L.log) if (e.type !== 'move') console.log((e.t - t0).toFixed(2).padStart(7), e.type.padEnd(6), e.name ?? e.label ?? e.u ?? '', e.foco ?? e.hl ?? '', e.t1 ? `[${(e.t1 - e.t).toFixed(2)} s]` : '')
