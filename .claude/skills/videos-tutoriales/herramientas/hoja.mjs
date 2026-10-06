// Hoja de contactos de un video (o de un tramo) para revisarlo de un vistazo.
//   node herramientas/hoja.mjs <video.mp4> [cada_segundos=4] [desde] [hasta] → out/hoja.jpg
import { spawn } from 'node:child_process'
import { ffmpegPath } from './lib/deps.mjs'

const [video, cadaA = '4', desde, hasta] = process.argv.slice(2)
if (!video) { console.log('Uso: node herramientas/hoja.mjs <video> [cada_s] [desde] [hasta]'); process.exit(1) }
const args = ['-y', '-loglevel', 'error']
if (desde) args.push('-ss', desde)
if (hasta) args.push('-to', hasta)
args.push('-i', video, '-vf', `fps=1/${cadaA},scale=480:270,tile=6x6:padding=4:color=white`, '-frames:v', '1', 'out/hoja.jpg')
await new Promise((res, rej) => spawn(ffmpegPath, args, { stdio: 'inherit' }).on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))))
console.log('out/hoja.jpg')
