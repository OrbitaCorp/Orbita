// "Cómo cargar un producto" v3: el tutorial es del PLAN BASE (lo que puede hacer
// todo el mundo) y al final, bien marcado, lo que suma el PAQUETE AVANZADO
// (escaneo con foto + quitar fondo) con un llamado a la acción.
//   node editar.mjs                  → compose/tl.json + out/sfx.json (sin voz)
//   node editar.mjs --voz voz.json   → versión narrada
// Tomas: toma1 (manual, real), toma1b (lista publicada), toma-orbi (ensayo: nada se guardó)
import fs from 'node:fs'
import { crearEdicion } from './herramientas/lib/edicion.mjs'

const iv = process.argv.indexOf('--voz')
const voz = iv > 0 ? JSON.parse(fs.readFileSync(process.argv[iv + 1], 'utf8')) : null
const E = crearEdicion({
  tomas: [{ nombre: 'toma1' }, { nombre: 'toma1b', offset: 1000 }, { nombre: 'toma-orbi', offset: 2000 }],
  esperas: { 'quitar-fondo': 2.4, orbi: 1.5, encuadre: .7, form: .9, 'cat-creada': 1.0, 'o-encuadre': .6, scan: 2.0 },
  voz,
})
const { M, F, C, S, HL, centro } = E
const O = n => M(n, 'toma-orbi')
const espera = (label, toma = 'toma1') => E.log.find(e => e.type === 'wait' && e.label === label && e.toma === toma)
const finFotosBase = espera('encuadre').t1 + .5          // miniaturas listas, antes de ir a la vista previa
const inicioFondo = C('preview-siguiente').t - 1.0       // (Avanzado) pasar a la 3ra foto y quitarle el fondo

// ── Clips ───────────────────────────────────────────────────────────────
// PLAN BASE
const sDialogo = M('dialogo-abre') + .12
E.clip(M('inicio'), sDialogo)
E.dialogoAbrir({ s: sDialogo, fotos: ['remera-oversize-negra-1.jpg', 'remera-oversize-negra-2.jpg', 'remera-oversize-negra-3.webp'], carpeta: 'Imágenes > Remeras' })
E.clip(M('fotos-subidas') - .03, finFotosBase)
E.clip(M('sD') + .02, M('tarjeta') + 2.0, { xf: .35 })                          // (sin "Quitar fondo": es de Avanzado; no se solapa con el tramo del bonus)
E.clip(M('inicio', 'toma1b') + .25, M('fin', 'toma1b'), { xf: .45 })
E.clip(M('tienda') - .35, M('tienda-fin') + .3, { xf: .5 })
// PAQUETE AVANZADO
E.capitulo(O('inicio') + .05, { kicker: 'Paquete Avanzado', titulo: 'Orbi lo hace por vos', sub: 'Cargá un producto con una sola foto', xf: .5 })
const sDlgOrbi = O('dialogo-abre') + .12
E.clip(O('inicio') + .05, sDlgOrbi)
E.dialogoAbrir({ s: sDlgOrbi, fotos: ['remera-oversize-negra-1.jpg'], carpeta: 'Imágenes > Remeras' })
E.clip(O('fotos-subidas') - .03, O('fin'))
E.clip(inicioFondo, M('quitar-fondo-fin'), { xf: .45 })
E.capitulo(M('quitar-fondo-fin'), { kicker: 'Paquete Avanzado', titulo: 'Activalo cuando quieras', sub: 'Configuración → Suscripción', xf: .3 })
E.armar()
const [capAvz, capCta] = E.capitulos
const tTienda = E.out(M('tienda') - .34)
E.cursorCorte(tTienda)

