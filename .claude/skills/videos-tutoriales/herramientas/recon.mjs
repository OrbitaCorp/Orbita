// Reconocimiento SOLO LECTURA de una pantalla: captura + inventario de botones,
// campos y títulos con sus cajas. Bloquea toda escritura al API.
//   node herramientas/recon.mjs <ruta> [nombre] [--clic "Texto"]…
//   ej.: node herramientas/recon.mjs /admin/ventas/descuentos cupones --clic "Crear cupón"
// En Git Bash anteponé MSYS_NO_PATHCONV=1 (si no, convierte "/admin/…" en una ruta de Windows).
import fs from 'node:fs'
import { abrirSesion, bloquearEscrituras } from './lib/sesion.mjs'
import { BASE } from './lib/deps.mjs'

const args = process.argv.slice(2)
const ruta = args[0] ?? '/admin/ventas/dashboard'
const nombre = args[1] && !args[1].startsWith('--') ? args[1] : 'recon'
const clics = args.flatMap((a, i) => a === '--clic' ? [args[i + 1]] : [])
fs.mkdirSync('out/recon', { recursive: true })
const { ctx, page } = await abrirSesion()
await bloquearEscrituras(page)
await page.goto(BASE + ruta, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
if (/\/login/.test(page.url())) { console.log('⚠ La sesión no está activa: correr herramientas/login.mjs'); await ctx.close(); process.exit(2) }
let i = 0
const volcar = async etiqueta => {
  await page.screenshot({ path: `out/recon/${nombre}-${etiqueta}.png` })
  const info = await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight }
    const txt = el => (el.innerText || el.getAttribute('aria-label') || el.title || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 60)
    const caja = el => { const r = el.getBoundingClientRect(); return `@${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}` }
    return {
      titulos: [...document.querySelectorAll('h1,h2,h3')].filter(vis).map(e => `${txt(e)} ${caja(e)}`),
      botones: [...document.querySelectorAll('button,a[role=button],[role=tab],[role=menuitem]')].filter(vis).map(e => `"${txt(e)}" ${caja(e)}`).filter(s => !s.startsWith('""')),
      campos: [...document.querySelectorAll('input,textarea,select')].filter(vis).map(e => `${e.tagName.toLowerCase()}[${e.type}] ph="${e.placeholder || ''}" aria="${e.getAttribute('aria-label') || ''}" ${caja(e)}`),
      scroll: (() => { const m = document.querySelector('main.admin-main') || document.scrollingElement; return `${m.tagName}.${m.className.split(' ')[0]} scrollHeight=${m.scrollHeight} clientHeight=${m.clientHeight}` })(),
    }
  })
  console.log(`\n=== ${etiqueta} · ${page.url()}\n${JSON.stringify(info, null, 1)}`)
}
await volcar(String(i++))
for (const c of clics) {
  await page.getByText(c, { exact: true }).first().click().catch(e => console.log('No pude tocar', c, e.message))
  await page.waitForTimeout(1200)
  await volcar(String(i++))
}
await ctx.close()
