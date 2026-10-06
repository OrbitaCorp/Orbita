// Navegador con la sesión del panel.
// SIEMPRE el perfil persistente compartido (~/orbita-videos/perfil): el refresh
// token del panel ROTA en cada uso y el server revoca TODAS las sesiones del
// usuario en ese negocio si ve volver uno ya rotado (auth.service.ts, "reuso").
// Con el perfil, la cookie nueva queda guardada en cada corrida.
// Nunca abrir dos contextos con este perfil a la vez. Nunca usar storageState.
import { chromium, chromePath, PERFIL_DIR } from './deps.mjs'

export async function abrirSesion({ headless = true, dpr = 1, ancho = 1440, alto = 900 } = {}) {
  const ctx = await chromium.launchPersistentContext(PERFIL_DIR, {
    executablePath: chromePath(), headless,
    viewport: { width: ancho, height: alto }, deviceScaleFactor: dpr,
    colorScheme: 'light', locale: 'es-AR',
  })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('orbita-theme', 'light') } catch {}
    // sin el subrayado rojo del corrector del navegador (diccionario en inglés)
    const off = r => r.querySelectorAll?.('input,textarea,[contenteditable]').forEach(el => { el.spellcheck = false })
    new MutationObserver(() => off(document)).observe(document, { childList: true, subtree: true })
  })
  const page = ctx.pages()[0] ?? await ctx.newPage()
  return { ctx, page }
}

// Navegador LIMPIO (sin perfil): para sitios que no piden login, como la demo
// pública (demo.orbita.site) o las plantillas. No toca la sesión del panel.
// movil = vista de celular (390×844, táctil, user agent de iPhone).
export const VISTA_MOVIL = { width: 390, height: 844 }
export async function abrirLimpia({ headless = true, dpr = 1, movil = false, ancho = 1440, alto = 900 } = {}) {
  const browser = await chromium.launch({ executablePath: chromePath(), headless })
  const ctx = await browser.newContext({
    viewport: movil ? VISTA_MOVIL : { width: ancho, height: alto }, deviceScaleFactor: dpr,
    isMobile: movil, hasTouch: movil, colorScheme: 'light', locale: 'es-AR',
    ...(movil ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' } : {}),
  })
  await ctx.addInitScript(() => { try { localStorage.setItem('orbita-theme', 'light') } catch {} })
  const page = await ctx.newPage()
  // ctx.close() cierra también el navegador
  const cerrar = ctx.close.bind(ctx)
  ctx.close = async () => { await cerrar().catch(() => {}); await browser.close().catch(() => {}) }
  return { ctx, page }
}

// Bloquea escrituras al API (para ensayos y reconocimientos). `permitir(method, pathname)`
// puede dejar pasar algo puntual (p. ej. la IA en un ensayo).
export async function bloquearEscrituras(page, permitir = () => false) {
  await page.route('**/*', route => {
    const r = route.request(), m = r.method(), p = new URL(r.url()).pathname
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && /\/api\//.test(p) && !/\/auth\//.test(p) && !permitir(m, p)) {
      console.log('bloqueado (ensayo):', m, p)
      return route.abort()
    }
    return route.continue()
  })
}
