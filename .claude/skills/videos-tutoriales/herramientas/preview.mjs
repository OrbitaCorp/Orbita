// Cuadros sueltos del compositor → out/preview-<t>.png, y una hoja de contactos
// out/preview-hoja.jpg con todos (para revisar sin renderizar el video).
//   TL=compose/tl.json node herramientas/preview.mjs 6 12.5 25 …
// Imprime en qué esquina quedó cada cartel.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, chromePath, ffmpegPath } from './lib/deps.mjs'

const tiempos = process.argv.slice(2).map(Number)
const TLP = process.env.TL ?? 'compose/tl.json', PAGE = process.env.PAGE ?? 'compose/index.html'
const tl = JSON.parse(fs.readFileSync(TLP, 'utf8'))
fs.mkdirSync('out', { recursive: true })
const browser = await chromium.launch({ executablePath: chromePath(), args: ['--allow-file-access-from-files'] })
const W = tl.W ?? 1920, H = tl.H ?? 1080   // promos: 1080×1920 (reel) o 1920×1080
const page = await browser.newPage({ viewport: { width: W, height: H } })
await page.goto(pathToFileURL(path.resolve(PAGE)).href)
console.log('cargado:', JSON.stringify(await page.evaluate(tl => window.load(tl), tl)))
const archivos = []
for (const t of tiempos) {
  await page.evaluate(t => window.seek(t), t)
  const f = `out/preview-${t}.png`
  await page.screenshot({ path: f }); archivos.push(f)
}
await browser.close()
if (archivos.length > 1) {
  const cols = Math.min(W >= H ? 4 : 6, archivos.length), filas = Math.ceil(archivos.length / cols)
  const inputs = archivos.flatMap(f => ['-i', f])
  const tw = W >= H ? 640 : 270, th = W >= H ? 360 : 480
  const esc = archivos.map((_, i) => `[${i}:v]scale=${tw}:${th},drawtext=text='${tiempos[i]}s':x=10:y=10:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.5[v${i}]`).join(';')
  const layout = archivos.map((_, i) => `${(i % cols) * tw}_${Math.floor(i / cols) * th}`).join('|')
  const fc = `${esc};${archivos.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${archivos.length}:layout=${layout}:fill=white`
  await new Promise(res => spawn(ffmpegPath, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc, 'out/preview-hoja.jpg'], { stdio: 'inherit' }).on('close', res))
  console.log(`hoja: out/preview-hoja.jpg (${cols}×${filas})`)
}