// ── Cámara ──────────────────────────────────────────────────────────────
// categoría y Crear producto
E.camara(C('nav-productos').t, .9, 170, 250, 1.6, .75)
E.general(M('categorias') - .3)
E.camara(F('nueva-categoria').t + .1, .8, 1150, 200, 1.45)
E.camara(M('modal'), .8, 720, 300, 1.4)
E.camara(C('cat-icono').t - .25, .8, 720, 470, 1.15)
E.camara(F('cat-en-arbol').t - .2, 1.0, 470, 430, 1.4)
E.camara(M('sB') + .2, .9, 170, 250, 1.6)
E.general(M('form') - .6)
// paso a paso
E.camara(F('zona-fotos').t + .1, .9, 570, 300, 1.45)
E.camara(M('fotos-subidas') + .05, 1.1, 770, 390, 1.28)
E.camara(F('nombre').t + .2, 1.0, 600, 570, 1.55)
E.camara(F('categoria').t + .2, .9, 600, 735, 1.6)
E.camara(S('a-variantes').t, 1.0, 640, 520, 1.32)
E.camara(S('a-tabla').t, 1.0, 700, 450, 1.3)
E.camara(S('a-descripcion').t, 1.0, 640, 560, 1.45)
E.camara(M('orbi-fin') - .2, 1.1, 770, 520, 1.22)
E.camara(C('mas-detalles').t - .3, .9, 640, 640, 1.3)
const hc = n => centro(HL(n)[0].box)
E.camara(S('a-etiquetas').t + .2, 1.0, hc('etiquetas').x, hc('etiquetas').y + 20, 1.42)
E.camara(HL('specs')[0].t, .9, hc('specs').x, hc('specs').y + 10, 1.45)
E.camara(S('a-video').t + .2, 1.0, hc('video').x, hc('video').y + 10, 1.42)
E.camara(HL('contenido')[0].t - .1, .9, hc('contenido').x, hc('contenido').y, 1.42)
E.camara(S('a-sku').t + .2, 1.0, hc('sku').x, hc('sku').y, 1.35)
const pub = centro(F('publicar').box)
E.camara(F('publicar').t + .1, 1.0, pub.x - 80, pub.y - 40, 1.75)
E.general(M('publicado') + .05, .8)
const tb = F('tarjeta').box
E.camara(M('inicio', 'toma1b') + .3, 2.2, tb.x + tb.w / 2 + 120, tb.y - 40, 1.35)
E.camara({ o: tTienda + .05 }, 1.4, 720, 450, 1)
E.camara(C('talle-m').t, 1.0, 1100, 460, 1.38, .9)
E.camara(C('miniatura-3').t, 1.1, 560, 470, 1.18, .9)
E.general(S('a-caracteristicas').t - .1)
E.camara(M('tienda-caracteristicas'), 1.0, 420, 240, 1.55)
E.camara({ o: capAvz.o0 + .05 }, .8, 720, 450, 1)
// Avanzado · escaneo con foto
E.camara(F('o-zona-fotos').t + .1, .9, 570, 300, 1.45)
E.camara(O('fotos-subidas') + .05, 1.0, 520, 360, 1.55)
E.camara(O('scan-fin') - .15, 1.1, 770, 440, 1.12)
const hcO = centro(HL('orbi-campos')[0].box)
E.camara(S('o-a-datos').t, 1.0, hcO.x + 40, hcO.y, 1.18)
const pO = centro(F('o-precio').box)
E.camara(F('o-precio').t + .1, .9, pO.x + 180, pO.y + 10, 1.55)
const pubO = centro(F('o-publicar').box)
E.camara(F('o-publicar').t + .1, 1.0, pubO.x - 80, pubO.y - 40, 1.75)
// Avanzado · quitar fondo (vista previa en grande, antes y después)
E.camara(inicioFondo + .05, .9, 770, 390, 1.28)
E.camara(M('quitar-fondo-fin') - 1.6, 1.0, 1130, 400, 1.55)
E.camara({ o: capCta.o0 + .05 }, .8, 720, 450, 1)

// ── Resaltados ──────────────────────────────────────────────────────────
E.resaltar('etiquetas', C('spec-agregar').t - .25)
E.resaltar('specs', S('a-video').t)
E.resaltar('video', HL('contenido')[0].t - .05)
E.resaltar('contenido', S('a-sku').t)
E.resaltar('sku', M('detalles-fin') - .1)
E.resaltarCaja('caracteristicas', M('tienda-caracteristicas') + .05, M('tienda-fin') - .1, { x: 26, y: 168, w: 690, h: 122 })
E.resaltar('orbi-campos', O('oC-fin') - .05)

