// Toma de Avanzado en la tienda (celular, demo pública): "Juegos y anuncios" →
// "Encestá y ganá" → Jugar → 5 tiros (toca cuando el aro pasa por el centro)
// → premio. Después, el anuncio de 2x1.
//   node grabar-juego.mjs [toma]
import { crearGrabador } from './herramientas/lib/grabador.mjs'

const DEMO = 'https://demo.orbita.site'
const toma = process.argv[2] ?? 'juego'
const g = await crearGrabador({ toma, sesion: 'limpia', movil: true, dpr: 2, base: DEMO })   // dpr 2: a 3 el screencast se frenaba en la animación del tiro
const { page, pausa, clic, mark, esperar, mover, ev } = g

// Posición del aro (% del ancho de la cancha) y caja de la cancha
const aro = () => page.evaluate(() => {
  const els = [...document.querySelectorAll('div[style]')].filter(e => /%$/.test(e.style.left) && e.style.top && e.getBoundingClientRect().width > 0)
  return els.length ? parseFloat(els[0].style.left) : null
})
const cancha = () => page.evaluate(() => {
  const els = [...document.querySelectorAll('div[style]')].filter(e => /%$/.test(e.style.left) && e.style.top && e.getBoundingClientRect().width > 0)
  let c = els[0]; while (c && c.getBoundingClientRect().width < 280) c = c.parentElement
  const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }
})
try {
  await g.cookiesMinimas()
  await page.goto(DEMO + '/', { waitUntil: 'domcontentloaded' })
  await page.getByText('Comprá por categoría').waitFor({ timeout: 30000 })
  await pausa(2500)

  await g.iniciar()
  await pausa(900); mark('portada')
  await clic(page.getByText('Juegos y anuncios').first(), 'pestaña')
  await esperar('menu', t => page.getByText('Encestá y ganá').waitFor({ timeout: t }))
  await pausa(1100); mark('menu')
  await clic(page.getByText('Encestá y ganá').first(), 'juego')
  await esperar('modal', t => page.getByRole('button', { name: 'Jugar' }).waitFor({ timeout: t }))
  await pausa(1300); mark('modal')
  await clic(page.getByRole('button', { name: 'Jugar' }), 'jugar')
  await pausa(700); mark('cancha')
  const c = await cancha()
  const x = c.x + c.w * .5, y = c.y + c.h * .62
  await mover(x, y, 450)
  for (let i = 1; i <= 5; i++) {
    if (!(await page.getByText(/tiro \d\/5/i).first().isVisible().catch(() => false))) { console.log('sin contador de tiros en el tiro', i); break }
    // esperar a que el aro pase por el centro (zona de acierto: 38–62 %)
    await page.waitForFunction(() => {
      const els = [...document.querySelectorAll('div[style]')].filter(e => /%$/.test(e.style.left) && e.style.top && e.getBoundingClientRect().width > 0)
      return els.length && Math.abs(parseFloat(els[0].style.left) - 50) < 3.5
    }, null, { polling: 'raf', timeout: 15000 })
    ev('click', { x, y, label: 'tiro' + i, box: c })
    await page.mouse.down(); await pausa(40); await page.mouse.up()
    mark('tiro' + i)
    await pausa(1900)
  }
  await pausa(1500); mark('resultado')
  await pausa(2600); mark('premio')
  await pausa(800); mark('fin')
} catch (e) { await g.error(e) }
await g.terminar()
