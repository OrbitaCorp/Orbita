// Tramos con voz dentro de cada frase (out/voz/<id>.wav): dónde empieza y
// termina cada grupo de palabras separado por una pausa. Sirve para sincronizar
// cortes con palabras (p. ej. una portada por "¿Ferretería? ¿Pet shop?…") y
// para achicar pausas internas largas.
//   node herramientas/tramos-voz.mjs <voz.json> [--pausa 0.22] [--achicar 0.16] [--tempo 1.08]
//   --achicar s: deja cada pausa interna más larga que --pausa en s segundos (reescribe el wav)
//   --tempo k:  acelera la voz k veces sin cambiar el tono (ffmpeg atempo; reescribe el wav)
// Escribe los tramos en voz.json (frase.tramos = [[a, b], …] en segundos) y actualiza dur.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { ffmpegPath } from './lib/deps.mjs'

const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? Number(args[i + 1]) : d }
const VOZ = args.find(a => a.endsWith('.json')) ?? 'voz.json'
const PAUSA = opt('pausa', .22), ACHICAR = opt('achicar', null), TEMPO = opt('tempo', null)
const SOLO = process.env.SOLO?.split(',')
const V = JSON.parse(fs.readFileSync(VOZ, 'utf8'))

// WAV PCM 16 bits mono: busca el bloque 'data' (ffmpeg agrega 'LIST' y el encabezado no siempre mide 44 bytes)
function leer(archivo) {
  const raw = fs.readFileSync(archivo)
  let p = 12, rate = 24000, data = null
  while (p + 8 <= raw.length) {
    const id = raw.toString('ascii', p, p + 4), len = raw.readUInt32LE(p + 4)
    if (id === 'fmt ') rate = raw.readUInt32LE(p + 12)
    if (id === 'data') { data = raw.subarray(p + 8, p + 8 + len); break }
    p += 8 + len + (len % 2)
  }
  if (!data) throw new Error('WAV sin datos: ' + archivo)
  // se normaliza a un encabezado canónico de 44 bytes
  const b = Buffer.concat([cabecera(data.length, rate), data])
  return { b, rate, n: data.length / 2 }
}
function cabecera(len, rate) {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + len, 4); h.write('WAVE', 8); h.write('fmt ', 12)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24)
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(len, 40)
  return h
}
function tramos({ b, rate, n }) {
  const win = Math.round(rate * .01), nv = Math.ceil(n / win), on = []
  for (let v = 0; v < nv; v++) { let s = 0; const a = v * win, z = Math.min(n, a + win); for (let k = a; k < z; k++) { const x = b.readInt16LE(44 + k * 2); s += x * x } on.push(10 * Math.log10(s / (z - a) / 1073741824 + 1e-12) > -38) }
  const T = []
  for (let v = 0; v < nv; v++) { if (!on[v]) continue; const u = T.at(-1); if (u && (v - u[1]) * .01 < PAUSA) u[1] = v + 1; else T.push([v, v + 1]) }
  return T.filter(([a, z]) => (z - a) * .01 >= .06).map(([a, z]) => [+(a * .01).toFixed(2), +(z * .01).toFixed(2)])
}
for (const fr of V.frases.filter(f => !SOLO || SOLO.includes(f.id))) {
  const archivo = `out/voz/${fr.id}.wav`
  if (TEMPO && TEMPO !== 1) {
    const tmp = archivo.replace(/\.wav$/, '.tmp.wav')
    execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', archivo, '-af', `atempo=${TEMPO}`, '-ac', '1', '-c:a', 'pcm_s16le', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', tmp]); fs.renameSync(tmp, archivo)
  }
  let w = leer(archivo), T = tramos(w)
  if (ACHICAR != null && T.length > 1) {
    const partes = [], aire = Math.round(w.rate * ACHICAR)
    T.forEach(([a, z], i) => {
      const A = Math.max(0, Math.round((a - .03) * w.rate)), Z = Math.min(w.n, Math.round((z + .03) * w.rate))
      partes.push(w.b.subarray(44 + A * 2, 44 + Z * 2)); if (i < T.length - 1) partes.push(Buffer.alloc(aire * 2))
    })
    const pcm = Buffer.concat(partes)
    fs.writeFileSync(archivo, Buffer.concat([cabecera(pcm.length, w.rate), pcm])); w = leer(archivo); T = tramos(w)
  }
  fs.writeFileSync(archivo, w.b)   // deja el WAV con encabezado canónico
  fr.dur = +(w.n / w.rate).toFixed(3); fr.tramos = T
  console.log(`${fr.id.padEnd(6)} ${fr.dur.toFixed(2)} s  ${T.map(([a, z]) => `${a.toFixed(2)}–${z.toFixed(2)}`).join('  ')}`)
}
fs.writeFileSync(VOZ, JSON.stringify(V, null, 1))
