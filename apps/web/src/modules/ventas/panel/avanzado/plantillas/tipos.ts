// Tipos y helpers de las plantillas de Home (paquete Avanzado).
//
// Una plantilla NO es un tema de colores: es una portada distinta. Por eso
// cada una trae su propio `layout` (ver homes.tsx), su marca de muestra y sus
// productos de muestra — lo que se elige acá es la puerta de entrada de la
// tienda, no la tienda.

import type { ReactNode } from 'react'

export const IMG = '/plantillas'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Tema {
  bg: string; surf: string; soft: string; text: string; muted: string; border: string
  primary: string; onPrimary: string; accent: string
  fh: string; fb: string; radio: number; oscuro: boolean
  sombra: string
}

export type Layout =
  // El esqueleto de Vidriera, extraído para poder reusarlo: una plantilla
  // nueva puede tomarlo en vez de escribir el suyo. (Semilla, Lunar, Tueste y
  // Piñón lo usaron y se dieron de baja — se parecían demasiado a Vidriera;
  // ver el commit que las quita.)
  | 'tienda'
  // Un esqueleto propio por plantilla — ver el bloque de cada una en
  // homes.tsx. 'vidriera' quedó como alias de 'tienda'.
  | 'vidriera' | 'escaparate' | 'mosaico' | 'premium' | 'nocturno' | 'glow'
  | 'papeleria' | 'corralon' | 'atleta' | 'patitas' | 'bodega' | 'crecer'
  | 'circuito' | 'vera' | 'cobijo' | 'nitida'
  // Las que se arman con el vocabulario compartido (ver Receta): el
  // bloque no lo escribe cada una, lo dibuja el mismo render.
  | 'receta'

export interface Producto {
  nombre: string; precio: string; antes?: string; transfer?: string; cuotas?: string
  badge?: string; badgeTono?: 'azul' | 'violeta' | 'verde' | 'rojo'
  tag?: string; estrellas?: number; resenas?: number; stock?: string
  colores?: string[]
  img: string; img2?: string
  // El NOMBRE de su categoría. Solo con datos reales: lo necesita cualquier
  // sección que arme filas por categoría ("Camisas street" y abajo camisas de
  // verdad). Sin esto, lo único que se podía hacer era cortar el array de
  // destacados en pedazos, que es como Atleta terminó mostrando los mismos
  // productos bajo tres títulos distintos.
  cat?: string
  // Solo con datos reales (ver plantillaReal.ts): los mismos swatches que
  // dibuja la ProductCard real, para plantillas que arman su PROPIA tarjeta
  // en vez de reusar `renderProducto`/ProductCard (ver Escaparate en
  // homes.tsx) — `colores` (hex a mano) es de la maqueta nomás, esto es lo
  // que hay que pintar cuando el producto es real.
  variantOptions?: { name: string; isVisual: boolean; values: { value: string; imageUrl: string | null }[] }[]
  // Solo cuando los datos vienen de la tienda real (ver adaptador en
  // cliente/inicio/plantillaReal.ts): a dónde lleva la tarjeta al hacerle
  // click. En las plantillas de muestra no existe y la tarjeta no navega.
  slug?: string
}

// ─── Recetas ─────────────────────────────────────────────────────────────────
//
// Las dieciséis primeras plantillas tienen cada una su bloque de JSX en
// homes.tsx, y varias traen secciones que ninguna otra tiene ("El taller", la
// carta de Bodega, el muro de Mosaico). Eso les da personalidad, pero tiene un
// precio: cada una necesita su propio editor, y sumar una es escribir una
// pantalla entera.
//
// Una RECETA es la otra mitad del catálogo: la plantilla declara qué bloques
// muestra y en qué orden, y el render es compartido. Se cambia el DISEÑO —la
// paleta, la tipografía, el tipo de hero, la forma de las categorías, el ritmo
// de las filas— sin inventar funcionalidad nueva ni un editor nuevo. El
// formulario de edición sale solo de la receta.
//
// Las dos formas conviven: una plantilla con una idea rara sigue escribiendo
// su bloque a mano; una que se arma con el vocabulario de siempre usa receta.

