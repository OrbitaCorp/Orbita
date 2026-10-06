// Mezcla la narración (out/voz/<id>.wav en los tiempos de out/voz-tiempos.json)
// con los efectos (out/sfx-voz.wav) → out/audio-voz.wav
// Voz normalizada a ~-16 LUFS; efectos 6 dB abajo y con sidechain mientras se habla.
// alimiter va con level=disabled: si no, "auto-nivela" y la salida pega 0 dBFS.
//   node herramientas/mezclar-voz.mjs [nombre-del-corte]   (sin nombre: el corte principal)
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { ffmpegPath } from './lib/deps.mjs'

const n = process.argv[2] ? '-' + process.argv[2] : ''
const tiempos = JSON.parse(fs.readFileSync(`out/voz-tiempos${n}.json`, 'utf8'))
const { duration } = JSON.parse(fs.readFileSync(`out/sfx${n}-voz.json`, 'utf8'))
const args = ['-y', '-loglevel', 'error', '-i', `out/sfx${n}-voz.wav`]
tiempos.forEach(f => args.push('-i', `out/voz/${f.id}.wav`))
const ms = t => Math.round(t * 1000)
const filtro = [
  ...tiempos.map((f, i) => `[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms(f.t)}|${ms(f.t)}[v${i}]`),
  `${tiempos.map((_, i) => `[v${i}]`).join('')}amix=inputs=${tiempos.length}:normalize=0:dropout_transition=0,highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,loudnorm=I=-16:TP=-1.5:LRA=7,apad=whole_dur=${duration.toFixed(3)}[voz]`,
  `[voz]asplit=2[voz1][voz2]`,
  `[0:a]volume=0.5[fx]`,
  `[fx][voz2]sidechaincompress=threshold=0.03:ratio=4:attack=10:release=250[fxd]`,
  `[voz1][fxd]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.84:level=disabled[out]`,
].join(';')
args.push('-filter_complex', filtro, '-map', '[out]', '-ar', '48000', '-t', duration.toFixed(3), `out/audio${n}-voz.wav`)
await new Promise((res, rej) => spawn(ffmpegPath, args, { stdio: 'inherit' }).on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))))
console.log(`out/audio${n}-voz.wav listo · revisá: node herramientas/qa/audio.mjs out/audio${n}-voz.wav`)
