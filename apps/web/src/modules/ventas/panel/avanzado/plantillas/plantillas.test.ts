import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PLANTILLAS } from './datos'
import { Home, LAYOUTS_CON_HEADER_PROPIO } from './homes'
import { SECCIONES_POR_PLANTILLA, TITULOS_ESTANTE, dibujaCupon, seccionesDe } from './secciones'
import { BLOQUES_ESTANDAR, ESTANTES, type AccionesHome, type Plantilla } from './tipos'
import { plantillaReal } from '@/modules/ventas/cliente/inicio/plantillaReal'
import type { Producto } from '@/lib/storefront/types'

// El modo check de las plantillas de Home. Correr con `pnpm test plantillas`.
//
// Por qué existe: una plantilla se diseña mirando su vitrina —marca de
// muestra, productos de muestra, cuatro categorías con foto— y ahí siempre se
// ve bien. Los bugs aparecieron todos después, al aplicarla en una tienda de
// verdad: un CUIT inventado en el pie, "−40%" sobre categorías sin descuento,
// la marca de la maqueta en el navbar de otro negocio, una foto que no
// existía. Nada de eso se ve en la vitrina, así que mirarla no alcanza.
//
// Acá cada plantilla se dibuja con el MISMO `Home()` y el MISMO adaptador
// (`plantillaReal`) que usa la tienda, contra cuatro tiendas de prueba, en
// escritorio y en celular, y se revisa el HTML que sale. No usa navegador:
// es `renderToStaticMarkup`, así que corre en segundos junto al resto de los
// tests.
//
// Lo que NO ve (y hay que seguir mirando a mano): si el diseño es lindo, si
// algo desborda de la pantalla, y si un botón dibujado hace algo al tocarlo
// —el HTML estático no trae los `onClick`—.

const AQUI = dirname(fileURLToPath(import.meta.url))
const WEB = join(AQUI, '../../../../../..')
const leer = (ruta: string) => readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n')

const visibles = PLANTILLAS.filter(p => !p.oculta)

// ─── Lo que ya se sabe que está mal ──────────────────────────────────────────
//
// Para un problema que el check encuentra en una plantilla ya publicada y
// que no se arregla en el momento: cambiar cómo se ve una tienda que hoy está
// andando es una decisión aparte. Se anota acá —`'grupo > plantilla':
// ['pedazo del texto']`— para que el check siga sirviendo sin esconder lo que
// falta. Hoy está vacía, y una plantilla NUEVA no suma nada acá: se arregla.
//
// Cada renglón es un pedazo del texto del problema. Funciona como trinquete:
// si aparece un problema que no está acá, falla; y si uno de acá deja de
// pasar, también falla, pidiendo que se lo borre. La lista solo se achica.
const PENDIENTES: Record<string, string[]> = {}

/**
 * Falla listando TODO lo que encontró, de a un renglón. Con `toEqual([])`
 * vitest recorta la lista y hay que adivinar qué más había.
 *
 * Un problema `[caso] texto` que se repite en varios casos sale una sola vez,
 * con los casos al final: "promete X" en las ocho combinaciones es un bug, no
 * ocho.
 */
function sinProblemas(clave: string, mal: string[]) {
  const pendientes = PENDIENTES[clave] ?? []
  const todo = pendientes.includes('*')
  const vistos = new Set<string>()
  const casos = new Map<string, string[]>()
  for (const m of mal) {
    const [, caso, que] = /^\[([^\]]+)\] ([\s\S]*)$/.exec(m) ?? [null, '', m]
    const conocido = pendientes.find(f => que!.includes(f))
    if (conocido) { vistos.add(conocido); continue }
    if (todo) continue
    casos.set(que!, [...(casos.get(que!) ?? []), caso!].filter(Boolean))
  }
  // Ocho casos por plantilla (cuatro tiendas × dos pantallas): si falla en
  // todos no hace falta nombrarlos.
  const donde = (c: string[]) => (c.length === 0 ? '' : c.length >= 8 ? '  (en todos los casos)' : `  (${c.join(', ')})`)
  const renglones = [...casos].map(([que, c]) => `  - ${que}${donde(c)}`)

  const arreglados = todo ? (mal.length === 0 ? ['*'] : []) : pendientes.filter(f => !vistos.has(f))
  for (const f of arreglados) renglones.push(`  - ya no pasa: borrá "${f}" de PENDIENTES['${clave}']`)

  if (renglones.length) throw new Error([`${clave}:`, ...renglones].join('\n'))
}

// ─── Las tiendas de prueba ───────────────────────────────────────────────────
//
// Los nombres no llevan números a propósito: varias afirmaciones de muestra
// son un número pelado ("12", "26") y un "Producto 12" daría un falso
// positivo al buscarlas en la portada.

const LETRAS = 'abcdefghijklmnopqrstuvwxyz'
const sufijo = (i: number) => LETRAS[Math.floor(i / 26) % 26] + LETRAS[i % 26]
const RUBROS = ['Alfa', 'Beta', 'Gama', 'Delta', 'Sigma', 'Omega', 'Kappa', 'Lambda', 'Zeta']

const producto = (i: number, cat: string, conFoto: boolean): Producto => ({
  id: `prod-${sufijo(i)}`,
  nombre: `Articulo ${sufijo(i)}`,
  cat,
  precio: 7000,
  precioAnt: null,
  badge: null,
  hue: 200,
  stock: true,
  imgUrl: conFoto ? `https://fotos.check/${sufijo(i)}.jpg` : null,
  variantOptions: [],
} as Producto)

const categoria = (i: number, conFoto: boolean) => ({
  id: `cat-${i}`, slug: `rubro-${RUBROS[i].toLowerCase()}`, nombre: `Rubro ${RUBROS[i]}`, hue: 30 * i,
  imageUrl: conFoto ? `https://fotos.check/cat-${i}.jpg` : null,
})

