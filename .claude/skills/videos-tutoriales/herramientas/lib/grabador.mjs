// Grabador: captura cuadros del panel REAL con CDP (Page.startScreencast, 2x) y
// registra cada acción con su tiempo y la caja del elemento, para que el editor
// arme cámara, cursor, carteles, resaltados y sonido.
//
//   const g = await crearGrabador({ toma: 'toma1', ensayo })
//   ... preparación sin grabar (navegar, limpiar memoria, cookies) ...
//   await g.iniciar()            // arranca la captura y marca 'inicio'
//   await g.clic(loc, 'nombre')  // mover + clic, con registro
//   await g.terminar()           // guarda tomas/<toma>/log.json
//
// Coordenadas: px CSS del viewport (1440×900). El mouse real se mueve en pasos
// para que la página muestre los hover; el cursor del video se dibuja después.
import fs from 'node:fs'
import path from 'node:path'
import { abrirSesion, abrirLimpia, bloquearEscrituras, VISTA_MOVIL } from './sesion.mjs'
import { BASE as BASE_PANEL } from './deps.mjs'

export const ZONAS = {
  // columna del formulario entre la barra superior y el pie fijo del panel
  panel: { x: 64, y: 64, w: 948, h: 762 },
  // tienda: todo debajo del encabezado fijo; el botón de WhatsApp no se mueve
  tienda: { x: 0, y: 77, w: 1440, h: 823, fijos: [{ x: 1350, y: 810, w: 76, h: 76 }] },
  // tienda en el celular (390×844): debajo del encabezado fijo
  'tienda-movil': { x: 0, y: 76, w: 390, h: 768 },
}

