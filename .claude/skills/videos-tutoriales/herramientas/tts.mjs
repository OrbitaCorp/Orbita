// Narración con Gemini TTS: una frase por pedido → out/voz/<id>.wav y voz.json
// (el guion con la duración real de cada frase, para el editor con voz).
//
//   GEMINI_KEY_FILE=<ruta/.env> node herramientas/tts.mjs [guion.json]
//   SOLO=id1,id2 …   regenera solo esas frases (no reescribe voz.json)
//   MODELO=…         fuerza un modelo (por defecto: el Flash TTS estándar más nuevo)
//
// IMPORTANTE: NO mandar instrucciones de estilo en el texto ("Leé con tono…",
// "Say warmly: …"): el modelo las LEE en voz alta (frases de 3 s salían de 15 s).
// El acento se fija con speechConfig.languageCode = 'es-AR'; el voseo del guion
// hace el resto. systemInstruction no está habilitado en estos modelos.
import fs from 'node:fs'

function clave() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  const f = process.env.GEMINI_KEY_FILE
  if (f && fs.existsSync(f)) {
    const m = fs.readFileSync(f, 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)/m)
    if (m) return m[1].trim()
  }
  throw new Error('Falta la clave: GEMINI_API_KEY o GEMINI_KEY_FILE=<archivo .env con GEMINI_API_KEY=…> (pedila a la persona; nunca la busques por tu cuenta)')
}
const KEY = clave()
const API = 'https://generativelanguage.googleapis.com/v1beta'
const GUION = process.argv[2] ?? 'guion.json'
const G = JSON.parse(fs.readFileSync(GUION, 'utf8'))
const SOLO = process.env.SOLO
// guion.json → voz.json; guion-avanzado.json → voz-avanzado.json
const VOZ_OUT = process.env.VOZ ?? GUION.replace(/guion/, 'voz')
fs.mkdirSync('out/voz', { recursive: true })

async function modelo() {
  if (process.env.MODELO) return process.env.MODELO
  const r = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': KEY } })
  if (!r.ok) throw new Error('No pude listar modelos: ' + r.status)
  const nombres = (await r.json()).models.map(m => m.name.replace('models/', '')).filter(n => /tts/i.test(n))
  // Flash estándar (ni lite ni preview ni pro): buena calidad sin ser el más caro
  const estandar = nombres.filter(n => /flash-tts$/.test(n)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  const elegido = estandar[0] ?? nombres.find(n => /flash/.test(n)) ?? nombres[0]
  console.log('Modelos TTS disponibles:', nombres.join(', '), '→', elegido)
  return elegido
}
async function decir(mod, voz, texto) {
  for (let intento = 1; intento <= 4; intento++) {
    const r = await fetch(`${API}/models/${mod}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: texto }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { languageCode: G.idioma ?? 'es-AR', voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } } },
      }),
    })
    if (r.ok) {
      const j = await r.json()
      const p = j.candidates?.[0]?.content?.parts?.find(x => x.inlineData)
      if (!p) throw new Error('Respuesta sin audio: ' + JSON.stringify(j).slice(0, 300))
      return { pcm: Buffer.from(p.inlineData.data, 'base64'), rate: Number((p.inlineData.mimeType.match(/rate=(\d+)/) || [])[1] || 24000), tokens: j.usageMetadata?.candidatesTokenCount ?? 0 }
    }
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 2000 * intento)); continue }
    throw new Error(`TTS ${r.status}: ${(await r.text()).slice(0, 300)}`)
  }
  throw new Error('TTS: demasiados reintentos')
}
function recortar(pcm, rate) {
  const n = pcm.length / 2, th = 32768 * Math.pow(10, -45 / 20), win = Math.round(rate * .01)
  const nivel = i => { let m = 0; for (let k = i; k < Math.min(n, i + win); k++) m = Math.max(m, Math.abs(pcm.readInt16LE(k * 2))); return m }
  let a = 0; while (a < n && nivel(a) < th) a += win
  let b = n; while (b > a && nivel(Math.max(0, b - win)) < th) b -= win
  return pcm.subarray(Math.max(0, a - Math.round(rate * .04)) * 2, Math.min(n, b + Math.round(rate * .04)) * 2)
}
function wav(pcm, rate) {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24)
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

const mod = await modelo()
const voz = G.voz ?? 'Achird'
const frases = []
let tokens = 0
for (const fr of G.frases.filter(f => !SOLO || SOLO.split(',').includes(f.id))) {
  const r = await decir(mod, voz, fr.texto)
  tokens += r.tokens
  const rec = recortar(r.pcm, r.rate)
  fs.writeFileSync(`out/voz/${fr.id}.wav`, wav(rec, r.rate))
  const dur = rec.length / 2 / r.rate
  frases.push({ ...fr, dur: +dur.toFixed(3) })
  // una frase corta no debería durar más de ~0,6 s por palabra: si pasa, leyó algo de más
  const palabras = fr.texto.split(/\s+/).length
  console.log(`${fr.id.padEnd(12)} ${dur.toFixed(2)} s${dur > palabras * .6 + 1.5 ? '  ⚠ demasiado larga: ¿leyó algo de más?' : ''}  ${fr.texto}`)
}
if (!SOLO) fs.writeFileSync(VOZ_OUT, JSON.stringify({ voz, modelo: mod, frases }, null, 1))
else {
  // rearmar voz.json en el orden del guion: duraciones nuevas para las frases
  // regeneradas, las de antes para el resto (frases sin audio → aviso)
  const viejo = fs.existsSync(VOZ_OUT) ? JSON.parse(fs.readFileSync(VOZ_OUT, 'utf8')) : { frases: [] }
  const dur = id => frases.find(f => f.id === id)?.dur ?? viejo.frases.find(f => f.id === id)?.dur
  // las frases que no se regeneraron conservan lo que ya tenían (p. ej. 'tramos' de tramos-voz.mjs)
  const nuevas = new Set(frases.map(f => f.id))
  const todas = G.frases.map(fr => ({ ...(nuevas.has(fr.id) ? {} : viejo.frases.find(f => f.id === fr.id) ?? {}), ...fr, dur: dur(fr.id) }))
  for (const f of todas) if (f.dur == null) console.warn('⚠ falta el audio de', f.id, '(generalo con SOLO=' + f.id + ')')
  fs.writeFileSync(VOZ_OUT, JSON.stringify({ voz, modelo: mod, frases: todas }, null, 1))
}
console.log(`Listo · ${tokens} tokens de audio (≈ US$${(tokens * 9 / 1e6).toFixed(3)} con Flash TTS a US$9/M; verificá el precio vigente) · después: node herramientas/limpiar-voz.mjs`)
