// EJEMPLO (video "Cómo cargar un producto"): categoría rápida + alta completa +
// "Más detalles" explicado + publicar + la ficha en la tienda.
// Plantilla para adaptar: cambiá los pasos, los textos de los selectores y P.
//
//   ENSAYO=1 node grabar.mjs ensayo1   → bloquea toda escritura de datos (siempre primero)
//   node grabar.mjs toma1              → toma real: CREA la categoría y PUBLICA el producto
//
// Antes: node herramientas/login.mjs (la persona se loguea) y reconocimiento con
// herramientas/recon.mjs. Marcas que usa editar.mjs: sA…sI, modal, form,
// dialogo-abre, fotos-subidas, quitar-fondo-fin, publicado, tarjeta, tienda…
import fs from 'node:fs'
import path from 'node:path'
import { crearGrabador } from './herramientas/lib/grabador.mjs'

const TOMA = process.argv[2] ?? 'toma1'
const ENSAYO = process.env.ENSAYO === '1'
const P = {
  categoria: 'Remeras oversize',
  nombre: 'Remera Oversize Algodón Negra',
  precio: '24990', costo: '11500', stock: '10',
  spec: ['Composición', '100% algodón'],
  fotos: ['remera-oversize-negra-1.jpg', 'remera-oversize-negra-2.jpg', 'remera-oversize-negra-3.webp'],
}
// En el ensayo la categoría no se crea (escritura bloqueada): se usa una existente
const CAT_BUSCAR = ENSAYO ? 'rem' : 'over', CAT_ELEGIR = ENSAYO ? 'remeras' : P.categoria

const g = await crearGrabador({ toma: TOMA, ensayo: ENSAYO, permitirEnEnsayo: (m, p) => /ai-assist|image-studio/.test(p) })
const { page, BASE, pausa, mark, foco, clic, tipear, mover, scrollHasta, esperar, hl, cajaBloque, inputPorLabel, comoLoc, caja } = g
const navBtn = name => page.locator('nav, aside').getByRole('button', { name, exact: true }).first()

