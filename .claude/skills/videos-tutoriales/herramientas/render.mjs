// Renderiza la línea de tiempo a MP4: N navegadores en paralelo dibujan cuadros
// (seek(t) + captura JPEG) y los pasan por pipe a ffmpeg (H.264, BT.709);
// al final se unen los pedazos y se mezcla el audio.
//   TL=compose/tl.json WAV=out/sfx.wav node herramientas/render.mjs <salida.mp4> [desde] [hasta]
//   (desde/hasta en segundos: para previas cortas; WAV=none → sin audio)
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, chromePath, ffmpegPath } from './lib/deps.mjs'

const [salida = 'out/video.mp4', desdeA, hastaA] = process.argv.slice(2)
const FPS = 60
const PAGE = process.env.PAGE ?? 'compose/index.html', TLP = process.env.TL ?? 'compose/tl.json', WAV = process.env.WAV ?? 'out/sfx.wav'
const tl = JSON.parse(fs.readFileSync(TLP, 'utf8'))
const desde = Number(desdeA ?? 0), hasta = Math.min(tl.duration, Number(hastaA ?? tl.duration))
const f0 = Math.round(desde * FPS), f1 = Math.round(hasta * FPS), total = f1 - f0
const WORKERS = Math.min(6, Math.max(2, Math.floor(os.cpus().length / 2)))
const tmp = path.resolve('out', 'chunks'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true })
console.log(`Render ${desde}s→${hasta}s · ${total} cuadros · ${WORKERS} procesos`)

const browser = await chromium.launch({ executablePath: chromePath(), args: ['--allow-file-access-from-files', '--disable-web-security'] })
const url = pathToFileURL(path.resolve(PAGE)).href
let hechos = 0
const t0 = Date.now()
async function worker(w, a, b) {
  const page = await browser.newPage({ viewport: { width: tl.W ?? 1920, height: tl.H ?? 1080 } })
  await page.goto(url)
  await page.evaluate(tl => window.load(tl), tl)
  const archivo = path.join(tmp, `c${String(w).padStart(2, '0')}.mp4`)
  const ff = spawn(ffmpegPath, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', archivo], { stdio: ['pipe', 'inherit', 'inherit'] })
  const fin = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))))
  for (let f = a; f < b; f++) {
    await page.evaluate(t => window.seek(t), f / FPS)
    const img = await page.screenshot({ type: 'jpeg', quality: 96 })
    if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r))
    if (++hechos % 300 === 0) { const s = (Date.now() - t0) / 1000; console.log(`  ${hechos}/${total} (${(hechos / s).toFixed(1)} c/s, faltan ~${Math.round((total - hechos) / (hechos / s))} s)`) }
  }
  ff.stdin.end(); await fin; await page.close()
  return archivo
}
const por = Math.ceil(total / WORKERS)
const partes = await Promise.all(Array.from({ length: WORKERS }, (_, w) => { const a = f0 + w * por, b = Math.min(f1, a + por); return a < b ? worker(w, a, b) : null }))
await browser.close()
const lista = path.join(tmp, 'lista.txt')
fs.writeFileSync(lista, partes.filter(Boolean).map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'))
const conAudio = WAV !== 'none' && fs.existsSync(WAV)
const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista]
if (conAudio) args.push('-ss', String(desde), '-t', String(hasta - desde), '-i', WAV)
args.push('-c:v', 'copy')
if (conAudio) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest')
args.push('-movflags', '+faststart', salida)
await new Promise((res, rej) => spawn(ffmpegPath, args, { stdio: 'inherit' }).on('close', c => c === 0 ? res() : rej(new Error('mux ' + c))))
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`Listo: ${salida} (${((Date.now() - t0) / 1000).toFixed(0)} s)${conAudio ? '' : ' · sin audio'}`)
