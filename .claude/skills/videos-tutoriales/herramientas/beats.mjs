// Pulso de un tema musical: tempo (BPM), golpes y un buen punto de arranque.
// → out/musica-beats.json y out/musica.json (lo que usan editar-*.mjs y mezclar-promo.mjs)
//   node herramientas/beats.mjs musica/tema.mp3 [--desde s] [--gain 0.5]
// Sin --desde elige el primer compás donde el tema ya está "arriba" (energía alta
// sostenida 8 s): un reel no puede arrancar con la intro tranquila del tema.
// El editor corre cada corte entre planos al pulso más cercano (P.alinear).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { ffmpegPath } from './lib/deps.mjs'

const args = process.argv.slice(2)
const archivo = args.find(a => !a.startsWith('--') && !/^\d/.test(a))
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? Number(args[i + 1]) : d }
if (!archivo) { console.log('Uso: node herramientas/beats.mjs musica/tema.mp3 [--desde s] [--gain 0.5]'); process.exit(1) }
const SR = 22050, HOP = 256
const raw = execFileSync(ffmpegPath, ['-loglevel', 'error', '-i', archivo, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 })
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4)
const dur = x.length / SR

// envolventes: graves (bombo) y total, por ventanas de HOP muestras
function biquad(type, f, q = .707) {
  const w = 2 * Math.PI * f / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q)
  let b0, b1, b2, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2 } else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2 }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  return v => { const y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = v; y2 = y1; y1 = y; return y }
}
const lp = biquad('lp', 160), hp = biquad('hp', 2000)
const N = Math.floor(x.length / HOP), eLow = new Float32Array(N), eHi = new Float32Array(N), eAll = new Float32Array(N)
for (let i = 0; i < N; i++) {
  let a = 0, b = 0, c = 0
  for (let k = i * HOP; k < (i + 1) * HOP; k++) { const v = x[k], l = lp(v), h = hp(v); a += l * l; b += h * h; c += v * v }
  eLow[i] = Math.sqrt(a / HOP); eHi[i] = Math.sqrt(b / HOP); eAll[i] = Math.sqrt(c / HOP)
}
// fuerza de ataque (flujo positivo, en log)
const onset = new Float32Array(N)
for (let i = 1; i < N; i++) onset[i] = Math.max(0, Math.log1p(80 * eLow[i]) - Math.log1p(80 * eLow[i - 1])) * 1.4 + Math.max(0, Math.log1p(200 * eHi[i]) - Math.log1p(200 * eHi[i - 1]))
const fps = SR / HOP
// tempo: la grilla (tempo + fase) con más ataque PROMEDIO por golpe, entre 70 y 180 BPM.
// Una preferencia fija (p. ej. "cerca de 118") eligió 112 en un tema de 140: no usar.
const peine = (b, paso = .006) => {
  const per = 60 / b; let mejor = 0
  for (let ph = 0; ph < per; ph += paso) { let v = 0, n = 0; for (let t = ph; t < dur; t += per) { const i = Math.round(t * fps); v += (onset[i] ?? 0) + .5 * ((onset[i - 1] ?? 0) + (onset[i + 1] ?? 0)); n++ } mejor = Math.max(mejor, v / n) }
  return mejor
}
let best = { bpm: 120, v: -1 }
for (let b = 70; b <= 180; b += .5) { const v = peine(b); if (v > best.v) best = { bpm: b, v } }
// octava: un tema con golpe fuerte cada dos tiempos da la MITAD del tempo (70 en uno de 140)
if (best.bpm < 95 && peine(best.bpm * 2) > .5 * best.v) best = { bpm: best.bpm * 2, v: peine(best.bpm * 2) }
if (best.bpm > 165 && peine(best.bpm / 2) > .9 * best.v) best = { bpm: best.bpm / 2, v: peine(best.bpm / 2) }
// ajuste fino conjunto de tempo y fase sobre TODO el tema (un error de 0,5 % ya
// corre medio segundo al minuto): la grilla que más energía de ataque junta
const sm = new Float32Array(N); for (let i = 1; i < N - 1; i++) sm[i] = onset[i] + .5 * (onset[i - 1] + onset[i + 1])
const en = t => { const f = t * fps, i = Math.floor(f), u = f - i; return (sm[i] ?? 0) * (1 - u) + (sm[i + 1] ?? 0) * u }
let fino = { bpm: best.bpm, fase: 0, v: -1 }
for (let b = best.bpm - 1.6; b <= best.bpm + 1.6; b += .01) {
  const per = 60 / b
  for (let ph = 0; ph < per; ph += .004) { let v = 0; for (let t = ph; t < dur; t += per) v += en(t); if (v > fino.v) fino = { bpm: b, fase: ph, v } }
}
const bpm = +fino.bpm.toFixed(2), periodo = 60 / fino.bpm, fase = fino.fase
const golpes = []; for (let t = fase; t < dur; t += periodo) golpes.push(+t.toFixed(3))
// compás: de los 4 golpes posibles, el "1" es el que tiene más graves
let c1 = 0, cv = -1
for (let k = 0; k < 4; k++) { let v = 0; for (let j = k; j < golpes.length; j += 4) v += eLow[Math.round(golpes[j] * fps)] ?? 0; if (v > cv) { cv = v; c1 = k } }
const compases = golpes.filter((_, j) => j % 4 === c1)
// punto de arranque: primer compás con energía alta sostenida (8 s)
const media = (a, b) => { let s = 0, n = 0; for (let i = Math.floor(a * fps); i < Math.min(N, b * fps); i++) { s += eAll[i]; n++ } return n ? s / n : 0 }
const niveles = compases.map(t => media(t, t + 8)), orden = [...niveles].sort((a, b) => a - b), p75 = orden[Math.floor(orden.length * .75)] ?? 0
let desde = opt('desde', null)
if (desde == null) { const k = compases.findIndex((t, i) => niveles[i] >= p75 * .92 && t + 70 < dur); desde = compases[Math.max(0, k)] ?? 0 }
const offset = +(((golpes.find(g => g >= desde - 1e-3) ?? desde) - desde)).toFixed(3)
fs.mkdirSync('out', { recursive: true })
fs.writeFileSync('out/musica-beats.json', JSON.stringify({ archivo, dur: +dur.toFixed(2), bpm, fase: +fase.toFixed(3), golpes, compases }, null, 1))
const musica = { archivo, desde: +desde.toFixed(3), gain: opt('gain', .5), bpm, offset }
fs.writeFileSync('out/musica.json', JSON.stringify(musica, null, 1))
console.log(`${archivo}: ${dur.toFixed(1)} s · ${bpm} BPM · primer golpe ${fase.toFixed(2)} s · arranca en ${desde.toFixed(2)} s (compás con energía alta)`)
console.log('→ out/musica.json', JSON.stringify(musica))