export type BloqueReceta =
  // El hero. `pleno` es foto a sangre con el texto encima; `partido`, mitad
  // color y mitad foto; `minimo`, solo tipografía sobre un fondo liso; y
  // `tarjeta`, la foto adentro de una caja con aire alrededor.
  | { t: 'hero'; estilo: 'pleno' | 'partido' | 'minimo' | 'tarjeta' }
  // Las categorías del negocio. Cuatro formas distintas de la misma data.
  | { t: 'categorias'; estilo: 'grilla' | 'pastillas' | 'tira' | 'altas'; cols?: number }
  // Una fila de productos. `id` es la clave de su encabezado editable, así que
  // dos filas de la misma plantilla no pueden repetirlo.
  | { t: 'fila'; id: string; fuente?: 'destacados' | 'masVendidos' | 'catalogo'; estilo?: 'grilla' | 'tira' | 'sangre'; cols?: number }
  // El nombre de una categoría y, abajo, productos DE esa categoría.
  | { t: 'porCategoria'; cuantas?: number; porFila?: number }
  // Un espacio de anuncio. No todas las plantillas llevan uno, y las que sí
  // no tienen por qué usar la misma forma: `plena` es la franja de color de
  // punta a punta, `filete` una línea fina con el texto centrado, `cartelera`
  // el texto corriendo en loop, y `apilada` un bloque centrado con aire.
  | { t: 'franja'; estilo?: 'plena' | 'filete' | 'cartelera' | 'apilada' }
  // Banner con la foto quieta y el contenido pasando por encima. Es el mismo
  // efecto que ofrece Apariencia; acá es un bloque más, para las plantillas
  // donde pega. En celular y con `prefers-reduced-motion` se apaga solo.
  | { t: 'parallax' }
  // Una foto ancha con texto encima, al final.
  | { t: 'campana' }
  // El bloque de consulta por WhatsApp.
  | { t: 'whatsapp' }

export interface Receta {
  /** Dónde va el logo del header: a la izquierda (default) o centrado. */
  header?: 'izquierda' | 'centrado'
  bloques: BloqueReceta[]
}

export interface Slide {
  img: string; kicker?: string; titulo: string; bajada: string; cta: string
  // A dónde lleva el CTA. Solo lo trae un slide con datos reales (ver
  // plantillaReal.ts, que lo arma desde `ctaLink` de Apariencia); en las
  // plantillas de muestra no existe y el CTA no navega — mismo criterio que
  // `Producto.slug`.
  link?: string
}

// ─── Secciones editables ─────────────────────────────────────────────────────
//
// Cada plantilla tiene secciones que las demás no tienen ("El taller" de
// Premium, la carta de varietales de Bodega, el muro de Mosaico) y las tiene
// en SU orden. Por eso el editor no puede ser una lista fija de campos como
// Apariencia: cada plantilla declara acá qué se puede editar de ella, y el
// panel dibuja ese formulario solo (ver Apariencia.tsx, pestaña "Secciones").
//
// Lo que se guarda va a `homeTemplateData.secciones[idSeccion][idCampo]`, un
// JSON por negocio — sin migración de base ni una columna por plantilla.
// Cualquier campo sin valor cae al texto de la maqueta, así que una tienda
// que no editó nada se ve idéntica a su vitrina.

export type TipoCampo =
  | 'texto'    // una línea
  | 'parrafo'  // varias líneas
  | 'imagen'   // una foto subida por el dueño
  // Un interruptor. Se guarda como texto igual que el resto ('si' o vacío)
  // porque la bolsa de secciones es un mapa de strings de punta a punta —
  // ver `secciones` en home-template-data.dto.ts. Leerlo: helper `activo()`
  // en homes.tsx.
  | 'switch'
  // Elegir UNA cosa del catálogo real del negocio: una categoría o un
  // producto. Se guarda como `cat:<slug>` o `prod:<id>` —con prefijo, igual
  // que los `headerLinks`, para que una categoría y un producto no choquen
  // nunca— y el panel dibuja un desplegable con lo que la tienda tiene de
  // verdad.
  //
  // Existe porque una sección como "Armá tu setup" (Nocturno) no se puede
  // rellenar sola con las tres primeras categorías: qué va ahí es una
  // decisión del dueño, no del orden en que estén cargadas. Sin elegir nada,
  // la sección no se dibuja.
  | 'seleccion'

