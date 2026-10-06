// Mezcla de una PROMO: voz (out/voz/<id>.wav en out/voz-tiempos-<nombre>.json)
// + efectos (out/sfx-<nombre>.wav) + música (out/musica.json, opcional)
// → out/audio-<nombre>.wav
//   node herramientas/mezclar-promo.mjs <nombre>          (p. ej. reel-a, youtube)
//   SIN_VOZ=1 → solo música + efectos (versión para poner otra voz o subtítulos)
// out/musica.json: { "archivo": "musica/tema.mp3", "desde": 12.3, "gain": 0.55, "bpm": 120, "offset": 0.2 }
//   desde = segundo del tema donde arranca el video (elegido sobre un golpe fuerte)
// Música con "ducking": baja ~9 dB mientras habla la voz (sidechain). Final a -14 LUFS
// (lo que normalizan Instagram, TikTok y YouTube), pico ≤ -1,5 dBTP.
// alimiter va con level=disabled: si no, "auto-nivela" y la salida pega 0 dBFS.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { ffmpegPath } from './lib/deps.mjs'

const nombre = process.argv[2]
if (!nombre) { console.log('Uso: node herramientas/mezclar-promo.mjs <nombre>'); process.exit(1) }
const sinVoz = !!process.env.SIN_VOZ
const tiempos = sinVoz ? [] : JSON.parse(fs.readFileSync(`out/voz-tiempos-${nombre}.json`, 'utf8'))
const { duration } = JSON.parse(fs.readFileSync(`out/sfx-${nombre}.json`, 'utf8'))
const M = fs.existsSync('out/musica.json') ? JSON.parse(fs.readFileSync('out/musica.json', 'utf8')) : null
const D = duration.toFixed(3), ms = t => Math.round(t * 1000)

const args = ['-y', '-loglevel', 'error', '-i', `out/sfx-${nombre}.wav`]
tiempos.forEach(f => args.push('-i', `out/voz/${f.id}.wav`))
if (M) args.push('-ss', String(M.desde ?? 0), '-i', M.archivo)
const iM = 1 + tiempos.length
const f = []
if (tiempos.length) {
  f.push(...tiempos.map((v, i) => `[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms(v.t)}|${ms(v.t)}[v${i}]`))
  f.push(`${tiempos.map((_, i) => `[v${i}]`).join('')}amix=inputs=${tiempos.length}:normalize=0:dropout_transition=0,highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=6:release=110,loudnorm=I=-15:TP=-2:LRA=6,apad=whole_dur=${D}[voz]`)
  f.push(`[voz]asplit=3[voz1][voz2][voz3]`)
}
f.push(`[0:a]volume=0.42[fx0]`)
if (tiempos.length) f.push(`[fx0][voz2]sidechaincompress=threshold=0.03:ratio=3:attack=10:release=250[fx]`); else f.push(`[fx0]anull[fx]`)
let mezcla = tiempos.length ? ['[voz1]', '[fx]'] : ['[fx]']
if (M) {
  // fundido de entrada corto y de salida al final del cierre
  f.push(`[${iM}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${D},afade=t=in:d=0.25,afade=t=out:st=${(duration - 1.6).toFixed(3)}:d=1.6,volume=${M.gain ?? .5},loudnorm=I=-20:TP=-3:LRA=9[mus0]`)
  if (tiempos.length) f.push(`[mus0][voz3]sidechaincompress=threshold=0.02:ratio=5:attack=25:release=420:makeup=1[mus]`); else f.push(`[mus0]anull[mus]`)
  mezcla.push('[mus]')
} else if (tiempos.length) f.push('[voz3]anullsink')
f.push(`${mezcla.join('')}amix=inputs=${mezcla.length}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=8,alimiter=limit=0.84:level=disabled[out]`)
args.push('-filter_complex', f.join(';'), '-map', '[out]', '-ar', '48000', '-t', D, `out/audio-${nombre}${sinVoz ? '-sin-voz' : ''}.wav`)
await new Promise((res, rej) => spawn(ffmpegPath, args, { stdio: 'inherit' }).on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))))
console.log(`out/audio-${nombre}${sinVoz ? '-sin-voz' : ''}.wav · ${M ? 'con música' : 'sin música'} · revisá: node herramientas/qa/audio.mjs out/audio-${nombre}.wav`)
