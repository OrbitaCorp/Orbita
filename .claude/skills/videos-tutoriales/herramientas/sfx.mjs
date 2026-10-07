// Sintetiza los efectos de sonido y los mezcla en out/sfx.wav (48 kHz, estéreo).
// Todo se genera por código: sin archivos de terceros ni licencias.
import fs from 'node:fs'

const SR = 48000
//   node herramientas/sfx.mjs [out/sfx.json] [out/sfx.wav]
const IN = process.argv[2] ?? 'out/sfx.json', OUTWAV = process.argv[3] ?? IN.replace(/\.json$/, '.wav')
const { duration, events } = JSON.parse(fs.readFileSync(IN, 'utf8'))
const N = Math.ceil((duration + 1) * SR)
const L = new Float32Array(N), R = new Float32Array(N)
const FX_L = new Float32Array(N), FX_R = new Float32Array(N)   // envío a "sala"

// Ruido determinístico (mismo resultado en cada render)
let seed = 1234567
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const noise = () => rnd() * 2 - 1

// Biquad (RBJ) — devuelve una función de muestra
function biquad(type, f, q = .707, gainDb = 0) {
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0
  const set = (freq) => {
    const w = 2 * Math.PI * Math.min(freq, SR * .45) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q)
    let a0
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al }
    else { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al } // bp
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0
  }
  set(f)
  const fn = x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y }
  fn.set = set
  return fn
}
const buf = sec => new Float32Array(Math.ceil(sec * SR))

// ── Sonidos ───────────────────────────────────────────────────────────────
function click() {
  // clic de mouse: "press" + "release", transitorio filtrado y un cuerpo corto
  const b = buf(.11)
  const hit = (off, g) => {
    const hp = biquad('hp', 2500), bp = biquad('bp', 4200, 3)
    for (let i = 0; i < SR * .03; i++) {
      const t = i / SR, e = Math.exp(-t / .0035)
      const body = Math.sin(2 * Math.PI * 1650 * t) * Math.exp(-t / .006) * .35
      const thock = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t / .009) * .25
      b[off + i] += g * (hp(noise()) * e * .7 + bp(noise()) * e * .5 + body + thock)
    }
  }
  hit(0, 1); hit(Math.floor(SR * .058), .45)
  return b
}
function key(p = 1) {
  const b = buf(.07), bp = biquad('bp', 2600 * p, 1.4), lp = biquad('lp', 5000)
  for (let i = 0; i < b.length; i++) {
    const t = i / SR, e = Math.exp(-t / .006)
    b[i] = lp(bp(noise()) * e * 1.1 + Math.sin(2 * Math.PI * 320 * p * t) * Math.exp(-t / .012) * .35)
  }
  return b
}
function tick() {
  const b = buf(.02), hp = biquad('hp', 3500)
  for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = hp(noise()) * Math.exp(-t / .0018) * .9 + Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t / .003) * .2 }
  return b
}
function pop(p = 1) {
  const b = buf(.12)
  let ph = 0
  for (let i = 0; i < b.length; i++) {
    const t = i / SR, f = (520 + 520 * Math.exp(-t / .018)) * p
    ph += 2 * Math.PI * f / SR
    b[i] = Math.sin(ph) * Math.exp(-t / .03) * (1 - Math.exp(-t / .0015)) * .8
  }
  return b
}
function sweep(dur, f0, f1, q, g) {
  const b = buf(dur), bp = biquad('bp', f0, q), lp = biquad('lp', 6000)
  for (let i = 0; i < b.length; i++) {
    const u = i / b.length
    if (i % 32 === 0) bp.set(f0 * Math.pow(f1 / f0, u))
    const env = Math.sin(Math.PI * Math.pow(u, .7)) ** 2
    b[i] = lp(bp(noise())) * env * g
  }
  return b
}
const whoosh = (dur = 1) => sweep(dur, 300, 2600, 1.1, 1.6)
const swoosh = (dur = .7) => sweep(dur, 1800, 700, 1.4, 1.2)
function bell(b, off, f, g, dec) {
  for (let i = 0; off + i < b.length; i++) {
    const t = i / SR, e = Math.exp(-t / dec) * (1 - Math.exp(-t / .002))
    b[off + i] += g * e * (Math.sin(2 * Math.PI * f * t) + .28 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t / (dec * .4)) + .12 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t / (dec * .2)))
  }
}
function sparkle(p = 1) {
  const b = buf(1.4)
  ;[1318.5, 1661.2, 1975.5, 2637].forEach((f, i) => bell(b, Math.floor(SR * i * .055), f * p, .3 - i * .04, .35))
  // brillo de ruido agudo
  const hp = biquad('hp', 7000)
  for (let i = 0; i < SR * .5; i++) { const t = i / SR; b[i] += hp(noise()) * Math.exp(-t / .12) * .05 * Math.min(1, t / .02) }
  return b
}
function success() {
  const b = buf(1.8)
  bell(b, 0, 783.99, .32, .5)            // G5
  bell(b, Math.floor(SR * .11), 1174.66, .3, .7)   // D6
  bell(b, Math.floor(SR * .11), 1567.98, .12, .6)  // G6 (octava, suave)
  return b
}
function thump() {
  const b = buf(.5)
  let ph = 0
  for (let i = 0; i < b.length; i++) {
    const t = i / SR, f = 55 + 70 * Math.exp(-t / .04)
    ph += 2 * Math.PI * f / SR
    b[i] = Math.sin(ph) * Math.exp(-t / .16) * (1 - Math.exp(-t / .004)) * .9
  }
  return b
}
function shimmer(dur = .9) {
  const b = sweep(dur, 1500, 7000, 2.2, .7)
  const notas = [2093, 2637, 3136, 4186]
  notas.forEach((f, i) => bell(b, Math.floor(SR * (dur * .15 + i * dur * .16)), f, .07, .25))
  return b
}