export interface CampoSeccion {
  id: string
  label: string
  tipo: TipoCampo
  /** Ayuda debajo del label, para explicar qué es o dónde se ve. */
  help?: string
  /** Tope de caracteres: es de DISEÑO (el texto desborda la caja), no de seguridad. */
  max?: number
  /**
   * El contenido con el que se diseñó la sección. Es LA fuente de verdad, y se
   * usa en los dos lados: lo dibuja la portada cuando el dueño no editó nada
   * (helper `txt()` en homes.tsx) y aparece precargado en el editor, para que
   * se vea qué se está por cambiar en vez de una caja vacía.
   *
   * Por eso vive acá y no suelto adentro del bloque de homes.tsx: con el texto
   * en dos lugares, el día que se retoca una copia el editor muestra una cosa
   * y la tienda otra.
   */
  porDefecto?: string
  /**
   * Este campo AFIRMA algo del negocio: un descuento, un envío gratis, una
   * cantidad, una certificación, un plazo de entrega. No es una etiqueta
   * ("Más vendidos") sino una promesa al comprador.
   *
   * Su `porDefecto` se sigue usando en la vitrina del panel —es lo que hace
   * que la plantilla se venda con una portada creíble— pero en la TIENDA REAL
   * no se dibuja hasta que el dueño lo escriba. Mosaico mostraba −40% / −25% /
   * −30% sobre las categorías de una tienda que nunca puso esos descuentos, y
   * media docena de plantillas prometían envío gratis y cuotas sin interés que
   * el negocio no había configurado.
   *
   * Lo resuelve `txt()` en homes.tsx: solo cae al ejemplo cuando NO hay
   * `acciones` (o sea, en el panel).
   */
  afirmacion?: boolean
  /**
   * El default para una TIENDA REAL, cuando el de la vitrina está escrito para
   * el rubro de la maqueta.
   *
   * Cualquier negocio puede aplicar cualquier plantilla, y ahí el texto de
   * muestra se lee mal: Papelería encabeza sus categorías con "Buscá por
   * rubro" —jerga de librería— y eso terminó arriba de "Camisas street" en una
   * tienda de ropa. Crecer pregunta "¿Cuántos meses tiene?", Corralón habla de
   * "Departamentos", Nítida de "Por familia".
   *
   * No es lo mismo que `afirmacion`: acá no se promete nada falso, así que
   * callarse no sirve —la sección se quedaría sin encabezado—. Lo que hace
   * falta es una versión neutra. La vitrina sigue mostrando la sabrosa, que es
   * lo que le da personalidad a la plantilla y ayuda al dueño a elegirla.
   */
  porDefectoReal?: string
}

export interface SeccionPlantilla {
  /** Clave de guardado. No cambiarla: lo guardado se busca por acá. */
  id: string
  /** Cómo se llama en el panel. Mismo nombre que usa el dueño para reconocerla. */
  nombre: string
  /** Una línea que ubique la sección dentro de la portada. */
  nota?: string
  campos: CampoSeccion[]
}

/** Lo que el dueño editó, por sección y campo. Lo arma plantillaReal(). */
export type ContenidoSecciones = Record<string, Record<string, string> | undefined>