try {
  // ── preparación (no se graba) ─────────────────────────────────────────
  await g.cookiesMinimas()
  await page.goto(BASE + '/admin/ventas/dashboard', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Buenas', { timeout: 30000 })
  await g.limpiarMemoria()
  await pausa(1500)
  await g.iniciar()
  await pausa(900)

  // ── A · Categoría rápida ──────────────────────────────────────────────
  mark('sA')
  await clic(navBtn('Productos'), 'nav-productos', { ms: 800 })
  await pausa(800)
  const subCat = page.locator('nav, aside').getByText('Categorías', { exact: true }).first()
  await foco(subCat, 'submenu')
  await clic(subCat, 'sub-categorias', { ms: 600 })
  await esperar('pag-categorias', t => page.getByRole('button', { name: 'Nueva categoría' }).waitFor({ timeout: t }))
  await page.waitForLoadState('networkidle').catch(() => {})
  await pausa(900)
  mark('categorias')
  const nueva = page.getByRole('button', { name: 'Nueva categoría' })
  await foco(nueva, 'nueva-categoria')
  await clic(nueva, 'nueva-categoria', { ms: 800 })
  await page.locator('[role=dialog]').waitFor()
  await pausa(700)
  const dlg = page.locator('[role=dialog]').last()
  mark('modal')
  await clic(dlg.locator('input').first(), 'cat-nombre', { dx: .2 })
  await tipear(P.categoria, 'cat-nombre', 65)
  await pausa(600)
  const iconos = await dlg.evaluate(d => [...d.querySelectorAll('button')].map((b, i) => ({ i, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height, txt: b.innerText.trim() })).filter(o => Math.abs(o.w - 46) < 6 && Math.abs(o.h - 46) < 6 && !o.txt).map(o => o.i))
  if (iconos.length) { await clic(dlg.locator('button').nth(iconos[0]), 'cat-icono', { ms: 600 }); await pausa(700) }
  await clic(dlg.getByRole('button', { name: 'Crear', exact: true }), 'cat-crear', { ms: 700 })
  await esperar('cat-creada', async t => {
    if (ENSAYO) { await pausa(1200); await page.keyboard.press('Escape'); return }
    await page.locator('[role=dialog]').waitFor({ state: 'detached', timeout: t })
    await page.getByText(P.categoria, { exact: true }).first().waitFor({ timeout: t })
  })
  await pausa(1300)
  try { const enArbol = page.getByText(P.categoria, { exact: true }).first(); await enArbol.waitFor({ timeout: 3000 }); await foco(enArbol, 'cat-en-arbol') } catch {}
  await pausa(900)
  mark('sA-fin')

  // ── B · Crear producto (por el submenú) ───────────────────────────────
  mark('sB')
  const bNav = await caja(navBtn('Productos'))
  await mover(bNav.x + bNav.w / 2, bNav.y + bNav.h / 2, 800)
  await pausa(700)
  const subCrear = page.locator('nav, aside').getByText('Crear producto', { exact: true }).first()
  if (!(await subCrear.isVisible().catch(() => false))) { await clic(navBtn('Productos'), 'nav-productos-2', { ms: 200 }); await pausa(700) }
  await clic(subCrear, 'crear-producto', { ms: 600 })
  await esperar('form', t => page.getByText('Arrastrá tus fotos o tocá para subirlas').waitFor({ timeout: t }))
  await pausa(700)
  await mover(600, 520, 500)   // sacar el mouse del menú para que se pliegue
  await pausa(500)
  mark('form')

  // ── C · Fotos (el diálogo "Abrir" lo dibuja el compositor) ────────────
  mark('sC')
  const zona = page.getByText('Arrastrá tus fotos o tocá para subirlas')
  await foco(zona, 'zona-fotos')
  const chooserP = page.waitForEvent('filechooser')
  await clic(zona, 'zona-fotos', { ms: 700 })
  const chooser = await chooserP
  mark('dialogo-abre')
  await pausa(600)
  await chooser.setFiles(P.fotos.map(f => path.resolve('fotos', f)))
  mark('fotos-subidas')
  await esperar('miniaturas', t => page.getByRole('button', { name: 'Quitar fondo' }).nth(2).waitFor({ timeout: t }))
  await esperar('encuadre', t => page.waitForFunction(() => !document.body.innerText.includes('Encuadrando'), null, { timeout: t }))
  await pausa(700)
  const sig = page.getByRole('button', { name: 'Foto siguiente' }).first()
  await clic(sig, 'preview-siguiente', { ms: 750 }); await pausa(450)
  await clic(sig, 'preview-siguiente', { ms: 200, antes: 60 }); await pausa(900)
  mark('preview-3')
  await clic(page.getByRole('button', { name: 'Quitar fondo' }).nth(2), 'quitar-fondo', { ms: 700 })
  await esperar('quitar-fondo', async t => {
    await page.waitForFunction(() => document.body.innerText.includes('Quitando fondo'), null, { timeout: 4000 }).catch(() => {})
    await page.waitForFunction(() => !document.body.innerText.includes('Quitando fondo'), null, { timeout: t })
  }, 120000)
  await pausa(1500)
  mark('quitar-fondo-fin')

  // ── D · Nombre, precio, costo ─────────────────────────────────────────
  mark('sD')
  const nombre = page.locator('textarea[placeholder="Ej: Remera oversize negra"]')
  await foco(nombre, 'nombre')
  await clic(nombre, 'nombre', { dx: .2 })
  await tipear(P.nombre, 'nombre')
  await pausa(700)
  const precio = await inputPorLabel('Precio')
  await clic(precio, 'precio', { dx: .3 }); await tipear(P.precio, 'precio', 90); await pausa(450)
  await clic(await inputPorLabel('Costo'), 'costo', { dx: .3 }); await tipear(P.costo, 'costo', 90); await pausa(900)
  mark('precio-fin')

  // ── E · Categoría ─────────────────────────────────────────────────────
  mark('sE')
  const cat = page.locator('#pn-categoria button').first()
  await foco(cat, 'categoria')
  await clic(cat, 'categoria', { dx: .25 }); await pausa(500)
  await tipear(CAT_BUSCAR, 'buscar-categoria', 110); await pausa(600)
  await clic(page.getByText(CAT_ELEGIR, { exact: true }).last(), 'opcion-categoria', { dx: .1, ms: 550 }); await pausa(800)
  mark('categoria-fin')

  // ── F · Variantes ─────────────────────────────────────────────────────
  mark('sF')
  const toggle = page.getByText('Este producto viene en varias opciones')
  await scrollHasta(toggle, 330, 'a-variantes')
  await clic(toggle, 'toggle-variantes', { dx: .3 }); await pausa(900)
  await clic(page.getByText('Usar los habituales (S, M, L, XL)'), 'habituales'); await pausa(1000)
  const todas = page.getByText('Todas', { exact: true })
  await scrollHasta(todas, 330, 'a-tabla')
  await clic(todas.locator('xpath=ancestor::*[.//input][1]').locator('input').first(), 'stock-todas', { dx: .4 })
  await tipear(P.stock, 'stock-todas', 120); await pausa(1100)
  mark('variantes-fin')

  // ── G · Descripción con Orbi ──────────────────────────────────────────
  mark('sG')
  const redactar = page.getByRole('button', { name: 'Redactar con Orbi' })
  await scrollHasta(redactar, 430, 'a-descripcion')
  await clic(redactar, 'redactar', { ms: 700 })
  await esperar('orbi', async t => {
    await page.waitForFunction(() => { const tas = [...document.querySelectorAll('textarea')].filter(x => !x.placeholder); const ta = tas[tas.length - 1]; return ta && ta.value.trim().length > 40 }, null, { timeout: t })
    await pausa(1200)
  }, 90000)
  mark('orbi-fin')
  await pausa(1800)

  // ── H · Más detalles, bloque por bloque (con resaltados) ──────────────
  mark('sH')
  await clic(page.getByRole('button', { name: /Más detalles/ }), 'mas-detalles', { dx: .15 }); await pausa(900)
  await scrollHasta(page.getByText('Etiquetas', { exact: true }), 140, 'a-etiquetas'); await pausa(300)
  hl('etiquetas', await cajaBloque('Etiquetas')); mark('det-etiquetas'); await pausa(2600)
  await clic(page.getByRole('button', { name: 'Agregar', exact: true }).first(), 'spec-agregar', { ms: 700 }); await pausa(700)
  hl('specs', await cajaBloque('Especificaciones técnicas')); mark('det-specs')
  const chip = page.getByRole('button', { name: '+ ' + P.spec[0], exact: true })
  if (await chip.isVisible().catch(() => false)) { await clic(chip, 'spec-sugerida', { ms: 650 }); await pausa(600) }
  else { await clic(page.locator('input[aria-label="Característica"]').first(), 'spec-label', { dx: .25 }); await tipear(P.spec[0], 'spec-label', 70); await pausa(300) }
  // el campo Valor de ESA fila (hay otros inputs "Valor" en la página)
  const hVal = (await page.evaluateHandle(lbl => {
    const car = [...document.querySelectorAll('input[aria-label="Característica"]')].find(i => i.value === lbl)
    return car?.parentElement?.querySelector('input[aria-label="Valor"]')
  }, P.spec[0])).asElement()
  await clic(comoLoc(hVal, 'valor'), 'spec-valor', { dx: .25 })
  await tipear(P.spec[1], 'spec-valor', 70); await pausa(1300)
  hl('specs', await cajaBloque('Especificaciones técnicas'), { update: true })
  await scrollHasta(page.getByText('Video', { exact: true }).first(), 150, 'a-video'); await pausa(300)
  hl('video', await cajaBloque('Video')); mark('det-video'); await pausa(2600)
  hl('contenido', await cajaBloque('Contenido de la ficha')); mark('det-contenido'); await pausa(2600)
  await scrollHasta(page.getByText('SKU y stock mínimo por variante'), 230, 'a-sku'); await pausa(300)
  hl('sku', await cajaBloque('SKU y stock mínimo por variante')); mark('det-sku'); await pausa(2800)
  mark('detalles-fin')

  // ── I · Publicar ──────────────────────────────────────────────────────
  mark('sI')
  const publicar = page.getByRole('button', { name: 'Publicar', exact: true })
  await foco(publicar, 'publicar')
  if (ENSAYO) {
    const b = await caja(publicar); await mover(b.x + 50, b.y + 24, 700); await pausa(1200); mark('fin-ensayo')
  } else {
    const creado = page.waitForResponse(r => r.request().method() === 'POST' && /\/products\/?$/.test(new URL(r.url()).pathname), { timeout: 60000 })
    await clic(publicar, 'publicar', { ms: 750 })
    mark('publicado')
    await esperar('lista-nueva', t => page.getByText(P.nombre).first().waitFor({ timeout: t }))
    mark('tarjeta')
    const resp = await creado, prod = await resp.json()
    console.log('Producto creado:', prod.id, resp.status())
    fs.writeFileSync(path.join(g.DIR, 'producto.json'), JSON.stringify({ id: prod.id, status: resp.status() }))
    // (la tarjeta tarda en terminar de subir las fotos: la lista "terminada" se
    //  graba aparte con grabar-lista.mjs y se enlaza con un fundido)
    await pausa(2500)
    mark('lista-fin')

    // ── J · La ficha en la tienda ───────────────────────────────────────
    g.cursor(0)
    await page.goto(`${BASE}/producto/${prod.id}`, { waitUntil: 'networkidle' })
    await page.getByText(P.nombre).first().waitFor({ timeout: 30000 })
    await pausa(2000)
    mark('tienda'); g.cursor(1)
    await pausa(1100)
    const talleM = page.getByRole('button', { name: 'M', exact: true }).first()
    await clic(talleM, 'talle-m', { ms: 900 }); await pausa(1200)
    const idx = await page.$$eval('button', bs => bs.map((b, i) => ({ i, r: b.getBoundingClientRect(), img: !!b.querySelector('img') })).filter(o => o.img && o.r.x < 140 && o.r.width > 50).map(o => o.i))
    if (idx.length >= 3) { await clic(page.locator('button').nth(idx[2]), 'miniatura-3', { ms: 900 }); await pausa(1400) }
    const car = page.getByText('Características', { exact: true }).first()
    if (await car.count()) {
      await mover(1000, 560, 500)
      await scrollHasta(car, 180, 'a-caracteristicas', { sel: null, ms: 1000, zona: 'tienda' })
      await pausa(400)
      mark('tienda-caracteristicas'); await pausa(2600)
    }
    mark('tienda-fin')
  }
} catch (err) { await g.error(err) } finally { await g.terminar({ producto: P }) }
