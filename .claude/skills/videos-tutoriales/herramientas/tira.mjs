// Tira de cuadros CRUDOS de una toma (para revisarla de un vistazo antes de editar):
// los cuadros más cercanos a cada tiempo (s desde 'inicio') o marca, uno al lado del otro.
//   node herramientas/tira.mjs <toma> <t|marca> [t|marca …] [--alto 640] → out/tira-<toma>.jpg
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { ffmpegPath } from './lib/deps.mjs'

const args = process.argv.slice(2)
const iAlto = args.indexOf('--alto'), alto = iAlto >= 0 ? Number(args.splice(iAlto, 2)[1]) : 640
const [toma, ...ts] = args
const L = JSON.parse(fs.readFileSync(`tomas/${toma}/log.json`, 'utf8'))
const t0 = L.log.find(e => e.type === 'mark' && e.name === 'inicio').t
const F = [...L.frames].sort((a, b) => a.s - b.s)
const marca = n => L.log.find(e => e.type === 'mark' && (e.name === n || e.foco === n))
const archivos = ts.map(t => {
  const abs = isNaN(Number(t)) ? marca(t)?.t : t0 + Number(t)
  if (abs == null) throw new Error('No encuentro la marca ' + t)
  let best = F[0]; for (const f of F) { if (f.s <= abs) best = f; else break }
  return `tomas/${toma}/${best.f}`
})
const ff = ['-y', '-loglevel', 'error', ...archivos.flatMap(a => ['-i', a]), '-filter_complex',
  archivos.map((_, i) => `[${i}]scale=-2:${alto}[a${i}]`).join(';') + ';' + archivos.map((_, i) => `[a${i}]`).join('') + `hstack=inputs=${archivos.length}`,
  `out/tira-${toma}.jpg`]
if (archivos.length === 1) ff.splice(ff.indexOf('-filter_complex'), 2, '-vf', `scale=-2:${alto}`)
await new Promise((res, rej) => spawn(ffmpegPath, ff, { stdio: 'inherit' }).on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))))
console.log(`out/tira-${toma}.jpg · ${ts.join(' ')}`)