// sesion: 'perfil' (panel con login, perfil persistente) | 'limpia' (sin login: demo pública, plantillas)
// movil: graba en vista de celular (390×844, táctil); dpr 3 recomendado para que el zoom quede nítido
export async function crearGrabador({ toma, ensayo = false, permitirEnEnsayo, dpr = 2, dir = process.cwd(), sesion = 'perfil', movil = false, base = BASE_PANEL }) {
  const BASE = base
  const DIR = path.resolve(dir, 'tomas', toma)
  fs.rmSync(DIR, { recursive: true, force: true })
  fs.mkdirSync(path.join(DIR, 'frames'), { recursive: true })
  const { ctx, page } = sesion === 'limpia' ? await abrirLimpia({ dpr, movil }) : await abrirSesion({ dpr })
  const VW = movil ? VISTA_MOVIL.width : 1440, VH = movil ? VISTA_MOVIL.height : 900
  if (ensayo) await bloquearEscrituras(page, permitirEnEnsayo)

  const ahora = () => Date.now() / 1000
  const log = []
  const ev = (type, data = {}) => { const e = { type, t: ahora(), ...data }; log.push(e); return e }
  const mark = (name, data = {}) => ev('mark', { name, ...data })
  const pausa = ms => page.waitForTimeout(ms)
  const ease = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2

  // ── captura ────────────────────────────────────────────────────────────
  const cdp = await ctx.newCDPSession(page)
  const frames = [], pendientes = new Set()
  let n = 0, capturando = false
  cdp.on('Page.screencastFrame', f => {
    const file = `frames/${String(n++).padStart(6, '0')}.jpg`
    frames.push({ s: f.metadata.timestamp, f: file })
    const w = fs.promises.writeFile(path.join(DIR, file), Buffer.from(f.data, 'base64')).finally(() => pendientes.delete(w))
    pendientes.add(w)
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  page.on('framenavigated', fr => { if (fr === page.mainFrame() && capturando) ev('url', { u: fr.url() }) })

  // ── acciones ───────────────────────────────────────────────────────────
  let mouse = { x: VW / 2, y: VH / 2 }
  async function caja(loc) {
    const b = await loc.boundingBox()
    if (!b) throw new Error('Sin caja (¿no está visible?): ' + loc)
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  }
  async function mover(x, y, ms = 650) {
    const e = ev('move', { x, y, d: ms / 1000 })
    const pasos = Math.max(8, Math.round(ms / 16)), x0 = mouse.x, y0 = mouse.y
    for (let i = 1; i <= pasos; i++) { const k = ease(i / pasos); await page.mouse.move(x0 + (x - x0) * k, y0 + (y - y0) * k); await page.waitForTimeout(ms / pasos) }
    mouse = { x, y }; e.t1 = ahora()
  }
  async function clic(loc, label, { dx = .5, dy = .5, ms = 650, antes = 120 } = {}) {
    const b = await caja(loc)
    const x = b.x + b.w * dx, y = b.y + b.h * dy
    await mover(x, y, ms); await pausa(antes)
    ev('click', { x, y, label, box: b })
    await page.mouse.down(); await pausa(70); await page.mouse.up()
    return b
  }
  async function tipear(texto, label, delay = 55) {
    const e = ev('type', { label, chars: [] })
    for (const ch of texto) { e.chars.push(ahora()); await page.keyboard.type(ch); await pausa(delay + (Math.random() * 24 - 12)) }
    e.t1 = ahora()
  }
  // Scroll SUAVE: anima scrollTop con requestAnimationFrame (nunca mouse.wheel:
  // salta de a ~80 px). `zona` = qué parte de la pantalla se desplaza (para la
  // compensación de movimiento de scrolls.mjs): 'panel', 'tienda' u objeto.
  async function scrollSuave(dy, label, { ms = 850, sel = 'main.admin-main', zona = 'panel' } = {}) {
    const e = ev('scroll', { label, dy, zona: typeof zona === 'string' ? ZONAS[zona] : zona, ms })
    e.real = await page.evaluate(({ dy, ms, sel }) => new Promise(res => {
      const el = (sel && document.querySelector(sel)) || document.scrollingElement
      const y0 = el.scrollTop, y1 = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, y0 + dy))
      const t0 = performance.now(), ez = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
      const paso = now => { const u = Math.min(1, (now - t0) / ms); el.scrollTop = y0 + (y1 - y0) * ez(u); if (u < 1) requestAnimationFrame(paso); else res(y1 - y0) }
      requestAnimationFrame(paso)
    }), { dy, ms, sel })
    e.t1 = ahora()
    await pausa(120)
    return e.real
  }
  // Desplaza hasta que el elemento quede a `y` px del borde superior
  async function scrollHasta(loc, y, label, opts) { const b = await caja(loc); return scrollSuave(b.y - y, label, opts) }
  async function esperar(label, fn, timeout = 60000) { const e = ev('wait', { label }); await fn(timeout); e.t1 = ahora() }
  async function foco(loc, name) { const b = await caja(loc); mark('foco', { foco: name, box: b }); return b }
  const hl = (name, box, extra = {}) => mark('hl', { hl: name, box, ...extra })
  // Caja del bloque que contiene un texto: sube hasta un contenedor ancho que
  // además incluye contenido (no solo la fila del título)
  async function cajaBloque(texto, minW = 760) {
    return page.evaluate(({ texto, minW }) => {
      const t = [...document.querySelectorAll('label,span,div,p,h2,h3,h4,strong')].find(el => {
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim()
        return own === texto && el.getBoundingClientRect().width > 0
      })
      if (!t) return null
      const h0 = t.getBoundingClientRect().height
      let c = t
      while (c && (c.getBoundingClientRect().width < minW || c.getBoundingClientRect().height < h0 + 28)) c = c.parentElement
      if (!c) return null
      const r = c.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }, { texto, minW })
  }
  // Input cuyo rótulo visible es exactamente `texto` (para campos sin id/aria)
  async function inputPorLabel(texto) {
    const h = await page.evaluateHandle(t => {
      const cands = [...document.querySelectorAll('label, span, div, p')].filter(el => {
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim()
        return own === t && el.getBoundingClientRect().width > 0
      })
      for (const c of cands) { let el = c; for (let i = 0; i < 5 && el; i++) { const ins = el.querySelectorAll('input:not([type=checkbox]):not([type=file]),textarea'); if (ins.length === 1) return ins[0]; el = el.parentElement } }
      return null
    }, texto)
    const el = h.asElement(); if (!el) throw new Error('No encontré el input de ' + texto)
    return comoLoc(el, texto)
  }
  // Adapta un ElementHandle a lo que esperan clic()/caja()/foco()
  const comoLoc = (el, nombre = 'elemento') => ({ boundingBox: () => el.boundingBox(), toString: () => nombre })

  // ── preparación (antes de iniciar, no se graba) ────────────────────────
  // Formularios como los ve alguien la primera vez: borra preferencias que el
  // panel recuerda en localStorage (p. ej. la última categoría del alta).
  async function limpiarMemoria(prefijos = ['orbita:catalogo:']) {
    await page.evaluate(ps => Object.keys(localStorage).filter(k => ps.some(p => k.startsWith(p))).forEach(k => localStorage.removeItem(k)), prefijos)
  }
  // En la tienda, responde el banner de cookies con la opción más privada
  async function cookiesMinimas() {
    // (sin networkidle: con escrituras bloqueadas la página puede no quedar nunca quieta)
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await pausa(2500)
    const b = page.getByRole('button', { name: 'Solo necesarias' })
    if (await b.isVisible().catch(() => false)) { await b.click(); await pausa(400) }
  }

  async function iniciar() {
    await page.mouse.move(mouse.x, mouse.y)
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: VW * dpr, maxHeight: VH * dpr, everyNthFrame: 1 })
    capturando = true
    ev('url', { u: page.url() }); ev('vista', { w: VW, h: VH, movil })
    await pausa(600)
    mark('inicio'); ev('cursor', { v: 1 })
  }
  async function terminar(extra = {}) {
    await cdp.send('Page.stopScreencast').catch(() => {})
    capturando = false
    await Promise.all([...pendientes])
    fs.writeFileSync(path.join(DIR, 'log.json'), JSON.stringify({ ensayo, ...extra, log, frames }, null, 1))
    console.log(`Toma ${toma}: ${frames.length} cuadros, ${log.length} eventos → ${DIR}`)
    await ctx.close()
  }
  async function error(err) {
    console.error('ERROR en la toma:', err)
    mark('error', { msg: String(err) })
    await page.screenshot({ path: path.join(DIR, 'error.png') }).catch(() => {})
  }

  return { page, ctx, BASE, DIR, ev, mark, pausa, caja, mover, clic, tipear, scrollSuave, scrollHasta, esperar, foco, hl, cajaBloque, inputPorLabel, comoLoc, limpiarMemoria, cookiesMinimas, iniciar, terminar, error, cursor: v => ev('cursor', { v }) }
}
