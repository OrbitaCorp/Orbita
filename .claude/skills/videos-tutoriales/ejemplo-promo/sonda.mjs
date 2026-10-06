// Sonda de reconocimiento sobre la demo: ejecuta una lista de pasos y saca capturas.
//   node sonda.mjs <nombre> [--movil] '<json de pasos>'
// Pasos: {"goto":"/ruta"} {"wait":ms} {"click":"Texto"} {"clickSel":"css"} {"clickRol":["button","Nombre"]}
//        {"fill":["css","texto"]} {"type":"texto"} {"key":"Enter"} {"scroll":y} {"shot":"etiqueta"}
//        {"texto":"css"} (vuelca innerText) {"eval":"js"}
import fs from 'node:fs'
import { chromium, chromePath } from './herramientas/lib/deps.mjs'

const args = process.argv.slice(2)
const nombre = args[0], movil = args.includes('--movil')
const archivo = args.find(a => a.endsWith('.json'))
const pasos = JSON.parse(archivo ? fs.readFileSync(archivo, 'utf8') : (args.filter(a => a.startsWith('[')).pop() ?? '[]'))
const BASE = process.env.DEMO ?? 'https://demo.orbita.site'
fs.mkdirSync('out/recon', { recursive: true })
const browser = await chromium.launch({ executablePath: chromePath(), headless: true })
const ctx = await browser.newContext({
  viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: 1, isMobile: movil, hasTouch: movil, colorScheme: 'light', locale: 'es-AR',
  userAgent: movil ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' : undefined,
})
await ctx.addInitScript(() => { try { localStorage.setItem('orbita-theme', 'light') } catch {} })
const page = await ctx.newPage()
page.on('response', r => { if (r.status() >= 400 && /\/api\//.test(r.url())) console.log('HTTP', r.status(), r.request().method(), new URL(r.url()).pathname) })
for (const p of pasos) {
  try {
    if (p.goto) { await page.goto(p.goto.startsWith('http') ? p.goto : BASE + p.goto, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000) }
    else if (p.wait) await page.waitForTimeout(p.wait)
    else if (p.click) { await page.getByText(p.click, { exact: p.exact ?? true }).first().click({ timeout: 8000 }); await page.waitForTimeout(1500) }
    else if (p.clickSel) { await page.locator(p.clickSel).first().click({ timeout: 8000 }); await page.waitForTimeout(1500) }
    else if (p.clickRol) { await page.getByRole(p.clickRol[0], { name: p.clickRol[1] }).first().click({ timeout: 8000 }); await page.waitForTimeout(1500) }
    else if (p.fill) await page.locator(p.fill[0]).first().fill(p.fill[1])
    else if (p.type) await page.keyboard.type(p.type, { delay: 30 })
    else if (p.key) await page.keyboard.press(p.key)
    else if (p.scroll !== undefined) { await page.evaluate(y => { const m = document.querySelector('main.admin-main') || document.scrollingElement; m.scrollTo(0, y) }, p.scroll); await page.waitForTimeout(1200) }
    else if (p.shot) { await page.screenshot({ path: `out/recon/${nombre}-${p.shot}.png` }); console.log('captura', p.shot, page.url()) }
    else if (p.texto) console.log(`--- texto ${p.texto}\n` + (await page.locator(p.texto).first().innerText().catch(e => 'ERR ' + e.message)).slice(0, p.max ?? 2500))
    else if (p.eval) console.log('eval:', JSON.stringify(await page.evaluate(p.eval)).slice(0, 3000))
  } catch (e) { console.log('⚠ paso', JSON.stringify(p), e.message.split('\n')[0]) }
}
await browser.close()
