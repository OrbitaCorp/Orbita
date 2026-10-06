// EJEMPLO: toma corta (solo lectura) de la lista de Productos con el producto ya
// publicado, al MISMO scroll con el que terminó la toma principal, para
// enlazarlas con un fundido (la tarjeta tarda en terminar de subir las fotos).
//   node grabar-lista.mjs toma1b [scroll=357]
import { crearGrabador } from './herramientas/lib/grabador.mjs'

const TOMA = process.argv[2] ?? 'toma1b', SCROLL = Number(process.argv[3] ?? 357)
const NOMBRE = 'Remera Oversize Algodón Negra'
const g = await crearGrabador({ toma: TOMA, ensayo: true })   // solo lectura
const { page, BASE, pausa, mover, mark } = g
try {
  await page.goto(BASE + '/admin/ventas/catalogo', { waitUntil: 'networkidle' })
  const titulo = page.getByText(NOMBRE).first()
  await titulo.waitFor({ timeout: 30000 })
  // esperar a que ESA tarjeta (no otra de la grilla) tenga foto y diga Publicado
  await page.waitForFunction(n => {
    const t = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && e.textContent.trim().startsWith(n.slice(0, 20)))
    let c = t
    for (let i = 0; i < 6 && c; i++) {
      if (c.querySelectorAll('img').length && c.innerText.includes('Publicado') && c.innerText.split('Publicado').length === 2)
        return [...c.querySelectorAll('img')].every(im => im.complete && im.naturalWidth > 0)
      c = c.parentElement
    }
    return false
  }, NOMBRE, { timeout: 90000, polling: 500 })
  await page.locator('main.admin-main').evaluate((e, y) => { e.scrollTop = y }, SCROLL)
  await pausa(1500)
  await page.mouse.move(1000, 700)
  await g.iniciar()
  const b = await titulo.boundingBox()
  mark('foco', { foco: 'tarjeta', box: { x: b.x, y: b.y, w: b.width, h: b.height } })
  await mover(b.x + b.width * .5, b.y - 120, 750)   // hover real sobre la tarjeta
  await pausa(2600)
  mark('fin')
} catch (err) { await g.error(err) } finally { await g.terminar() }