// ── Mezcla ────────────────────────────────────────────────────────────────
const conSala = new Set(['sparkle', 'success', 'shimmer', 'thump', 'pop'])
function mezclar(b, t, gain, pan = 0) {
  const off = Math.floor(t * SR)
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr = gain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2
  for (let i = 0; i < b.length && off + i < N; i++) { L[off + i] += b[i] * gl; R[off + i] += b[i] * gr }
  return { off, gl, gr }
}
for (const e of events) {
  const v = 1 + (rnd() - .5) * .16   // variación leve de volumen
  let b
  switch (e.kind) {
    case 'click': b = click(); break
    case 'key': b = key(.9 + rnd() * .22); break
    case 'tick': b = tick(); break
    case 'pop': b = pop(e.pitch ?? 1); break
    case 'whoosh': b = whoosh(e.dur); break
    case 'swoosh': b = swoosh(e.dur); break
    case 'sparkle': b = sparkle(e.pitch ?? 1); break
    case 'success': b = success(); break
    case 'thump': b = thump(); break
    case 'shimmer': b = shimmer(e.dur); break
    default: continue
  }
  const g = e.gain * v * ({ click: .55, key: .32, tick: .22, pop: .5, whoosh: .35, swoosh: .3, sparkle: .55, success: .6, thump: .7, shimmer: .45 })[e.kind]
  mezclar(b, e.t, g, e.pan ?? 0)
  if (conSala.has(e.kind)) {
    const off = Math.floor(e.t * SR)
    for (let i = 0; i < b.length && off + i < N; i++) { FX_L[off + i] += b[i] * g * .5; FX_R[off + i] += b[i] * g * .5 }
  }
}
// "Sala": reflexiones tempranas cruzadas + cola corta
const taps = [[.019, .32, 0], [.031, .27, 1], [.047, .22, 0], [.071, .18, 1], [.097, .14, 0], [.131, .1, 1], [.17, .07, 0]]
const lpL = biquad('lp', 4500), lpR = biquad('lp', 4500)
for (let i = 0; i < N; i++) {
  let wl = 0, wr = 0
  for (const [d, g, side] of taps) {
    const j = i - Math.floor(d * SR)
    if (j < 0) continue
    if (side) { wl += FX_R[j] * g; wr += FX_L[j] * g } else { wl += FX_L[j] * g; wr += FX_R[j] * g }
  }
  L[i] += lpL(wl); R[i] += lpR(wr)
}
// Normalizar a -4,5 dBFS de pico (con margen para los picos que agrega el AAC) y limitar suave
let peak = 0
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
const k = peak > 0 ? Math.pow(10, -4.5 / 20) / peak : 1
const out = Buffer.alloc(44 + N * 4)
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12)
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24)
out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40)
for (let i = 0; i < N; i++) {
  const l = Math.tanh(L[i] * k * 1.05) / Math.tanh(1.05), r = Math.tanh(R[i] * k * 1.05) / Math.tanh(1.05)
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l)) * 32767), 44 + i * 4)
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r)) * 32767), 46 + i * 4)
}
fs.writeFileSync(OUTWAV, out)
console.log(`${OUTWAV}: ${duration.toFixed(1)} s, ${events.length} efectos, pico original ${peak.toFixed(2)}`)
