// Toma del PANEL (computadora, demo pública con sesión anónima de solo lectura:
// lo que se cambia queda en el navegador). Inicio → Pedidos → confirmar un
// pedido → Productos (stock e inventario) → Orbi responde una pregunta.
//   node grabar-panel.mjs [toma]
import { crearGrabador } from './herramientas/lib/grabador.mjs'

const DEMO = 'https://demo.orbita.site'
const toma = process.argv[2] ?? 'panel'
const PREGUNTA = process.env.PREGUNTA ?? '¿Qué fue lo que más vendí este mes?'
const g = await crearGrabador({ toma, sesion: 'limpia', dpr: 2, base: DEMO })
const { page, pausa, clic, mover, tipear, mark, foco, esperar, caja } = g
const cajaDe = async (loc, sube = 0) => {
  const h = await loc.elementHandle()
  const r = await h.evaluate((el, n) => { let c = el; for (let i = 0; i < n; i++) c = c.parentElement; const b = c.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } }, sube)
  return r
}
try {
  await page.goto(DEMO + '/admin/ventas/dashboard', { waitUntil: 'domcontentloaded' })
  await page.getByText('Ventas de la semana').waitFor({ timeout: 40000 })
  await page.waitForFunction(() => /\$\d/.test(document.body.innerText.replace(/\s/g, '')) && !document.querySelector('[class*=skeleton], [class*=Skeleton]'), null, { timeout: 30000 }).catch(() => {})
  await pausa(3500)

  await g.iniciar()
  mark('dashboard')
  await foco(page.getByText(/^ventas$/i).first(), 'kpi-ventas')
  await pausa(2200)
  await foco(page.getByText(/productos con stock crítico/).first(), 'alerta-stock')
  await pausa(1500)
  await foco(page.getByText('Ventas de la semana').first(), 'grafico')
  await pausa(1300); mark('dashboard-fin')

  // Pedidos
  await clic(page.getByRole('button', { name: 'Pedidos' }).first(), 'menu-pedidos')
  await pausa(500)
  await clic(page.getByText('Lista', { exact: true }).first(), 'pedidos-lista')
  await esperar('pedidos', t => page.getByText('#1183').first().waitFor({ timeout: t }))
  await mover(760, 420, 500)
  await pausa(1500); mark('pedidos')
  await foco(page.getByText('#1183').first(), 'pedido-nuevo')
  await pausa(900)
  await clic(page.getByText('#1183').first(), 'abrir-pedido')
  await esperar('detalle', t => page.getByRole('button', { name: /Confirmar pedido/ }).waitFor({ timeout: t }))
  await pausa(1400); mark('detalle')
  await foco(page.getByRole('button', { name: /Confirmar pedido/ }), 'confirmar')
  await clic(page.getByRole('button', { name: /Confirmar pedido/ }), 'confirmar-pedido')
  await esperar('confirmado', t => page.getByRole('button', { name: /Confirmar pedido/ }).waitFor({ state: 'detached', timeout: t }))
  await pausa(2000); mark('confirmado')

  // Productos: stock e inventario
  // el menú lateral se despliega al pasar el mouse: primero desplegarlo, después tocar "Productos" ya desplegado
  await mover(32, 204, 600)
  await pausa(700)
  const lista = page.getByText('Lista de productos', { exact: true }).first()
  if (!(await lista.isVisible().catch(() => false))) { await clic(page.getByText('Productos', { exact: true }).first(), 'menu-productos'); await pausa(600) }
  await clic(lista, 'productos-lista')
  await esperar('catalogo', t => page.getByText(/^valor de inventario$/i).first().waitFor({ timeout: t }))
  await mover(760, 520, 500)
  await pausa(1600); mark('catalogo')
  await foco(page.getByText(/^valor de inventario$/i).first(), 'inventario')
  await pausa(1800)
  await foco(page.getByText(/\d+ u\.$/).first(), 'unidades')
  await pausa(1200); mark('catalogo-fin')

  // Orbi
  await clic(page.getByRole('button', { name: 'Abrir Orbi AI' }), 'orbi')
  await esperar('orbi-abre', t => page.getByText('Hola, soy Orbi').waitFor({ timeout: t }))
  await pausa(1100); mark('orbi')
  await clic(page.locator('textarea').last(), 'orbi-campo')
  await pausa(300)
  await tipear(PREGUNTA, 'pregunta', 45)
  await pausa(400)
  await page.keyboard.press('Enter'); mark('orbi-enviado')
  // la respuesta llega por partes: esperar a que deje de crecer
  await esperar('orbi-respuesta', async t => {
    const t0 = Date.now(); let prev = -1, quieto = 0
    while (Date.now() - t0 < t) {
      const n = await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.getBoundingClientRect().x > 1040).map(e => e.textContent).join('').length)
      if (n === prev && n > 150) { if (++quieto >= 8) return } else quieto = 0
      prev = n; await page.waitForTimeout(250)
    }
  }, 60000)
  await foco(page.getByText(/producto más vendido/).first(), 'orbi-numeros').catch(() => {})
  await pausa(3200); mark('orbi-fin')
  await pausa(600); mark('fin')
} catch (e) { await g.error(e) }
await g.terminar()
