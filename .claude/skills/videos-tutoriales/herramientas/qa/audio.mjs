// Mide loudness integrada (LUFS) y pico real (dBFS) de un audio o video.
//   node herramientas/qa/audio.mjs <archivo>
// Objetivo: versión con voz -14 a -16 LUFS, pico ≤ -1 dBFS. Sin voz: pico ≤ -1 dBFS
// (la integrada da muy baja, ~-30, porque son solo efectos: es normal).
import { spawn } from 'node:child_process'
import { ffmpegPath } from '../lib/deps.mjs'

const archivo = process.argv[2]
const salida = await new Promise((res, rej) => {
  let err = ''
  const p = spawn(ffmpegPath, ['-hide_banner', '-i', archivo, '-map', '0:a', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'])
  p.stderr.on('data', d => err += d); p.on('close', c => c === 0 ? res(err) : rej(new Error(err.slice(-400))))
})
const I = Number((salida.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1]), P = Number((salida.match(/Peak:\s+(-?[\d.]+) dBFS/) || [])[1])
console.log(`${archivo}: ${I} LUFS integrada · pico ${P} dBFS ${P > -1 ? '⚠ pico alto: bajar el limitador o la ganancia' : '✓'}`)