type Tienda = Omit<Parameters<typeof plantillaReal>[0], 'base'>
type Apariencia = NonNullable<Tienda['apariencia']>

// Lo que el dueño carga en Apariencia. Los textos llevan "Check" para poder
// buscarlos en la portada sin confundirlos con nada de la plantilla.
const APARIENCIA = {
  showFeaturedSection: true, showNewArrivalsSection: true, showRecommendedSection: true, showBestSellersSection: true,
  showCategoriesSection: true, showSearch: true, showWhatsapp: true,
  showAnnouncementBar: true, shippingText: 'Anuncio Check', announcementScroll: false,
  showParallaxBanner: true, parallaxImageUrl: 'https://fotos.check/parallax.jpg',
  parallaxTitle: 'Parallax Check', parallaxSubtitle: 'Bajada del parallax', parallaxCtaText: 'Ver', parallaxCtaLink: '/catalogo',
  showBrands: true, brandsTitle: 'Marcas Check', brands: [{ id: 'm', name: 'Marca Check' }],
  showVideo: true,
} as unknown as Apariencia

// Recién creada: Apariencia tal como viene, sin nada cargado.
const APARIENCIA_NUEVA = {
  showFeaturedSection: true, showNewArrivalsSection: true, showRecommendedSection: true, showBestSellersSection: true,
  showCategoriesSection: true, showSearch: true, showWhatsapp: true,
  showAnnouncementBar: true, shippingText: null, announcementScroll: false,
  showParallaxBanner: false, parallaxImageUrl: null, showBrands: false, brands: [], showVideo: false,
} as unknown as Apariencia

function tienda(nCats: number, nProductos: number, conFoto: boolean, completa: boolean): Tienda {
  const categorias = Array.from({ length: nCats }, (_, i) => categoria(i, conFoto))
  const productos = Array.from({ length: nProductos }, (_, i) =>
    producto(i, categorias.length ? categorias[i % categorias.length].nombre : '', conFoto))
  return {
    baseUrl: '/tienda/check',
    marca: 'Negocio Check',
    tagline: completa ? 'Bajada Check' : undefined,
    productos,
    categorias,
    apariencia: completa ? APARIENCIA : APARIENCIA_NUEVA,
    // Una tienda sin armar no marcó destacados ni vendió nada: lo único que
    // tiene para mostrar es lo que cargó ("Nuevos ingresos").
    destacados: completa ? productos.slice(0, 5) : [],
    masVendidos: [],
    recomendados: completa ? productos.slice(4, 9) : [],
    topVentas: completa ? productos.slice(7, 12) : [],
    stats: completa ? [{ id: 's', value: 'Dato Check', label: 'etiqueta check' }] : [],
    cupon: completa ? { titulo: 'Cupón Check', bajada: 'Bajada check', codigo: 'CHECK' } : null,
    heroSlides: completa
      ? [
          { id: 'h', titulo: 'Hero Check', subtitulo: 'Bajada del hero', img: 'https://fotos.check/hero.jpg', cta: 'Ver', ctaLink: '/catalogo' },
          { id: 'i', titulo: 'Hero Check Dos', subtitulo: 'Otra bajada', img: null, cta: 'Ver', ctaLink: '' },
        ]
      : [],
    contacto: completa ? { instagram: 'negociocheck' } as Tienda['contacto'] : null,
  }
}

const TIENDAS: Record<string, Tienda> = {
  // Recién creada: sin productos, sin categorías, sin nada editado.
  vacia: tienda(0, 0, false, false),
  // Lo mínimo para vender: una categoría, dos productos, ninguna foto.
  minima: tienda(1, 2, false, false),
  // Una tienda armada, con todo lo que Apariencia deja cargar.
  completa: tienda(4, 12, true, true),
  // Más categorías y productos de los que entran en cualquier grilla.
  grande: tienda(9, 40, true, true),
}

const marca = (nombre: string, texto?: string) => createElement('span', { 'data-check': nombre }, texto)
const nada = () => {}

const ACCIONES: AccionesHome = {
  irAInicio: nada, irACatalogo: nada, irACategoria: nada, irAProducto: nada,
  abrirWhatsapp: nada, irALink: nada, abrirDevolucion: nada,
  navLayout: 'standard',
  nav: [{ label: 'Enlace Check Uno', onClick: nada }, { label: 'Enlace Check Dos', onClick: nada }],
  renderAcciones: () => marca('acciones'),
  renderBuscador: (o) => marca('buscador', o?.placeholder),
  renderVideo: () => marca('video'),
  renderOferta: () => marca('oferta'),
  renderProducto: (x) => marca('producto', x.nombre),
}

// ─── Leer el HTML ────────────────────────────────────────────────────────────

const dibujar = (props: Parameters<typeof Home>[0]) => renderToStaticMarkup(createElement(Home, props))

