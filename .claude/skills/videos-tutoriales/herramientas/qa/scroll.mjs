// Desplazamiento vertical del contenido cuadro a cuadro (correlación de una columna)
//   node herramientas/qa/scroll.mjs <video> <desde> <hasta> [x]
// Renderizá el tramo con la cámara quieta (sin zoom) para medir solo el scroll.
// Umbral: el salto entre cuadros vecinos no debe superar ~2-4 px (curva suave).
import { spawn } from 'node:child_process'
import { ffmpegPath } from '../lib/deps.mjs'
const [video, desde, hasta, xA] = process.argv.slice(2)
const X = Number(xA ?? 700), H = 1080
const buf = await new Promise((res, rej) => { const ch = []; const p = spawn(ffmpegPath, ['-loglevel', 'error', '-ss', desde, '-to', hasta, '-i', video, '-vf', `crop=1:${H}:${X}:0,format=gray`, '-f', 'rawvideo', '-']); p.stdout.on('data', d => ch.push(d)); p.on('close', c => c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ffmpeg'))) })
const n = buf.length / H, cols = Array.from({ length: n }, (_, f) => buf.subarray(f * H, (f + 1) * H))
const shifts = []
for (let f = 1; f < n; f++) {
  const a = cols[f - 1], b = cols[f]; let best = 0, bv = -Infinity; const sc = []
  for (let s = -70; s <= 70; s++) { let v = 0, c = 0; for (let y = 150; y < 950; y++) { const yy = y + s; if (yy < 0 || yy >= H) continue; v -= Math.abs(a[y] - b[yy]); c++ } v /= c; sc.push(v); if (v > bv) { bv = v; best = s } }
  const i = best + 70, l = sc[i - 1] ?? sc[i], r = sc[i + 1] ?? sc[i], d = l - 2 * sc[i] + r
  shifts.push(-(best + (d ? (l - r) / (2 * d) : 0)))
}
console.log('px por cuadro:', shifts.map(s => s.toFixed(1)).join(' '))
const segunda = shifts.slice(1).map((s, i) => Math.abs(s - shifts[i]))
console.log('salto máx entre cuadros vecinos:', Math.max(...segunda).toFixed(2), 'px')