// ── Carteles ────────────────────────────────────────────────────────────
E.cartel(M('sA') - .2, M('modal') - .1, 1, 'Creá una categoría', 'Productos → Categorías → Nueva categoría')
E.cartel(M('modal') - .1, M('sA-fin'), 1, 'Nombre, ícono y Crear', 'La imagen es opcional')
E.cartel(M('sB') + .1, M('form'), 2, 'Andá a Crear producto', 'Productos → Crear producto')
E.cartel(M('sC') + .1, finFotosBase - .05, 3, 'Subí tus fotos', 'La primera es la portada del producto')
E.cartel(M('sD') + .1, M('precio-fin') - .1, 4, 'Nombre, precio y costo', 'El costo solo lo ves vos')
E.cartel(M('sE') + .05, M('categoria-fin') - .05, 5, 'Elegí la categoría', 'La que acabás de crear')
E.cartel(M('sF') + .1, M('variantes-fin') - .05, 6, 'Talles y stock', 'Cada talle lleva su propio stock')
E.cartel(M('sG') + .1, C('mas-detalles').t - .3, 7, 'Orbi escribe la descripción', 'Incluido en todos los planes')
E.cartel(C('mas-detalles').t - .3, HL('etiquetas')[0].t, 8, 'Abrí “Más detalles”', 'Todo opcional, para una ficha más completa')
E.cartel(HL('etiquetas')[0].t, C('spec-agregar').t - .25, 8, 'Etiquetas', 'Agrupan productos y ayudan a encontrarlos')
E.cartel(C('spec-agregar').t - .25, S('a-video').t, 8, 'Especificaciones técnicas', 'Tocá una sugerencia y completá el dato')
E.cartel(S('a-video').t, HL('contenido')[0].t - .05, 8, 'Video', 'Un link de YouTube o un archivo, junto a las fotos')
E.cartel(HL('contenido')[0].t - .05, S('a-sku').t, 8, 'Contenido de la ficha', 'Bloques de video y texto bajo las características')
E.cartel(S('a-sku').t, M('detalles-fin') - .05, 8, 'SKU y stock mínimo', 'Códigos automáticos y aviso cuando queda poco')
E.cartel(M('sI') + .05, M('fin', 'toma1b') - .2, 9, 'Publicá', 'Y aparece al instante en tu catálogo')
E.cartel(M('tienda') + .25, M('tienda-fin') + .1, '✓', 'Así lo ven tus clientes', 'Con sus talles, fotos y características')
// Paquete Avanzado (✦): un solo cartel que va cambiando de texto
E.cartel(O('oA') + .1, O('oB'), '✦', 'Subí una foto', 'Paquete Avanzado')
E.cartel(O('oB'), O('scan-fin'), '✦', 'Tocá “Completar con esta foto”', 'Orbi la reconoce en segundos')
E.cartel(O('scan-fin'), O('oC'), '✦', 'Orbi completa todo', 'Nombre, categoría, descripción y fotos')
E.cartel(O('oC'), O('oD'), '✦', 'Revisá lo que completó', 'También te sugiere talles y colores')
E.cartel(O('oD'), O('fin'), '✦', 'Solo poné precio y stock', 'Y publicás')
E.cartel(inicioFondo, M('quitar-fondo-fin') - .05, '✦', 'Quitá el fondo con un toque', 'También en el paquete Avanzado')

// ── Sonidos propios ─────────────────────────────────────────────────────
const tFotos = E.out(M('fotos-subidas') + .1)
;[0, .09, .18].forEach((d, i) => E.sonido(tFotos + d, 'pop', .45, { pitch: 1 + i * .12, pan: -.25 + i * .12 }))
E.sonido(E.out(M('orbi-fin')) - .65, 'sparkle', .5, { pitch: 1.12 })
E.sonido(E.out(espera('cat-creada').t1), 'sparkle', .35, { pitch: 1.25 })
E.sonido(E.segs.find(g => g.xf === .45 && !g.hold).o0 + .1, 'success', .6)              // tarjeta publicada
E.sonido(tTienda - .25, 'whoosh', .55, { dur: .8 })
E.sonido(E.out(O('fotos-subidas') + .1), 'pop', .45)
E.sonido(E.out(O('scan-fin')) - .1, 'sparkle', .6)                                    // Orbi reconoció la foto
E.sonido(E.out(O('scan-visto')) - 2.2, 'pop', .3, { pitch: 1.2 })                      // fotos sugeridas
E.sonido(E.out(M('quitar-fondo-fin') - .01) - 1.04, 'sparkle', .55)                  // fondo quitado
E.sonido(capCta.o0 + .35, 'success', .5)

E.escribir({ titulo: 'Cómo cargar un producto', cierre: 'Listo. Tu producto ya está a la venta.' })
