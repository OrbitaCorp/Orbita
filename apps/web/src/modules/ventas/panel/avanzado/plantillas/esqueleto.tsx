import { Home } from './homes'
import { seccionesDe } from './secciones'
import type { ItemPie, Plantilla } from './tipos'

// ─── El esqueleto de carga de una plantilla ──────────────────────────────────
//
// Mientras la portada espera sus datos (la config, las categorías, los
// productos) la tienda mostraba el esqueleto del home clásico: una caja de
// hero, seis cuadraditos y dos grillas de cuatro. Con una plantilla puesta eso
// no se parece a lo que viene después —Circuito tiene un panel al costado,
// Mosaico arranca con un muro, Vera lista sus piezas en renglones—, así que la
// página pegaba un salto al terminar de cargar.
//
// Escribir veintiséis esqueletos a mano era la otra opción, y la peor: cada
// retoque a un bloque obligaba a acordarse de retocar su esqueleto, y la
// próxima plantilla nacía sin uno.
//
// Acá el esqueleto de una plantilla ES la plantilla: se dibuja el mismo
// `Home()` con su estructura de muestra, y una clase (`.pl-esq`, en piezas.tsx)
// convierte cada texto en una barra y cada foto en un bloque. Tiene la forma
// exacta de esa portada, con sus colores de fondo, y una plantilla nueva lo
// tiene sin escribir nada.

// Un fondo que `Foto` trata como degradé: no dibuja un <img>, así que el
// esqueleto no baja ninguna de las fotos de muestra (son para la vitrina del
// panel, y son pesadas).
const SIN_FOTO = 'linear-gradient(0deg, transparent, transparent)'

// El texto de muestra, cambiado por blancos del mismo largo: la barra queda
// del ancho que tenía la palabra, y el HTML que sale del servidor no lleva
// "Auriculares V-90 Pro" en la portada de una tienda de ropa (lo leería un
// buscador, y lo vería cualquiera con el CSS a medio cargar).
//
// El blanco es U+2800 (el braille vacío) y no un espacio: ocupa lugar, no se
// ve, y `trim()` no lo come — con un espacio de verdad `txt()` tomaba el
// campo por vacío y volvía a caer al texto de muestra.
const velar = (s: string) => s.replace(/\S/g, '\u2800')
// Para el menú de las plantillas que no declaran enlaces de muestra y caen a
// los que tiene escritos su bloque.
const ENLACES = ['xxxxxxxx', 'xxxxxx', 'xxxxxxx', 'xxxxxxxxx']

/** La plantilla con su estructura de muestra y sin nada de su contenido. */
export function paraEsqueleto(base: Plantilla, marca?: string): Plantilla {
  const producto = <T extends { nombre: string; precio: string; img: string }>(x: T): T => ({
    ...x,
    nombre: velar(x.nombre), precio: velar(x.precio), img: SIN_FOTO, img2: undefined,
    antes: undefined, transfer: undefined, cuotas: undefined, badge: undefined, tag: undefined, stock: undefined,
  })
  const item = (i: ItemPie): ItemPie => (typeof i === 'string' ? velar(i) : { ...i, label: velar(i.label) })

  // Cada campo de sus secciones propias: el texto velado, la foto afuera. Los
  // interruptores y las selecciones quedan como vienen (no son texto).
  const sec = Object.fromEntries(seccionesDe(base.id).map(s => [s.id, Object.fromEntries(
    s.campos
      .filter(c => c.tipo === 'texto' || c.tipo === 'parrafo' || c.tipo === 'imagen')
      .map(c => [c.id, c.tipo === 'imagen' ? SIN_FOTO : velar(c.porDefecto ?? '')])
      .filter(([, v]) => v !== ''),
  )]))

  return {
    ...base,
    // El nombre del negocio sí: lo trae el servidor, y es lo primero que se lee.
    marca: marca?.trim() || velar(base.marca),
    tagline: velar(base.tagline),
    cartel: base.cartel ? velar(base.cartel) : undefined,
    links: (base.links ?? ENLACES).map(velar),
    // Un solo slide: con dos el hero arranca a rotar.
    slides: base.slides.slice(0, 1).map(x => ({
      ...x, img: SIN_FOTO, kicker: x.kicker ? velar(x.kicker) : undefined,
      titulo: velar(x.titulo), bajada: velar(x.bajada), cta: velar(x.cta),
    })),
    productos: base.productos.map(producto),
    productosSecundarios: base.productosSecundarios?.map(producto),
    categorias: base.categorias?.map(([n, , s]) => [velar(n), SIN_FOTO, s] as [string, string, string?]),
    confianza: base.confianza?.map(([a, b]) => [velar(a), velar(b)] as [string, string]),
    // El cupón es de una promo puntual: la mayoría de las tiendas no tiene, y
    // reservarle el lugar es un salto seguro al terminar de cargar.
    cupon: undefined,
    pie: base.pie && { ...base.pie, cierre: velar(base.pie.cierre), columnas: base.pie.columnas.map(([t, items]) => [velar(t), items.map(item)] as [string, ItemPie[]]) },
    sec,
  }
}

export function EsqueletoPlantilla({ p, movil, soloCuerpo, marca }: {
  p: Plantilla
  movil: boolean
  /** Igual que en `Home`: la tienda pone el header (Vidriera, Escaparate). */
  soloCuerpo?: boolean
  /** El nombre real del negocio, si el servidor ya lo trajo. */
  marca?: string
}) {
  const t = p.tema
  return (
    <div
      className="pl-esq" aria-hidden="true" inert
      // La barra es el color del texto de la plantilla, muy lavado sobre su
      // fondo: se ve en las claras y en las oscuras sin pedirle a cada una
      // un color de esqueleto.
      style={{ ['--pl-esq' as string]: `color-mix(in srgb, ${t.text} 11%, ${t.bg})`, background: soloCuerpo ? undefined : t.bg }}
    >
      <Home p={paraEsqueleto(p, marca)} movil={movil} soloCuerpo={soloCuerpo} />
    </div>
  )
}
