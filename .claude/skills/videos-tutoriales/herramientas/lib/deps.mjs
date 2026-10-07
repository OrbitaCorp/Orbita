// Dependencias pesadas (Playwright, ffmpeg) y rutas de trabajo.
// Viven FUERA del repo, en ~/orbita-videos/kit (lo instala preparar.mjs), y se
// resuelven desde ahí: así el skill queda liviano y cada video, reproducible.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const VIDEOS_DIR = process.env.ORBITA_VIDEOS ?? path.join(os.homedir(), 'orbita-videos')
export const KIT_DIR = path.join(VIDEOS_DIR, 'kit')
// Perfil de navegador COMPARTIDO entre videos: guarda la sesión del panel (ver
// sesion.mjs: el refresh token rota y no se puede reusar una copia de la cookie).
export const PERFIL_DIR = path.join(VIDEOS_DIR, 'perfil')
export const BASE = process.env.BASE ?? 'https://negocio.orbita.site'

const req = createRequire(path.join(KIT_DIR, 'package.json'))
function cargar(nombre) {
  try { return req(nombre) } catch {
    throw new Error(`Falta "${nombre}" en ${KIT_DIR}. Corré: node herramientas/preparar.mjs --kit`)
  }
}
export const { chromium } = cargar('playwright')
export const ffmpegPath = cargar('ffmpeg-static')

// Chromium: CHROME_PATH > el que trae Playwright > el más nuevo de ms-playwright
export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  try { const p = chromium.executablePath(); if (p && fs.existsSync(p)) return p } catch {}
  const bases = [
    path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
    path.join(os.homedir(), '.cache', 'ms-playwright'),
  ]
  for (const b of bases) {
    if (!fs.existsSync(b)) continue
    const dirs = fs.readdirSync(b).filter(d => /^chromium-\d+$/.test(d)).sort((x, y) => Number(y.split('-')[1]) - Number(x.split('-')[1]))
    for (const d of dirs) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-linux/chrome']) {
        const p = path.join(b, d, rel); if (fs.existsSync(p)) return p
      }
    }
  }
  return undefined   // Playwright intentará el suyo y avisará si falta
}
