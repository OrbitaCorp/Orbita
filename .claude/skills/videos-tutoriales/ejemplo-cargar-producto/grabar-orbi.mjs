// Toma "Opción 1 · Con Orbi": una foto → "Completar nombre, categoría y
// descripción con esta foto" → Orbi completa → precio y stock → Publicar (sin
// publicar). SIEMPRE en modo ensayo: no se guarda nada; solo se permite la IA
// (escaneo + fotos sugeridas). Arranca con el formulario vacío ya abierto, igual
// que la toma principal en su marca 'form', para enlazarlas.
//   node grabar-orbi.mjs toma-orbi
import path from 'node:path'
import { crearGrabador } from './herramientas/lib/grabador.mjs'

const TOMA = process.argv[2] ?? 'toma-orbi'
const FOTO = 'remera-oversize-negra-1.jpg'
const g = await crearGrabador({ toma: TOMA, ensayo: true, permitirEnEnsayo: (m, p) => /ai-scan|suggested-images|proxy-image/.test(p) })
const { page, BASE, pausa, mark, foco, clic, tipear, mover, scrollHasta, esperar, hl, caja, inputPorLabel } = g

try {
  await page.goto(BASE + '/admin/ventas/dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Buenas', { timeout: 30000 })
  await g.limpiarMemoria()
  await page.goto(BASE + '/admin/ventas/catalogo?vista=nuevo', { waitUntil: 'domcontentloaded' })
  await page.getByText('Arrastrá tus fotos o tocá para subirlas').waitFor({ timeout: 30000 })
  await pausa(1500)
  await mover(600, 520, 300)
  await g.iniciar()
  await pausa(700)

  // ── 1 · Una foto ──────────────────────────────────────────────────────
  mark('oA')
  const zona = page.getByText('Arrastrá tus fotos o tocá para subirlas')
  await foco(zona, 'o-zona-fotos')
  const chooserP = page.waitForEvent('filechooser')
  await clic(zona, 'o-zona-fotos', { ms: 700 })
  const chooser = await chooserP
  mark('dialogo-abre')
  await pausa(600)
  await chooser.setFiles([path.resolve('fotos', FOTO)])
  mark('fotos-subidas')
  await esperar('o-miniatura', t => page.getByRole('button', { name: 'Quitar fondo' }).first().waitFor({ timeout: t }))
  await esperar('o-encuadre', t => page.waitForFunction(() => !document.body.innerText.includes('Encuadrando'), null, { timeout: t }))
  await pausa(600)

  // ── 2 · Completar con esta foto ───────────────────────────────────────
  mark('oB')
  const completar = page.getByText('Completar nombre, categoría y descripción con esta foto')
  await foco(completar, 'completar')
  await clic(completar, 'completar', { dx: .3, ms: 800 })
  mark('scan-inicio')
  await esperar('scan', t => page.waitForFunction(() => document.body.innerText.includes('Orbi completó'), null, { timeout: t }), 90000)
  mark('scan-fin')
  // dar tiempo a que lleguen las fotos sugeridas de la web y a mirar el resultado
  await page.waitForFunction(() => !document.body.innerText.includes('Buscando fotos oficiales'), null, { timeout: 20000 }).catch(() => {})
  await pausa(2600)
  mark('scan-visto')

  // ── 3 · Todo lo que completó ──────────────────────────────────────────
  mark('oC')
  const nombre = page.locator('textarea[placeholder="Ej: Remera oversize negra"]')
  await scrollHasta(nombre, 185, 'o-a-datos')
  await pausa(300)
  // un solo resaltado desde "Nombre" hasta el final de la descripción
  const bN = await caja(nombre), bNombre = { y: bN.y - 30 }   // incluye el rótulo "Nombre *"
  const tas = await page.$$('textarea')
  const bDesc = await tas[tas.length - 1].boundingBox()
  hl('orbi-campos', { x: 169, y: bNombre.y - 6, w: 806, h: (bDesc.y + bDesc.height) - (bNombre.y - 6) + 6 })
  mark('campos')
  console.log('Nombre:', await nombre.inputValue(), '| categoría:', await page.locator('#pn-categoria button').first().innerText())
  await pausa(3000)
  mark('oC-fin')

  // ── 4 · Precio y stock ────────────────────────────────────────────────
  mark('oD')
  const precio = await inputPorLabel('Precio')
  await foco(precio, 'o-precio')
  await clic(precio, 'o-precio', { dx: .3 }); await tipear('24990', 'o-precio', 90); await pausa(400)
  await clic(await inputPorLabel('Stock'), 'o-stock', { dx: .3 })
  await page.keyboard.press('Control+A'); await tipear('40', 'o-stock', 110); await pausa(900)
  mark('oD-fin')
  const publicar = page.getByRole('button', { name: 'Publicar', exact: true })
  await foco(publicar, 'o-publicar')
  const bp = await caja(publicar)
  await mover(bp.x + bp.w / 2, bp.y + bp.h / 2, 800)
  await pausa(1300)
  mark('fin')
} catch (err) { await g.error(err) } finally { await g.terminar() }