const ENTIDADES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'" }
const limpio = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Los textos de la portada, uno por nodo: lo que hay entre etiqueta y etiqueta. */
const nodos = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .split(/<[^>]+>/)
    .map(n => limpio(n.replace(/&(amp|lt|gt|quot|#x27);/g, (e) => ENTIDADES[e])))
    .filter(Boolean)

const texto = (html: string) => nodos(html).join(' ')

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * ¿La portada dice `frase`?
 *
 * Una frase corta ("12", "a mano", "Nuevo") tiene que ser un nodo entero: si
 * no, "a mano" aparece adentro de "piedras seleccionadas a mano" y da un
 * falso positivo. Una larga alcanza con que esté, sin pegarse a otra palabra
 * —el cintillo, por ejemplo, la repite seis veces en el mismo nodo—.
 */
function dice(n: string[], frase: string) {
  const f = limpio(frase)
  if (!f) return false
  if (f.length < 14) return n.includes(f)
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapar(f)}(?![\\p{L}\\p{N}])`, 'u')
  return n.some(x => re.test(x))
}

/** Lo que tiene que cumplir CUALQUIER render, vitrina o tienda. */
function basura(html: string): string[] {
  const out: string[] = []
  const t = nodos(html).join(' ')
  for (const m of ['undefined', 'NaN', '[object Object]']) {
    if (t.includes(m)) out.push(`se lee "${m}" en la portada`)
  }
  if (/url\((undefined|null)?\)/.test(html)) out.push('un fondo con url() vacío')
  if (/<img[^>]*\ssrc=""/.test(html)) out.push('una <img> con src vacío (pide la página entera de nuevo)')
  for (const [, ruta] of html.matchAll(/\/plantillas\/([\w.-]+\.(?:jpg|jpeg|png|webp|svg))/g)) {
    if (!existsSync(join(WEB, 'public/plantillas', ruta))) out.push(`foto que no existe: /plantillas/${ruta}`)
  }
  for (const [a] of html.matchAll(/<a\b[^>]*>/g)) {
    const href = /\shref="([^"]*)"/.exec(a)?.[1]
    if (!href || href === '#') out.push(`un enlace sin destino: ${a.slice(0, 80)}`)
  }
  return [...new Set(out)]
}

// Las páginas que una tienda de Órbita tiene de verdad (src/pages/tienda/[slug]).
// Una plantilla no puede mandar a otra: sería un 404 con el diseño puesto.
const RUTAS = /^\/tienda\/check(\/|\/catalogo(\/[\w-]+)?(\?.*)?|\/carrito|\/login|\/registro|\/perfil(\?.*)?|\/producto\/[\w-]+|\/legales\/(terminos|privacidad|cookies)|\/pedido\/[\w-]+)?$/
const rutasInexistentes = (html: string) =>
  [...new Set([...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map(m => m[1]))]
    .filter(h => h.startsWith('/') && !RUTAS.test(h))
    .map(h => `un enlace a ${h}, que no es una página de la tienda`)

// Lo que la maqueta escribe en su hero y en su bajada. Se revisa aparte (ver
// "lo que el adaptador deja pasar", más abajo), así que acá se saca del medio:
// si no, "Oro 18k y piedras seleccionadas a mano" del hero de muestra de
// Premium se cuenta como que Premium promete algo.
const deLaMaqueta = (base: Plantilla) =>
  new Set([base.tagline, ...base.slides.flatMap(s => [s.kicker, s.titulo, s.bajada, s.cta])].filter(Boolean).map(x => limpio(x!)))

// Palabras con las que una plantilla genérica nombra sus categorías de
// muestra y que Órbita también escribe por su cuenta (el pie, un encabezado).
const NEUTRAS = new Set(['Destacados', 'Catálogo', 'Novedades', 'Ofertas', 'Inicio'])

/** Lo que además tiene que cumplir aplicada en una tienda de verdad. */
function enTiendaReal(base: Plantilla, nombreTienda: string, movil: boolean): string[] {
  const t0 = TIENDAS[nombreTienda]
  const p = plantillaReal({ base, ...t0 })
  const soloCuerpo = !base.headerPropio
  const html = dibujar({ p, movil, acciones: ACCIONES, soloCuerpo })
  const maqueta = deLaMaqueta(base)
  const n = nodos(html).filter(x => !maqueta.has(x))
  const out = [...basura(html), ...rutasInexistentes(html)]

  if (!html) out.push('no dibuja nada')

  // La identidad es la del negocio: nada de la maqueta puede quedar a la vista.
  if (dice(n, base.marca)) out.push(`se lee la marca de muestra "${base.marca}"`)
  for (const x of base.productos) {
    if (dice(n, x.nombre)) out.push(`se lee el producto de muestra "${x.nombre}"`)
  }
  // Las categorías reales pisan las de muestra, así que un nombre de muestra
  // a la vista es una lista clavada en el bloque, o un texto por defecto
  // escrito para el rubro de la maqueta al que le falta su `porDefectoReal`.
  for (const [nombre] of base.categorias ?? []) {
    if (NEUTRAS.has(nombre)) continue
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapar(nombre)}(?![\\p{L}\\p{N}])`, 'u')
    if (n.some(x => re.test(x))) out.push(`se lee la categoría de muestra "${nombre}"`)
  }

  // Ninguna promesa que el dueño no escribió (ver `afirmacion` en tipos.ts).
  for (const s of seccionesDe(base.id)) {
    for (const c of s.campos) {
      if (c.afirmacion && c.porDefecto && dice(n, c.porDefecto)) {
        out.push(`promete "${c.porDefecto}" sin que el dueño lo haya escrito (${s.id}.${c.id})`)
      }
    }
  }

  if (!soloCuerpo) {
    if (!html.includes('data-check="acciones"')) out.push('el header no dibuja la cuenta y el carrito reales (renderAcciones)')
    const enlaces = n.includes('Enlace Check Uno')
    // En celular alcanza con el menú, que arranca cerrado con los enlaces adentro.
    if (!enlaces && !(movil && html.includes('aria-label="Abrir menú"'))) {
      out.push(movil
        ? 'en celular no hay forma de llegar al catálogo: ni enlaces ni MenuMovil'
        : 'el header no muestra los enlaces reales de Apariencia (acciones.nav)')
    }
    // Buscar es parte de cualquier tienda: en las dos pantallas.
    if (!html.includes('data-check="buscador"')) out.push('no hay buscador')
    if (base.piePropio) {
      for (const legal of ['Términos y condiciones', 'Política de privacidad', 'Arrepentimiento / Devolución']) {
        if (!n.includes(legal)) out.push(`al pie le falta "${legal}", que es obligatorio`)
      }
    }
  }

  if (t0.productos.length > 0) {
    const algunProducto = html.includes('data-check="producto"') || t0.productos.some(x => n.some(y => y.includes(x.nombre)))
    if (!algunProducto) out.push('la tienda tiene productos y la portada no muestra ninguno')
  }

  return out.map(e => `[${nombreTienda} · ${movil ? 'celular' : 'escritorio'}] ${e}`)
}

// ─── Contraste ───────────────────────────────────────────────────────────────

const luminancia = (hex: string) => {
  const h = hex.replace('#', '')
  const c = (h.length === 3 ? [...h].map(x => x + x).join('') : h).match(/../g)!.map(x => parseInt(x, 16) / 255)
  const [r, g, b] = c.map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const contraste = (a: string, b: string): number | null => {
  if (!HEX.test(a) || !HEX.test(b)) return null
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

// ─── El catálogo ─────────────────────────────────────────────────────────────

describe('catálogo de plantillas', () => {
  it('los ids no se repiten', () => {
    const ids = PLANTILLAS.map(p => p.id)
    sinProblemas('catálogo > ids', ids.filter((id, i) => ids.indexOf(id) !== i).map(id => `${id} está dos veces`))
  })

  // Si no coinciden, el panel ofrece una plantilla que la API rechaza con 400.
  // Se lee el archivo como texto: importarlo arrastra class-validator.
  it('coincide con HOME_TEMPLATES_DISPONIBLES de la API', () => {
    const dto = leer(join(WEB, '../api/src/businesses/dto/set-home-template.dto.ts'))
    const lista = /HOME_TEMPLATES_DISPONIBLES = \[([\s\S]*?)\] as const/.exec(dto)?.[1] ?? ''
    const enApi = [...lista.matchAll(/^\s*'([\w-]+)'/gm)].map(m => m[1]).sort()
    expect(enApi).toEqual(PLANTILLAS.map(p => p.id).sort())
  })

  // La portada es la foto de la tarjeta en la galería: dos vecinas con la
  // misma foto parecen la misma plantilla.
  it('cada plantilla visible tiene una portada distinta', () => {
    const portadas = visibles.map(p => p.slides[0]?.img)
    sinProblemas('catálogo > portadas', visibles
      .filter((p, i) => portadas.indexOf(p.slides[0]?.img) !== i)
      .map(p => `${p.id}: repite la portada de otra plantilla`))
  })

  // Una fuente que no está en la lista no se baja: la variable CSS la nombra
  // y el navegador cae al fallback sin avisar. Geist no hace falta: es la
  // fuente de Órbita y ya viene cargada (ver lib/fonts.ts).
  it('las tipografías están en FUENTES_PLANTILLAS', () => {
    const lista = /const FUENTES_PLANTILLAS = \[([\s\S]*?)\]/.exec(leer(join(AQUI, 'piezas.tsx')))?.[1] ?? ''
    const cargadas = new Set(['Geist', ...[...lista.matchAll(/'([^:']+):/g)].map(m => m[1].replace(/\+/g, ' '))])
    const faltan = PLANTILLAS.flatMap(p =>
      [p.tema.fh, p.tema.fb]
        .map(f => /^"([^"]+)"/.exec(f)?.[1])
        .filter((f): f is string => !!f && !cargadas.has(f))
        .map(f => `${p.id}: ${f} no está en FUENTES_PLANTILLAS`))
    sinProblemas('catálogo > tipografías', [...new Set(faltan)])
  })

  it('una plantilla con receta no declara secciones a mano, y al revés', () => {
    const mal: string[] = []
    for (const p of PLANTILLAS) {
      if (!!p.receta !== (p.layout === 'receta')) mal.push(`${p.id}: layout 'receta' y campo receta van juntos`)
      if (p.receta && SECCIONES_POR_PLANTILLA[p.id]) mal.push(`${p.id}: su editor sale de la receta, sobra en SECCIONES_POR_PLANTILLA`)
      const filas = (p.receta?.bloques ?? []).flatMap(b => (b.t === 'fila' ? [b.id] : []))
      if (new Set(filas).size !== filas.length) mal.push(`${p.id}: dos filas comparten id, y con él su encabezado`)
    }
    for (const id of Object.keys(SECCIONES_POR_PLANTILLA)) {
      if (!PLANTILLAS.some(p => p.id === id)) mal.push(`${id}: tiene secciones y no existe en datos.tsx`)
    }
    sinProblemas('catálogo > recetas', mal)
  })
})

