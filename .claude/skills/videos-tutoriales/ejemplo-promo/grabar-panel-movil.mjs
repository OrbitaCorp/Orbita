// Toma del PANEL EN EL CELULAR (demo pública, vista 390×844): inicio (ventas,
// alertas, gráfico) → pedido nuevo → "Confirmar pedido" → productos → Orbi.
// Para el reel: todo se ve dentro del mockup del teléfono, sin recortes.
// dpr 2: a 3 el screencast se frena en las pantallas pesadas.
//   node grabar-panel-movil.mjs [toma]
import { crearGrabador } from './herramientas/lib/grabador.mjs'

const DEMO = 'https://demo.orbita.site'
const toma = process.argv[2] ?? 'panelm'
const PREGUNTA = process.env.PREGUNTA ?? '¿Qué fue lo que más vendí este mes?'
const g = await crearGrabador({ toma, sesion: 'limpia', movil: true, dpr: 2, base: DEMO })
const { page, pausa, clic, tipear, mark, foco, esperar, scrollSuave, scrollHasta } = g
const Z = { sel: 'main.admin-main', zona: { x: 0, y: 64, w: 390, h: 780 } }
async function ir(ruta, nombre, listo) {
  mark('carga-' + nombre); g.cursor(0)
  await page.goto(DEMO + ruta, { waitUntil: 'domcontentloaded' })
  await esperar('carga-' + nombre, listo, 40000)
  await page.waitForTimeout(1800)
  g.cursor(1); mark(nombre)
}
try {
  await page.goto(DEMO + '/admin/ventas/dashboard', { waitUntil: 'domcontentloaded' })
  await page.getByText(/neto de devoluciones/).first().waitFor({ timeout: 40000 })
  await pausa(3500)
  await g.iniciar()
  mark('dashboard')
  await pausa(2200)
  await scrollHasta(page.getByText(/alertas/).first(), 70, 'a-alertas', { ...Z, ms: 1000 }); mark('alertas')
  await pausa(1600)
  await scrollHasta(page.getByText('Ventas de la semana').first(), 80, 'a-grafico', { ...Z, ms: 1000 }); mark('grafico')
  await pausa(1800); mark('dashboard-fin')

  await ir('/admin/ventas/pedidos', 'pedidos', t => page.getByText('#1183').filter({ visible: true }).first().waitFor({ timeout: t }))
  await pausa(900)
  await clic(page.getByText('#1183').filter({ visible: true }).first(), 'abrir-pedido')
  await esperar('detalle', t => page.getByRole('button', { name: /Confirmar pedido/ }).filter({ visible: true }).first().waitFor({ timeout: t }))
  await pausa(1300); mark('detalle')
  const conf = page.getByRole('button', { name: /Confirmar pedido/ })
  const b = await conf.boundingBox()
  if (b && b.y > 700) { await scrollHasta(conf, 300, 'a-confirmar', { ...Z, ms: 800 }); await pausa(500) }
  await foco(conf, 'confirmar')
  await clic(conf, 'confirmar-pedido')
  await esperar('confirmado', t => conf.waitFor({ state: 'detached', timeout: t }))
  await pausa(2200); mark('confirmado')

  await ir('/admin/ventas/catalogo', 'catalogo', t => page.getByText(/^valor de inventario$/i).filter({ visible: true }).first().waitFor({ timeout: t }))
  await pausa(1600)
  await scrollSuave(760, 'a-productos', { ...Z, ms: 1100 }); mark('productos')
  await pausa(1800); mark('catalogo-fin')

  await clic(page.getByRole('button', { name: /Orbi/ }).filter({ visible: true }).first(), 'orbi')
  await esperar('orbi-abre', t => page.getByText('Hola, soy Orbi').filter({ visible: true }).first().waitFor({ timeout: t }))
  await pausa(1100); mark('orbi')
  // en el celular la hoja se abre a media altura y el campo de texto queda debajo del borde:
  // se toca una pregunta sugerida (visible) y se envía con el botón Enviar
  await clic(page.getByText('¿Cuáles son los más vendidos?').filter({ visible: true }).first(), 'orbi-sugerida')
  await pausa(700)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button[aria-label=Enviar]')].find(x => !x.disabled); b && b.click() })
  mark('orbi-enviado')
  await esperar('orbi-respuesta', async t => {
    const t0 = Date.now(), n0 = await page.evaluate(() => document.body.innerText.length); let prev = -1, quieto = 0
    while (Date.now() - t0 < t) {
      const n = await page.evaluate(() => document.body.innerText.length)
      if (n === prev && n > n0 + 150) { if (++quieto >= 8) return } else quieto = 0
      prev = n; await page.waitForTimeout(250)
    }
  }, 60000)
  await pausa(2600); mark('orbi-fin')
  await pausa(500); mark('fin')
} catch (e) { await g.error(e) }
await g.terminar()