export interface Plantilla {
  id: string; nombre: string; para: string; queCambia: string; secciones: string[]
  marca: string; tagline: string; layout: Layout; tema: Tema
  // Identidad visual que se nota más allá del home — hoy solo la usa
  // Vidriera (header con el logo centrado y buscador, en vez del layout
  // estándar a la izquierda). Antes esto vivía como un ternario
  // `homeTemplate === 'vidriera'` repetido en cada página del storefront
  // (Catálogo, Categoría, Producto, Carrito...) que además NUNCA llegó a
  // pasarse ahí (solo Inicio.tsx lo tenía) — la tienda con Vidriera
  // aplicada se veía "partida": home con el look de la plantilla, el
  // resto de las páginas con el header por defecto (bug real, reportado
  // con captura). Declararlo acá en vez de hardcodear el id de nuevo hace
  // que una plantilla futura que también quiera esto solo tenga que
  // marcarlo, sin tocar ninguna página — ver headerCentrado() en
  // cliente/inicio/plantillaReal.ts, que es lo que cada página del
  // storefront debería llamar en vez de comparar el id a mano.
  headerCentrado?: boolean
  // Igual que `headerCentrado`, pero para Escaparate: no cambia el LAYOUT
  // del header (sigue siendo logo-izquierda de siempre), solo la
  // tipografía y el color del nav (mayúsculas, tracked, "Ofertas" en
  // acento) — ver headerBold() en plantillaReal.ts y el prop `escaparate`
  // de StorefrontHeader.tsx.
  headerBold?: boolean
  // El carrusel real (HeroCarousel en Inicio.tsx) tiene un modo "grande"
  // —tipografía editorial a 132/62px, CTA subrayado sin botón— hecho a
  // medida para el Carrusel de esta plantilla. Antes era un hardcode
  // `homeTemplate === 'vidriera'` en Inicio.tsx; ahora lo pide la
  // plantilla, igual que headerCentrado. Solo tiene sentido junto con
  // `layout: 'tienda'` (es el único hero real que lo soporta).
  heroGrande?: boolean
  // Esta plantilla dibuja SU PROPIO hero adentro de `Home()` (no el
  // carrusel genérico) — Inicio.tsx tiene que saltear su `HeroCarousel`
  // para no dibujar dos heros superpuestos. Ver Escaparate: dos campañas
  // partidas, no hay carrusel real que sepa dibujar eso todavía.
  heroPropio?: boolean
  // Esta plantilla dibuja SU PROPIO header, en TODA la tienda (no solo el
  // home) — `StorefrontChrome` la llama con `soloHeader` en vez de dibujar
  // `StorefrontHeader`.
  //
  // Por qué se invirtió: `StorefrontHeader` solo sabe dos formas (la de
  // siempre y la centrada de Vidriera) más el pintado de Escaparate, y las
  // dieciséis maquetas tienen ocho headers distintos —el ☰ de Mosaico, el
  // dorado centrado de Premium, la barra de departamentos de Corralón, el
  // panel lateral de Circuito—. Sumar una forma por plantilla adentro del
  // header real era reescribir dieciséis veces el mismo drawer de carrito.
  // Al revés sale gratis y además queda idéntico POR CONSTRUCCIÓN: el
  // header que se ve en la tienda es literalmente el mismo JSX que el de la
  // vitrina, con los comportamientos reales enchufados por `AccionesHome`
  // (cuenta, carrito, buscador y navegación).
  headerPropio?: boolean
  // Ídem para el pie: la plantilla dibuja el suyo (`Pie` de piezas.tsx) con
  // los enlaces reales adentro, en vez del `StorefrontFooter` de siempre.
  piePropio?: boolean
  // El header de esta plantilla no es una franja arriba sino una COLUMNA al
  // costado (Circuito, con su panel lateral fijo). `StorefrontChrome` arma
  // una fila —panel a la izquierda, contenido de la página a la derecha— en
  // vez de apilarlo como un bloque más. En celular no cambia nada: ahí el
  // propio bloque ya dibuja una barra común arriba.
  headerLateral?: boolean
  // ¿Esta plantilla dibuja la barra de estadísticas (`p.confianza`)? Varias
  // no: Premium tiene sus tres promesas propias, Nocturno sus números
  // grandes, Glow sus sellos. Sin esto, el editor les ofrecía igual el
  // interruptor y la lista de estadísticas, que no se veían en ningún lado
  // (reportado con captura sobre Premium: "esta sección de Contenido no
  // aplica nada realmente a la plantilla"). `undefined` = sí la usa.
  usaStats?: boolean
  // Tope de slides que el hero de esta plantilla realmente usa (ver
  // `heroPropio` arriba) — Escaparate solo dibuja los dos primeros
  // (`p.slides.slice(0, 2)` en homes.tsx), así que el editor de Apariencia
  // no deja cargar un tercero que quedaría guardado pero invisible.
  // `undefined` = sin tope (Vidriera, o el home clásico).
  heroMaxSlides?: number
  /**
   * Lo que el dueño ya editó. Solo lo llena la tienda real (plantillaReal.ts);
   * en la vitrina del panel viene vacío y todo cae a los textos de muestra.
   */
  sec?: ContenidoSecciones