// ─── El editor ───────────────────────────────────────────────────────────────
//
// El esquema de secciones.ts y el bloque de homes.tsx se escriben por
// separado, y nada los ata: un `txt('taller', 'titulo')` sin su campo dibuja
// vacío para siempre, y un campo sin su `txt()` es un casillero del editor
// que no mueve nada.

describe('el editor de cada plantilla coincide con lo que dibuja', () => {
  const homes = leer(join(AQUI, 'homes.tsx'))
  // Cada bloque arranca en su `if (p.layout === '…')` y termina en el
  // separador `// ── NOMBRE ──` del que sigue.
  const separadores = [...homes.matchAll(/^ {2}\/\/ ── /gm)].map(m => m.index!)
  const hasta = (desde: number) => separadores.find(i => i > desde) ?? homes.length
  const bloqueDe = (layout: string) => {
    const m = new RegExp(`^ {2}if \\(p\\.layout === '${layout}'`, 'm').exec(homes)
    if (m) return homes.slice(m.index, hasta(m.index))
    // El último bloque del archivo no lleva `if`: es lo que queda cuando no
    // entró ninguno de los de arriba.
    const ultimo = separadores[separadores.length - 1]
    return /^ {2}if \(p\.layout === /m.test(homes.slice(ultimo)) ? null : homes.slice(ultimo)
  }

  for (const p of PLANTILLAS.filter(x => !x.receta)) {
    it(p.id, () => {
      const bloque = bloqueDe(p.layout)
      expect(bloque, `no hay un bloque para el layout '${p.layout}' en homes.tsx`).toBeTruthy()

      const esquema = seccionesDe(p.id)
      const declarados = new Set(esquema.flatMap(s => s.campos.map(c => `${s.id}.${c.id}`)))
      const usados = new Set<string>()
      // Las secciones leídas con una clave armada (`i${n}`, `n${k}v`): ahí
      // no se puede saber qué campo es, así que se dan todos por usados.
      // El cintillo también: lo lee Home() una sola vez, arriba de todos los
      // bloques, para la vitrina (en la tienda el anuncio es el de Apariencia).
      const dinamicas = new Set<string>(['cintillo'])
      for (const [, s, c] of bloque!.matchAll(/\b(?:txt|activo)\(\s*'([\w-]+)'\s*,\s*'([\w-]+)'\s*\)/g)) usados.add(`${s}.${c}`)
      for (const [, s] of bloque!.matchAll(/\b(?:txt|activo)\(\s*'([\w-]+)'\s*,\s*[^')]/g)) dinamicas.add(s)
      for (const [, s] of bloque!.matchAll(/\blugares\(\s*[^,]+,\s*'([\w-]+)'/g)) dinamicas.add(s)

      const mal: string[] = []
      for (const u of usados) if (!declarados.has(u)) mal.push(`homes.tsx lee ${u} y secciones.ts no lo declara`)
      for (const d of declarados) {
        if (!usados.has(d) && !dinamicas.has(d.split('.')[0])) mal.push(`secciones.ts ofrece ${d} y homes.tsx no lo dibuja`)
      }
      const ids = esquema.map(s => s.id)
      if (new Set(ids).size !== ids.length) mal.push('dos secciones comparten id')
      sinProblemas(`editor > ${p.id}`, mal)
    })
  }
})

// ─── El diseño ───────────────────────────────────────────────────────────────

describe('el tema de cada plantilla se lee', () => {
  for (const p of PLANTILLAS) {
    it(p.id, () => {
      const t = p.tema
      // 4.5 es el mínimo de lectura para texto corrido. Al botón se le pide
      // 3: va en negrita y es una sola palabra, pero debajo de eso el "Ver
      // todo" blanco sobre un primario claro directamente no se ve.
      const pares: [string, string, string, number][] = [
        ['texto sobre fondo', t.text, t.bg, 4.5],
        ['texto sobre superficie', t.text, t.surf, 4.5],
        ['texto apagado sobre fondo', t.muted, t.bg, 3],
        ['texto del botón sobre el primario', t.onPrimary, t.primary, 3],
      ]
      sinProblemas(`tema > ${p.id}`, pares.flatMap(([que, a, b, min]) => {
        const c = contraste(a, b)
        return c !== null && c < min ? [`${que}: contraste ${c.toFixed(2)}, mínimo ${min}`] : []
      }))
    })
  }
})

// ─── La vitrina del panel ────────────────────────────────────────────────────

describe('la vitrina del panel', () => {
  for (const p of PLANTILLAS) {
    it(p.id, () => {
      sinProblemas(`vitrina > ${p.id}`, [false, true].flatMap(movil => {
        const html = dibujar({ p, movil })
        return [...(html ? [] : ['no dibuja nada']), ...basura(html)].map(e => `[${movil ? 'celular' : 'escritorio'}] ${e}`)
      }))
    })
  }
})

// ─── Aplicada en una tienda ──────────────────────────────────────────────────

describe('aplicada en una tienda de verdad', () => {
  for (const p of PLANTILLAS) {
    it(p.id, () => {
      sinProblemas(`tienda > ${p.id}`, Object.keys(TIENDAS).flatMap(nombre => [false, true].flatMap(movil => enTiendaReal(p, nombre, movil))))
    })
  }

  // ── Lo que el adaptador deja pasar ──
  // No son de una plantilla en particular: `plantillaReal()` conserva estos
  // dos datos de la maqueta cuando el negocio no cargó los suyos.
  const enMinima = (p: Plantilla) =>
    nodos(dibujar({ p: plantillaReal({ base: p, ...TIENDAS.minima }), movil: false, acciones: ACCIONES, soloCuerpo: !p.headerPropio }))

  it('un negocio sin bajada no muestra la de la maqueta', () => {
    sinProblemas('tienda > bajada de la maqueta', PLANTILLAS
      .filter(p => enMinima(p).includes(limpio(p.tagline)))
      .map(p => `${p.id}: se lee "${p.tagline}"`))
  })

  it('un negocio sin hero cargado no muestra el de la maqueta', () => {
    // Sin contar los títulos que también son el nombre de un estante: el
    // segundo slide de muestra de Base se llama "Recién llegados", igual que
    // la fila de Nuevos ingresos.
    const deEstante = new Set(Object.values(TITULOS_ESTANTE).flat())
    sinProblemas('tienda > hero de la maqueta', PLANTILLAS.flatMap(p => {
      const n = enMinima(p)
      return p.slides.map(x => limpio(x.titulo)).filter(t => !deEstante.has(t) && n.includes(t)).map(t => `${p.id}: se lee "${t}"`)
    }))
  })
})

// ─── El estándar: lo de Apariencia vale con plantilla ────────────────────────
//
// Toda plantilla ubica todo lo de Apariencia, y el dueño lo prende y lo apaga
// con los mismos interruptores que sin plantilla. Acá se prueba de los dos
// lados: prendido se ve, apagado no.

describe('una plantilla respeta lo que se configura en Apariencia', () => {
  const t0 = TIENDAS.completa
  const html = (p: Plantilla, ap: Partial<Apariencia>, movil = false, extra: Partial<Tienda> = {}, acc: Partial<AccionesHome> = {}) =>
    dibujar({
      p: plantillaReal({ base: p, ...t0, ...extra, apariencia: { ...APARIENCIA, ...ap } as Apariencia }),
      movil, acciones: { ...ACCIONES, ...acc }, soloCuerpo: !p.headerPropio,
    })
  const ver = (p: Plantilla, ap: Partial<Apariencia>, movil = false) => nodos(html(p, ap, movil))
  const tiene = (n: string[], frase: string) => n.some(x => x.includes(frase))
  // El primer producto de cada estante (ver `tienda()`): es el que entra en
  // cualquier fila, por angosta que sea. Se prueba con un estante prendido
  // por vez, así que no importa que dos arranquen con el mismo.
  const PRIMERO = { destacados: 'Articulo aa', nuevos: 'Articulo aa', recomendados: 'Articulo ae', topVentas: 'Articulo ah' } as const
  const INTERRUPTOR = { destacados: 'showFeaturedSection', nuevos: 'showNewArrivalsSection', recomendados: 'showRecommendedSection', topVentas: 'showBestSellersSection' } as const
  const SIN_ESTANTES = { showFeaturedSection: false, showNewArrivalsSection: false, showRecommendedSection: false, showBestSellersSection: false }

  // Productos que no son un estante y por eso no tienen interruptor: las
  // filas por categoría (Atleta), y las selecciones que el dueño arma a mano
  // (los pasos de Nocturno, la lista de Papelería, la rutina de Glow).
  const CON_PRODUCTOS_SIN_ESTANTE = new Set(['atleta', 'nocturno', 'papeleria', 'glow'])
  const productosSinEstante = (p: Plantilla) =>
    p.receta ? p.receta.bloques.some(b => b.t === 'porCategoria') : CON_PRODUCTOS_SIN_ESTANTE.has(p.id)
  // Sin una sección de categorías que apagar: Mosaico arranca con un muro de
  // categorías que es su hero, y Atleta las muestra como filas de productos.
  const SIN_SECCION_DE_CATEGORIAS = new Set(['mosaico', 'atleta'])

  for (const p of PLANTILLAS) {
    it(p.id, () => {
      const mal: string[] = []
      const propio = !!p.headerPropio

      // Una receta ubica todos los bloques, una vez cada uno. (Un bloque
      // propio dibuja los suyos con su diseño y el resto con `resto()`: eso
      // se prueba abajo, mirando la portada.)
      if (p.receta) {
        const bloques = p.receta.bloques
        for (const b of BLOQUES_ESTANDAR) {
          const n = bloques.filter(x => x.t === b || (b === 'categorias' && x.t === 'porCategoria')).length
          if (n === 0) mal.push(`no ubica el bloque '${b}': el dueño lo prende en Apariencia y no aparece`)
          if (n > 1 && b !== 'categorias') mal.push(`ubica ${n} veces el bloque '${b}'`)
        }
        for (const e of ESTANTES) {
          const n = bloques.filter(x => x.t === 'fila' && x.fuente === e).length
          if (n !== 1) mal.push(`tiene ${n} filas de '${e}' (tiene que ser una)`)
        }
      }

      for (const movil of [false, true]) {
        const donde = movil ? 'celular' : 'escritorio'
        const todo = ver(p, {}, movil)
        const nada = ver(p, { ...SIN_ESTANTES, showAnnouncementBar: false, showParallaxBanner: false, showBrands: false }, movil)

        for (const e of ESTANTES) {
          if (!tiene(ver(p, { ...SIN_ESTANTES, [INTERRUPTOR[e]]: true }, movil), PRIMERO[e])) mal.push(`[${donde}] el estante '${e}' prendido no se ve`)
        }
        // Con todo prendido se ven los cuatro: el título de cada uno está.
        for (const e of ESTANTES) {
          if (!todo.includes(TITULOS_ESTANTE[e][2])) mal.push(`[${donde}] con los cuatro estantes prendidos falta "${TITULOS_ESTANTE[e][2]}"`)
        }
        if (!productosSinEstante(p) && tiene(nada, 'Articulo ')) mal.push(`[${donde}] con los cuatro estantes apagados sigue mostrando productos`)
        for (const e of ESTANTES) {
          if (nada.includes(TITULOS_ESTANTE[e][2])) mal.push(`[${donde}] con los estantes apagados queda el título "${TITULOS_ESTANTE[e][2]}" sin productos`)
        }

        // El anuncio de las que no dibujan su header lo pone la tienda (AnnouncementBar).
        const pares: [string, string][] = [['el parallax', 'Parallax Check'], ['las marcas', 'Marca Check'], ...(propio ? [['el anuncio', 'Anuncio Check'] as [string, string]] : [])]
        for (const [que, frase] of pares) {
          if (!tiene(todo, frase)) mal.push(`[${donde}] ${que} de Apariencia no se ve`)
          if (tiene(nada, frase)) mal.push(`[${donde}] ${que} se ve aunque esté apagado en Apariencia`)
        }
        if (p.receta && !tiene(todo, 'Dato Check')) mal.push(`[${donde}] las estadísticas de Apariencia no se ven`)
        if (html(p, {}, movil, { stats: [] }).includes('Dato Check')) mal.push(`[${donde}] las estadísticas se ven aunque no haya ninguna`)

        if (!html(p, {}, movil).includes('data-check="video"')) mal.push(`[${donde}] el video de Apariencia no se ve`)
        if (!html(p, {}, movil).includes('data-check="oferta"')) mal.push(`[${donde}] la oferta con cuenta regresiva no se ve`)
        if (html(p, {}, movil, {}, { renderVideo: () => null }).includes('data-check="video"')) mal.push(`[${donde}] dibuja el video aunque no haya ninguno`)

        if (propio) {
          // Apagado, la tienda le pasa un buscador que no dibuja nada (ver Inicio.tsx).
          const sinBuscar = html(p, { showSearch: false }, movil, {}, { renderBuscador: () => null })
          if (sinBuscar.includes('data-check="buscador"')) mal.push(`[${donde}] el buscador se ve aunque esté apagado en Apariencia`)
          if (/buscar…|Buscar…|¿Qué estás buscando\?/.test(sinBuscar)) mal.push(`[${donde}] con el buscador apagado dibuja el de muestra, que no busca nada`)
        }
      }

      // Las categorías y el WhatsApp se prueban contra la portada entera: sus
      // textos son de la plantilla, no de la tienda de prueba.
      const con = html(p, {})
      const veces = (h: string) => h.split('Rubro Alfa').length
      const sinSeccion = p.receta ? !p.receta.bloques.some(b => b.t === 'categorias') : SIN_SECCION_DE_CATEGORIAS.has(p.id)
      if (!sinSeccion && !(veces(con) > veces(html(p, { showCategoriesSection: false })))) {
        mal.push('la sección de categorías se ve aunque esté apagada en Apariencia')
      }
      // Apagado, la tienda no le pasa a la plantilla cómo abrir el chat.
      const sinWpp = html(p, { showWhatsapp: false }, false, {}, { abrirWhatsapp: undefined })
      if (/whatsapp/i.test(texto(sinWpp).replace(/Enlace Check \w+/g, ''))) mal.push('con el WhatsApp apagado queda un texto que invita a escribir por WhatsApp')

      sinProblemas(`estándar > ${p.id}`, mal)
    })
  }

  // El caso por el que existe todo esto: una plantilla que traía una sola
  // fila, "Top ventas", en una tienda que todavía no vendió nada.
  it('una tienda que recién empieza muestra sus productos, y no un "Más vendidos" vacío', () => {
    sinProblemas('estándar > tienda nueva', PLANTILLAS.flatMap(p => {
      const n = nodos(dibujar({ p: plantillaReal({ base: p, ...TIENDAS.minima }), movil: false, acciones: ACCIONES, soloCuerpo: !p.headerPropio }))
      return [
        ...(tiene(n, 'Articulo aa') ? [] : [`${p.id}: no muestra los productos que la tienda cargó`]),
        ...(n.includes('Recién llegados') ? [] : [`${p.id}: sus productos no salen bajo "Recién llegados", que es lo único que tiene`]),
        ...(['Más vendidos', 'Recomendados para vos', 'Productos destacados'].filter(t => n.includes(t)).map(t => `${p.id}: dibuja "${t}" sin productos`)),
      ]
    }))
  })
})

// ─── El editor: cada control mueve algo en la portada ────────────────────────
//
// El editor de una plantilla (Avanzado → Plantillas) le ofrece al dueño el
// hero, las secciones propias, el contenido de Apariencia y el pie. Cada cosa
// que le deja cargar tiene que verse: un campo que no mueve nada es una
// promesa del panel que la tienda no cumple.
//
// Salió de un caso real: en Lienzo el editor pedía la imagen de cada slide y
// el hero de Lienzo no dibujaba ninguna. Acá se prueba al revés de como se
// escribió ese bug: no se mira el código del editor, se cambia cada dato que
// el editor deja cambiar y se exige que la portada cambie.

describe('cada control del editor mueve algo en la portada', () => {
  const t0 = TIENDAS.completa
  // La portada en las dos pantallas, pegadas: alcanza con que el cambio se
  // vea en una (la aclaración de Nocturno, por ejemplo, es solo de escritorio).
  const portada = (p: Plantilla, extra: Partial<Tienda> = {}, ap: Partial<Apariencia> = {}) =>
    [false, true].map(movil => dibujar({
      p: plantillaReal({ base: p, ...t0, ...extra, apariencia: { ...APARIENCIA, ...ap } as Apariencia }),
      movil, acciones: ACCIONES, soloCuerpo: !p.headerPropio,
    })).join('\n')

  const slide = (n: string, img: string | null = `https://fotos.check/slide-${n}.jpg`) =>
    ({ id: n, titulo: `Titulo ${n}`, subtitulo: `Bajada ${n}`, img, cta: `Boton ${n}`, ctaLink: '/catalogo' })

  for (const p of PLANTILLAS) {
    it(p.id, () => {
      const mal: string[] = []

      // ── Pestaña Hero ──
      // Vidriera no entra: su hero lo dibuja la tienda (HeroCarousel), no Home().
      if (p.heroPropio) {
        const h = portada(p, { heroSlides: [slide('uno'), slide('dos')] })
        for (const [que, frase] of [['el título', 'Titulo uno'], ['la bajada', 'Bajada uno'], ['el botón', 'Boton uno'], ['la imagen', 'slide-uno.jpg']]) {
          if (!h.includes(frase)) mal.push(`Hero: ${que} del slide se carga en el editor y no se ve en la portada`)
        }
        // Sin imagen la portada tiene que seguir dibujando el hero.
        const sinFoto = portada(p, { heroSlides: [slide('uno', null)] })
        if (!sinFoto.includes('Titulo uno')) mal.push('Hero: sin imagen el slide desaparece')
        // Un segundo slide tiene que notarse (rota, o tiene su lugar fijo).
        if (p.heroMaxSlides !== 1 && h === portada(p, { heroSlides: [slide('uno')] })) {
          mal.push('Hero: agregar un segundo slide no cambia nada')
        }
        // Y uno más allá del tope no: el editor no lo deja cargar.
        if (p.heroMaxSlides) {
          const tope = Array.from({ length: p.heroMaxSlides }, (_, i) => slide(`n${i}`))
          if (portada(p, { heroSlides: tope }) !== portada(p, { heroSlides: [...tope, slide('demas')] })) {
            mal.push(`Hero: dice usar ${p.heroMaxSlides} slides y dibuja más`)
          }
        }
      }

      // ── Pestaña Secciones ──
      // Con todos los campos de la sección cargados, cambiar uno tiene que
      // cambiar la portada. (El cintillo no se edita ahí: es el anuncio.)
      const valores = (c: { id: string; tipo: string; porDefecto?: string }, otro: boolean) =>
        c.tipo === 'switch' ? (otro ? '' : 'si')
          : c.tipo === 'imagen' ? `https://fotos.check/sec-${c.id}-${otro ? 'b' : 'a'}.jpg`
          : c.tipo === 'seleccion' ? (otro ? 'prod:prod-ac' : 'prod:prod-ab')
          // Un campo de posición ("72,78"): con texto libre cae a su default.
          : /^\d+,\d+$/.test(c.porDefecto ?? '') ? (otro ? '90,90' : '10,10')
          : `Campo ${c.id} ${otro ? 'dos' : 'uno'}`
      for (const sec of seccionesDe(p.id).filter(x => x.id !== 'cintillo')) {
        const base = Object.fromEntries(sec.campos.map(c => [c.id, valores(c, false)]))
        const antes = portada(p, { secciones: { [sec.id]: base } })
        for (const c of sec.campos) {
          const despues = portada(p, { secciones: { [sec.id]: { ...base, [c.id]: valores(c, true) } } })
          if (antes === despues) mal.push(`Secciones: "${sec.nombre} → ${c.label}" se edita y no cambia nada en la portada`)
        }
      }

      // ── Pestaña Contenido ──
      const normal = portada(p)
      if (p.headerPropio) {
        // El modo cartelera del anuncio.
        if (normal === portada(p, {}, { announcementScroll: true })) mal.push('Contenido: "Mostrar como cartelera" no cambia nada')
        // Varios ítems en el anuncio, uno por línea.
        const varios = portada(p, {}, { shippingText: 'Aviso Uno\nAviso Dos' })
        if (!varios.includes('Aviso Uno') || !varios.includes('Aviso Dos')) mal.push('Contenido: con dos ítems en el anuncio no se ven los dos')
      }
      // La barra de estadísticas, en las que el editor la ofrece.
      if (p.usaStats !== false && !normal.includes('Dato Check')) mal.push('Contenido: el editor ofrece la barra de estadísticas y la portada no la dibuja')
      if (p.usaStats === false && normal.includes('Dato Check')) mal.push('Contenido: dibuja las estadísticas y el editor no las ofrece (falta sacar usaStats: false)')
      // El parallax, campo por campo.
      for (const [que, frase] of [['el título', 'Parallax Check'], ['el subtítulo', 'Bajada del parallax'], ['la imagen', 'parallax.jpg']]) {
        if (!normal.includes(frase)) mal.push(`Contenido: ${que} del parallax no se ve`)
      }
      if (normal === portada(p, {}, { parallaxCtaText: 'Otro Boton' })) mal.push('Contenido: el texto del botón del parallax no cambia nada')
      // Las marcas: el título, y el logo cuando hay.
      if (!normal.includes('Marcas Check')) mal.push('Contenido: el título de las marcas no se ve')
      if (!portada(p, {}, { brands: [{ id: 'm', name: 'Marca Check', logoUrl: 'https://fotos.check/logo-marca.png' }] } as Partial<Apariencia>).includes('logo-marca.png')) {
        mal.push('Contenido: el logo de una marca no se ve')
      }

      // ── Pestaña Pie ──
      if (p.piePropio) {
        if (!normal.includes('Bajada Check')) mal.push('Pie: la descripción no se ve')
        const sinRedes = portada(p, {}, { showSocialFooter: false } as Partial<Apariencia>)
        if (!normal.includes('instagram.com')) mal.push('Pie: las redes cargadas en Contacto no se ven')
        if (sinRedes.includes('instagram.com')) mal.push('Pie: "Redes sociales en el pie de página" apagado y las redes siguen ahí')
      }
      // El cupón: el editor ofrece la tarjeta con `dibujaCupon()`.
      if (dibujaCupon(p)) {
        for (const [que, frase] of [['el título', 'Cupón Check'], ['la aclaración', 'Bajada check'], ['el código', 'CHECK']]) {
          if (!normal.includes(frase)) mal.push(`Pie: ${que} del cupón no se ve`)
        }
      } else if (normal.includes('Cupón Check')) {
        mal.push('Pie: dibuja el cupón y el editor no lo ofrece (ver dibujaCupon en secciones.ts)')
      }

      sinProblemas(`editor-portada > ${p.id}`, mal)
    })
  }
})

// El header de la plantilla se usa en el catálogo, la ficha y el carrito, no
// solo en la portada (ver `soloHeader` en homes.tsx).
describe('el header suelto, para el resto de la tienda', () => {
  for (const p of PLANTILLAS.filter(x => x.headerPropio)) {
    it(p.id, () => {
      const mal: string[] = []
      if (!LAYOUTS_CON_HEADER_PROPIO.has(p.layout)) mal.push('marca headerPropio y su layout no está en LAYOUTS_CON_HEADER_PROPIO')
      for (const movil of [false, true]) {
        const html = dibujar({ p: plantillaReal({ base: p, ...TIENDAS.completa }), movil, acciones: ACCIONES, soloHeader: true })
        const donde = movil ? 'celular' : 'escritorio'
        if (!html.includes('data-check="acciones"')) mal.push(`[${donde}] sin cuenta ni carrito`)
        if (html.includes('data-check="producto"')) mal.push(`[${donde}] dibuja productos: devolvió la portada entera, no solo el header`)
        mal.push(...basura(html).map(e => `[${donde}] ${e}`))
      }
      sinProblemas(`header > ${p.id}`, mal)
    })
  }
})
