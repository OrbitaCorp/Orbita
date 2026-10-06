// Toma de la TIENDA en el celular (demo pública, sin login): portada → ficha →
// color → Comprar ahora → datos → pago (Mercado Pago) → pago simulado → confirmado.
// La demo no cobra ni guarda nada (el checkout se simula en el navegador).
//   node grabar-tienda.mjs [toma]
import { crearGrabador } from './herramientas/lib/grabador.mjs'

const DEMO = 'https://demo.orbita.site'
const toma = process.argv[2] ?? 'tienda'
const g = await crearGrabador({ toma, sesion: 'limpia', movil: true, dpr: 3, base: DEMO })
const { page, pausa, clic, scrollSuave, scrollHasta, mark, foco, esperar } = g
const S = { sel: null, zona: 'tienda-movil' }
const visible = loc => loc.filter({ visible: true }).first()
try {
  await g.cookiesMinimas()
  await page.goto(DEMO + '/', { waitUntil: 'domcontentloaded' })
  await page.getByText('Comprá por categoría').waitFor({ timeout: 30000 })
  await pausa(2500)

  await g.iniciar()
  await pausa(1600); mark('portada')
  await scrollSuave(880, 'portada-cats', { ...S, ms: 1100 }); mark('categorias')
  await pausa(900)
  await scrollHasta(page.getByText('Favoritos de Nébula').first(), 90, 'ofertas', { ...S, ms: 1000 }); mark('ofertas')
  await pausa(1000)
  const tarjeta = visible(page.getByRole('link', { name: /Parlante Nébula Dot/ }))
  await clic(tarjeta, 'producto', { dy: .35 })
  await esperar('ficha', t => page.getByRole('button', { name: 'Agregar al carrito' }).first().waitFor({ timeout: t }))
  await pausa(1300); mark('ficha')
  // precio, colores y botones a la vista
  const colorLbl = page.getByText(/^Color:/).first()
  await scrollHasta(colorLbl, 250, 'ficha-precio', { ...S, ms: 1000 }); mark('precio')
  await foco(page.getByText(/pagando con transferencia/).first(), 'transferencia')
  await pausa(900)
  // segunda muestra de color (rojo)
  const muestra = await page.evaluateHandle(() => {
    const l = [...document.querySelectorAll('*')].find(e => e.children.length <= 1 && /^Color:/.test(e.textContent.trim()))
    let c = l; for (let i = 0; i < 6 && c; i++) { const bs = [...c.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width > 20); if (bs.length >= 2) return bs[1]; c = c.parentElement }
    return null
  })
  await clic(g.comoLoc(muestra.asElement(), 'color'), 'color')
  await pausa(1300); mark('color-elegido')
  await clic(visible(page.getByRole('button', { name: 'Comprar ahora' })), 'comprar')
  await esperar('checkout', t => page.getByText('¿Quién recibe el pedido?').waitFor({ timeout: t }))
  await pausa(1300); mark('datos')
  await clic(page.getByRole('button', { name: /Continuar con el pago/ }), 'continuar')
  await esperar('pago', t => page.getByText('Método de pago').waitFor({ timeout: t }))
  await pausa(900); mark('envio')
  await scrollHasta(page.getByText('Método de pago').first(), 120, 'pago-metodo', { ...S, ms: 1000 })
  await foco(page.getByText('Método de pago').first(), 'metodo'); mark('metodo')
  await pausa(1400)
  const confirmar = page.getByRole('button', { name: /Confirmar compra/ })
  await scrollHasta(confirmar, 560, 'pago-confirmar', { ...S, ms: 900 })
  await pausa(500)
  await clic(confirmar, 'confirmar')
  await esperar('simulado', t => page.getByRole('button', { name: 'Aprobar el pago' }).waitFor({ timeout: t }))
  await pausa(1200); mark('simulado')
  await clic(page.getByRole('button', { name: 'Aprobar el pago' }), 'aprobar')
  await esperar('confirmado', t => page.getByText('¡Pedido confirmado!').waitFor({ timeout: t }))
  await pausa(2600); mark('confirmado')
  await pausa(600); mark('fin')
} catch (e) { await g.error(e) }
await g.terminar()