  slides: Slide[]; productos: Producto[]
  // Segunda fila ("Más vendidos"). En las plantillas de muestra no se define
  // y sale de invertir `productos` (con 4 productos de muestra alcanza para
  // que se vea distinta); la tienda real sí la pasa, porque ahí destacados y
  // más vendidos son consultas distintas, no la misma lista al revés.
  productosSecundarios?: Producto[]

  // Una plantilla que no se muestra en la galería. NO se borra: el dueño
  // quiso guardar las de autor (Escaparate, Mosaico, Premium, Nocturno,
  // Glow) por si más adelante las quiere de vuelta — se destapan sacando
  // este campo.
  oculta?: boolean

  // Contenido del layout 'tienda'. Es el mismo esqueleto para todas (el que
  // más vende, y el único que arma secciones que Órbita realmente genera);
  // lo que cambia de una a otra es esto, más el tema y las fotos.
  cartel?: string
  links?: string[]
  confianza?: [string, string][]
  // [nombre, imagen] en las plantillas de muestra; la tienda real agrega un
  // tercer elemento con el slug para que el tile navegue a la categoría.
  categorias?: [string, string, string?][]
  // El catálogo del negocio, SOLO para resolver los campos `seleccion` (ver
  // TipoCampo): un `prod:<id>` guardado tiene que poder encontrar su nombre y
  // su foto, y `productos` de acá arriba son los destacados nomás. En el
  // panel no existe.
  catalogo?: Producto[]
  // Con esto puesto, el layout es 'receta': los bloques y su orden salen
  // de acá y el render es el compartido. Ver Receta más arriba.
  receta?: Receta
  cupon?: { titulo: string; bajada: string; codigo: string }
  // El pie. En la vitrina del panel los ítems son strings sueltos (texto
  // muerto de la maqueta); en la tienda real `plantillaReal()` los reemplaza
  // por `{ label, href }` y ahí sí navegan. `redes` y `legales` solo existen
  // con datos reales: la maqueta no tiene Instagram ni Términos de nadie.
  pie?: {
    columnas: [string, ItemPie[]][]
    cierre: string
    redes?: { label: string; href: string }[]
    legales?: { label: string; href: string }[]
  }
  // El toggle "Mostrar footer" de Apariencia. Las plantillas con `piePropio`
  // lo ignoraban: el dueño lo apagaba y su pie seguía ahí, porque el que se
  // chequeaba era el de `StorefrontFooter`, que en esas plantillas ni se
  // dibuja. Solo lo pone `plantillaReal()`; en el panel siempre se ve.
  ocultarPie?: boolean
}

// Un ítem de columna del pie: texto pelado (maqueta) o enlace real (tienda).
export type ItemPie = string | { label: string; href: string }

