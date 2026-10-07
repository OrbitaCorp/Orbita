// Limpia los bordes de cada frase: descarta ruidos cortos (respiración, clic)
// separados de la voz por una pausa, al principio y al final. Reescribe
// out/voz/<id>.wav y actualiza las duraciones en voz.json.
import fs from 'node:fs'

const VOZ = process.argv[2] ?? 'voz.json'   // node herramientas/limpiar-voz.mjs [voz-avanzado.json]
const V = JSON.parse(fs.readFileSync(VOZ, 'utf8'))
const UMBRAL = -35, MIN_TRAMO = .25, MIN_PAUSA = .18, AIRE = .05
// SOLO=id1,id2 limpia solo esas (las demás ya están limpias: no recortar dos veces)
const SOLO = process.env.SOLO?.split(',')
for (const fr of V.frases.filter(f => !SOLO || SOLO.includes(f.id))) {
  const archivo = `out/voz/${fr.id}.wav`
  const b = fs.readFileSync(archivo), rate = b.readUInt32LE(24), n = (b.length - 44) / 2
  const win = Math.round(rate * .01), nv = Math.ceil(n / win), voz = []
  for (let v = 0; v < nv; v++) {
    let s = 0; const a = v * win, z = Math.min(n, a + win)
    for (let k = a; k < z; k++) { const x = b.readInt16LE(44 + k * 2); s += x * x }
    voz.push(10 * Math.log10(s / (z - a) / 1073741824 + 1e-12) > UMBRAL)
  }
  // tramos con voz (uniendo huecos cortos)
  const tramos = []
  for (let v = 0; v < nv; v++) {
    if (!voz[v]) continue
    const ult = tramos[tramos.length - 1]
    if (ult && (v - ult.z) * .01 < MIN_PAUSA) ult.z = v + 1
    else tramos.push({ a: v, z: v + 1 })
  }
  while (tramos.length > 1 && (tramos[0].z - tramos[0].a) * .01 < MIN_TRAMO) tramos.shift()
  while (tramos.length > 1 && (tramos.at(-1).z - tramos.at(-1).a) * .01 < MIN_TRAMO) tramos.pop()
  const a = Math.max(0, tramos[0].a * win - Math.round(AIRE * rate)), z = Math.min(n, tramos.at(-1).z * win + Math.round(AIRE * 2 * rate))
  const pcm = Buffer.from(b.subarray(44 + a * 2, 44 + z * 2))
  // fundidos de 8 ms en los bordes
  const fade = Math.round(rate * .008), m = pcm.length / 2
  for (let i = 0; i < fade; i++) {
    pcm.writeInt16LE(Math.round(pcm.readInt16LE(i * 2) * i / fade), i * 2)
    pcm.writeInt16LE(Math.round(pcm.readInt16LE((m - 1 - i) * 2) * i / fade), (m - 1 - i) * 2)
  }
  const h = Buffer.from(b.subarray(0, 44)); h.writeUInt32LE(36 + pcm.length, 4); h.writeUInt32LE(pcm.length, 40)
  fs.writeFileSync(archivo, Buffer.concat([h, pcm]))
  const antes = fr.dur
  fr.dur = +(m / rate).toFixed(3)
  console.log(`${fr.id.padEnd(11)} ${antes.toFixed(2)} → ${fr.dur.toFixed(2)} s`)
}
fs.writeFileSync(VOZ, JSON.stringify(V, null, 1))
console.log('Total voz:', V.frases.reduce((s, f) => s + f.dur, 0).toFixed(1), 's')
