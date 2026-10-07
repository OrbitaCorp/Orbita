// Analiza cada scroll de una toma → out/scrolls-<toma>.json
// Mide la posición REAL del contenido en cada cuadro (correlación de 8 columnas
// dentro de la zona que se mueve). El compositor usa esto para dibujar un
// scroll suave exacto (compensación de movimiento): los cuadros del screencast
// llegan con demoras variables y mostrados "por tiempo" el scroll se ve trabado.
//   node herramientas/scrolls.mjs <toma>
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ffmpegPath } from './lib/deps.mjs'
import { ZONAS } from './lib/grabador.mjs'

const toma = process.argv[2]
if (!toma) { console.log('Uso: node herramientas/scrolls.mjs <toma>'); process.exit(1) }
const L = JSON.parse(fs.readFileSync(`tomas/${toma}/log.json`, 'utf8'))
const t0 = L.log.find(e => e.type === 'mark' && e.name === 'inicio').t
// vista de la toma (1440×900 en computadora, 390×844 en celular): se analiza a 2 px por px CSS
const vista = L.log.find(e => e.type === 'vista') ?? { w: 1440, h: 900 }
const S2 = 2, H = vista.h * S2, NC = 8
fs.mkdirSync('out', { recursive: true })
const res = []
for (const e of L.log.filter(x => x.type === 'scroll' && x.t1)) {
  const zona = e.zona ?? ZONAS.panel
  if (Math.abs(e.real ?? e.dy) < 6) { console.log(`${e.label.padEnd(20)} sin movimiento (ya estaba en el borde)`); continue }
  // ventana amplia: los últimos cuadros del scroll pueden llegar ~0,5 s tarde
  const fr = L.frames.filter(f => f.s >= e.t - .15 && f.s <= e.t1 + .9).sort((a, b) => a.s - b.s)
  const abs = f => path.resolve('tomas', toma, f).split(path.sep).join('/')
  fs.writeFileSync('out/lista-scroll.txt', fr.map(f => `file '${abs(f.f)}'\nduration 0.01`).join('\n'))
  const cols = Array.from({ length: NC }, (_, i) => zona.x + zona.w * (i + .5) / NC)
    .filter(x => !(zona.fijos ?? []).some(f => x >= f.x - 4 && x <= f.x + f.w + 4)).map(x => Math.round(x * S2))
  const NK = cols.length
  const buf = await new Promise((ok, mal) => {
    const ch = []
    const vf = `scale=${vista.w * S2}:${vista.h * S2},format=gray,split=${NK}` + cols.map((_, i) => `[s${i}]`).join('') + ';' + cols.map((x, i) => `[s${i}]crop=1:${H}:${x}:0[c${i}]`).join(';') + ';' + cols.map((_, i) => `[c${i}]`).join('') + `hstack=${NK}`
    const p = spawn(ffmpegPath, ['-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'out/lista-scroll.txt', '-filter_complex', vf, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'])
    p.stdout.on('data', d => ch.push(d)); p.on('close', c => c === 0 ? ok(Buffer.concat(ch)) : mal(new Error('ffmpeg ' + c)))
  })
  const n = Math.min(fr.length, buf.length / (NK * H))
  const px = (f, k, y) => buf[f * NK * H + y * NK + k]
  const y0 = Math.round((zona.y + 20) * S2), y1 = Math.round((zona.y + zona.h - 20) * S2)
  // 1) acumulado cuadro a cuadro
  let pos = 0
  const P = [0]
  for (let f = 1; f < n; f++) {
    let best = 0, bv = -Infinity
    const sc = []
    for (let s = -260; s <= 260; s++) {
      let v = 0, c = 0
      for (let k = 0; k < NK; k++) for (let y = y0; y < y1; y += 2) { const yy = y + s; if (yy < y0 || yy >= y1) continue; v -= Math.abs(px(f - 1, k, y) - px(f, k, yy)); c++ }
      v /= c; sc.push(v); if (v > bv) { bv = v; best = s }
    }
    const i = best + 260, l = sc[i - 1] ?? sc[i], r = sc[i + 1] ?? sc[i], d = l - 2 * sc[i] + r
    pos += -(best + (best === 0 ? 0 : d ? (l - r) / (2 * d) : 0)) / S2
    P.push(pos)
  }
  // 2) refinar contra referencias FIJAS (primer y último cuadro), mezcladas de a poco
  const medir = (f, ref, pred) => {
    let best = pred, bv = -Infinity
    const sc = new Map()
    for (let s = pred - 14; s <= pred + 14; s++) {
      let v = 0, c = 0
      for (let k = 0; k < NK; k++) for (let y = y0; y < y1; y++) { const yy = y + s; if (yy < y0 || yy >= y1) continue; v -= Math.abs(px(ref, k, yy) - px(f, k, y)); c++ }
      if (c < 600) continue
      v /= c; sc.set(s, v); if (v > bv) { bv = v; best = s }
    }
    const l = sc.get(best - 1), r = sc.get(best + 1), m = sc.get(best), d = (l ?? m) - 2 * m + (r ?? m)
    return best + (d && l != null && r != null ? (l - r) / (2 * d) : 0)
  }
  const Pacc = [...P], last = n - 1, Yacc = Pacc[last]
  for (let f = 1; f < n; f++) {
    const u = Yacc ? Pacc[f] / Yacc : 0, w = Math.max(0, Math.min(1, (u - .25) / .5))
    const pI = w < 1 ? medir(f, 0, Math.round(Pacc[f] * S2)) / S2 : 0
    const pF = w > 0 ? Yacc - medir(last, f, Math.round((Yacc - Pacc[f]) * S2)) / S2 : 0
    P[f] = (1 - w) * pI + w * pF
  }
  const Y = Math.abs(e.real ?? e.dy), total = P[P.length - 1], k = total ? Y / total : 1
  const frames = fr.slice(0, n).map((f, i) => ({ f: `../tomas/${toma}/${f.f}`, s: f.s - t0, P: +(P[i] * k).toFixed(2) }))
  const quietos = frames.filter(f => f.P < .6)
  const sStart = (quietos.length ? quietos[quietos.length - 1] : frames[0]).s
  const finF = frames.find(f => f.P > Y - .6) ?? frames[frames.length - 1]
  res.push({ label: e.label, Y, zona, ms: e.ms, sStart, sEnd: finF.s, escala: +k.toFixed(4), frames })
  const aviso = Math.abs(total - Y) > Math.max(8, Y * .03) ? '  ⚠ revisar: la medición difiere del scroll real (¿cuadros tardíos fuera de la ventana? ¿zona mal elegida?)' : ''
  console.log(`${e.label.padEnd(20)} Y=${Y.toFixed(0)}px  medido=${total.toFixed(1)}px (×${k.toFixed(3)})  ${frames.length} cuadros${aviso}`)
}
fs.writeFileSync(`out/scrolls-${toma}.json`, JSON.stringify(res))
console.log(`→ out/scrolls-${toma}.json`)
