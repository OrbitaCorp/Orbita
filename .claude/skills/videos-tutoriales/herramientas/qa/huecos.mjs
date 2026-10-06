// Control de una PROMO antes de renderizar: huecos sin cuadros dentro de cada plano.
// El screencast manda cuadros solo cuando la pantalla CAMBIA: un hueco en una
// pantalla quieta no molesta; uno donde la imagen cambió (página ocupada cargando,
// animación pesada) se ve como un salto. Se comparan los dos cuadros del hueco
// (PSNR): ≥ 38 dB = quieta (ok); menos = salto (⚠). Los tramos con scroll
// compensado no cuentan (los arma el compositor).
//   node herramientas/qa/huecos.mjs compose/tl-<nombre>.json [umbral_s=0.12]
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ffmpegPath } from '../lib/deps.mjs'

const [archivo, umbralA = '0.12'] = process.argv.slice(2)
const tl = JSON.parse(fs.readFileSync(archivo, 'utf8')), umbral = Number(umbralA)
const ruta = f => path.resolve(path.dirname(archivo), f)
function psnr(a, b) {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-i', ruta(a), '-i', ruta(b), '-lavfi', '[0]scale=480:-2,format=gray[x];[1]scale=480:-2,format=gray[y];[x][y]psnr', '-f', 'null', '-'], { encoding: 'utf8' })
  const m = (r.stderr || '').match(/average:([\d.]+|inf)/)
  return m ? (m[1] === 'inf' ? 99 : Number(m[1])) : 0
}
let malos = 0
for (const p of tl.planos) {
  const T = tl.tomas[p.toma], vel = (p.s1 - p.s0) / (p.o1 - p.o0)
  if (Math.abs(p.s1 - p.s0) < .1) continue   // plano quieto
  const F = T.frames.filter(f => f.s >= p.s0 - .3 && f.s <= p.s1)
  for (let i = 1; i < F.length; i++) {
    const a = Math.max(F[i - 1].s, p.s0), b = F[i].s
    if (b <= p.s0) continue
    if (T.scrolls.some(sc => a >= sc.sStart - .05 && b <= sc.sEnd + .05)) continue
    const hueco = (b - a) / vel
    if (hueco <= umbral) continue
    const d = psnr(F[i - 1].f, F[i].f)
    if (d >= 38) continue
    malos++
    console.log(`⚠ ${p.id} (${p.toma} ${p.s0.toFixed(2)}→${p.s1.toFixed(2)}, salida ${p.o0.toFixed(2)}): salto de ${hueco.toFixed(2)} s en ${a.toFixed(2)} (PSNR ${d.toFixed(1)} dB)`)
  }
}
console.log(malos ? `${malos} saltos > ${umbral} s` : `Sin saltos > ${umbral} s ✓`)