// ─── Acciones reales (solo storefront) ───────────────────────────────────────
//
// El MISMO `Home()` dibuja el preview del panel y la portada de la tienda
// real. Lo único que las diferencia es esto: el panel no lo pasa (todo queda
// decorativo, como siempre) y la tienda real sí, con navegación y carrito de
// verdad.
//
// Por qué así y no re-implementando cada plantilla en Inicio.tsx: eso es
// justo lo que había antes (ternarios `homeTemplate === 'vidriera'` sueltos
// por todo el archivo) y garantizaba que la tienda quedara "parecida" pero
// nunca idéntica — cada retoque en la plantilla había que copiarlo a mano al
// storefront, y siempre se escapaba alguno. Compartiendo el render, una
// plantilla nueva anda en la tienda sin tocar Inicio.tsx.
export interface AccionesHome {
  /**
   * Volver a la portada. Hace falta desde que el header de la plantilla se
   * usa en TODA la tienda (ver `soloHeader` en homes.tsx): en la ficha de un
   * producto, la marca del header es la única forma de volver al inicio.
   */
  irAInicio?: () => void
  // "Estilo de header" de Apariencia. El nav de una plantilla muestra SIEMPRE
  // los enlaces reales (los mismos que el header de Orbita, ver `nav` mas
  // abajo); esto decide cuantos y donde. `minimal` los saca en todas por
  // igual — es una decision de contenido, no de diseño. `centered` vs
  // `standard` solo lo aplican las plantillas cuyo header no tenga ya una
  // posicion propia como parte de su identidad.
  navLayout?: 'full' | 'standard' | 'centered' | 'minimal'
  // Abre el modal de arrepentimiento/devolución (RBT-683). Lo dibuja el pie
  // normal de Órbita por obligación legal, así que el pie de una plantilla
  // tiene que poder abrirlo también. En el panel no existe: ahí el botón no
  // se dibuja.
  abrirDevolucion?: () => void
  irACatalogo: () => void
  irACategoria: (slug: string) => void
  irAProducto: (slug: string) => void
  abrirWhatsapp?: () => void
  // A dónde lleva el CTA de un `Slide.link` — path interno o URL completa,
  // mismo criterio que ya usan HeroCarousel/banner parallax en Inicio.tsx.
  // Solo la piden las plantillas con `heroPropio` (Escaparate hoy): el hero
  // genérico (`layout: 'tienda'`) no pasa por acá, lo dibuja HeroCarousel
  // directamente con su propio manejo de `ctaLink`.
  irALink?: (link: string) => void
  // La tarjeta de producto de la tienda real (ProductCard) en vez de la
  // maqueta `Card` de piezas.tsx: la maqueta imita a la real pero no compra
  // nada (sin carrito, sin variantes, sin modo vidriera). El layout —la
  // grilla, si va a sangre, los altos— lo sigue poniendo la plantilla; solo
  // se reemplaza QUÉ se dibuja adentro de cada celda.
  //
  // `opts` es ese layout: son los MISMOS valores con los que la plantilla
  // dibujaría su maqueta `Card` (a sangre o con borde propio, y qué alto de
  // foto). Sin esto la tarjeta real no tenía forma de saberlo y quedaba
  // siempre con el look por defecto de Órbita adentro de una grilla pensada
  // para otra cosa — que es justo lo que se veía: la plantilla ponía la
  // grilla a sangre y adentro seguían las cards redondeadas de siempre.
  renderProducto?: (p: Producto, i: number, opts: { sangre?: boolean; alto: number }) => ReactNode

  // ── Las piezas del "chrome", reales ────────────────────────────────────
  //
  // El header de cada plantilla ya está dibujado en su bloque de homes.tsx y
  // es idéntico al de la vitrina. Lo único que le falta para servir en la
  // tienda real es que sus tres piezas interactivas dejen de ser dibujitos:
  // la cuenta, el carrito y el buscador. En vez de reescribir dieciséis
  // headers, la tienda real pasa acá QUÉ dibujar adentro de cada hueco y la
  // maqueta decide DÓNDE va, con el tema de la plantilla.
  //
  // Sin estas funciones (el panel), cada pieza cae a su versión de muestra
  // de siempre — la vitrina sigue andando exactamente igual.

  /** Cuenta + carrito reales (con contador y drawer). Reemplaza a `AccionesTienda`. */
  renderAcciones?: (opts: { movil?: boolean }) => ReactNode
  /** El buscador real. `compacto` = el ícono solo, sin la caja de texto. */
  renderBuscador?: (opts: { compacto?: boolean }) => ReactNode
  /** Los enlaces de navegación reales del header (Apariencia → Header). */
  nav?: { label: string; onClick: () => void; activo?: boolean }[]
  /** El pie real de la tienda, para las plantillas que no dibujan uno propio. */
  renderPie?: () => ReactNode
}

export const sans = (n: string) => `"${n}", system-ui, -apple-system, sans-serif`
export const serif = (n: string) => `"${n}", Georgia, serif`

export const ar = (final: string, antes: string, transfer: string, cuota: string) => ({
  precio: final, antes, transfer: `${transfer} con transferencia`, cuotas: `3 cuotas sin interés de ${cuota}`,
})
