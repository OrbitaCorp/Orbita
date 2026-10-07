// Toma de RUBROS: las portadas públicas de las plantillas de Home (Avanzado)
// en el celular, con sus datos de muestra (www.orbita.site/plantillas/<id>).
// Se elige la vista "Celular" de la página y se oculta su barra de vista previa
// (volver / Computadora / Celular), que no es parte de la tienda.
//   node grabar-rubros.mjs [toma]
import { crearGrabador } from './herramientas/lib/grabador.mjs'

const WEB = 'https://www.orbita.site'
const toma = process.argv[2] ?? 'rubros'
const IDS = (process.env.IDS ?? 'corralon,patitas,escaparate,papeleria,glow,bodega,crecer,circuito').split(',')
const g = await crearGrabador({ toma, sesion: 'limpia', movil: true, dpr: 3, base: WEB })
const { page, pausa, scrollSuave, mark, ev } = g

async function abrir(id) {
  await page.goto(`${WEB}/plantillas/${id}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Celular/ }).click({ timeout: 20000 })
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /Celular/.test(x.textContent))
    let c = b; while (c && getComputedStyle(c).position !== 'sticky') c = c.parentElement
    if (c) c.style.display = 'none'
    scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
  await page.evaluate(() => Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r }))))
  await pausa(900)
}
try {
  await abrir(IDS[0])
  await g.iniciar()
  for (let i = 0; i < IDS.length; i++) {
    const id = IDS[i]
    if (i > 0) { ev('cursor', { v: 0 }); mark('carga-' + id); await abrir(id) }
    mark('p-' + id)
    await pausa(1300)
    await scrollSuave(260, 'baja-' + id, { sel: null, zona: { x: 0, y: 0, w: 390, h: 844 }, ms: 1500 })
    await pausa(500)
    mark('p-' + id + '-fin')
  }
  mark('fin')
} catch (e) { await g.error(e) }
await g.terminar()
