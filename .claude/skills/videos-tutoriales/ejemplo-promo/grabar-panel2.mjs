// Toma extra del PANEL (demo pública): Clientes → Mensajes (una conversación) →
// Cupones → Dominios. Para la versión larga (YouTube). Se navega directo a cada
// pantalla (/admin/ventas/<sección>?vista=…): en el video solo se usa la
// pantalla ya cargada.
//   node grabar-panel2.mjs [toma]
import { crearGrabador } from './herramientas/lib/grabador.mjs'

const DEMO = 'https://demo.orbita.site'
const toma = process.argv[2] ?? 'panel2'
const g = await crearGrabador({ toma, sesion: 'limpia', dpr: 2, base: DEMO })
const { page, pausa, clic, mover, mark, esperar, comoLoc } = g
async function ir(ruta, nombre, listo) {
  mark('carga-' + nombre); g.cursor(0)
  await page.goto(DEMO + ruta, { waitUntil: 'domcontentloaded' })
  await esperar('carga-' + nombre, listo, 40000)
  await page.waitForTimeout(1800)
  g.cursor(1); mark(nombre)
}
try {
  await page.goto(DEMO + '/admin/ventas/dashboard', { waitUntil: 'domcontentloaded' })
  await page.getByText('Ventas de la semana').waitFor({ timeout: 40000 })
  await pausa(2000)
  await g.iniciar()
  await mover(900, 520, 400)

  await ir('/admin/ventas/clientes', 'clientes', t => page.getByRole('heading', { name: /Clientes/ }).first().waitFor({ timeout: t }))
  await pausa(2200); mark('clientes-fin')

  await ir('/admin/ventas/mensajes', 'bandeja', t => page.getByText(/Seleccioná una conversación/).waitFor({ timeout: t }))
  await pausa(700)
  await clic(page.getByText(/Hola! Los auriculares/).first(), 'conversacion'); await pausa(2400)
  mark('conversacion'); await pausa(600); mark('bandeja-fin')

  await ir('/admin/ventas/cupones', 'cupones', t => page.getByText(/NEBULA15|BIENVENIDA10/).first().waitFor({ timeout: t }))
  await pausa(2000); mark('cupones-fin')

  await ir('/admin/ventas/configuracion?vista=dominios', 'dominios', t => page.getByText(/dominio/i).first().waitFor({ timeout: t }))
  await pausa(2200); mark('fin')
} catch (e) { await g.error(e) }
await g.terminar()
