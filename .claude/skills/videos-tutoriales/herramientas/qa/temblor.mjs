// Mide el temblor de un zoom: ubica con precisión subpíxel el borde izquierdo
// de la ventana (fondo oscuro → panel claro) en la fila y=Y, cuadro por cuadro,
// y calcula cuánto se aparta cada posición del promedio de sus vecinas
// (en un movimiento suave eso es ~0; el redondeo a píxeles enteros lo sube).
//   node herramientas/qa/temblor.mjs <video> <desde> <hasta> [y]
// Umbral: RMS < 0,5 px (un movimiento suave real da ~0,25 px). Elegí una fila
// y que cruce el borde izquierdo de la ventana sobre el fondo oscuro.
import { spawn } from 'node:child_process'
import { ffmpegPath } from '../lib/deps.mjs'

const [video, desde, hasta, yArg] = process.argv.slice(2)
const Y = Number(yArg ?? 700), W = 1920
const buf = await new Promise((res, rej) => {
  const ch = []
  const p = spawn(ffmpegPath, ['-loglevel', 'error', '-ss', desde, '-to', hasta, '-i', video, '-vf', `crop=${W}:1:0:${Y},format=gray`, '-f', 'rawvideo', '-'])
  p.stdout.on('data', d => ch.push(d)); p.on('close', c => c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ffmpeg ' + c)))
})
const n = buf.length / W, xs = []
for (let f = 0; f < n; f++) {
  const row = buf.subarray(f * W, (f + 1) * W)
  // cruce del umbral con fondo oscuro a la izquierda y panel claro a la derecha,
  // buscado cerca del borde del cuadro anterior (seguimiento)
  const prev = xs.length ? xs[xs.length - 1] : NaN
  const lo = isFinite(prev) ? Math.max(8, Math.floor(prev - 60)) : 8, hi = isFinite(prev) ? Math.min(W - 8, Math.ceil(prev + 60)) : W - 8
  let x = NaN
  for (let i = lo; i < hi; i++) {
    if (row[i - 1] < 128 && row[i] >= 128) {
      const izq = (row[i - 6] + row[i - 5] + row[i - 4]) / 3, der = (row[i + 3] + row[i + 4] + row[i + 5]) / 3
      if (izq < 90 && der > 170) { x = i - 1 + (128 - row[i - 1]) / (row[i] - row[i - 1]); break }
    }
  }
  xs.push(x)
}
const r = []
for (let i = 1; i < xs.length - 1; i++) if (isFinite(xs[i - 1]) && isFinite(xs[i]) && isFinite(xs[i + 1]) && xs[i] > 2) r.push(xs[i] - (xs[i - 1] + xs[i + 1]) / 2)
const rms = Math.sqrt(r.reduce((a, b) => a + b * b, 0) / Math.max(1, r.length))
console.log(`${video} ${desde}→${hasta}s: ${n} cuadros, borde de ${xs[0]?.toFixed(1)} a ${xs.at(-1)?.toFixed(1)} px, temblor RMS = ${rms.toFixed(3)} px (máx ${Math.max(...r.map(Math.abs)).toFixed(2)})`)
