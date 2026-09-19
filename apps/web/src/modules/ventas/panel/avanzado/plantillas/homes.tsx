import { useEffect, useMemo, useState } from 'react'
import { esPreview } from '@/lib/storefront/previewBridge'
// Sin `IMG`: ya no queda ninguna foto del repo clavada en un bloque. Las que
// se ven salen del catálogo del negocio, de sus categorías, o de una sección
// editable cuyo `porDefecto` vive en secciones.ts.
import type { BloqueReceta, Plantilla, Producto, AccionesHome } from './tipos'
import {
  Reveal, Foto, Estrellas, Card, Boton, Titulo, Marquee,
  HeaderCentrado, Carrusel, Pie, TONOS, AccionesTienda, navDe, MenuMovil,
} from './piezas'
import { esAfirmacion, porDefectoDe } from './secciones'

// ─── Los seis homes ──────────────────────────────────────────────────────────
//
// Cada plantilla trae SU vocabulario, no una piel distinta sobre el mismo
// esqueleto: header propio, forma propia de mostrar el producto y proporción
// propia de imagen. Editorial no usa tarjetas (usa piezas numeradas), Local no
// usa grilla (usa una carta en lista) y Mosaico no tiene hero (arranca con un
// muro). Eso es lo que hace que se distingan de lejos.

// Tira horizontal con snap — la usan Editorial (lookbook) y Nocturno (setup).
function Tira({ children, gap = 14 }: { children: React.ReactNode; gap?: number }) {
  return (
    <div style={{ display: 'flex', gap, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 6, scrollbarWidth: 'thin' }}>
      {children}
    </div>
  )
}

// Las plantillas que ya saben dibujar SOLO su header (modo `soloHeader`).
//
// El header de una plantilla no es del home: es de la tienda entera — la
// ficha de producto, el catálogo y el carrito tienen que verse con la misma
// marca, la misma tipografía y los mismos íconos (pedido explícito, con una
// captura de la ficha de producto mostrando el header clásico de Órbita
// mientras la portada tenía el de Premium). `StorefrontChrome` consulta esta
// lista: la plantilla que todavía no separó su header sigue con el de
// siempre en el resto de las vistas, en vez de romperlas.
//
// Para sumar una: envolver el encabezado del bloque en una variable y
// devolverlo cuando `soloHeader` esté puesto (ver el bloque `premium`).
export const LAYOUTS_CON_HEADER_PROPIO = new Set<string>([
  'premium', 'vera', 'cobijo', 'nitida', 'mosaico', 'atleta', 'patitas', 'bodega', 'crecer',
  'nocturno', 'papeleria', 'corralon', 'glow', 'circuito',
  // Todas las de receta dibujan su propio header: es un solo valor
  // porque comparten el layout, no hace falta sumarlas una por una.
  'receta',
])

// Un lugar de una seccion de pasos, ya resuelto: puede venir de algo que el
// dueño eligió (categoría o producto) o del relleno del catálogo. `producto`
// solo existe cuando es un producto — una categoría no tiene precio.
type Elegido = { nombre: string; img: string; ir?: () => void; producto?: Producto }

export function Home({ p, movil, acciones, soloCuerpo, soloHeader }: {
  p: Plantilla
  movil: boolean
  // Solo la tienda real las pasa: con esto el mismo render deja de ser una
  // maqueta y navega/compra de verdad. Ver AccionesHome en tipos.ts.
  acciones?: AccionesHome
  // La tienda real ya dibuja su propio cartel, header, hero y pie con los
  // componentes de verdad (StorefrontHeader, HeroCarousel, StorefrontFooter
  // — que ya siguen el look de la plantilla, ver commit "header y hero de la
  // tienda real igual a la plantilla"). Con esto `Home` aporta SOLO el cuerpo
  // —barra de confianza, filas de productos, categorías, cupón y WhatsApp—,
  // que es la parte que antes Inicio.tsx re-implementaba a mano y quedaba
  // desincronizada de la plantilla.
  soloCuerpo?: boolean
  // Dibuja SOLO el encabezado de esta plantilla (cintillo + navbar), para que
  // el resto del storefront —catálogo, ficha, carrito— use el mismo header
  // que la portada. Ver LAYOUTS_CON_HEADER_PROPIO arriba.
  soloHeader?: boolean
}) {
  const t = p.tema
  const marco: React.CSSProperties = soloCuerpo ? {} : { background: t.bg, color: t.text, fontFamily: t.fb }

  // Hero de las plantillas que dibujan el suyo a partir de UN slide (Premium):
  // Apariencia deja cargar varios, así que rotan y traen su navegación, en vez
  // de mostrar siempre el primero y tirar el resto (reportado: "la edición
  // permite eso, pero la plantilla no tiene los botones de navegación").
  // El estado vive acá arriba, sin condicionar, porque los bloques de abajo
  // son ramas de ESTE componente y un hook adentro de un `if` no es válido.
  const [iHero, setIHero] = useState(0)
  const nSlides = p.slides.length
  // Quieto en la vista previa del panel (ver HeroCarousel en Inicio.tsx).
  useEffect(() => {
    if (nSlides < 2 || esPreview()) return
    const id = setInterval(() => setIHero((v) => (v + 1) % nSlides), 5200)
    return () => clearInterval(id)
  }, [nSlides])
  const iActual = nSlides > 0 ? iHero % nSlides : 0
  const irASlide = (i: number) => setIHero((nSlides + i) % Math.max(nSlides, 1))

  // Flechas + puntos, pintados con el tema de la plantilla. Solo se dibujan
  // con más de un slide: con uno no hay a dónde ir.
  const navHero = (estilo?: React.CSSProperties) => nSlides < 2 ? null : (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, ...estilo }}>
      <button
        onClick={() => irASlide(iActual - 1)} aria-label="Anterior"
        style={{ width: 34, height: 34, borderRadius: t.radio === 0 ? 0 : '50%', border: `1px solid ${t.primary}`, background: 'transparent', color: t.primary, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 15, lineHeight: 1 }}
      >‹</button>
      <div style={{ display: 'flex', gap: 7 }}>
        {p.slides.map((_, k) => (
          <button
            key={k} onClick={() => irASlide(k)} aria-label={`Ir al ${k + 1}`}
            style={{ width: k === iActual ? 22 : 8, height: 8, borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer', background: k === iActual ? t.primary : `${t.primary}59`, transition: 'width .35s, background .35s' }}
          />
        ))}
      </div>
      <button
        onClick={() => irASlide(iActual + 1)} aria-label="Siguiente"
        style={{ width: 34, height: 34, borderRadius: t.radio === 0 ? 0 : '50%', border: `1px solid ${t.primary}`, background: 'transparent', color: t.primary, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 15, lineHeight: 1 }}
      >›</button>
    </div>
  )
  const cols = (d: number, m = 2) => `repeat(${movil ? m : d}, 1fr)`
  // Cuántos entran en UNA fila de esa grilla. Va siempre de a pares con
  // `cols()`: si no coinciden, la fila queda con un hueco a la derecha o con
  // un producto colgado abajo.
  const cuantos = (d: number, m = 2) => (movil ? m : d)
  // Columnas que se achican a cuántos hay. Una grilla de 6 con 4 categorías
  // deja dos huecos a la derecha; con esto la fila se reparte entre las 4 y
  // queda llena. Para productos no hace falta —`fila()` siempre trae los que
  // entran— pero las categorías son las que son: no se pueden inventar.
  const colsDe = (d: number, n: number, m = 2) =>
    cols(Math.max(1, Math.min(d, n)), Math.max(1, Math.min(m, n)))

  // Un orden estable pero que no es el del catálogo. `p.productos` son los
  // DESTACADOS, y rellenar toda la portada con ellos hace que la tienda
  // muestre siempre los mismos cinco: las secciones que no piden destacados
  // salen de acá.
  //
  // No usa Math.random(): tiene que dar lo mismo en el servidor y en el
  // cliente (si no, React se queja al hidratar) y no puede barajarse de nuevo
  // en cada render. Ordenar por un hash del slug da un orden "al azar" que es
  // estable para esta tienda y distinto para cada una.
  const hash = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
    return h
  }
  const barajado = useMemo(() => {
    const todos = p.catalogo ?? p.productos
    return [...todos].sort((a, b) => hash(a.slug ?? a.nombre) - hash(b.slug ?? b.nombre))
  }, [p.catalogo, p.productos])

  /**
   * Exactamente los productos que llenan una fila — ni uno de más ni de menos.
   *
   * `clave` es el id de la sección: desplaza el arranque dentro del barajado
   * para que dos secciones de la misma portada no muestren los mismos.
   * `base` solo lo pasan las secciones que de verdad piden destacados o más
   * vendidos ("Destacados", "Top ventas"); el resto sale del catálogo.
   */
  const fila = (n: number, clave: string, base?: Producto[]) => {
    const pool = base && base.length > 0 ? base : barajado
    if (pool.length === 0) return []
    const desde = Math.abs(hash(clave)) % pool.length
    const salida: Producto[] = []
    for (let i = 0; i < Math.min(n, pool.length); i++) salida.push(pool[(desde + i) % pool.length])
    return salida
  }
  // En el panel la grilla dibuja la maqueta `Card`; en la tienda real, la
  // ProductCard de verdad. El layout (altos, si va a sangre) no cambia.
  // Contenido de una sección editable de ESTA plantilla. Si el dueño no lo
  // tocó, cae al texto con el que se diseñó la sección, que vive en
  // secciones.ts junto al resto del esquema — no acá adentro. Ese fallback no
  // es un detalle: es lo que hace que una tienda que no editó nada se vea
  // igual que su vitrina.
  // ...salvo cuando ese texto AFIRMA algo del negocio. Un "−40%" sobre una
  // categoría, un "envío gratis desde $70.000" o un "+18.000 clientes" son
  // promesas al comprador, no etiquetas: en la vitrina del panel están bien
  // (venden la plantilla), pero en una tienda REAL que no los escribió son
  // mentira. Mosaico mostraba tres descuentos que ese negocio nunca cargó.
  // `acciones` es lo que distingue los dos mundos: solo existe en la tienda.
  // Ver `afirmacion` en tipos.ts.
  const txt = (seccion: string, campo: string) => {
    const guardado = p.sec?.[seccion]?.[campo]?.trim()
    if (guardado) return guardado
    if (acciones && esAfirmacion(p.id, seccion, campo)) return ''
    // `!!acciones` = tienda real. Ahí, un campo escrito para el rubro de la
    // maqueta ("Buscá por rubro" de Papelería) cae a su versión neutra.
    return porDefectoDe(p.id, seccion, campo, !!acciones)
  }

  // Un campo de tipo interruptor (ver TipoCampo en tipos.ts): se guarda como
  // texto igual que todo lo demás, así que 'si' es el único valor que cuenta.
  const activo = (seccion: string, campo: string) => txt(seccion, campo) === 'si'

  // Las plantillas que dibujan SU PROPIA tarjeta (que es parte de lo que las
  // hace distintas) no la cambian por la de Órbita: se les enchufa el click
  // para llegar a la ficha real, que es donde vive el carrito de verdad
  // —picker de variante, stock, comprar ahora—. Mismo criterio que ya se usó
  // con el "Agregar" de Escaparate: nunca prometer un agregado directo que la
  // tienda no arma.
  const abrir = (x: Producto) =>
    x.slug && acciones ? () => acciones.irAProducto(x.slug!) : undefined

  // Resuelve lo que el dueño eligió en un campo `seleccion` (ver TipoCampo):
  // `cat:<slug>` o `prod:<id>`, contra las categorías y el catálogo reales.
  // Devuelve null si no eligió nada o si eso ya no existe —una categoría
  // borrada después de configurar la sección no puede dejar una tarjeta rota.
  const elegido = (valor: string): Elegido | null => {
    const v = valor.trim()
    if (!v) return null
    if (v.startsWith('cat:')) {
      const slug = v.slice(4)
      const cat = (p.categorias ?? []).find(([, , s]) => s === slug)
      if (!cat) return null
      return { nombre: cat[0], img: cat[1], ir: acciones ? () => acciones.irACategoria(slug) : undefined }
    }
    if (v.startsWith('prod:')) {
      const id = v.slice(5)
      const prod = (p.catalogo ?? p.productos).find((x) => x.slug === id)
      if (!prod) return null
      // `producto` va aparte: una sección que muestra precio y estrellas solo
      // puede hacerlo si lo elegido es un producto, no una categoría.
      return { nombre: prod.nombre, img: prod.img, ir: abrir(prod), producto: prod }
    }
    return null
  }

  /**
   * Las categorías del negocio con productos SUYOS adentro.
   *
   * Atleta mostraba tres títulos de categoría y abajo `p.productos.slice(i,
   * i+3)` — una ventana corrediza sobre los destacados, que no tenía nada que
   * ver con la categoría de arriba y repetía los mismos productos en las tres
   * filas (reportado con captura). Sin `Producto.cat` no había forma de hacerlo
   * bien; ahora sí.
   *
   * Una categoría sin productos cargados no se devuelve: un título con una
   * fila vacía abajo es peor que no mostrar esa categoría.
   */
  const porCategoria = (cuantas: number, porFila: number) =>
    (p.categorias ?? [])
      .map(([nombre, , slug]) => ({
        nombre,
        slug,
        productos: (p.catalogo ?? p.productos).filter((x) => x.cat === nombre).slice(0, porFila),
      }))
      .filter((c) => c.productos.length > 0)
      .slice(0, cuantas)

  /**
   * Los lugares de una sección de "pasos" (Nocturno: Armá tu setup; Glow: Tu
   * rutina). Lo que el dueño eligió manda; los lugares que no tocó se llenan
   * con el catálogo, igual que cualquier otra fila.
   *
   * Antes esto se rellenaba con las tres PRIMERAS categorías del negocio, que
   * no significaba nada. El primer intento de arreglarlo fue esconder la
   * sección hasta que eligiera algo, y fue peor: parecía que la plantilla
   * había perdido una sección.
   */
  const lugares = (n: number, seccion: string, clave: string): Elegido[] => {
    const relleno = fila(n, clave)
    const salida: Elegido[] = []
    for (let i = 0; i < n; i++) {
      const puesto = elegido(txt(seccion, `i${i + 1}`))
      if (puesto) { salida.push(puesto); continue }
      const x = relleno[i]
      if (x) salida.push({ nombre: x.nombre, img: x.img, ir: abrir(x), producto: x })
    }
    return salida
  }

  const producto = (x: Producto, i: number, props: { sangre?: boolean; alto: number }) =>
    acciones?.renderProducto
      ? <div key={x.slug ?? x.nombre}>{acciones.renderProducto(x, i, props)}</div>
      : <Card key={x.nombre} p={x} t={t} sangre={props.sangre} alto={props.alto} onClick={abrir(x)} />

  // ── TIENDA ────────────────────────────────────────────────────────────────
  // El esqueleto de Vidriera, que es el que el dueño eligió para todas: la
  // forma de tienda masiva argentina (cartel corriendo, hero con promo, barra
  // de confianza, destacados a sangre, categorías, más vendidos y cupón).
  //
  // Dos decisiones que vale la pena no perder:
  //
  // NO hay newsletter, ni testimonios, ni planes por suscripción — acá ni en
  // ningún otro esqueleto de este archivo. Órbita no genera ninguna de esas
  // tres cosas en el home (ver Inicio.tsx: cartel, hero, stats, categorías,
  // filas de productos, banner de WhatsApp y pie), y una plantilla que las
  // muestre promete algo que después la tienda no puede cumplir.
  // ── RECETA ────────────────────────────────────────────────────────────────
  // El render compartido de las plantillas que se arman con el vocabulario de
  // siempre (ver Receta en tipos.ts). Lo que cambia entre una y otra es el
  // TEMA y la lista de bloques: el mismo código dibuja las diez.
  //
  // Todo lo que muestra sale de la tienda —categorías, catálogo, destacados— y
  // los textos van por `txt()`, así que el editor de estas plantillas se
  // genera solo desde la receta y no hay que escribirle uno a mano.
  if (p.receta) {
    const r = p.receta
    const s = p.slides[iActual]
    const cats = p.categorias ?? []

    // El encabezado de cada bloque, editable. La clave es el id del bloque,
    // así que dos filas de la misma plantilla no comparten título.
    const encabezadoDe = (id: string, centrado?: boolean) => (
      <Titulo
        t={t}
        volanta={txt(id, 'volanta')}
        texto={txt(id, 'titulo')}
        accion={txt(id, 'accion')}
        centrado={centrado}
        movil={movil}
        onAccion={acciones?.irACatalogo}
      />
    )

    const fuenteDe = (b: Extract<BloqueReceta, { t: 'fila' }>, n: number) =>
      b.fuente === 'destacados' ? fila(n, b.id, p.productos)
        : b.fuente === 'masVendidos' ? fila(n, b.id, p.productosSecundarios ?? [])
        : fila(n, b.id)

    const heroTexto = (alineado: 'izq' | 'centro', claro: boolean) => (
      <div style={{ textAlign: alineado === 'centro' ? 'center' : 'left', maxWidth: alineado === 'centro' ? 640 : 520, margin: alineado === 'centro' ? '0 auto' : undefined }}>
        {s?.kicker && <div style={{ fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, color: claro ? t.accent : t.primary, marginBottom: 14 }}>{s.kicker}</div>}
        <h1 style={{ fontFamily: t.fh, fontSize: movil ? 38 : 66, lineHeight: 1.02, margin: 0, fontWeight: 800, letterSpacing: '-0.04em', color: claro ? '#fff' : t.text, whiteSpace: 'pre-line' }}>{s?.titulo}</h1>
        <p style={{ fontSize: movil ? 15 : 17, lineHeight: 1.6, margin: '16px 0 26px', color: claro ? 'rgba(255,255,255,0.88)' : t.muted }}>{s?.bajada}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: alineado === 'centro' ? 'center' : undefined }}>
          <Boton t={t} grande={!movil} onClick={s?.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : acciones?.irACatalogo}>{s?.cta}</Boton>
          {txt('hero', 'cta2') && <Boton t={t} grande={!movil} secundario onClick={acciones?.abrirWhatsapp}>{txt('hero', 'cta2')}</Boton>}
        </div>
        {navHero({ marginTop: 22, justifyContent: alineado === 'centro' ? 'center' : undefined })}
      </div>
    )

    const bloque = (b: BloqueReceta, i: number) => {
      const pad = movil ? '28px 16px' : '52px 40px'
      switch (b.t) {
        // ── Hero, cuatro formas de la misma foto ───────────────────────────
        case 'hero': {
          if (!s) return null
          if (b.estilo === 'minimo') {
            return (
              <div key={i} style={{ background: t.soft, borderBottom: `1px solid ${t.border}`, padding: movil ? '46px 16px' : '92px 40px' }}>
                {heroTexto('centro', false)}
              </div>
            )
          }
          if (b.estilo === 'partido') {
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ background: t.soft, padding: movil ? '34px 18px' : '70px 48px', display: 'flex', alignItems: 'center' }}>
                  {heroTexto('izq', false)}
                </div>
                <div style={{ minHeight: movil ? 240 : 460 }}><Foto src={s.img} alto={movil ? 240 : '100%'} /></div>
              </div>
            )
          }
          if (b.estilo === 'tarjeta') {
            return (
              <div key={i} style={{ padding: movil ? '16px 16px 6px' : '28px 40px 10px' }}>
                <div style={{ position: 'relative', borderRadius: t.radio, overflow: 'hidden' }}>
                  <Foto src={s.img} alto={movil ? 380 : 520} />
                  <div style={{ position: 'absolute', inset: 0, background: t.oscuro ? 'linear-gradient(90deg, rgba(0,0,0,0.82), rgba(0,0,0,0.15))' : 'linear-gradient(90deg, rgba(0,0,0,0.66), rgba(0,0,0,0.05))', display: 'flex', alignItems: 'center', padding: movil ? 22 : 52 }}>
                    {heroTexto('izq', true)}
                  </div>
                </div>
              </div>
            )
          }
          // pleno
          return (
            <div key={i} style={{ position: 'relative' }}>
              <Foto src={s.img} alto={movil ? 430 : 580} />
              <div style={{ position: 'absolute', inset: 0, background: t.oscuro ? 'linear-gradient(180deg, rgba(0,0,0,0.30), rgba(0,0,0,0.85))' : 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.72))', display: 'flex', alignItems: 'flex-end', padding: movil ? 22 : 54 }}>
                {heroTexto('izq', true)}
              </div>
            </div>
          )
        }

        // ── Categorías, cuatro formas de la misma lista ────────────────────
        case 'categorias': {
          if (cats.length === 0) return null
          const max = b.cols ?? 4
          const visibles = cats.slice(0, max)
          const cab = encabezadoDe('categorias', b.estilo === 'pastillas')
          if (b.estilo === 'pastillas') {
            return (
              <Reveal key={i}><div style={{ padding: pad }}>
                {cab}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                  {visibles.map(([n, src, slug]) => (
                    <span
                      key={n} className="pl-cta" onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, border: `1px solid ${t.border}`, background: t.surf, borderRadius: 999, padding: '7px 18px 7px 7px', cursor: slug && acciones ? 'pointer' : undefined }}
                    >
                      <span style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}><Foto src={src} alto={34} /></span>
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{n}</span>
                    </span>
                  ))}
                </div>
              </div></Reveal>
            )
          }
          if (b.estilo === 'tira') {
            return (
              <Reveal key={i}><div style={{ padding: movil ? '28px 0 28px 16px' : '52px 0 52px 40px' }}>
                <div style={{ paddingRight: movil ? 16 : 40 }}>{cab}</div>
                <Tira gap={12}>
                  {visibles.map(([n, src, slug]) => (
                    <div
                      key={n} className="pl-tile" onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                      style={{ width: movil ? 180 : 250, flexShrink: 0, position: 'relative', borderRadius: t.radio, overflow: 'hidden', cursor: slug && acciones ? 'pointer' : undefined }}
                    >
                      <Foto src={src} alto={movil ? 130 : 170} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.75))', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
                        <span style={{ color: '#fff', fontFamily: t.fh, fontSize: 15, fontWeight: 700 }}>{n}</span>
                      </div>
                    </div>
                  ))}
                </Tira>
              </div></Reveal>
            )
          }
          const alto = b.estilo === 'altas' ? (movil ? 190 : 300) : (movil ? 120 : 165)
          return (
            <Reveal key={i}><div style={{ padding: pad }}>
              {cab}
              <div style={{ display: 'grid', gridTemplateColumns: colsDe(max, visibles.length, Math.min(2, visibles.length)), gap: movil ? 10 : 14 }}>
                {visibles.map(([n, src, slug]) => (
                  <div
                    key={n} className="pl-tile" onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                    style={{ position: 'relative', borderRadius: t.radio, overflow: 'hidden', cursor: slug && acciones ? 'pointer' : undefined }}
                  >
                    <Foto src={src} alto={alto} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.78))', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
                      <span style={{ color: '#fff', fontFamily: t.fh, fontSize: movil ? 14 : 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{n}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div></Reveal>
          )
        }

        // ── Fila de productos ──────────────────────────────────────────────
        case 'fila': {
          const nCols = b.cols ?? 4
          if (b.estilo === 'tira') {
            const items = fuenteDe(b, movil ? 4 : 6)
            if (items.length === 0) return null
            return (
              <Reveal key={i}><div style={{ padding: movil ? '28px 0 28px 16px' : '52px 0 52px 40px' }}>
                <div style={{ paddingRight: movil ? 16 : 40 }}>{encabezadoDe(b.id)}</div>
                <Tira gap={14}>
                  {items.map((x, j) => (
                    <div key={x.slug ?? x.nombre} style={{ width: movil ? 200 : 260, flexShrink: 0 }}>
                      {producto(x, j, { alto: movil ? 200 : 260 })}
                    </div>
                  ))}
                </Tira>
              </div></Reveal>
            )
          }
          const sangre = b.estilo === 'sangre'
          const items = fuenteDe(b, cuantos(nCols, 2))
          if (items.length === 0) return null
          return (
            <Reveal key={i}><div style={{ padding: sangre ? (movil ? '28px 0' : '52px 0') : pad }}>
              <div style={{ padding: sangre ? (movil ? '0 16px' : '0 40px') : undefined }}>{encabezadoDe(b.id)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: cols(nCols, 2), gap: sangre ? 0 : (movil ? 12 : 18), borderTop: sangre ? `1px solid ${t.border}` : undefined, borderBottom: sangre ? `1px solid ${t.border}` : undefined }}>
                {items.map((x, j) => producto(x, j, { sangre, alto: movil ? 170 : 250 }))}
              </div>
            </div></Reveal>
          )
        }

        // ── El nombre de una categoría, y abajo productos DE esa categoría ──
        case 'porCategoria': {
          const filas = porCategoria(b.cuantas ?? 3, cuantos(b.porFila ?? 4, 2))
          if (filas.length === 0) return null
          return (
            <div key={i}>
              {filas.map((c, j) => (
                <Reveal key={c.nombre} delay={j * 60}>
                  <div style={{ padding: movil ? '24px 16px 8px' : '40px 40px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14 }}>
                      <h2 style={{ fontFamily: t.fh, fontSize: movil ? 22 : 30, margin: 0, fontWeight: 800, letterSpacing: '-0.025em' }}>{c.nombre}</h2>
                      {c.slug && acciones && (
                        <span
                          className="pl-nav" onClick={() => acciones.irACategoria(c.slug!)}
                          style={{ marginLeft: 'auto', fontSize: 12.5, color: t.primary, fontWeight: 700, cursor: 'pointer' }}
                        >Ver todo →</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: colsDe(b.porFila ?? 4, c.productos.length, 2), gap: movil ? 12 : 16 }}>
                      {c.productos.map((x, k) => producto(x, k, { alto: movil ? 160 : 230 }))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )
        }

        // ── El espacio de anuncio, en cuatro formas ────────────────────────
        // Es una AFIRMACIÓN (ver secciones.ts): una tienda que no escribió
        // nada acá no anuncia nada, y la franja entera no se dibuja.
        case 'franja': {
          const titulo = txt('franja', 'titulo')
          if (!titulo) return null
          const estilo = b.estilo ?? 'plena'

          if (estilo === 'cartelera') {
            return <div key={i}><Marquee t={t} texto={titulo} /></div>
          }

          if (estilo === 'filete') {
            return (
              <div
                key={i}
                onClick={acciones?.irACatalogo}
                style={{ borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, background: t.soft, padding: movil ? '14px 16px' : '18px 40px', textAlign: 'center', cursor: acciones ? 'pointer' : undefined }}
              >
                <span style={{ fontSize: movil ? 12.5 : 13.5, letterSpacing: '0.06em', color: t.text, fontWeight: 600 }}>{titulo}</span>
                {txt('franja', 'cta') && <span style={{ marginLeft: 12, fontSize: 13, color: t.primary, fontWeight: 700 }}>{txt('franja', 'cta')} →</span>}
              </div>
            )
          }

          if (estilo === 'apilada') {
            return (
              <Reveal key={i}>
                <div style={{ background: t.soft, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '34px 18px' : '58px 40px', textAlign: 'center' }}>
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 24 : 36, fontWeight: 800, letterSpacing: '-0.03em', maxWidth: 620, margin: '0 auto' }}>{titulo}</div>
                  {txt('franja', 'bajada') && <div style={{ fontSize: 14.5, color: t.muted, margin: '12px auto 22px', maxWidth: 480, lineHeight: 1.6 }}>{txt('franja', 'bajada')}</div>}
                  {txt('franja', 'cta') && <Boton t={t} grande onClick={acciones?.irACatalogo}>{txt('franja', 'cta')}</Boton>}
                </div>
              </Reveal>
            )
          }

          // plena
          return (
            <Reveal key={i}>
              <div style={{ background: t.primary, color: t.onPrimary, padding: movil ? '26px 18px' : '40px', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 230 }}>
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 21 : 30, fontWeight: 800, letterSpacing: '-0.025em' }}>{titulo}</div>
                  <div style={{ fontSize: 13.5, opacity: 0.9, marginTop: 6 }}>{txt('franja', 'bajada')}</div>
                </div>
                {txt('franja', 'cta') && (
                  <span
                    className="pl-cta" onClick={acciones?.irACatalogo}
                    style={{ background: t.onPrimary, color: t.primary, padding: '13px 26px', borderRadius: t.radio === 0 ? 0 : 999, fontWeight: 700, fontSize: 13.5, cursor: acciones ? 'pointer' : undefined }}
                  >{txt('franja', 'cta')}</span>
                )}
              </div>
            </Reveal>
          )
        }

        // ── Banner parallax ────────────────────────────────────────────────
        // La foto se queda quieta y el contenido pasa por encima. El efecto
        // lo hace `.pl-parallax` (piezas.tsx), que además lo apaga solo en
        // celular y con prefers-reduced-motion.
        case 'parallax': {
          const foto = txt('parallax', 'foto')
          const titulo = txt('parallax', 'titulo')
          if (!foto || !titulo) return null
          return (
            <div
              key={i} className="pl-parallax"
              style={{ backgroundImage: `url(${foto})`, minHeight: movil ? 320 : 440, display: 'flex', alignItems: 'center', position: 'relative' }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.72), rgba(0,0,0,0.18))' }} />
              <div style={{ position: 'relative', padding: movil ? '38px 20px' : '60px', maxWidth: 560 }}>
                {txt('parallax', 'volanta') && (
                  <div style={{ fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800, color: t.accent, marginBottom: 12 }}>{txt('parallax', 'volanta')}</div>
                )}
                <h2 style={{ fontFamily: t.fh, fontSize: movil ? 26 : 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.12, color: '#fff', margin: 0, textShadow: '0 2px 16px rgba(0,0,0,0.35)' }}>{titulo}</h2>
                {txt('parallax', 'texto') && (
                  <p style={{ fontSize: movil ? 14 : 16, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, margin: '14px 0 24px', maxWidth: 440 }}>{txt('parallax', 'texto')}</p>
                )}
                {txt('parallax', 'cta') && <Boton t={t} grande={!movil} onClick={acciones?.irACatalogo}>{txt('parallax', 'cta')}</Boton>}
              </div>
            </div>
          )
        }

        // ── Campaña: foto ancha con el texto encima ─────────────────────────
        case 'campana': {
          const foto = txt('campana', 'foto')
          if (!foto || !txt('campana', 'titulo')) return null
          return (
            <Reveal key={i}>
              <div style={{ padding: movil ? '28px 16px' : '52px 40px' }}>
                <div style={{ position: 'relative', borderRadius: t.radio, overflow: 'hidden' }}>
                  <Foto src={foto} alto={movil ? 260 : 360} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.78), rgba(0,0,0,0.12))', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: movil ? 22 : 48, color: '#fff' }}>
                    <div style={{ fontSize: 11.5, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800, marginBottom: 12 }}>{txt('campana', 'volanta')}</div>
                    <div style={{ fontFamily: t.fh, fontSize: movil ? 26 : 40, fontWeight: 800, letterSpacing: '-0.035em', maxWidth: 440, lineHeight: 1.1 }}>{txt('campana', 'titulo')}</div>
                    <p style={{ fontSize: 14, margin: '12px 0 20px', maxWidth: 380, opacity: 0.9 }}>{txt('campana', 'texto')}</p>
                    <div><span className="pl-cta" onClick={acciones?.irACatalogo} style={{ display: 'inline-block', background: '#fff', color: t.text, padding: '12px 24px', borderRadius: t.radio === 0 ? 0 : 999, fontSize: 13.5, fontWeight: 800, cursor: acciones ? 'pointer' : undefined }}>{txt('campana', 'cta')}</span></div>
                  </div>
                </div>
              </div>
            </Reveal>
          )
        }

        // ── Consulta por WhatsApp ──────────────────────────────────────────
        case 'whatsapp': {
          if (!txt('whatsapp', 'titulo')) return null
          return (
            <Reveal key={i}>
              <div style={{ borderTop: `1px solid ${t.border}`, background: t.soft, padding: movil ? '26px 18px' : '40px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 25, fontWeight: 800, letterSpacing: '-0.02em' }}>{txt('whatsapp', 'titulo')}</div>
                  <div style={{ fontSize: 13.5, color: t.muted, marginTop: 6 }}>{txt('whatsapp', 'bajada')}</div>
                </div>
                <Boton t={t} grande onClick={acciones?.abrirWhatsapp}>{txt('whatsapp', 'cta')}</Boton>
              </div>
            </Reveal>
          )
        }
      }
    }

    // El header: el mismo de siempre en dos variantes. No hace falta uno por
    // plantilla — lo que las distingue es el tema, no dónde cae el logo.
    const encabezado = (
      <>
        {!!txt('cintillo', 'texto') && (
          activo('cintillo', 'cartelera')
            ? <Marquee t={t} texto={txt('cintillo', 'texto')} />
            : (
              <div style={{ background: t.primary, color: t.onPrimary, textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' }}>
                {txt('cintillo', 'texto')}
              </div>
            )
        )}
        {r.header === 'centrado' ? (
          <HeaderCentrado t={t} marca={p.marca} links={p.links ?? []} conBuscador movil={movil} acciones={acciones} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: movil ? 12 : 26, padding: movil ? '13px 16px' : '16px 40px', background: t.surf, borderBottom: `1px solid ${t.border}` }}>
            {movil && <MenuMovil t={t} links={p.links ?? []} acciones={acciones} />}
            <span
              onClick={acciones?.irAInicio}
              style={{ fontFamily: t.fh, fontSize: movil ? 20 : 25, fontWeight: 800, letterSpacing: '-0.03em', color: t.text, cursor: acciones?.irAInicio ? 'pointer' : undefined }}
            >{p.marca}</span>
            {!movil && (() => {
              const nav = navDe(p.links ?? [], acciones)
              if (nav.length === 0) return null
              return (
                <div style={{ display: 'flex', gap: 22, fontSize: 13.5, color: t.muted, ...(acciones?.navLayout === 'centered' ? { margin: '0 auto' } : {}) }}>
                  {nav.map((l) => (
                    <span key={l.label} className="pl-nav" onClick={l.onClick} style={{ cursor: l.onClick ? 'pointer' : undefined, color: l.activo ? t.text : undefined, fontWeight: l.activo ? 700 : undefined }}>{l.label}</span>
                  ))}
                </div>
              )
            })()}
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 14 }}>
              {!movil && acciones?.renderBuscador && acciones.renderBuscador({})}
              <AccionesTienda t={t} movil={movil} acciones={acciones} />
            </span>
          </div>
        )}
      </>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}
        {r.bloques.map(bloque)}
        {p.cupon && (
          <Reveal>
            <div style={{ margin: movil ? '0 16px 26px' : '0 40px 40px', border: `1px dashed ${t.primary}`, borderRadius: t.radio, padding: movil ? 22 : '28px 32px', textAlign: 'center' }}>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 20 : 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{p.cupon.titulo}</div>
              <div style={{ fontSize: 13, color: t.muted, margin: '8px 0 16px' }}>{p.cupon.bajada}</div>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, letterSpacing: '0.16em', fontWeight: 700, color: t.primary, border: `1px dashed ${t.primary}`, padding: '10px 22px', borderRadius: 999 }}>{p.cupon.codigo}</span>
            </div>
          </Reveal>
        )}
        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  if (p.layout === 'tienda' || p.layout === 'vidriera') {
    const links = p.links ?? ['Inicio', 'Novedades', 'Ofertas']
    const confianza = p.confianza ?? [['Envío gratis', 'a todo el país'], ['3 cuotas', 'sin interés'], ['Cambios', 'hasta 30 días'], ['Garantía', '1 año']]
    const categorias = p.categorias ?? []
    const masVendidos = p.productosSecundarios ?? [...p.productos].reverse()
    return (
      <div style={marco}>
        {!soloCuerpo && (
          <>
            {p.cartel && <Marquee t={t} texto={p.cartel} />}
            <HeaderCentrado t={t} marca={p.marca} links={links} conBuscador movil={movil} acciones={acciones} />
            <Carrusel t={t} slides={p.slides} movil={movil} alto={movil ? 420 : 470} />
          </>
        )}

        {/* Barra de confianza fina, con separadores: muy de tienda masiva. */}
        <div style={{ borderBottom: `1px solid ${t.border}`, background: t.surf }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), padding: movil ? '12px 10px' : '14px 40px' }}>
            {confianza.map(([a, b], i) => (
              <div key={a} style={{ textAlign: 'center', fontSize: movil ? 11.5 : 13, borderLeft: i && !movil ? `1px solid ${t.border}` : 'none' }}>
                <strong style={{ fontWeight: 700 }}>{a}</strong> <span style={{ color: t.muted }}>{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Una tienda real puede no tener ningún producto destacado marcado
            (`isFeatured`) — sin este chequeo quedaba el título y la bajada
            flotando arriba de una grilla vacía, que es peor que no tener la
            sección. Mismo criterio que el home clásico de Órbita, que ya
            esconde cada fila sin productos (ver Inicio.tsx). */}
        {p.productos.length > 0 && (
        <Reveal>
          <div style={{ padding: movil ? '30px 0 0' : '48px 0 0' }}>
            <h2 style={{ fontFamily: t.fh, fontSize: movil ? 24 : 32, textAlign: 'center', margin: '0 0 4px', fontWeight: 800, letterSpacing: '-0.025em' }}>{txt('destacados', 'titulo')}</h2>
            <p style={{ textAlign: 'center', color: t.muted, fontSize: 13.5, margin: '0 0 26px' }}>{txt('destacados', 'bajada')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: cols(4), borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }}>
              {fila(cuantos(4), 'vidriera-destacados', p.productos).map((x, i) => producto(x, i, { sangre: true, alto: movil ? 190 : 290 }))}
            </div>
          </div>
        </Reveal>
        )}

        {categorias.length > 0 && (
          <Reveal>
            <div style={{ padding: movil ? '30px 16px' : '46px 40px' }}>
              <Titulo t={t} texto={txt('categorias', 'titulo')} centrado movil={movil} />
              <div style={{ display: 'grid', gridTemplateColumns: colsDe(4, categorias.length), gap: 12 }}>
                {categorias.slice(0, 4).map(([n, src, slug]) => (
                  <div
                    key={n} className="pl-tile"
                    onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                    style={{ position: 'relative', borderRadius: t.radio, cursor: slug && acciones ? 'pointer' : undefined }}
                  >
                    <Foto src={src} alto={movil ? 116 : 168} radio={t.radio} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.66), transparent 60%)', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: movil ? 13 : 16 }}>{n}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {/* Segunda fila de productos: el home real de Órbita tiene varias
            (destacados, nuevos ingresos, más vendidos), no una sola. */}
        {masVendidos.length > 0 && (
        <Reveal>
          <div style={{ padding: movil ? '4px 16px 30px' : '0 40px 44px' }}>
            <Titulo t={t} volanta={txt('masVendidos', 'volanta')} texto={txt('masVendidos', 'titulo')} accion={txt('masVendidos', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 12 : 16 }}>
              {fila(cuantos(4), 'vidriera-mas-vendidos', masVendidos).map((x, i) => producto(x, i, { alto: movil ? 150 : 215 }))}
            </div>
          </div>
        </Reveal>
        )}

        {p.cupon && (
          <Reveal>
            <div style={{ margin: movil ? '0 16px 30px' : '0 40px 42px', background: t.text, color: t.bg, padding: movil ? 22 : '30px 34px', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 230 }}>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 20 : 27, fontWeight: 800, letterSpacing: '-0.02em' }}>{p.cupon.titulo}</div>
                <div style={{ fontSize: 13.5, opacity: 0.75, marginTop: 6 }}>{p.cupon.bajada}</div>
              </div>
              <div style={{ border: '2px dashed rgba(255,255,255,0.5)', padding: '12px 22px', fontFamily: 'ui-monospace, monospace', fontSize: 19, fontWeight: 700, letterSpacing: '0.12em' }}>{p.cupon.codigo}</div>
            </div>
          </Reveal>
        )}

        {/* Banner de WhatsApp — esto SÍ lo arma Órbita (ver Inicio.tsx), a
            diferencia del newsletter que estaba acá antes. */}
        <Reveal>
          <div style={{ borderTop: `1px solid ${t.border}`, background: t.soft, padding: movil ? '26px 20px' : '38px 40px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center', textAlign: movil ? 'center' : 'left' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{txt('whatsapp', 'titulo')}</div>
              <div style={{ fontSize: 13.5, color: t.muted, marginTop: 6 }}>{txt('whatsapp', 'bajada')}</div>
            </div>
            <Boton t={t} grande onClick={acciones?.abrirWhatsapp}>{txt('whatsapp', 'cta')}</Boton>
          </div>
        </Reveal>

        {!soloCuerpo && !p.ocultarPie && (
          <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />
        )}
      </div>
    )
  }

  // ── MOSAICO ───────────────────────────────────────────────────────────────
  // Sin hero: arranca con un muro de bloques de distinta altura. Los productos
  // van compactos, cinco por fila, con lo mínimo.
  if (p.layout === 'mosaico') {
    const s = p.slides[iActual]
    // Los cuatro bloques chicos del muro son categorías REALES del negocio, no
    // una lista de casa y deco: el descuento de cada uno lo escribe el dueño
    // (sección "Muro"), porque es lo único que Órbita no sabe solo.
    const tiles = (p.categorias ?? []).slice(0, 4)
    // Una lista separada por comas, para no pedirle seis campos al dueño.
    const marcas = txt('marcas', 'lista').split(',').map((m) => m.trim()).filter(Boolean)

    const encabezado = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: movil ? '14px 16px' : '18px 28px', background: t.surf, borderBottom: `1px solid ${t.border}` }}>
        {/* La hamburguesa solo en celular: en escritorio los enlaces ya están
            a la vista al lado de la marca, y un control que promete un menú
            que no existe sobra. */}
        {movil && <MenuMovil t={t} links={p.links ?? []} acciones={acciones} />}
        <span
          onClick={acciones?.irAInicio}
          style={{ fontFamily: t.fh, fontSize: movil ? 18 : 22, fontWeight: 800, letterSpacing: '-0.02em', cursor: acciones?.irAInicio ? 'pointer' : undefined }}
        >{p.marca}</span>
        {/* El nav. Faltaba: este header dibujaba solo el ☰ decorativo, la
            marca y las acciones, así que en una tienda real no había forma de
            llegar a Catálogo, Ofertas ni a las categorías desde la portada.
            Los enlaces son los MISMOS que el header de Órbita (salen de
            `acciones.nav`, ver navRealDe) — lo propio de la plantilla es cómo
            se ven, no cuáles son. Centrado o al lado de la marca lo decide
            "Estilo de header" en Apariencia. */}
        {!movil && (() => {
          const nav = navDe(p.links ?? ['Cocina', 'Textil', 'Jardín', 'Deco'], acciones)
          if (nav.length === 0) return null
          const centrado = acciones?.navLayout === 'centered'
          return (
            <div style={{ display: 'flex', gap: 20, fontSize: 13, color: t.muted, ...(centrado ? { margin: '0 auto' } : {}) }}>
              {nav.map((l) => (
                <span key={l.label} className="pl-nav" onClick={l.onClick} style={{ cursor: l.onClick ? 'pointer' : undefined, fontWeight: l.activo ? 700 : 500, color: l.activo ? t.text : undefined }}>{l.label}</span>
              ))}
            </div>
          )
        })()}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 14, fontSize: 12.5, color: t.muted, alignItems: 'center' }}>
          {!movil && (acciones?.renderBuscador
            ? acciones.renderBuscador({})
            : <span style={{ border: `1px solid ${t.border}`, borderRadius: 999, padding: '7px 16px', background: t.soft }}>Buscar…</span>)}
          <AccionesTienda t={t} movil={movil} acciones={acciones} />
        </span>
      </div>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}

        {/* El muro. Alturas desparejas a propósito. */}
        <div style={{ padding: movil ? 12 : 16, display: 'grid', gridTemplateColumns: movil ? '1fr 1fr' : '1.7fr 1fr 1fr', gap: 12 }}>
          <div className="pl-tile" style={{ gridRow: movil ? undefined : 'span 2', gridColumn: movil ? 'span 2' : undefined, position: 'relative', borderRadius: t.radio, boxShadow: t.sombra }}>
            <Foto src={s.img} alto={movil ? 250 : 480} radio={t.radio} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(4,47,46,0.86), transparent 72%)', padding: movil ? 22 : 38, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: t.radio }}>
              {s.kicker && <div style={{ fontSize: 11.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>{s.kicker}</div>}
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 28 : 46, lineHeight: 1.04, margin: '12px 0 10px', color: '#fff', whiteSpace: 'pre-line', fontWeight: 800, letterSpacing: '-0.03em' }}>{s.titulo}</h1>
              <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.9)', margin: '0 0 20px', maxWidth: 380 }}>{s.bajada}</p>
              <div><Boton t={t} onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}>{s.cta}</Boton></div>
              {navHero({ marginTop: 18 })}
            </div>
          </div>
          {tiles.map(([n, src, slug], i) => (
            <div
              key={n} className="pl-tile"
              onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
              style={{ position: 'relative', borderRadius: t.radio, cursor: slug && acciones ? 'pointer' : undefined }}
            >
              <Foto src={src} alto={movil ? 128 : (i < 2 ? 230 : 238)} radio={t.radio} />
              <div style={{ position: 'absolute', inset: 0, padding: 15, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent 58%)', borderRadius: t.radio }}>
                {/* El descuento de cada bloque lo escribe el dueño: vacío, no
                    se dibuja la pastilla (mejor que inventarle un "-40%"). */}
                {txt('muro', `of${i + 1}`) && (
                  <span style={{ alignSelf: 'flex-start', background: t.accent, color: '#3B1D00', fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>{txt('muro', `of${i + 1}`)}</span>
                )}
                <span style={{ fontSize: movil ? 15 : 19, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{n}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Productos compactos: cinco por fila, imagen cuadrada, sin ficha larga. */}
        <Reveal>
          <div style={{ padding: movil ? '24px 16px 30px' : '34px 28px 40px' }}>
            <Titulo t={t} volanta={txt('fila', 'volanta')} texto={txt('fila', 'titulo')} accion={txt('fila', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(5, 2), gap: 14 }}>
              {fila(cuantos(5), 'mosaico-fila').map((x, i) => (
                <div key={i} className="pl-card" data-link={abrir(x) ? '1' : undefined} onClick={abrir(x)} style={{ background: t.surf, borderRadius: t.radio, overflow: 'hidden', border: `1px solid ${t.border}` }}>
                  <div className="pl-media" style={{ position: 'relative' }}>
                    <Foto src={x.img} src2={x.img2} alto={movil ? 150 : 172} />
                    {x.badge && <span style={{ position: 'absolute', top: 9, left: 9, background: TONOS[x.badgeTono ?? 'azul'], color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{x.badge}</span>}
                  </div>
                  <div style={{ padding: '11px 12px 14px' }}>
                    <div style={{ fontSize: 12.5, lineHeight: 1.35, height: 34, overflow: 'hidden' }}>{x.nombre}</div>
                    <div style={{ fontSize: 15.5, fontWeight: 800, marginTop: 6 }}>{x.precio}</div>
                    {x.antes && <div style={{ fontSize: 11.5, color: t.muted, textDecoration: 'line-through' }}>{x.antes}</div>}
                    {x.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.transfer}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* La franja prometía "Envío gratis desde $70.000" y "llega en 48 a 72
            horas" en cualquier tienda que aplicara Mosaico, la ofreciera o no.
            Ahora el texto es una afirmación (ver secciones.ts) y sin él la
            banda entera no se dibuja: media franja de color con un botón
            suelto se ve peor que no tenerla. */}
        {!!txt('franja', 'titulo') && (
        <Reveal>
          <div style={{ background: t.primary, color: '#fff', padding: movil ? '26px 18px' : '38px 28px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 230 }}>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 21 : 30, fontWeight: 800, letterSpacing: '-0.02em' }}>{txt('franja', 'titulo')}</div>
              <div style={{ fontSize: 13.5, opacity: 0.9, marginTop: 6 }}>{txt('franja', 'bajada')}</div>
            </div>
            <span
              className="pl-cta" onClick={acciones?.irACatalogo}
              style={{ background: '#fff', color: t.primary, padding: '13px 28px', borderRadius: 999, fontWeight: 700, fontSize: 13.5, cursor: acciones ? 'pointer' : undefined }}
            >{txt('franja', 'cta')}</span>
          </div>
        </Reveal>
        )}

        {/* Las marcas que trabaja el negocio. Vacío = la sección no se dibuja:
            no toda tienda de deco revende marcas, y seis casilleros con
            nombres inventados es peor que no tenerla. */}
        {marcas.length > 0 && (
        <Reveal>
          <div style={{ padding: movil ? '28px 16px' : '38px 28px' }}>
            <Titulo t={t} texto={txt('marcas', 'titulo')} centrado movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(6, 3), gap: 12 }}>
              {marcas.map((m) => (
                <div key={m} style={{ border: `1px solid ${t.border}`, borderRadius: t.radio, padding: '20px 8px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: t.muted, background: t.surf }}>{m}</div>
              ))}
            </div>
          </div>
        </Reveal>
        )}

        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  // ── ESCAPARATE ────────────────────────────────────────────────────────────
  // Marca de ropa: dos campañas a pantalla partida y "comprá el look" con
  // puntos sobre la foto. Todo foto grande, nada de párrafos.
  if (p.layout === 'escaparate') {
    // Dos campañas partidas: hoy son los primeros DOS slides del hero, los
    // mismos que ya edita el dueño en Apariencia (mismo editor que usa
    // Vidriera) — ver `heroPropio` en tipos.ts y plantillaReal.ts. No hay
    // `kicker` en datos reales (Apariencia no tiene ese campo): se dibuja
    // solo si vino de la maqueta.
    // Cada punto es "alto,ancho" en porcentaje sobre la foto del look.
    const puntosLook: [number, number][] = ['p1', 'p2', 'p3']
      .map((k) => txt('look', k))
      .filter(Boolean)
      .map((v) => {
        const [top, left] = v.split(',').map((n) => parseFloat(n.trim()))
        return [Number.isFinite(top) ? top : 50, Number.isFinite(left) ? left : 50] as [number, number]
      })
    const campanas = p.slides.slice(0, 2)
    const cats = p.categorias ?? []
    return (
      <div style={marco}>
        {!soloCuerpo && (
          <>
            <div style={{ background: t.primary, color: t.onPrimary, textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' }}>
              Envío gratis en compras desde $90.000 · 3 cuotas sin interés
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: movil ? '13px 16px' : '17px 34px', borderBottom: `1px solid ${t.border}` }}>
              <span style={{ fontFamily: t.fh, fontSize: movil ? 19 : 23, fontWeight: 800, letterSpacing: '-0.04em', textTransform: 'uppercase' }}>{p.marca}</span>
              {!movil && <div style={{ display: 'flex', gap: 22, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{['Mujer', 'Hombre', 'Calzado', 'Sale'].map((l) => <span key={l} style={{ color: l === 'Sale' ? t.accent : t.text }}>{l}</span>)}</div>}
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 14, fontSize: 12.5, color: t.muted, alignItems: 'center' }}>
                {!movil && <span style={{ border: `1px solid ${t.border}`, borderRadius: 4, padding: '7px 14px' }}>Buscar</span>}
                <AccionesTienda t={t} movil={movil} acciones={acciones} />
              </span>
            </div>
          </>
        )}

        {/* Dos campañas, mitad y mitad. Editable desde Apariencia (el mismo
            hero de Vidriera): con menos de dos slides cargados, se acomoda
            sola en vez de dejar una columna vacía. */}
        {campanas.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : `repeat(${campanas.length}, 1fr)` }}>
            {campanas.map((s, i) => (
              <div
                key={i} className="pl-tile" style={{ position: 'relative', cursor: s.link && acciones?.irALink ? 'pointer' : undefined }}
                onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}
              >
                <Foto src={s.img} alto={movil ? 330 : 540} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(9,9,11,0.72), transparent 58%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: movil ? 24 : 40 }}>
                  {s.kicker && <div style={{ fontSize: 11.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', fontWeight: 700, marginBottom: 12 }}>{s.kicker}</div>}
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 32 : 46, lineHeight: 1.02, color: '#fff', whiteSpace: 'pre-line', fontWeight: 800, letterSpacing: '-0.035em', marginBottom: 20 }}>{s.titulo}</div>
                  <div><span style={{ display: 'inline-block', background: '#fff', color: t.text, padding: '12px 26px', fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.cta}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {p.productos.length > 0 && (
        <Reveal>
          <div style={{ padding: movil ? '30px 0 34px 16px' : '48px 0 52px 34px' }}>
            <div style={{ paddingRight: movil ? 16 : 34 }}>
              <Titulo t={t} volanta={txt('tira', 'volanta')} texto={txt('tira', 'titulo')} accion={txt('tira', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            </div>
            <Tira gap={14}>
              {/* Con datos reales, la ProductCard de verdad (vía `producto()`
                  → `acciones.renderProducto`), con `sangre` para que quede
                  sin caja ni borde — lo más cerca que se puede estar del
                  look sin caja de la maqueta SIN perder agregar/comprar
                  ahora/picker de variante/ícono flotante/aviso de stock:
                  esa funcionalidad vive adentro de la ProductCard real y no
                  se puede clonar en una tarjeta escrita a mano sin
                  reimplementar todo el carrito acá (pedido explícito:
                  "las product card deben tener las mismas funcionalidades
                  que las originales"). Sin `acciones` (maqueta), sigue la
                  tarjeta propia de Escaparate — sin caja, swatches en hex,
                  "Agregar" decorativo — que es la que no compra nada.
                  El repetido del primer producto al final es puro relleno
                  de maqueta (4 de muestra se sienten poco). */}
              {acciones
                ? p.productos.map((x, i) => (
                    <div key={x.slug ?? x.nombre} style={{ width: movil ? 210 : 268, flexShrink: 0, scrollSnapAlign: 'start' }}>
                      {producto(x, i, { sangre: true, alto: movil ? 270 : 340 })}
                    </div>
                  ))
                : [...p.productos, p.productos[0]].map((x, i) => (
                <div key={i} className="pl-card" style={{ width: movil ? 210 : 268, flexShrink: 0, scrollSnapAlign: 'start' }}>
                  <div style={{ position: 'relative' }}>
                    <Foto src={x.img} src2={x.img2} alto={movil ? 270 : 340} />
                    {x.badge && <span style={{ position: 'absolute', top: 12, left: 12, background: TONOS[x.badgeTono ?? 'azul'], color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '4px 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{x.badge}</span>}
                  </div>
                  <div style={{ paddingTop: 12 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{x.nombre}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 5 }}>
                      {x.antes && <span style={{ fontSize: 12, color: t.muted, textDecoration: 'line-through' }}>{x.antes}</span>}
                      <span style={{ fontSize: 16, fontWeight: 800 }}>{x.precio}</span>
                    </div>
                    {x.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.transfer}</div>}
                    {x.cuotas && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.cuotas}</div>}
                    {x.colores && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                        {x.colores.map((c) => <span key={c} className="pl-swatch" style={{ width: 14, height: 14, borderRadius: '50%', background: c, border: `1px solid ${t.border}` }} />)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </Tira>
          </div>
        </Reveal>
        )}

        {/* Comprá el look: puntos numerados sobre la foto + lista al costado. */}
        <Reveal>
          <div style={{ background: t.soft, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '30px 16px' : '52px 34px' }}>
            <Titulo t={t} volanta={txt('look', 'volanta')} texto={txt('look', 'titulo')} movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 0.85fr', gap: movil ? 20 : 34, alignItems: 'start' }}>
              <div style={{ position: 'relative' }}>
                <Foto src={txt('look', 'foto')} alto={movil ? 340 : 460} radio={t.radio} />
                {/* Los tres puntos sobre la foto: su posicion la elige el
                    dueno en porcentajes (alto/ancho), porque depende de donde
                    caiga cada prenda en SU foto. Antes estaban clavados en
                    coordenadas pensadas para la foto de la maqueta. */}
                {puntosLook.map(([top, left], i) => (
                  <span key={i} style={{
                    position: 'absolute', top: `${top}%`, left: `${left}%`, width: 30, height: 30, borderRadius: '50%',
                    background: '#fff', color: t.text, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.35)', border: '2px solid rgba(255,255,255,0.9)',
                  }}>{i + 1}</span>
                ))}
              </div>
              <div>
                {p.productos.slice(0, 3).map((x, i) => (
                  <div
                    key={x.nombre} className="pl-card"
                    onClick={x.slug && acciones ? () => acciones.irAProducto(x.slug!) : undefined}
                    style={{ display: 'flex', gap: 14, alignItems: 'center', background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, padding: 12, marginBottom: 12, cursor: x.slug && acciones ? 'pointer' : undefined }}
                  >
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: t.primary, color: t.onPrimary, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ width: 62, flexShrink: 0 }}><Foto src={x.img} alto={72} radio={t.radio} /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{x.nombre}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>{x.precio}</div>
                      {x.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.transfer}</div>}
                    </div>
                    {/* "Agregar" de la maqueta no compra nada de verdad — con
                        datos reales pasa a "Ver" y navega a la ficha, ahí sí
                        con el picker de variante real (mismo criterio que
                        `renderProducto`: nunca prometer un agregado directo
                        que Órbita no arma). */}
                    <span className="pl-cta" style={{ background: t.primary, color: t.onPrimary, fontSize: 11.5, fontWeight: 700, padding: '9px 14px', borderRadius: t.radio, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{acciones ? 'Ver' : 'Agregar'}</span>
                  </div>
                ))}
                {/* "Agregar los 3" es un combo (agregar tres productos, cada
                    uno con su propia variante, de un solo tilde) que Órbita
                    no arma — se muestra solo en la maqueta. */}
                {!acciones && <div style={{ marginTop: 14 }}><Boton t={t} ancho>Agregar los 3 · $446.000</Boton></div>}
              </div>
            </div>
          </div>
        </Reveal>

        {cats.length > 0 && (
        <Reveal>
          <div style={{ padding: movil ? '30px 16px' : '48px 34px' }}>
            {/* Grilla del ancho de la cantidad real de categorías (2 a 4) —
                con `cols(4,2)` fijo, una tienda con menos de 4 dejaba
                columnas vacías a la derecha en vez de tiles más grandes. El
                `.slice()` es el otro lado de la misma cuenta: sin él, una
                tienda con MÁS de 4 (desde que el adaptador dejó de cortar a
                4 categorías siempre, ver plantillaReal.ts) dejaba una
                segunda fila a medio llenar — el mismo hueco, del otro lado. */}
            <div style={{ display: 'grid', gridTemplateColumns: movil ? `repeat(${Math.min(cats.length, 2)}, 1fr)` : `repeat(${Math.min(cats.length, 4)}, 1fr)`, gap: 12 }}>
              {cats.slice(0, movil ? 2 : 4).map(([n, src, slug]) => (
                <div
                  key={n} className="pl-tile"
                  onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                  style={{ position: 'relative', cursor: slug && acciones ? 'pointer' : undefined }}
                >
                  <Foto src={src} alto={movil ? 130 : 210} />
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(9,9,11,0.30)', display: 'grid', placeItems: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: movil ? 13 : 17, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{n}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        )}

        {!soloCuerpo && !p.ocultarPie && (
          <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />
        )}
      </div>
    )
  }

  // ── PREMIUM ───────────────────────────────────────────────────────────────
  // Joyería. Lo que la separa de las otras cinco: el producto se presenta de a
  // uno, con aire alrededor, y no hay un solo tachado ni cartel de oferta — el
  // argumento es la pieza, no el descuento. Todo lo demás (dorado sobre
  // carbón, serif, filetes de un pixel) está al servicio de eso.
  if (p.layout === 'premium') {
    // El slide activo, no siempre el primero: el hero rota entre todos los que
    // el dueño cargó en Apariencia y trae flechas y puntos (ver navHero).
    const s = p.slides[iActual]
    const filete = `1px solid ${t.border}`
    const enlaceOro: React.CSSProperties = {
      fontSize: 11.5, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700,
      color: t.primary, borderBottom: `1px solid ${t.primary}`, paddingBottom: 6,
    }
    // El encabezado sale aparte porque no es del home: lo usa TODA la tienda
    // (ver LAYOUTS_CON_HEADER_PROPIO y el modo `soloHeader`).
    const encabezado = (
      <>
        {/* El cintillo, fijo o corriendo en loop según lo elija el dueño. La
            versión cartelera conserva el dorado sobre carbón de Premium en vez
            de usar el `Marquee` compartido, que va en negativo (fondo oscuro
            del tema) y acá se vería como una franja pegada de otra plantilla. */}
        {!!txt('cintillo', 'texto') && (
          <div style={{ padding: '9px 0', fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: t.primary, borderBottom: filete, overflow: 'hidden' }}>
            {activo('cintillo', 'cartelera') ? (
              <div className="pl-marquee-track">
                {[0, 1].map((k) => (
                  <span key={k}>{`${txt('cintillo', 'texto')}   ·   `.repeat(6)}</span>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '0 12px' }}>{txt('cintillo', 'texto')}</div>
            )}
          </div>
        )}

        {/* Logo centrado, buscador a la izquierda y las acciones de la tienda a
            la derecha — la misma cuenta y el mismo carrito que el resto del
            sitio, pintados en dorado. */}
        <div style={{ display: 'grid', gridTemplateColumns: movil ? 'auto 1fr auto' : '1fr auto 1fr', alignItems: 'center', padding: movil ? '14px 16px' : '22px 44px', borderBottom: filete, gap: 14 }}>
          {movil
            ? <MenuMovil t={t} links={p.links ?? []} acciones={acciones} color={t.primary} />
            // Con la tienda real detrás el buscador busca de verdad; en la
            // vitrina del panel sigue siendo el dibujito decorativo de siempre.
            : acciones?.renderBuscador
              ? <span style={{ justifySelf: 'start' }}>{acciones.renderBuscador({})}</span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.muted }}>⌕ Buscar</span>}
          <div style={{ textAlign: 'center' }}>
            <div
              onClick={acciones?.irAInicio}
              style={{ fontFamily: t.fh, fontSize: movil ? 24 : 34, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.primary, cursor: acciones?.irAInicio ? 'pointer' : undefined }}
            >{p.marca}</div>
            {!movil && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 12, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.muted }}>
                {navDe(p.links ?? ['Anillos', 'Collares', 'Aros', 'Relojes', 'A pedido'], acciones).map((l) => <span key={l.label} className="pl-nav" onClick={l.onClick} style={{ cursor: l.onClick ? 'pointer' : undefined }}>{l.label}</span>)}
              </div>
            )}
          </div>
          <span style={{ justifySelf: 'end' }}><AccionesTienda t={t} movil={movil} acciones={acciones} /></span>
        </div>
      </>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}

        {/* Hero a sangre: la pieza ocupa todo y el texto se apoya abajo a la
            izquierda. Antes era una columna de texto al lado de una foto
            chica y se leía como cualquier tienda; así se lee como una vidriera. */}
        <div className="pl-tile" style={{ position: 'relative' }}>
          <Foto src={s.img} alto={movil ? 430 : 620} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            padding: movil ? '0 22px 34px' : '0 56px 62px',
            background: movil
              ? 'linear-gradient(to top, rgba(12,10,9,0.97) 46%, rgba(12,10,9,0.8) 68%, rgba(12,10,9,0.28))'
              : 'linear-gradient(100deg, rgba(12,10,9,0.94) 26%, rgba(12,10,9,0.55) 52%, transparent 78%)',
          }}>
            <div style={{ maxWidth: 460 }}>
              <div style={{ width: 46, height: 1, background: t.primary, marginBottom: 18 }} />
              {s.kicker && <div style={{ fontSize: 10.5, letterSpacing: '0.3em', textTransform: 'uppercase', color: t.primary, marginBottom: 18 }}>{s.kicker}</div>}
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 44 : 78, lineHeight: 0.98, margin: 0, whiteSpace: 'pre-line', fontWeight: 400, letterSpacing: '-0.015em', color: '#F7F2E8' }}>{s.titulo}</h1>
              <p style={{ fontSize: movil ? 14 : 15, color: 'rgba(247,242,232,0.7)', margin: '22px 0 30px', lineHeight: 1.85 }}>{s.bajada}</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span
                  className="pl-cta"
                  onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}
                  style={{ background: t.primary, color: t.onPrimary, padding: '14px 30px', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: s.link && acciones ? 'pointer' : undefined }}
                >{s.cta}</span>
                <span
                  className="pl-cta"
                  onClick={acciones?.abrirWhatsapp}
                  style={{ border: '1px solid rgba(247,242,232,0.35)', color: '#F7F2E8', padding: '14px 26px', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: acciones ? 'pointer' : undefined }}
                >{txt('hero', 'cta2')}</span>
              </div>
              {navHero({ marginTop: 30 })}
            </div>
          </div>
        </div>

        {/* Tres promesas en una línea, separadas por filetes. */}
        <div style={{ borderBottom: filete, display: 'grid', gridTemplateColumns: movil ? '1fr' : 'repeat(3, 1fr)' }}>
          {([
            [txt('promesas', 't1'), txt('promesas', 'b1')],
            [txt('promesas', 't2'), txt('promesas', 'b2')],
            [txt('promesas', 't3'), txt('promesas', 'b3')],
          ] as [string, string][]).filter(([v]) => v).map(([a, b], i) => (
            <div key={a} style={{ padding: movil ? '20px 22px' : '30px 34px', textAlign: 'center', borderLeft: !movil && i > 0 ? filete : undefined, borderTop: movil && i > 0 ? filete : undefined }}>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 22, color: t.primary }}>{a}</div>
              <div style={{ fontSize: 12, color: t.muted, marginTop: 6, letterSpacing: '0.04em' }}>{b}</div>
            </div>
          ))}
        </div>

        {(p.categorias ?? []).length > 0 && (
        <Reveal>
          <div style={{ padding: movil ? '30px 16px 8px' : '58px 44px 16px' }}>
            <Titulo t={t} volanta={txt('categorias', 'volanta')} texto={txt('categorias', 'titulo')} accion={txt('categorias', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'grid', gridTemplateColumns: colsDe(4, (p.categorias ?? []).length, 2), gap: 12 }}>
              {/* Las categorías REALES del negocio (plantillaReal.ts las arma
                  con su foto propia, la del primer producto o el degradé).
                  Antes eran cuatro fijas de joyería —Anillos, Collares, Aros,
                  Relojes— así que una tienda de ropa con Premium aplicada
                  mostraba categorías que no vendía. Las de muestra quedan
                  solo para la vitrina del panel. */}
              {(p.categorias ?? []).slice(0, 4).map(([n, src, slug]) => (
                <div
                  key={n} className="pl-tile"
                  onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                  style={{ position: 'relative', cursor: slug && acciones ? 'pointer' : undefined }}
                >
                  <Foto src={src} alto={movil ? 140 : 250} radio={t.radio} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(12,10,9,0.9), rgba(12,10,9,0.1) 62%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
                    <span style={{ fontFamily: t.fh, fontSize: movil ? 16 : 22, letterSpacing: '0.06em', color: '#F7F2E8' }}>{n}</span>
                  </div>
                  <div style={{ position: 'absolute', inset: 10, border: '1px solid rgba(201,162,39,0.28)', pointerEvents: 'none' }} />
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        )}

        {/* Las piezas: tres, grandes, con aire. Sin tachados ni badges de oferta. */}
        <Reveal>
          <div style={{ padding: movil ? '26px 16px 34px' : '46px 44px 62px' }}>
            <Titulo t={t} volanta={txt('fila', 'volanta')} texto={txt('fila', 'titulo')} accion={txt('fila', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(3, 1), gap: movil ? 24 : 32 }}>
              {fila(cuantos(3, 1), 'premium-piezas').map((x) => (
                <div key={x.nombre} className="pl-card" data-link={abrir(x) ? '1' : undefined} onClick={abrir(x)} style={{ textAlign: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <Foto src={x.img} src2={x.img2} alto={movil ? 320 : 400} radio={t.radio} />
                    {x.badge && (
                      <span style={{ position: 'absolute', top: 14, left: 14, border: `1px solid ${t.primary}`, color: t.primary, fontSize: 9.5, fontWeight: 700, padding: '5px 11px', letterSpacing: '0.16em', textTransform: 'uppercase', background: 'rgba(12,10,9,0.74)' }}>{x.badge}</span>
                    )}
                  </div>
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 21 : 26, marginTop: 20 }}>{x.nombre}</div>
                  {x.estrellas && (
                    <div style={{ marginTop: 8, color: t.muted }}><Estrellas n={x.estrellas} resenas={x.resenas} color={t.primary} /></div>
                  )}
                  <div style={{ fontSize: 17.5, color: t.primary, marginTop: 10, letterSpacing: '0.03em' }}>{x.precio}</div>
                  {x.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.transfer}</div>}
                  <div style={{ marginTop: 16 }}>
                    <span style={{ ...enlaceOro, fontSize: 10.5, color: t.muted, borderBottomColor: t.border }}>Ver la pieza</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* El taller: foto a la izquierda, números grandes en serif a la derecha. */}
        <Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', alignItems: 'stretch', borderTop: filete, borderBottom: filete }}>
            <Foto src={txt('taller', 'foto')} alto={movil ? 250 : 420} />
            <div style={{ padding: movil ? '32px 22px' : '56px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: t.soft }}>
              <div style={{ width: 40, height: 1, background: t.primary, marginBottom: 16 }} />
              <div style={{ fontSize: 10.5, letterSpacing: '0.28em', textTransform: 'uppercase', color: t.primary, marginBottom: 14 }}>{txt('taller', 'volanta')}</div>
              <h2 style={{ fontFamily: t.fh, fontSize: movil ? 30 : 42, margin: 0, fontWeight: 400, lineHeight: 1.1 }}>{txt('taller', 'titulo')}</h2>
              <p style={{ fontSize: 14.5, color: t.muted, lineHeight: 1.85, margin: '20px 0 28px', maxWidth: 420, whiteSpace: 'pre-line' }}>
                {txt('taller', 'texto')}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: movil ? 20 : 38, justifyContent: 'start' }}>
                {([
                  [txt('taller', 'n1v'), txt('taller', 'n1l')],
                  [txt('taller', 'n2v'), txt('taller', 'n2l')],
                  [txt('taller', 'n3v'), txt('taller', 'n3l')],
                ] as [string, string][]).filter(([v]) => v).map(([n, l]) => (
                  <div key={l}>
                    <div style={{ fontFamily: t.fh, fontSize: movil ? 30 : 40, color: t.primary, lineHeight: 1 }}>{n}</div>
                    <div style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.muted, marginTop: 8 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', alignItems: 'center' }}>
            <div style={{ order: movil ? 2 : 1, padding: movil ? '32px 22px' : '0 52px' }}>
              <Titulo t={t} volanta={txt('grabado', 'volanta')} texto={txt('grabado', 'titulo')} movil={movil} />
              <p style={{ fontSize: 14.5, color: t.muted, lineHeight: 1.85, margin: '0 0 24px', maxWidth: 400, whiteSpace: 'pre-line' }}>
                {txt('grabado', 'texto')}
              </p>
              <span
                style={{ ...enlaceOro, cursor: acciones ? 'pointer' : undefined }}
                onClick={acciones?.abrirWhatsapp}
              >{txt('grabado', 'cta')}</span>
            </div>
            <div style={{ order: movil ? 1 : 2 }}><Foto src={txt('grabado', 'foto')} alto={movil ? 260 : 420} /></div>
          </div>
        </Reveal>


        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  // ── NOCTURNO ──────────────────────────────────────────────────────────────
  // Tech: contador de lanzamiento, foco radial detrás del producto, categorías
  // con cantidad, carrusel con specs y armador de setup.
  if (p.layout === 'nocturno') {
    const s = p.slides[iActual]
    // La etiqueta de arriba del título. El slide de la maqueta trae `kicker`;
    // el real no (Apariencia no tiene ese campo), así que cae a la sección
    // `hero`, que el dueño sí edita.
    const etiquetaHero = s?.kicker || txt('hero', 'etiqueta')
    // Los tres pasos de "Armá tu setup": lo que va ahí lo elige el dueño
    // (categoría o producto), no el orden en que estén cargadas las
    // categorías. Sin elegir nada la sección no se dibuja.
    const pasos = lugares(3, 'pasos', 'nocturno-pasos')

    const encabezado = (
      <>
        {/* El cintillo de lanzamiento. El reloj de la maqueta (02d 11h 46m)
            no contaba nada: Órbita ya tiene cuenta regresiva de verdad en
            Avanzado → Oferta relámpago, que se dibuja sola arriba de la
            portada. Acá queda el anuncio como texto editable, y vacío no se
            dibuja. */}
        {txt('lanzamiento', 'texto') && (
          <div style={{ background: t.soft, borderBottom: `1px solid ${t.border}`, padding: '9px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.primary, fontWeight: 700 }}>{txt('lanzamiento', 'texto')}</span>
            {!movil && txt('lanzamiento', 'aclaracion') && <span style={{ fontSize: 12, color: t.muted }}>· {txt('lanzamiento', 'aclaracion')}</span>}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: movil ? '13px 16px' : '15px 32px', borderBottom: `1px solid ${t.border}` }}>
          <span
            onClick={acciones?.irAInicio}
            style={{ fontFamily: t.fh, fontSize: movil ? 18 : 21, fontWeight: 800, letterSpacing: '-0.02em', cursor: acciones?.irAInicio ? 'pointer' : undefined }}
          >{p.marca}</span>
          {movil
            ? <MenuMovil t={t} links={p.links ?? []} acciones={acciones} />
            : <div style={{ display: 'flex', gap: 20, fontSize: 13, color: t.muted }}>{navDe(p.links ?? ['Periféricos', 'Audio', 'Monitores', 'Reacondicionados'], acciones).map((l) => <span key={l.label} className="pl-nav" onClick={l.onClick} style={{ cursor: l.onClick ? 'pointer' : undefined }}>{l.label}</span>)}</div>}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12, alignItems: 'center', fontSize: 12.5, color: t.muted }}>
            {!movil && (acciones?.renderBuscador
              ? acciones.renderBuscador({})
              : <span style={{ border: `1px solid ${t.border}`, borderRadius: 8, padding: '7px 14px', background: t.soft, fontFamily: 'ui-monospace, monospace' }}>buscar…</span>)}
            <AccionesTienda t={t} movil={movil} acciones={acciones} />
          </span>
        </div>
      </>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}

        <div style={{ position: 'relative', overflow: 'hidden', background: `radial-gradient(1100px 500px at 72% 46%, rgba(34,211,238,0.20), transparent 62%), ${t.bg}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1.05fr', gap: movil ? 0 : 40, padding: movil ? '30px 18px' : '62px 40px', alignItems: 'center' }}>
            <div>
              {/* La etiqueta de arriba del titulo. El slide real no trae `kicker`
                  --Apariencia no tiene ese campo-- asi que sale de la seccion
                  `hero`, editable desde el panel. Vacia, la pastilla no se
                  dibuja: un borde redondeado con nada adentro se ve peor que
                  no tenerlo. */}
              {etiquetaHero && <div style={{ display: 'inline-block', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.primary, fontWeight: 700, border: `1px solid ${t.primary}`, borderRadius: 999, padding: '5px 13px', marginBottom: 18 }}>{etiquetaHero}</div>}
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 36 : 62, lineHeight: 0.96, margin: 0, fontWeight: 800, letterSpacing: '-0.045em', whiteSpace: 'pre-line' }}>{s.titulo}</h1>
              <p style={{ fontSize: 15, color: t.muted, margin: '18px 0 26px', lineHeight: 1.7, maxWidth: 420 }}>{s.bajada}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
                <Boton t={t} onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}>{s.cta}</Boton>
                <Boton t={t} secundario onClick={acciones?.abrirWhatsapp}>{txt('hero', 'cta2')}</Boton>
              </div>
              {navHero({ marginBottom: 24 })}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {([
                  [txt('hero', 's1v'), txt('hero', 's1l')],
                  [txt('hero', 's2v'), txt('hero', 's2l')],
                  [txt('hero', 's3v'), txt('hero', 's3l')],
                ] as [string, string][]).filter(([v]) => v).map(([v, l]) => (
                  <div key={l} style={{ border: `1px solid ${t.border}`, background: t.surf, borderRadius: t.radio, padding: '10px 16px', boxShadow: '0 0 0 1px rgba(34,211,238,0.08)' }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: t.primary, fontFamily: 'ui-monospace, monospace' }}>{v}</div>
                    <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -20, background: 'radial-gradient(closest-side, rgba(34,211,238,0.22), transparent)', filter: 'blur(18px)' }} />
              <div style={{ position: 'relative' }}><Foto src={s.img} alto={movil ? 250 : 400} radio={t.radio} /></div>
            </div>
          </div>
        </div>

        {/* Categorías con cantidad de artículos. */}
        <Reveal>
          <div style={{ padding: movil ? '24px 16px 10px' : '34px 40px 12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: colsDe(4, (p.categorias ?? []).length, 2), gap: 12 }}>
              {/* Las categorias del negocio. Antes eran cuatro fijas de tech
                  con su conteo de modelos inventado ("42 modelos"): Orbita no
                  pasa ese total, asi que no se promete. */}
              {(p.categorias ?? []).slice(0, 4).map(([n, src, slug]) => (
                <div
                  key={n} className="pl-tile"
                  onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                  style={{ position: 'relative', borderRadius: t.radio, border: `1px solid ${t.border}`, cursor: slug && acciones ? 'pointer' : undefined }}
                >
                  <Foto src={src} alto={movil ? 100 : 140} radio={t.radio} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,17,32,0.92), transparent 62%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 13, borderRadius: t.radio }}>
                    <span style={{ fontSize: movil ? 13.5 : 15.5, fontWeight: 700 }}>{n}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ padding: movil ? '20px 0 30px 16px' : '26px 0 44px 40px' }}>
            <div style={{ paddingRight: movil ? 16 : 40 }}>
              <Titulo t={t} volanta={txt('fila', 'volanta')} texto={txt('fila', 'titulo')} accion={txt('fila', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            </div>
            <Tira gap={14}>
              {fila(movil ? 4 : 6, 'nocturno-fila').map((x) => (
                <div key={x.nombre} className="pl-card" data-link={abrir(x) ? '1' : undefined} onClick={abrir(x)} style={{ width: movil ? 235 : 280, flexShrink: 0, scrollSnapAlign: 'start', background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
                  <div style={{ position: 'relative' }}>
                    <Foto src={x.img} src2={x.img2} alto={movil ? 150 : 178} />
                    {x.badge && <span style={{ position: 'absolute', top: 10, left: 10, background: TONOS[x.badgeTono ?? 'azul'], color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 6, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em' }}>{x.badge}</span>}
                  </div>
                  <div style={{ padding: '13px 14px 15px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{x.nombre}</div>
                    <div style={{ marginTop: 8, borderTop: `1px solid ${t.border}` }}>
                      {([
                        [txt('ficha', 'f1l'), txt('ficha', 'f1v')],
                        [txt('ficha', 'f2l'), txt('ficha', 'f2v')],
                        [txt('ficha', 'f3l'), txt('ficha', 'f3v')],
                      ] as [string, string][]).filter(([a, b]) => a && b).map(([a, b]) => (
                        <div key={a} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 11.5, color: t.muted, fontFamily: 'ui-monospace, monospace' }}>
                          <span>{a}</span><span style={{ color: t.text }}>{b}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                      {x.antes && <span style={{ fontSize: 12, color: t.muted, textDecoration: 'line-through' }}>{x.antes}</span>}
                      <span style={{ fontSize: 18, fontWeight: 800 }}>{x.precio}</span>
                    </div>
                    {x.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.transfer}</div>}
                    <div style={{ fontSize: 11.5, color: t.muted, marginTop: 4 }}>{x.cuotas}</div>
                  </div>
                </div>
              ))}
            </Tira>
          </div>
        </Reveal>

        {/* Armá tu setup: los tres pasos los elige el dueño desde el editor
            (categoría o producto). Los que no eligió se llenan con el
            catálogo, igual que cualquier otra fila. */}
        <Reveal>
          <div style={{ background: t.soft, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '30px 16px' : '46px 40px' }}>
            <Titulo t={t} volanta={txt('pasos', 'volanta')} texto={txt('pasos', 'titulo')} centrado movil={movil} />
            {/* Eran tres pasos con producto y precio clavados, y un boton que
                no armaba nada: Orbita no tiene configurador. Despues fueron
                las tres primeras categorias del negocio, que tampoco tenia
                sentido: que va aca es una decision del dueño. Ahora elige
                cada paso --categoria o producto-- desde el editor. */}
            <div style={{ display: 'grid', gridTemplateColumns: cols(3, 1), gap: 16 }}>
              {pasos.map(({ nombre: n, img: src, ir }, i) => (
                <div
                  key={n} className="pl-card"
                  onClick={ir}
                  style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden', cursor: ir ? 'pointer' : undefined }}
                >
                  <div style={{ position: 'relative' }}>
                    <Foto src={src} alto={movil ? 140 : 158} />
                    <span style={{ position: 'absolute', top: 10, left: 10, width: 26, height: 26, borderRadius: '50%', background: t.primary, color: t.onPrimary, display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 800 }}>{i + 1}</span>
                  </div>
                  <div style={{ padding: '13px 14px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{n}</div>
                    </div>
                    <span className="pl-cta" style={{ border: `1px solid ${t.primary}`, color: t.primary, borderRadius: 8, padding: '7px 12px', fontSize: 11.5, fontWeight: 700 }}>Ver</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 22 }}><Boton t={t} grande onClick={acciones?.irACatalogo}>{txt('pasos', 'cta')}</Boton></div>
          </div>
        </Reveal>


        <div style={{ background: t.soft, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '26px 16px' : '40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 20 }}>
            {([
              [txt('numeros', 'n1v'), txt('numeros', 'n1l')],
              [txt('numeros', 'n2v'), txt('numeros', 'n2l')],
              [txt('numeros', 'n3v'), txt('numeros', 'n3l')],
              [txt('numeros', 'n4v'), txt('numeros', 'n4l')],
            ] as [string, string][]).filter(([n]) => n).map(([n, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: movil ? 26 : 40, fontWeight: 800, color: t.primary, fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.03em' }}>{n}</div>
                <div style={{ fontSize: 12.5, color: t.muted, marginTop: 6 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  // ── PAPELERÍA ─────────────────────────────────────────────────────────────
  // A una librería no se entra a pasear: se entra a buscar el cuaderno que
  // pidió la maestra. Por eso el buscador es el hero y no un ícono arriba a la
  // derecha, y por eso hay un armador de lista escolar con total.
  if (p.layout === 'papeleria') {
    const s = p.slides[iActual]
    // La lista escolar. Primero fue un armador con total y "10% off llevando
    // la lista completa" que no sumaba nada --Órbita no tiene listas ni
    // combos--. Después, cinco renglones "producto | precio" que el dueño
    // escribía a mano: el precio quedaba pegado en la portada y desactualizado
    // al día siguiente. Ahora son productos de verdad, elegidos del catálogo,
    // con SU precio; el presupuesto se pide por WhatsApp.

    const encabezado = (
      <>
        {!!txt('cintillo', 'texto') && (
          <div style={{ background: t.primary, color: t.onPrimary, textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>
            {txt('cintillo', 'texto')}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: movil ? 12 : 24, padding: movil ? '13px 16px' : '16px 32px', background: t.surf, borderBottom: `1px solid ${t.border}` }}>
          <span
            onClick={acciones?.irAInicio}
            style={{ fontFamily: t.fh, fontSize: movil ? 20 : 25, fontWeight: 800, letterSpacing: '-0.03em', color: t.primary, cursor: acciones?.irAInicio ? 'pointer' : undefined }}
          >{p.marca}</span>
          {!movil && (acciones?.renderBuscador
            ? <span style={{ flex: 1, maxWidth: 460 }}>{acciones.renderBuscador({})}</span>
            : (
              <div style={{ flex: 1, maxWidth: 460, display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${t.border}`, borderRadius: t.radio, padding: '10px 16px', background: t.soft, fontSize: 13.5, color: t.muted }}>
                <span>⌕</span><span>Buscar por nombre, marca o código…</span>
              </div>
            ))}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            {movil && <MenuMovil t={t} links={p.links ?? []} acciones={acciones} />}
            <AccionesTienda t={t} movil={movil} acciones={acciones} />
          </span>
        </div>
        {!movil && (
          <div style={{ display: 'flex', gap: 26, padding: '11px 32px', background: t.surf, borderBottom: `1px solid ${t.border}`, fontSize: 13, color: t.text }}>
            {navDe(p.links ?? ['Escolar', 'Oficina', 'Arte', 'Libros', 'Regalería', 'Ofertas'], acciones).map((l) => (
              <span
                key={l.label} className="pl-nav" onClick={l.onClick}
                style={{ color: l.label === 'Ofertas' ? t.accent : t.text, fontWeight: l.label === 'Ofertas' ? 700 : 400, cursor: l.onClick ? 'pointer' : undefined }}
              >{l.label}</span>
            ))}
          </div>
        )}
      </>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}

        {/* Hero: el campo de búsqueda es el protagonista, no un adorno. */}
        <div style={{ background: t.soft, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1.15fr 1fr', gap: movil ? 24 : 40, padding: movil ? '30px 20px' : '54px 40px', alignItems: 'center' }}>
            <div>
              {s.kicker && <div style={{ display: 'inline-block', fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.primary, fontWeight: 800, background: t.surf, border: `1px solid ${t.border}`, borderRadius: 999, padding: '6px 14px', marginBottom: 18 }}>{s.kicker}</div>}
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 36 : 52, lineHeight: 1.05, margin: 0, fontWeight: 800, letterSpacing: '-0.035em' }}>{s.titulo}</h1>
              <p style={{ fontSize: 14.5, color: t.muted, margin: '14px 0 22px', lineHeight: 1.7, maxWidth: 420 }}>{s.bajada}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: t.surf, border: `2px solid ${t.primary}`, borderRadius: t.radio, padding: movil ? '10px 12px' : '13px 16px', boxShadow: t.sombra, maxWidth: 480 }}>
                <span style={{ fontSize: 17, color: t.primary }}>⌕</span>
                <span style={{ flex: 1, fontSize: movil ? 13 : 15, color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{txt('hero', 'placeholder')}</span>
                <Boton t={t} onClick={acciones?.irACatalogo}>{s.cta}</Boton>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                {txt('hero', 'atajos').split(',').map((c) => c.trim()).filter(Boolean).map((c) => (
                  <span key={c} style={{ fontSize: 12, color: t.muted, background: t.surf, border: `1px solid ${t.border}`, borderRadius: 999, padding: '6px 13px' }}>{c}</span>
                ))}
              </div>
            </div>
            {!movil && <Foto src={s.img} alto={330} radio={t.radio} />}
          </div>
        </div>

        <Reveal>
          <div style={{ padding: movil ? '26px 16px 6px' : '44px 40px 10px' }}>
            <Titulo t={t} volanta={txt('categorias', 'volanta')} texto={txt('categorias', 'titulo')} accion={txt('categorias', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'grid', gridTemplateColumns: colsDe(6, (p.categorias ?? []).length, 3), gap: 10 }}>
              {(p.categorias ?? []).slice(0, 6).map(([n, src, slug]) => (
                <div
                  key={n} className="pl-tile"
                  onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                  style={{ background: t.surf, border: `1px solid ${t.border}`, borderRadius: 999, padding: '6px 14px 6px 6px', display: 'flex', alignItems: 'center', gap: 10, cursor: slug && acciones ? 'pointer' : undefined }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                    <Foto src={src} alto={38} />
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Armador de lista escolar: es lo que realmente resuelve el problema
            de marzo, y ninguna otra plantilla lo tiene. */}
        <Reveal>
          <div style={{ padding: movil ? '24px 16px' : '34px 40px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1.4fr 1fr', gap: movil ? 18 : 28, background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, padding: movil ? 20 : 30, boxShadow: t.sombra }}>
              <div>
                <Titulo t={t} volanta={txt('lista', 'volanta')} texto={txt('lista', 'titulo')} movil={movil} />
                {/* Era un armador con tildes, total y "10% off llevando la
                    lista completa" que no sumaba ni agregaba nada: Órbita no
                    tiene listas ni combos. Ahora es lo que de verdad es --una
                    lista sugerida-- y el presupuesto se pide por WhatsApp. */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {lugares(5, 'lista', 'papeleria-lista').map((x) => (
                    <div
                      key={x.nombre} className="pl-fila"
                      onClick={x.ir}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${t.border}`, cursor: x.ir ? 'pointer' : undefined }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: t.primary }} />
                      <span style={{ fontSize: 13.5, flex: 1, color: t.text }}>{x.nombre}</span>
                      {/* El precio sale del producto: una categoría no tiene. */}
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{x.producto?.precio}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: t.soft, borderRadius: t.radio, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 12, color: t.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>{txt('lista', 'volantaCaja')}</div>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 26 : 32, fontWeight: 800, letterSpacing: '-0.03em', margin: '8px 0 10px', lineHeight: 1.15 }}>{txt('lista', 'tituloCaja')}</div>
                <div style={{ fontSize: 12.5, color: t.muted, marginBottom: 18 }}>{txt('lista', 'bajadaCaja')}</div>
                <Boton t={t} ancho onClick={acciones?.abrirWhatsapp}>{txt('lista', 'cta')}</Boton>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ padding: movil ? '10px 16px 30px' : '16px 40px 48px' }}>
            <Titulo t={t} volanta={txt('fila', 'volanta')} texto={txt('fila', 'titulo')} accion={txt('fila', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 12 : 18 }}>
              {fila(cuantos(4), 'papeleria-fila').map((x) => <Card key={x.nombre} p={x} t={t} alto={movil ? 150 : 210} onClick={abrir(x)} />)}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="pl-tile" style={{ position: 'relative', margin: movil ? '0 16px 28px' : '0 40px 48px', borderRadius: t.radio, overflow: 'hidden' }}>
            <Foto src={txt('campana', 'foto')} alto={movil ? 220 : 300} radio={t.radio} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg, rgba(29,78,216,0.94), rgba(29,78,216,0.35) 70%, transparent)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: movil ? 24 : 44, color: '#fff' }}>
              <div style={{ fontSize: 11.5, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800, marginBottom: 12 }}>{txt('campana', 'volanta')}</div>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 26 : 40, fontWeight: 800, letterSpacing: '-0.035em', maxWidth: 420, lineHeight: 1.1 }}>{txt('campana', 'titulo')}</div>
              <p style={{ fontSize: 14, margin: '12px 0 20px', maxWidth: 380, opacity: 0.9 }}>{txt('campana', 'texto')}</p>
              {/* Abre el WhatsApp del negocio. No se personaliza: el número
                  ya está en Configuración, y pedirlo de nuevo acá sería tener
                  el mismo dato en dos lados. Antes el botón no hacía nada. */}
              <div><span className="pl-cta" onClick={acciones?.abrirWhatsapp} style={{ display: 'inline-block', background: '#fff', color: t.primary, padding: '12px 24px', borderRadius: t.radio, fontSize: 13.5, fontWeight: 800, cursor: acciones?.abrirWhatsapp ? 'pointer' : undefined }}>{txt('campana', 'cta')}</span></div>
            </div>
          </div>
        </Reveal>

        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  // ── CORRALÓN ──────────────────────────────────────────────────────────────
  // Catálogo enorme y comprador apurado: la barra de departamentos vive
  // siempre a la vista, el hero informa (retiro, envío, cuenta corriente) en
  // vez de vender, y el producto se lista con su ficha técnica al lado.
  if (p.layout === 'corralon') {
    const s = p.slides[iActual]
    // Los departamentos de la barra son las CATEGORIAS del negocio: antes eran
    // doce rubros de ferreteria fijos, asi que una tienda de otro rubro
    // mostraba una navegacion que no existia en su catalogo.
    const deptos = (p.categorias ?? []).map(([n]) => n)

    const encabezado = (
      <>
        <div style={{ background: t.primary, color: t.accent, padding: '8px 16px', fontSize: 11.5, fontWeight: 700, display: 'flex', justifyContent: 'center', gap: movil ? 12 : 28, flexWrap: 'wrap', letterSpacing: '0.03em' }}>
          {txt('servicios', 'texto').split('\u00b7').map((x) => x.trim()).filter(Boolean).map((x, i) => (
            (!movil || i < 2) ? <span key={x}>{x}</span> : null
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: movil ? 12 : 22, padding: movil ? '12px 16px' : '15px 30px', borderBottom: `1px solid ${t.border}` }}>
          <span
            onClick={acciones?.irAInicio}
            style={{ fontFamily: t.fh, fontSize: movil ? 20 : 24, fontWeight: 900, letterSpacing: '-0.04em', textTransform: 'uppercase', cursor: acciones?.irAInicio ? 'pointer' : undefined }}
          >
            {p.marca}<span style={{ color: t.accent }}>.</span>
          </span>
          {!movil && (acciones?.renderBuscador
            ? <span style={{ flex: 1, maxWidth: 420 }}>{acciones.renderBuscador({})}</span>
            : (
              <div style={{ flex: 1, maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `2px solid ${t.primary}`, borderRadius: t.radio, padding: '9px 14px', fontSize: 13, color: t.muted }}>
                <span>Buscar producto o código</span><span style={{ background: t.accent, color: t.primary, borderRadius: 3, padding: '2px 8px', fontWeight: 800 }}>⌘</span>
              </div>
            ))}
          <span style={{ marginLeft: 'auto' }}><AccionesTienda t={t} movil={movil} acciones={acciones} /></span>
        </div>
        {/* Los doce departamentos, siempre visibles. */}
        <div style={{ background: t.primary, padding: movil ? '10px 12px' : '11px 30px', display: 'grid', gridTemplateColumns: cols(6, 3), gap: movil ? '7px 10px' : '8px 14px' }}>
          {navDe(deptos, acciones).map((d) => (
            <span
              key={d.label} className="pl-nav" onClick={d.onClick}
              style={{ fontSize: movil ? 10.5 : 12, fontWeight: 600, color: d.label === 'Ofertas' ? t.accent : '#E7E5E4', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: d.onClick ? 'pointer' : undefined }}
            >{d.label}</span>
          ))}
        </div>
      </>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}

        {/* Hero partido en tres: la promo grande y dos avisos operativos. */}
        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1.9fr 1fr', gap: 10, padding: movil ? 12 : 18 }}>
          <div className="pl-tile" style={{ position: 'relative', borderRadius: t.radio, overflow: 'hidden' }}>
            <Foto src={s.img} alto={movil ? 260 : 380} radio={t.radio} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(95deg, rgba(12,10,9,0.9), rgba(12,10,9,0.25) 72%)', padding: movil ? 22 : 38, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {s.kicker && <span style={{ alignSelf: 'flex-start', background: t.accent, color: t.primary, fontSize: 11, fontWeight: 900, padding: '5px 12px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>{s.kicker}</span>}
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 30 : 46, lineHeight: 1.05, margin: 0, color: '#fff', whiteSpace: 'pre-line', fontWeight: 900, letterSpacing: '-0.035em', textTransform: 'uppercase' }}>{s.titulo}</h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.86)', margin: '14px 0 20px', maxWidth: 360 }}>{s.bajada}</p>
              <div>
                <span
                  className="pl-cta"
                  onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}
                  style={{ display: 'inline-block', background: t.accent, color: t.primary, padding: '13px 26px', fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: s.link && acciones ? 'pointer' : undefined }}
                >{s.cta}</span>
              </div>
              {navHero({ marginTop: 20 })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateRows: movil ? undefined : '1fr 1fr', gridTemplateColumns: movil ? '1fr 1fr' : undefined, gap: 10 }}>
            {([
              [txt('avisos', 't1'), txt('avisos', 'b1'), t.accent],
              [txt('avisos', 't2'), txt('avisos', 'b2'), t.soft],
            ] as [string, string, string][]).filter(([tit]) => tit).map(([tit, cuerpo, fondo], i) => (
              <div key={tit} style={{ background: fondo, border: `1px solid ${t.border}`, borderRadius: t.radio, padding: movil ? 16 : 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 16 : 20, fontWeight: 900, letterSpacing: '-0.02em', textTransform: 'uppercase', marginBottom: 8 }}>{tit}</div>
                <div style={{ fontSize: 12.5, color: i === 0 ? 'rgba(12,10,9,0.75)' : t.muted, lineHeight: 1.55 }}>{cuerpo}</div>
              </div>
            ))}
          </div>
        </div>

        <Reveal>
          <div style={{ padding: movil ? '16px 12px' : '26px 18px' }}>
            <Titulo t={t} volanta={txt('categorias', 'volanta')} texto={txt('categorias', 'titulo')} accion={txt('categorias', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'grid', gridTemplateColumns: colsDe(4, (p.categorias ?? []).length, 2), gap: 10 }}>
              {(p.categorias ?? []).slice(0, 4).map(([n, src, slug]) => (
                <div
                  key={n} className="pl-tile"
                  onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                  style={{ position: 'relative', borderRadius: t.radio, overflow: 'hidden', border: `1px solid ${t.border}`, cursor: slug && acciones ? 'pointer' : undefined }}
                >
                  <Foto src={src} alto={movil ? 120 : 180} />
                  <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, background: 'rgba(12,10,9,0.86)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: movil ? 12 : 14, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{n}</span>
                    <span style={{ color: t.accent, fontWeight: 900 }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Calculadora de materiales. */}
        <Reveal>
          <div style={{ margin: movil ? '4px 12px 18px' : '10px 18px 28px', background: t.primary, borderRadius: t.radio, padding: movil ? 20 : 30, display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', gap: movil ? 18 : 34, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.accent, fontWeight: 800, marginBottom: 10 }}>{txt('calculo', 'volanta')}</div>
              <h2 style={{ fontFamily: t.fh, fontSize: movil ? 22 : 30, color: '#fff', margin: '0 0 10px', fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase' }}>{txt('calculo', 'titulo')}</h2>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', margin: 0, lineHeight: 1.6, maxWidth: 380 }}>{txt('calculo', 'texto')}</p>
            </div>
            {/* Era una calculadora que no calculaba: 84 m², 2 manos y "2 latas
                de 20 L" dibujados. Ahora es lo que Órbita sí puede: pedir el
                calculo por WhatsApp, con el detalle que el dueno explique. */}
            <div style={{ background: '#fff', borderRadius: t.radio, padding: movil ? 16 : 22 }}>
              <div style={{ fontSize: 12, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{txt('calculo', 'volantaCaja')}</div>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 23, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 14 }}>{txt('calculo', 'tituloCaja')}</div>
              <div style={{ borderTop: `1px dashed ${t.border}`, paddingTop: 14 }}>
                <Boton t={t} ancho onClick={acciones?.abrirWhatsapp}>{txt('calculo', 'cta')}</Boton>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Productos en lista, con la ficha técnica al lado — no en grilla. */}
        <Reveal>
          <div style={{ padding: movil ? '0 12px 24px' : '0 18px 44px' }}>
            <Titulo t={t} volanta={txt('fila', 'volanta')} texto={txt('fila', 'titulo')} accion={txt('fila', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {p.productos.map((x) => (
                <div key={x.nombre} className="pl-card" data-link={abrir(x) ? '1' : undefined} onClick={abrir(x)} style={{ display: 'grid', gridTemplateColumns: movil ? '96px 1fr' : '150px 1fr auto', gap: movil ? 14 : 22, alignItems: 'center', border: `1px solid ${t.border}`, borderRadius: t.radio, padding: movil ? 10 : 14, background: t.surf }}>
                  <div style={{ borderRadius: t.radio, overflow: 'hidden' }}><Foto src={x.img} src2={x.img2} alto={movil ? 96 : 120} /></div>
                  <div style={{ minWidth: 0 }}>
                    {x.badge && <span style={{ display: 'inline-block', background: t.accent, color: t.primary, fontSize: 10, fontWeight: 900, padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>{x.badge}</span>}
                    <div style={{ fontSize: movil ? 14 : 16, fontWeight: 800, letterSpacing: '-0.015em' }}>{x.nombre}</div>
                    <div style={{ fontSize: 12, color: t.muted, marginTop: 5, fontFamily: 'ui-monospace, monospace' }}>{x.tag}</div>
                    {x.estrellas && <div style={{ marginTop: 7 }}><Estrellas n={x.estrellas} resenas={x.resenas} color={t.text} /></div>}
                    {movil && <div style={{ fontSize: 18, fontWeight: 900, marginTop: 8 }}>{x.precio}</div>}
                    {movil && x.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.transfer}</div>}
                  </div>
                  {!movil && (
                    <div style={{ textAlign: 'right', paddingRight: 8 }}>
                      {x.antes && <div style={{ fontSize: 12.5, color: t.muted, textDecoration: 'line-through' }}>{x.antes}</div>}
                      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>{x.precio}</div>
                      {x.transfer && <div style={{ fontSize: 11.5, color: t.muted, margin: '2px 0 10px' }}>{x.transfer}</div>}
                      <Boton t={t} onClick={abrir(x)}>{acciones ? 'Ver producto' : 'Agregar al carrito'}</Boton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div style={{ background: t.soft, borderTop: `1px solid ${t.border}`, padding: movil ? '22px 16px' : '34px 30px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 18 }}>
            {([
              [txt('numeros', 'n1v'), txt('numeros', 'n1l')],
              [txt('numeros', 'n2v'), txt('numeros', 'n2l')],
              [txt('numeros', 'n3v'), txt('numeros', 'n3l')],
              [txt('numeros', 'n4v'), txt('numeros', 'n4l')],
            ] as [string, string][]).filter(([n]) => n).map(([n, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 24 : 32, fontWeight: 900, letterSpacing: '-0.03em' }}>{n}</div>
                <div style={{ fontSize: 11.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  // ── ATLETA ────────────────────────────────────────────────────────────────
  // La más agresiva: negro, lima y condensada en mayúsculas. El catálogo no se
  // muestra en grilla sino en tiras por disciplina que se arrastran, porque el
  // que entra ya sabe si corre, levanta o pedalea.
  if (p.layout === 'atleta') {
    const s = p.slides[iActual]
    // Las tiras son las primeras tres CATEGORÍAS del negocio, con productos
    // suyos adentro. Antes eran Running/Fuerza/Ciclismo con nueve fotos del
    // repo y un conteo inventado ("18 artículos"), así que una tienda de ropa
    // con Atleta aplicada mostraba disciplinas que no vende.
    // Cada tira lleva los productos DE ESA categoría. Antes era
    // `p.productos.slice(i, i + 3)`: una ventana corrediza sobre los
    // destacados, que repetía los mismos productos bajo los tres títulos.
    const disciplinas: [string, string | undefined, typeof p.productos][] =
      porCategoria(3, 3).map((c) => [c.nombre, c.slug, c.productos])
    const encabezado = (
      <>
        {txt('cintillo', 'texto') && <Marquee t={t} texto={txt('cintillo', 'texto')} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: movil ? '13px 16px' : '16px 34px', borderBottom: `1px solid ${t.border}` }}>
          <span
            onClick={acciones?.irAInicio}
            style={{ fontFamily: t.fh, fontSize: movil ? 21 : 26, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', color: t.primary, cursor: acciones?.irAInicio ? 'pointer' : undefined }}
          >{p.marca}</span>
          {movil ? <MenuMovil t={t} links={p.links ?? []} acciones={acciones} /> : (
            <div style={{ display: 'flex', gap: 22, fontSize: 13, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: t.fh }}>
              {navDe(p.links ?? ['Running', 'Fuerza', 'Ciclismo', 'Indumentaria', 'Outlet'], acciones).map((l) => (
                <span
                  key={l.label} className="pl-nav" onClick={l.onClick}
                  style={{ color: l.label === 'Outlet' ? t.accent : t.text, cursor: l.onClick ? 'pointer' : undefined }}
                >{l.label}</span>
              ))}
            </div>
          )}
          <span style={{ marginLeft: 'auto' }}><AccionesTienda t={t} movil={movil} acciones={acciones} /></span>
        </div>
      </>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}

        {/* Hero a sangre: la foto ocupa todo y el titular se come el ancho. */}
        <div className="pl-tile" style={{ position: 'relative' }}>
          <Foto src={s.img} alto={movil ? 460 : 620} />
          <div style={{ position: 'absolute', inset: 0, background: movil ? 'linear-gradient(to top, rgba(10,10,10,0.95) 40%, rgba(10,10,10,0.4))' : 'linear-gradient(85deg, rgba(10,10,10,0.9) 30%, rgba(10,10,10,0.25) 70%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: movil ? '0 20px 34px' : '0 44px 56px' }}>
            {s.kicker && <div style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: t.primary, fontWeight: 600, marginBottom: 14 }}>{s.kicker}</div>}
            <h1 style={{ fontFamily: t.fh, fontSize: movil ? 50 : 104, lineHeight: movil ? 1.02 : 0.9, margin: 0, whiteSpace: 'pre-line', fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase', color: '#fff' }}>{s.titulo}</h1>
            <p style={{ fontSize: 14.5, color: 'rgba(250,250,250,0.72)', margin: '20px 0 26px', maxWidth: 420, lineHeight: 1.65 }}>{s.bajada}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span
                className="pl-cta"
                onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}
                style={{ background: t.primary, color: t.onPrimary, padding: '14px 30px', fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: t.fh, cursor: s.link && acciones ? 'pointer' : undefined }}
              >{s.cta}</span>
              <span
                className="pl-cta" onClick={acciones?.abrirWhatsapp}
                style={{ border: '1px solid rgba(250,250,250,0.4)', color: '#fff', padding: '14px 26px', fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: t.fh, cursor: acciones ? 'pointer' : undefined }}
              >{txt('hero', 'cta2')}</span>
            </div>
            {navHero({ marginTop: 26 })}
          </div>
        </div>

        {/* Tiras por disciplina, no grilla. */}
        {disciplinas.map(([nombre, slug, items], di) => (
          <Reveal key={nombre} delay={di * 60}>
            <div style={{ padding: movil ? '24px 0 6px 16px' : '40px 0 10px 34px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, paddingRight: movil ? 16 : 34, marginBottom: 14 }}>
                <h2 style={{ fontFamily: t.fh, fontSize: movil ? 26 : 36, margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{nombre}</h2>
                {/* Antes decía "18 artículos" — un número inventado que no
                    salía de contar nada. Órbita no pasa el total por categoría
                    hasta acá, así que no se promete. */}
                {!movil && (
                  <span
                    onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                    style={{ marginLeft: 'auto', fontSize: 12, color: t.primary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: slug && acciones ? 'pointer' : undefined }}
                  >Ver todo →</span>
                )}
              </div>
              <Tira gap={10}>
                {items.map((x, i) => (
                  <div
                    key={x.nombre + i} className="pl-tile" onClick={abrir(x)}
                    style={{ flex: `0 0 ${movil ? '75%' : '32%'}`, scrollSnapAlign: 'start', position: 'relative', cursor: abrir(x) ? 'pointer' : undefined }}
                  >
                    <Foto src={x.img} src2={x.img2} alto={movil ? 200 : 280} radio={t.radio} />
                    <span style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(10,10,10,0.82)', color: t.primary, fontSize: 10.5, fontWeight: 700, padding: '5px 11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: t.fh }}>{x.nombre}</span>
                  </div>
                ))}
              </Tira>
            </div>
          </Reveal>
        ))}

        <Reveal>
          <div style={{ padding: movil ? '20px 16px 28px' : '34px 34px 48px' }}>
            <Titulo t={t} volanta={txt('fila', 'volanta')} texto={txt('fila', 'titulo')} accion={txt('fila', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 10 : 14 }}>
              {fila(cuantos(4), 'atleta-fila').map((x) => (
                <div key={x.nombre} className="pl-card" data-link={abrir(x) ? '1' : undefined} onClick={abrir(x)} style={{ background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
                  <div style={{ position: 'relative' }}>
                    <Foto src={x.img} src2={x.img2} alto={movil ? 150 : 220} />
                    {x.badge && <span style={{ position: 'absolute', top: 10, left: 10, background: t.primary, color: t.onPrimary, fontSize: 10, fontWeight: 700, padding: '4px 10px', textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: t.fh }}>{x.badge}</span>}
                    {x.stock && <span style={{ position: 'absolute', bottom: 10, right: 10, background: t.accent, color: '#0A0A0A', fontSize: 10, fontWeight: 800, padding: '4px 9px' }}>{x.stock}</span>}
                  </div>
                  <div style={{ padding: movil ? 12 : 15 }}>
                    <div style={{ fontFamily: t.fh, fontSize: movil ? 14 : 16.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.01em', lineHeight: 1.2 }}>{x.nombre}</div>
                    <div style={{ fontSize: 11, color: t.muted, marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>{x.tag}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
                      <span style={{ fontSize: movil ? 16 : 19, fontWeight: 800, color: t.primary, fontFamily: t.fh }}>{x.precio}</span>
                      {x.antes && <span style={{ fontSize: 12, color: t.muted, textDecoration: 'line-through' }}>{x.antes}</span>}
                    </div>
                    {x.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.transfer}</div>}
                    {x.colores && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        {x.colores.map((c) => <span key={c} className="pl-swatch" style={{ width: 13, height: 13, borderRadius: 2, background: c, border: `1px solid ${t.border}` }} />)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Números de la comunidad. */}
        <div style={{ background: t.primary, color: t.onPrimary, padding: movil ? '26px 16px' : '40px 34px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 20 }}>
            {([
              [txt('numeros', 'n1v'), txt('numeros', 'n1l')],
              [txt('numeros', 'n2v'), txt('numeros', 'n2l')],
              [txt('numeros', 'n3v'), txt('numeros', 'n3l')],
              [txt('numeros', 'n4v'), txt('numeros', 'n4l')],
            ] as [string, string][]).filter(([n]) => n).map(([n, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 28 : 42, fontWeight: 700, letterSpacing: '-0.02em' }}>{n}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 600, marginTop: 6, opacity: 0.75 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  // ── PATITAS ───────────────────────────────────────────────────────────────
  // La compra arranca por la mascota, no por la categoría: tres círculos
  // grandes reemplazan al menú: se compra pensando en el animal, no en la
  // categoría.
  if (p.layout === 'patitas') {
    const s = p.slides[iActual]

    const encabezado = (
      <>
        {!!txt('cintillo', 'texto') && (
          <div style={{ background: t.soft, padding: '9px 0', fontSize: 12, fontWeight: 700, color: t.primary, overflow: 'hidden' }}>
            {activo('cintillo', 'cartelera') ? (
              <div className="pl-marquee-track">
                {[0, 1].map((k) => <span key={k}>{`${txt('cintillo', 'texto')}   `.repeat(6)}</span>)}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '0 12px' }}>{txt('cintillo', 'texto')}</div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: movil ? '13px 16px' : '16px 32px', background: t.surf, borderBottom: `1px solid ${t.border}` }}>
          <span
            onClick={acciones?.irAInicio}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 9, cursor: acciones?.irAInicio ? 'pointer' : undefined }}
          >
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: t.primary, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 17 }}>🐾</span>
            <span style={{ fontFamily: t.fh, fontSize: movil ? 21 : 26, fontWeight: 800, letterSpacing: '-0.02em', color: t.text }}>{p.marca}</span>
          </span>
          {movil ? <MenuMovil t={t} links={p.links ?? []} acciones={acciones} /> : (
            <div style={{ display: 'flex', gap: 22, fontSize: 13.5, fontWeight: 600, color: t.muted }}>
              {navDe(p.links ?? ['Perros', 'Gatos', 'Alimento', 'Juguetes', 'Farmacia'], acciones).map((l) => <span key={l.label} className="pl-nav" onClick={l.onClick} style={{ cursor: l.onClick ? 'pointer' : undefined }}>{l.label}</span>)}
            </div>
          )}
          <span style={{ marginLeft: 'auto' }}><AccionesTienda t={t} movil={movil} acciones={acciones} /></span>
        </div>
      </>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}

        <div style={{ background: `linear-gradient(160deg, ${t.soft} 0%, ${t.bg} 60%)` }}>
          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', gap: movil ? 22 : 36, padding: movil ? '28px 20px' : '52px 40px', alignItems: 'center' }}>
            <div style={{ order: movil ? 2 : 1 }}>
              {s.kicker && <div style={{ display: 'inline-block', background: t.accent, color: '#fff', fontSize: 11.5, fontWeight: 800, padding: '6px 14px', borderRadius: 999, marginBottom: 16 }}>{s.kicker}</div>}
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 36 : 52, lineHeight: 1.08, margin: 0, whiteSpace: 'pre-line', fontWeight: 800, letterSpacing: '-0.03em' }}>{s.titulo}</h1>
              <p style={{ fontSize: 15, color: t.muted, margin: '16px 0 24px', lineHeight: 1.7, maxWidth: 400 }}>{s.bajada}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Boton t={t} grande onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}>{s.cta}</Boton>
                <Boton t={t} secundario grande onClick={acciones?.abrirWhatsapp}>{txt('hero', 'cta2')}</Boton>
              </div>
              {navHero({ marginTop: 20 })}
            </div>
            <div style={{ order: movil ? 1 : 2, borderRadius: 32, overflow: 'hidden', boxShadow: t.sombra }}>
              <Foto src={s.img} alto={movil ? 260 : 400} radio={32} />
            </div>
          </div>
        </div>

        {/* El selector que reemplaza al menú de categorías. */}
        <Reveal>
          <div style={{ padding: movil ? '26px 16px' : '46px 40px' }}>
            <Titulo t={t} centrado volanta={txt('selector', 'volanta')} texto={txt('selector', 'titulo')} movil={movil} />
            {/* Los tres círculos son categorías REALES del negocio. Antes eran
                Perro/Gato/Otros con "412 productos" inventados: una veterinaria
                que vende otra cosa mostraba mascotas que no atiende, y el
                conteo no salía de contar nada. */}
            <div style={{ display: 'grid', gridTemplateColumns: colsDe(3, (p.categorias ?? []).length, 3), gap: movil ? 12 : 26, maxWidth: 720, margin: '0 auto' }}>
              {(p.categorias ?? []).slice(0, 3).map(([n, src, slug]) => (
                <div
                  key={n} className="pl-card"
                  onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                  style={{ textAlign: 'center', cursor: slug && acciones ? 'pointer' : undefined }}
                >
                  <div className="pl-tile" style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', border: `4px solid ${t.surf}`, boxShadow: t.sombra }}>
                    <Foto src={src} alto="100%" />
                  </div>
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 16 : 21, fontWeight: 800, marginTop: 14 }}>{n}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ padding: movil ? '4px 16px 26px' : '10px 40px 44px' }}>
            <Titulo t={t} volanta={txt('fila', 'volanta')} texto={txt('fila', 'titulo')} accion={txt('fila', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 12 : 18 }}>
              {fila(cuantos(4), 'patitas-fila').map((x) => <Card key={x.nombre} p={x} t={t} alto={movil ? 145 : 200} onClick={abrir(x)} />)}
            </div>
          </div>
        </Reveal>

        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  // ── BODEGA ────────────────────────────────────────────────────────────────
  // Borgoña, serif y carta de restaurante: el corazón es una LISTA de
  // varietales sin una sola foto, que es como se elige un vino. Las botellas
  // van altas y angostas sobre tarjetas crema, para que recorten del fondo.
  if (p.layout === 'bodega') {
    const s = p.slides[iActual]
    // La carta son las CATEGORÍAS del negocio. La bajada y el "desde" de cada
    // fila los escribe el dueño (sección "La carta"): son datos que Órbita no
    // tiene por categoría, y antes estaban inventados —Malbec de Valle de Uco,
    // "34 etiquetas"— en una vinoteca que podía vender otra cosa.
    const varietales = (p.categorias ?? []).slice(0, 5).map(([nombre, , slug], i) => ({
      nombre, slug,
      bajada: txt('carta', `b${i + 1}`),
      desde: txt('carta', `d${i + 1}`),
    }))

    const encabezado = (
      <>
        {!!txt('cintillo', 'texto') && (
          <div style={{ textAlign: 'center', padding: '9px 12px', fontSize: 10.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: t.primary, borderBottom: `1px solid ${t.border}` }}>
            {txt('cintillo', 'texto')}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: movil ? 'auto 1fr auto' : '1fr auto 1fr', alignItems: 'center', padding: movil ? '15px 16px' : '24px 44px', borderBottom: `1px solid ${t.border}`, gap: 14 }}>
          {movil
            ? <MenuMovil t={t} links={p.links ?? []} acciones={acciones} color={t.primary} />
            : acciones?.renderBuscador
              ? <span style={{ justifySelf: 'start' }}>{acciones.renderBuscador({})}</span>
              : <span style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.muted }}>⌕ Buscar etiqueta</span>}
          <div style={{ textAlign: 'center' }}>
            <div
              onClick={acciones?.irAInicio}
              style={{ fontFamily: t.fh, fontSize: movil ? 26 : 38, fontWeight: 400, letterSpacing: '0.24em', textTransform: 'uppercase', color: t.primary, cursor: acciones?.irAInicio ? 'pointer' : undefined }}
            >{p.marca}</div>
            {!movil && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 26, marginTop: 10, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.muted }}>
                {navDe(p.links ?? ['Tintos', 'Blancos', 'Espumantes', 'Cajas', 'Bodegas'], acciones).map((l) => <span key={l.label} className="pl-nav" onClick={l.onClick} style={{ cursor: l.onClick ? 'pointer' : undefined }}>{l.label}</span>)}
              </div>
            )}
          </div>
          <span style={{ justifySelf: 'end' }}><AccionesTienda t={t} movil={movil} acciones={acciones} /></span>
        </div>
      </>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}

        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', alignItems: 'stretch' }}>
          <div style={{ padding: movil ? '32px 22px' : '70px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'center', order: movil ? 2 : 1 }}>
            <div style={{ width: 44, height: 1, background: t.primary, marginBottom: 20 }} />
            {s.kicker && <div style={{ fontSize: 10.5, letterSpacing: '0.28em', textTransform: 'uppercase', color: t.primary, marginBottom: 18 }}>{s.kicker}</div>}
            <h1 style={{ fontFamily: t.fh, fontSize: movil ? 40 : 62, lineHeight: 1.02, margin: 0, whiteSpace: 'pre-line', fontWeight: 400, letterSpacing: '-0.015em' }}>{s.titulo}</h1>
            <p style={{ fontSize: 14.5, color: t.muted, margin: '24px 0 30px', lineHeight: 1.9, maxWidth: 400 }}>{s.bajada}</p>
            <span
              onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}
              style={{ fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, color: t.primary, borderBottom: `1px solid ${t.primary}`, paddingBottom: 6, alignSelf: 'flex-start', cursor: s.link && acciones ? 'pointer' : undefined }}
            >{s.cta}</span>
            {navHero({ marginTop: 28 })}
          </div>
          <div style={{ order: movil ? 1 : 2 }}><Foto src={s.img} alto={movil ? 300 : 560} /></div>
        </div>

        {/* La carta de varietales: puro texto, sin una sola foto. */}
        <Reveal>
          <div style={{ padding: movil ? '32px 22px' : '64px 52px', borderTop: `1px solid ${t.border}` }}>
            <Titulo t={t} volanta={txt('carta', 'volanta')} texto={txt('carta', 'titulo')} accion={txt('carta', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div>
              {varietales.map((v) => (
                <div
                  key={v.nombre} className="pl-fila"
                  onClick={v.slug && acciones ? () => acciones.irACategoria(v.slug!) : undefined}
                  style={{ display: 'grid', gridTemplateColumns: movil ? '1fr auto' : '1.1fr 1.4fr auto', gap: movil ? 6 : 24, alignItems: 'baseline', padding: movil ? '16px 0' : '20px 0', borderBottom: `1px solid ${t.border}`, cursor: v.slug && acciones ? 'pointer' : undefined }}
                >
                  <span style={{ fontFamily: t.fh, fontSize: movil ? 22 : 30, fontWeight: 400 }}>{v.nombre}</span>
                  {!movil && <span style={{ fontSize: 13, color: t.muted, letterSpacing: '0.03em' }}>{v.bajada}</span>}
                  <span style={{ fontSize: movil ? 13 : 14.5, color: t.primary, justifySelf: 'end', whiteSpace: 'nowrap' }}>{v.desde}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Botellas: altas y angostas, sobre crema para que recorten. */}
        <Reveal>
          <div style={{ padding: movil ? '10px 22px 34px' : '20px 52px 60px' }}>
            <Titulo t={t} volanta={txt('seleccion', 'volanta')} texto={txt('seleccion', 'titulo')} movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(3, 1), gap: movil ? 18 : 26 }}>
              {fila(cuantos(3, 1), 'bodega-seleccion').map((x) => (
                <div key={x.nombre} className="pl-card" data-link={abrir(x) ? '1' : undefined} onClick={abrir(x)} style={{ background: '#F3EADF', padding: movil ? 18 : 24, textAlign: 'center', color: '#2A1A14' }}>
                  <div style={{ margin: '0 auto', maxWidth: movil ? 200 : 230 }}>
                    <Foto src={x.img} src2={x.img2} alto={movil ? 300 : 380} />
                  </div>
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 21 : 25, marginTop: 18 }}>{x.nombre}</div>
                  <div style={{ fontSize: 11.5, color: '#7A6355', marginTop: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{x.tag}</div>
                  {x.estrellas && <div style={{ marginTop: 10, color: '#7A6355' }}><Estrellas n={x.estrellas} resenas={x.resenas} color={t.accent} /></div>}
                  <div style={{ fontSize: 19, marginTop: 10, fontWeight: 700 }}>{x.precio}</div>
                  {x.transfer && <div style={{ fontSize: 11.5, color: '#7A6355', marginTop: 3 }}>{x.transfer}</div>}
                  <div style={{ marginTop: 14 }}>
                    <span style={{ display: 'inline-block', border: '1px solid #2A1A14', padding: '10px 22px', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>Agregar</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '28px 22px' : '46px 52px' }}>
            <Titulo t={t} centrado volanta={txt('maridajes', 'volanta')} texto={txt('maridajes', 'titulo')} movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(3, 1), gap: movil ? 16 : 24 }}>
              {([
                [txt('maridajes', 't1'), txt('maridajes', 'b1')],
                [txt('maridajes', 't2'), txt('maridajes', 'b2')],
                [txt('maridajes', 't3'), txt('maridajes', 'b3')],
              ] as [string, string][]).filter(([tit]) => tit).map(([tit, cuerpo]) => (
                <div key={tit} style={{ background: t.soft, padding: movil ? 20 : 26 }}>
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 20 : 24, color: t.primary, marginBottom: 10 }}>{tit}</div>
                  <div style={{ fontSize: 13.5, color: t.muted, lineHeight: 1.8 }}>{cuerpo}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  // ── CRECER ────────────────────────────────────────────────────────────────
  // Acá no se navega por categoría sino por EDAD: es como compra el que
  // regala ("tiene ocho meses"). La línea de tiempo horizontal reemplaza al
  // menú, y hay un armador de lista de regalos para baby shower.
  if (p.layout === 'crecer') {
    const s = p.slides[iActual]
    // La línea de tiempo son las CATEGORÍAS del negocio: antes eran cuatro
    // tramos de edad fijos con fotos del repo, así que una tienda que agrupa
    // de otra forma mostraba una navegación que no existía en su catálogo.
    const edades = (p.categorias ?? []).slice(0, 4)

    const encabezado = (
      <>
        {!!txt('cintillo', 'texto') && (
          <div style={{ background: t.soft, textAlign: 'center', padding: '9px 12px', fontSize: 12, color: t.text, fontWeight: 600 }}>
            {txt('cintillo', 'texto')}
          </div>
        )}
        <div style={{ textAlign: 'center', padding: movil ? '15px 16px' : '20px 34px 16px', background: t.surf, borderBottom: `1px solid ${t.border}`, position: 'relative' }}>
          <div
            onClick={acciones?.irAInicio}
            style={{ fontFamily: t.fh, fontSize: movil ? 25 : 32, fontWeight: 700, letterSpacing: '0.04em', color: t.primary, cursor: acciones?.irAInicio ? 'pointer' : undefined }}
          >{p.marca}</div>
          {!movil && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 26, marginTop: 12, fontSize: 13.5, color: t.muted, fontWeight: 600 }}>
              {navDe(p.links ?? ['Ropa', 'Juguetes', 'Habitación', 'Paseo', 'Regalos'], acciones).map((l) => <span key={l.label} className="pl-nav" onClick={l.onClick} style={{ cursor: l.onClick ? 'pointer' : undefined }}>{l.label}</span>)}
            </div>
          )}
          {movil && <span style={{ position: 'absolute', left: 16, top: 16 }}><MenuMovil t={t} links={p.links ?? []} acciones={acciones} /></span>}
          <span style={{ position: 'absolute', right: movil ? 16 : 34, top: movil ? 14 : 22 }}><AccionesTienda t={t} movil={movil} acciones={acciones} /></span>
        </div>
      </>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}

        <div style={{ background: `linear-gradient(150deg, ${t.soft} 0%, ${t.bg} 55%)`, padding: movil ? '30px 20px' : '56px 44px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', gap: movil ? 24 : 40, alignItems: 'center' }}>
            <div style={{ order: movil ? 2 : 1 }}>
              {s.kicker && <div style={{ display: 'inline-block', background: t.accent, color: '#5C3A2C', fontSize: 11.5, fontWeight: 700, padding: '6px 15px', borderRadius: 999, marginBottom: 18 }}>{s.kicker}</div>}
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 36 : 52, lineHeight: 1.1, margin: 0, whiteSpace: 'pre-line', fontWeight: 700, letterSpacing: '-0.02em' }}>{s.titulo}</h1>
              <p style={{ fontSize: 15, color: t.muted, margin: '18px 0 26px', lineHeight: 1.8, maxWidth: 400 }}>{s.bajada}</p>
              <Boton t={t} grande onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}>{s.cta}</Boton>
              {navHero({ marginTop: 20 })}
            </div>
            <div style={{ order: movil ? 1 : 2, borderRadius: movil ? 28 : 40, overflow: 'hidden', boxShadow: t.sombra }}>
              <Foto src={s.img} alto={movil ? 270 : 420} radio={movil ? 28 : 40} />
            </div>
          </div>
        </div>

        {/* La línea de tiempo por edad, que reemplaza al menú de categorías. */}
        <Reveal>
          <div style={{ padding: movil ? '30px 16px' : '52px 44px' }}>
            <Titulo t={t} centrado volanta={txt('edades', 'volanta')} texto={txt('edades', 'titulo')} movil={movil} />
            <div style={{ position: 'relative', marginTop: 26 }}>
              <div style={{ position: 'absolute', left: '12%', right: '12%', top: movil ? 40 : 56, height: 2, background: t.border }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: movil ? 8 : 20, position: 'relative' }}>
                {edades.map(([n, src, slug], i) => (
                  <div
                    key={n} className="pl-card"
                    onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                    style={{ textAlign: 'center', cursor: slug && acciones ? 'pointer' : undefined }}
                  >
                    <div className="pl-tile" style={{ width: movil ? 72 : 108, height: movil ? 72 : 108, borderRadius: '50%', overflow: 'hidden', margin: '0 auto', border: `3px solid ${t.surf}`, boxShadow: t.sombra }}>
                      <Foto src={src} alto="100%" />
                    </div>
                    <div style={{ width: 11, height: 11, borderRadius: '50%', background: i === 1 ? t.primary : t.border, margin: '12px auto 10px', border: `2px solid ${t.bg}` }} />
                    <div style={{ fontSize: movil ? 12.5 : 15, fontWeight: 700, color: i === 1 ? t.primary : t.text }}>{n}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ padding: movil ? '4px 16px 28px' : '6px 44px 48px' }}>
            <Titulo t={t} volanta={txt('fila', 'volanta')} texto={txt('fila', 'titulo')} accion={txt('fila', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 12 : 18 }}>
              {fila(cuantos(4), 'crecer-fila').map((x) => <Card key={x.nombre} p={x} t={t} alto={movil ? 150 : 210} onClick={abrir(x)} />)}
            </div>
          </div>
        </Reveal>

        <div style={{ padding: movil ? '24px 16px' : '38px 44px', borderTop: `1px solid ${t.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 20 }}>
            {([
              [txt('certificaciones', 't1'), txt('certificaciones', 'b1')],
              [txt('certificaciones', 't2'), txt('certificaciones', 'b2')],
              [txt('certificaciones', 't3'), txt('certificaciones', 'b3')],
              [txt('certificaciones', 't4'), txt('certificaciones', 'b4')],
            ] as [string, string][]).filter(([a]) => a).map(([a, b]) => (
              <div key={a} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 15 : 18, fontWeight: 700, color: t.primary }}>{a}</div>
                <div style={{ fontSize: 12.5, color: t.muted, marginTop: 4 }}>{b}</div>
              </div>
            ))}
          </div>
        </div>

        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  // ── CIRCUITO ──────────────────────────────────────────────────────────────
  // Tech: la única con el header como PANEL LATERAL fijo — marca, nav vertical
  // y acciones de tienda a la izquierda, todo lo demás scrollea a la derecha.
  // El producto se muestra en fichas partidas (foto a un lado, specs al otro),
  // no en tarjeta, porque acá lo que decide la compra es la ficha técnica.
  if (p.layout === 'circuito') {
    const s = p.slides[iActual]
    const links = p.links ?? []
    const categorias = p.categorias ?? []

    // En celular el panel no puede quedar fijo al costado: pasa a ser una
    // barra común arriba, con el mismo contenido en una línea.
    const panel = movil ? (
      <div style={{ background: t.surf, borderBottom: `1px solid ${t.border}`, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <MenuMovil t={t} links={links} acciones={acciones} />
        <span
          onClick={acciones?.irAInicio}
          style={{ fontFamily: t.fh, fontSize: 19, fontWeight: 700, color: t.text, letterSpacing: '-0.02em', cursor: acciones?.irAInicio ? 'pointer' : undefined }}
        >{p.marca}</span>
        <span style={{ marginLeft: 'auto' }}><AccionesTienda t={t} movil acciones={acciones} /></span>
      </div>
    ) : (
      <div style={{ width: 232, flexShrink: 0, borderRight: `1px solid ${t.border}`, background: t.surf, padding: '30px 26px', position: 'sticky', top: 0, alignSelf: 'flex-start' }}>
        <div
          onClick={acciones?.irAInicio}
          style={{ fontFamily: t.fh, fontSize: 25, fontWeight: 700, color: t.text, letterSpacing: '-0.03em', cursor: acciones?.irAInicio ? 'pointer' : undefined }}
        >{p.marca}</div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 7, lineHeight: 1.5 }}>{p.tagline}</div>
        <div style={{ margin: '26px 0 22px', height: 1, background: t.border }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {navDe(links, acciones).map((l, i) => (
            <span
              key={l.label} className="pl-nav" onClick={l.onClick}
              style={{ fontSize: 13.5, color: i === 0 ? t.primary : t.text, fontWeight: i === 0 ? 700 : 500, cursor: l.onClick ? 'pointer' : undefined }}
            >{l.label}</span>
          ))}
        </div>
        <div style={{ margin: '24px 0 18px', height: 1, background: t.border }} />
        {acciones?.renderBuscador
          ? acciones.renderBuscador({})
          : <div style={{ border: `1px solid ${t.border}`, borderRadius: t.radio, padding: '9px 13px', fontSize: 12.5, color: t.muted, background: t.soft }}>Buscar…</div>}
        <div style={{ marginTop: 20 }}><AccionesTienda t={t} acciones={acciones} /></div>
      </div>
    )

    // El cartel va arriba de todo y el panel al costado. En `soloHeader` se
    // devuelven los dos y `StorefrontChrome` arma la fila con el contenido de
    // la pagina a la derecha --es la unica plantilla cuyo header no es una
    // franja sino una columna.
    if (soloHeader) {
      return (
        <div style={marco}>
          {txt('cintillo', 'texto') && <Marquee t={t} texto={txt('cintillo', 'texto')} />}
          {panel}
        </div>
      )
    }

    return (
      <div style={marco}>
        {txt('cintillo', 'texto') && <Marquee t={t} texto={txt('cintillo', 'texto')} />}
        {/* En celular el panel deja de ser una columna al costado y pasa a
            ser una barra arriba: en fila los dos hijos no entran en 390 px y
            el marco se llenaba de scroll horizontal. */}
        <div style={{ display: 'flex', flexDirection: movil ? 'column' : 'row', alignItems: movil ? 'stretch' : 'flex-start' }}>
          {panel}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Hero a sangre: la promo grande sobre la foto, sin carrusel. Con
                una sola campaña arriba el ojo va derecho a la ficha técnica. */}
            <div style={{ position: 'relative' }}>
              <Foto src={s.img} alto={movil ? 330 : 430} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: movil ? '0 20px 26px' : '0 44px 42px', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 12%, rgba(0,0,0,0.5) 52%, transparent 86%)' }}>
                {s.kicker && <div style={{ fontSize: movil ? 10.5 : 12, letterSpacing: '0.26em', textTransform: 'uppercase', color: t.primary, fontWeight: 700, marginBottom: 10 }}>{s.kicker}</div>}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: movil ? 12 : 20, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: t.fh, fontSize: movil ? 58 : 96, lineHeight: 0.86, fontWeight: 700, color: '#fff', letterSpacing: '-0.05em' }}>{s.titulo}</span>
                  <span style={{ fontSize: movil ? 15 : 21, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{s.bajada}</span>
                </div>
                <div style={{ marginTop: movil ? 18 : 24 }}>
                  <Boton t={t} grande={!movil} onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}>{s.cta}</Boton>
                </div>
                {navHero({ marginTop: 18 })}
              </div>
            </div>

            {/* Los datos de la compra en una línea de monoespaciada: en tech el
                argumento son las cuotas y la garantía, no un adjetivo. */}
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), borderBottom: `1px solid ${t.border}`, background: t.soft }}>
              {(p.confianza ?? []).map(([a, b], i) => (
                <div key={a} style={{ padding: movil ? '13px 12px' : '16px 20px', borderLeft: i && !movil ? `1px solid ${t.border}` : undefined, borderTop: movil && i > 1 ? `1px solid ${t.border}` : undefined }}>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: movil ? 13 : 15, fontWeight: 700, color: t.primary }}>{a}</div>
                  <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{b}</div>
                </div>
              ))}
            </div>

            {/* Fichas partidas: foto a la izquierda, specs y precio a la
                derecha. Es la diferencia con las demás — nadie más muestra el
                producto así, y es como se compra un periférico. */}
            <Reveal>
              <div style={{ padding: movil ? '26px 16px 8px' : '44px 44px 10px' }}>
                <Titulo t={t} volanta={txt('fila', 'volanta')} texto={txt('fila', 'titulo')} accion={txt('fila', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
                <div style={{ display: 'grid', gap: movil ? 14 : 18 }}>
                  {p.productos.slice(0, 3).map((x) => (
                    <div key={x.nombre} className="pl-card" data-link={abrir(x) ? '1' : undefined} onClick={abrir(x)} style={{ display: 'grid', gridTemplateColumns: movil ? '116px 1fr' : '260px 1fr', background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
                      <Foto src={x.img} src2={x.img2} alto={movil ? 132 : 186} />
                      <div style={{ padding: movil ? '13px 14px' : '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: movil ? 14.5 : 17, fontWeight: 700 }}>{x.nombre}</span>
                          {x.badge && <span style={{ background: TONOS[x.badgeTono ?? 'azul'], color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{x.badge}</span>}
                        </div>
                        {x.tag && <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: movil ? 11 : 12.5, color: t.muted }}>{x.tag}</div>}
                        {x.estrellas && <Estrellas n={x.estrellas} resenas={x.resenas} color={t.accent} />}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
                          {x.antes && <span style={{ fontSize: 12.5, color: t.muted, textDecoration: 'line-through' }}>{x.antes}</span>}
                          <span style={{ fontSize: movil ? 19 : 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{x.precio}</span>
                          {x.cuotas && !movil && <span style={{ fontSize: 12.5, color: t.primary, fontWeight: 600 }}>{x.cuotas}</span>}
                        </div>
                        {x.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.transfer}</div>}
                        {x.stock && <div style={{ fontSize: 11.5, color: '#F87171', fontWeight: 600 }}>{x.stock}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Categorías en lista con flecha, no en mosaico de fotos: en el
                panel lateral ya hay nav, esto es el atajo largo. */}
            <Reveal>
              <div style={{ padding: movil ? '20px 16px' : '30px 44px' }}>
                <Titulo t={t} texto={txt('categorias', 'titulo')} movil={movil} />
                <div style={{ display: 'grid', gridTemplateColumns: colsDe(2, categorias.length, 1), gap: 10 }}>
                  {categorias.slice(0, 2).map(([n, src, slug]) => (
                    <div
                      key={n} className="pl-tile"
                      onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden', cursor: slug && acciones ? 'pointer' : undefined }}
                    >
                      <div style={{ width: 92, flexShrink: 0 }}><Foto src={src} alto={72} /></div>
                      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{n}</span>
                      <span style={{ marginLeft: 'auto', paddingRight: 16, color: t.primary, fontSize: 17 }}>→</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal>
              <div style={{ padding: movil ? '4px 16px 26px' : '10px 44px 40px' }}>
                <Titulo t={t} volanta={txt('fila2', 'volanta')} texto={txt('fila2', 'titulo')} movil={movil} />
                <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 12 : 16 }}>
                  {fila(cuantos(4), 'circuito-nuevos').map((x) => <Card key={x.nombre} p={x} t={t} alto={movil ? 140 : 190} onClick={abrir(x)} />)}
                </div>
              </div>
            </Reveal>

            {p.cupon && (
              <Reveal>
                <div style={{ margin: movil ? '0 16px 26px' : '0 44px 38px', border: `1px solid ${t.primary}`, borderRadius: t.radio, padding: movil ? 20 : '26px 30px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', background: t.soft }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{p.cupon.titulo}</div>
                    <div style={{ fontSize: 13, color: t.muted, marginTop: 5 }}>{p.cupon.bajada}</div>
                  </div>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 17, fontWeight: 700, letterSpacing: '0.14em', color: t.primary, border: `1px dashed ${t.primary}`, padding: '11px 20px', borderRadius: t.radio }}>{p.cupon.codigo}</div>
                </div>
              </Reveal>
            )}

            <Reveal>
              <div style={{ borderTop: `1px solid ${t.border}`, padding: movil ? '24px 18px' : '32px 44px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 18 : 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{txt('whatsapp', 'titulo')}</div>
                  <div style={{ fontSize: 13, color: t.muted, marginTop: 5 }}>{txt('whatsapp', 'bajada')}</div>
                </div>
                <Boton t={t} grande onClick={acciones?.abrirWhatsapp}>{txt('whatsapp', 'cta')}</Boton>
              </div>
            </Reveal>

            {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
          </div>
        </div>
      </div>
    )
  }

  // ── VERA ──────────────────────────────────────────────────────────────────
  // Joyería: portada de catálogo impreso. El texto del hero va CENTRADO encima
  // de la foto (no a un costado), y las piezas se listan numeradas —01, 02,
  // 03— con filete entre una y otra, como el índice de un catálogo. Es lo
  // contrario de una grilla: acá se lee de arriba abajo, de a una pieza.
  if (p.layout === 'vera') {
    const s = p.slides[iActual]
    const filete = `1px solid ${t.border}`

    const encabezado = (
      <>
        {!!txt('cintillo', 'texto') && (
          <div style={{ padding: '9px 0', fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.primary, borderBottom: filete, background: t.soft, overflow: 'hidden' }}>
            {activo('cintillo', 'cartelera') ? (
              <div className="pl-marquee-track">
                {[0, 1].map((k) => <span key={k}>{`${txt('cintillo', 'texto')}   ·   `.repeat(6)}</span>)}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '0 12px' }}>{txt('cintillo', 'texto')}</div>
            )}
          </div>
        )}
        <HeaderCentrado t={t} marca={p.marca} links={p.links ?? []} movil={movil} acciones={acciones} />
      </>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}

        <div style={{ position: 'relative' }}>
          <Foto src={s.img} alto={movil ? 380 : 500} />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: movil ? 22 : 40, background: 'rgba(251,250,248,0.58)' }}>
            <div>
              <div style={{ width: 34, height: 1, background: t.primary, margin: '0 auto 16px' }} />
              {s.kicker && <div style={{ fontSize: movil ? 10 : 11.5, letterSpacing: '0.3em', textTransform: 'uppercase', color: t.primary, fontWeight: 700 }}>{s.kicker}</div>}
              <div style={{ fontFamily: t.fh, fontSize: movil ? 64 : 104, lineHeight: 1, fontWeight: 700, color: t.text, letterSpacing: '-0.03em', margin: '14px 0 6px' }}>{s.titulo}</div>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 17 : 24, color: t.text }}>{s.bajada}</div>
              <div style={{ marginTop: movil ? 20 : 28 }}>
                <Boton t={t} grande={!movil} onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}>{s.cta}</Boton>
              </div>
              {navHero({ marginTop: 26, justifyContent: 'center' })}
            </div>
          </div>
        </div>

        {/* Servicios en filetes, en versalitas: la promesa de una joyería no
            es un porcentaje, es el grabado y el envío asegurado. */}
        <div style={{ borderBottom: filete, display: 'grid', gridTemplateColumns: movil ? '1fr 1fr' : `repeat(${(p.confianza ?? []).length}, 1fr)` }}>
          {(p.confianza ?? []).map(([a, b], i) => (
            <div key={a} style={{ padding: movil ? '16px 14px' : '22px 26px', textAlign: 'center', borderLeft: !movil && i > 0 ? filete : undefined, borderTop: movil && i > 1 ? filete : undefined }}>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 14.5 : 17, color: t.primary }}>{a}</div>
              <div style={{ fontSize: 11.5, color: t.muted, marginTop: 5, letterSpacing: '0.04em' }}>{b}</div>
            </div>
          ))}
        </div>

        {/* Las piezas, numeradas y en lista. Foto cuadrada chica a la
            izquierda, nombre en serif, precio a la derecha alineado. */}
        <Reveal>
          <div style={{ padding: movil ? '30px 16px 10px' : '50px 44px 16px' }}>
            <Titulo t={t} volanta={txt('fila', 'volanta')} texto={txt('fila', 'titulo')} centrado movil={movil} />
            <div style={{ borderTop: filete }}>
              {p.productos.map((x, i) => (
                <div
                  key={x.nombre} className="pl-fila" onClick={abrir(x)}
                  style={{ display: 'grid', gridTemplateColumns: movil ? '28px 84px 1fr' : '58px 132px 1fr auto', alignItems: 'center', gap: movil ? 12 : 22, padding: movil ? '14px 0' : '20px 0', borderBottom: filete, cursor: abrir(x) ? 'pointer' : undefined }}
                >
                  <span style={{ fontFamily: t.fh, fontSize: movil ? 15 : 22, color: t.accent }}>{String(i + 1).padStart(2, '0')}</span>
                  <div className="pl-tile"><Foto src={x.img} src2={x.img2} alto={movil ? 84 : 132} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: t.fh, fontSize: movil ? 15 : 21, lineHeight: 1.25 }}>{x.nombre}</div>
                    {x.estrellas && <div style={{ marginTop: 7, color: t.muted }}><Estrellas n={x.estrellas} resenas={x.resenas} color={t.primary} /></div>}
                    {x.badge && <div style={{ marginTop: 8, display: 'inline-block', border: `1px solid ${t.primary}`, color: t.primary, fontSize: 9.5, fontWeight: 700, padding: '3px 9px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{x.badge}</div>}
                    {movil && <div style={{ fontSize: 16, fontWeight: 700, color: t.primary, marginTop: 9 }}>{x.precio}</div>}
                    {movil && x.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.transfer}</div>}
                  </div>
                  {!movil && (
                    <div style={{ textAlign: 'right', paddingRight: 4 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: t.primary }}>{x.precio}</div>
                      {x.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.transfer}</div>}
                      {x.cuotas && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 5 }}>{x.cuotas}</div>}
                      <div style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.muted, marginTop: 10, borderBottom: `1px solid ${t.border}`, display: 'inline-block', paddingBottom: 3 }}>Ver la pieza</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Índice de categorías: foto cuadrada chica y el nombre al lado en
            versalitas, en dos columnas. Ni mosaico ni pastillas. */}
        <Reveal>
          <div style={{ padding: movil ? '18px 16px 30px' : '26px 44px 48px' }}>
            <Titulo t={t} texto={txt('categorias', 'titulo')} centrado movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: colsDe(2, (p.categorias ?? []).length, 1), gap: movil ? 10 : 16 }}>
              {(p.categorias ?? []).slice(0, 2).map(([n, src, slug]) => (
                <div
                  key={n} className="pl-tile"
                  onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, border: filete, background: t.surf, cursor: slug && acciones ? 'pointer' : undefined }}
                >
                  <div style={{ width: movil ? 86 : 110, flexShrink: 0 }}><Foto src={src} alto={movil ? 78 : 96} /></div>
                  <span style={{ fontFamily: t.fh, fontSize: movil ? 16 : 20 }}>{n}</span>
                  <span style={{ marginLeft: 'auto', paddingRight: 18, color: t.accent }}>→</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {p.cupon && (
          <Reveal>
            <div style={{ borderTop: filete, borderBottom: filete, padding: movil ? '26px 20px' : '36px 44px', textAlign: 'center', background: t.soft }}>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 21 : 28, color: t.text }}>{p.cupon.titulo}</div>
              <div style={{ fontSize: 13, color: t.muted, margin: '8px 0 16px' }}>{p.cupon.bajada}</div>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, letterSpacing: '0.18em', color: t.primary, border: `1px dashed ${t.primary}`, padding: '10px 22px' }}>{p.cupon.codigo}</span>
            </div>
          </Reveal>
        )}

        <Reveal>
          <div style={{ padding: movil ? '26px 20px' : '38px 44px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center', textAlign: movil ? 'center' : 'left' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 24 }}>{txt('whatsapp', 'titulo')}</div>
              <div style={{ fontSize: 13, color: t.muted, marginTop: 6 }}>{txt('whatsapp', 'bajada')}</div>
            </div>
            <Boton t={t} grande onClick={acciones?.abrirWhatsapp}>{txt('whatsapp', 'cta')}</Boton>
          </div>
        </Reveal>

        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  // ── COBIJO ────────────────────────────────────────────────────────────────
  // Deco: se compra por AMBIENTE, no por categoría suelta. Por eso el cuerpo
  // son bloques que alternan lado (foto / texto, texto / foto) y cada uno se
  // lleva sus dos productos abajo. El hero no tapa la foto con un degradé:
  // apoya una tarjeta blanca encima, como una revista de decoración.
  if (p.layout === 'cobijo') {
    const s = p.slides[iActual]
    const cat = p.categorias ?? []
    // Los dos ambientes son lo que distingue a esta plantilla, así que su
    // título, su texto y su foto los edita el dueño. La foto cae a la de una
    // categoría suya (no a una del repo) cuando no subió ninguna.
    const ambientes: [string, string, string, string, typeof p.productos][] = [
      [txt('ambiente1', 'volanta'), txt('ambiente1', 'titulo'), txt('ambiente1', 'texto'), txt('ambiente1', 'foto') || cat[0]?.[1] || s.img, p.productos.slice(0, 2)],
      [txt('ambiente2', 'volanta'), txt('ambiente2', 'titulo'), txt('ambiente2', 'texto'), txt('ambiente2', 'foto') || cat[2]?.[1] || s.img, p.productos.slice(2, 4)],
    ]

    const encabezado = (
      <>
        {txt('cintillo', 'texto') && <Marquee t={t} texto={txt('cintillo', 'texto')} />}
        <HeaderCentrado t={t} marca={p.marca} links={p.links ?? []} conBuscador movil={movil} acciones={acciones} />
      </>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}

        <div style={{ position: 'relative' }}>
          <Foto src={s.img} alto={movil ? 340 : 470} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: movil ? '0 16px 20px' : '0 44px 40px' }}>
            <div style={{ background: t.surf, borderRadius: t.radio, padding: movil ? '20px 22px' : '30px 34px', maxWidth: movil ? '100%' : 430, boxShadow: t.sombra }}>
              {s.kicker && <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.primary, fontWeight: 700 }}>{s.kicker}</div>}
              <div style={{ fontFamily: t.fh, fontSize: movil ? 46 : 64, lineHeight: 0.95, fontWeight: 700, letterSpacing: '-0.04em', margin: '10px 0 4px' }}>{s.titulo}</div>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 17 : 22, color: t.muted, fontWeight: 500 }}>{s.bajada}</div>
              <div style={{ marginTop: 18 }}>
                <Boton t={t} grande={!movil} onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}>{s.cta}</Boton>
              </div>
              {navHero({ marginTop: 18 })}
            </div>
          </div>
        </div>

        <div style={{ background: t.soft, borderBottom: `1px solid ${t.border}`, display: 'grid', gridTemplateColumns: cols(4, 2), gap: 1 }}>
          {(p.confianza ?? []).map(([a, b]) => (
            <div key={a} style={{ padding: movil ? '14px 12px' : '20px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: movil ? 13 : 15, fontWeight: 700, color: t.primary }}>{a}</div>
              <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{b}</div>
            </div>
          ))}
        </div>

        {/* Ambientes en zigzag. La foto ocupa la mitad y el texto la otra, y
            se dan vuelta en el segundo bloque: es lo que hace que no se lea
            como una grilla más. */}
        {ambientes.map(([volanta, titulo, bajada, foto, items], k) => (
          <Reveal key={titulo}>
            <div style={{ padding: movil ? '28px 16px 8px' : '48px 44px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', gap: movil ? 18 : 34, alignItems: 'center' }}>
                <div className="pl-tile" style={{ order: movil ? 1 : k % 2 === 0 ? 1 : 2, borderRadius: t.radio, overflow: 'hidden' }}>
                  <Foto src={foto} alto={movil ? 230 : 340} radio={t.radio} />
                </div>
                <div style={{ order: movil ? 2 : k % 2 === 0 ? 2 : 1 }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.accent, fontWeight: 700, marginBottom: 10 }}>{volanta}</div>
                  <h2 style={{ fontFamily: t.fh, fontSize: movil ? 28 : 40, margin: 0, fontWeight: 700, letterSpacing: '-0.03em' }}>{titulo}</h2>
                  <p style={{ fontSize: 14.5, color: t.muted, lineHeight: 1.75, margin: '14px 0 20px', maxWidth: 400 }}>{bajada}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {items.map((x) => (
                      <div key={x.nombre} className="pl-card" data-link={abrir(x) ? '1' : undefined} onClick={abrir(x)} style={{ background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
                        <Foto src={x.img} src2={x.img2} alto={movil ? 108 : 132} />
                        <div style={{ padding: '11px 13px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{x.nombre}</div>
                          <div style={{ fontSize: 15.5, fontWeight: 800, marginTop: 6 }}>{x.precio}</div>
                          {x.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.transfer}</div>}
                          {x.cuotas && <div style={{ fontSize: 11, color: t.muted, marginTop: 3 }}>{x.cuotas}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}

        <Reveal>
          <div style={{ padding: movil ? '22px 16px 30px' : '34px 44px 44px' }}>
            <Titulo t={t} volanta={txt('categorias', 'volanta')} texto={txt('categorias', 'titulo')} accion={txt('categorias', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            {/* colsDe (no `cols(4,2)` fijo) + el slice que lo acompaña: sin
                esto, una tienda con más de 4 categorías dejaba una segunda
                fila a medio llenar (el adaptador dejó de cortar a 4 siempre,
                ver plantillaReal.ts) — mismo criterio que el resto de las
                grillas de categorías. */}
            <div style={{ display: 'grid', gridTemplateColumns: colsDe(4, cat.length, 2), gap: 12 }}>
              {cat.slice(0, 4).map(([n, src, slug]) => (
                <div
                  key={n} className="pl-tile"
                  onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                  style={{ position: 'relative', borderRadius: t.radio, cursor: slug && acciones ? 'pointer' : undefined }}
                >
                  <Foto src={src} alto={movil ? 118 : 168} radio={t.radio} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,35,32,0.66), transparent 58%)', display: 'flex', alignItems: 'flex-end', padding: 14, borderRadius: t.radio }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: movil ? 13 : 16 }}>{n}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {p.cupon && (
          <Reveal>
            <div style={{ margin: movil ? '0 16px 28px' : '0 44px 40px', background: t.primary, color: t.onPrimary, borderRadius: t.radio, padding: movil ? 22 : '30px 34px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 230 }}>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 20 : 27, fontWeight: 700, letterSpacing: '-0.02em' }}>{p.cupon.titulo}</div>
                <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 6 }}>{p.cupon.bajada}</div>
              </div>
              <div style={{ border: '2px dashed rgba(255,255,255,0.55)', padding: '12px 22px', fontFamily: 'ui-monospace, monospace', fontSize: 18, fontWeight: 700, letterSpacing: '0.12em', borderRadius: t.radio }}>{p.cupon.codigo}</div>
            </div>
          </Reveal>
        )}

        <Reveal>
          <div style={{ borderTop: `1px solid ${t.border}`, background: t.soft, padding: movil ? '26px 20px' : '36px 44px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{txt('whatsapp', 'titulo')}</div>
              <div style={{ fontSize: 13.5, color: t.muted, marginTop: 6 }}>{txt('whatsapp', 'bajada')}</div>
            </div>
            <Boton t={t} grande onClick={acciones?.abrirWhatsapp}>{txt('whatsapp', 'cta')}</Boton>
          </div>
        </Reveal>

        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  // ── NÍTIDA ────────────────────────────────────────────────────────────────
  // Cosmética sin rosa ni degradés: el hero está partido en dos mitades duras
  // —color plano con el texto, foto al lado— en vez de texto encima de la
  // foto, y los productos van en fichas horizontales de dos columnas, con el
  // "para qué sirve" al lado del precio. Glow es la versión romántica del
  // rubro; esta es la de farmacia prolija.
  if (p.layout === 'nitida') {
    // El hero es fijo (no rota): el PRIMER slide es la mitad dura de arriba y
    // el SEGUNDO es la campaña ancha del final — por eso `heroMaxSlides: 2`,
    // igual que Escaparate, y por eso no lleva `navHero`.
    const s = p.slides[0]
    const extra = p.slides[1] ?? s

    const encabezado = (
      <>
        {txt('cintillo', 'texto') && <Marquee t={t} texto={txt('cintillo', 'texto')} />}
        <HeaderCentrado t={t} marca={p.marca} links={p.links ?? []} movil={movil} acciones={acciones} />
      </>
    )

    if (soloHeader) return <div style={marco}>{encabezado}</div>

    return (
      <div style={marco}>
        {encabezado}

        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr' }}>
          <div style={{ background: t.soft, padding: movil ? '32px 20px' : '58px 46px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {s.kicker && <div style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: t.primary, fontWeight: 700 }}>{s.kicker}</div>}
            <div style={{ fontFamily: t.fh, fontSize: movil ? 56 : 88, lineHeight: 0.9, fontWeight: 800, letterSpacing: '-0.045em', margin: '14px 0 8px' }}>{s.titulo}</div>
            <div style={{ fontFamily: t.fh, fontSize: movil ? 18 : 26, color: t.muted, fontWeight: 600 }}>{s.bajada}</div>
            <div style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Boton t={t} grande={!movil} onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}>{s.cta}</Boton>
              <Boton t={t} grande={!movil} secundario onClick={acciones?.irACatalogo}>{txt('hero', 'cta2')}</Boton>
            </div>
          </div>
          <div className="pl-tile"><Foto src={s.img} alto={movil ? 280 : 460} /></div>
        </div>

        {/* Beneficios en píldoras, no en barra con filetes: es lo que separa
            esta de las otras claras apenas termina el hero. */}
        <div style={{ padding: movil ? '18px 14px' : '22px 44px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {(p.confianza ?? []).map(([a, b]) => (
            <span key={a} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, background: t.soft, border: `1px solid ${t.border}`, borderRadius: 999, padding: movil ? '7px 13px' : '9px 17px' }}>
              <span style={{ fontSize: movil ? 12 : 13.5, fontWeight: 700 }}>{a}</span>
              <span style={{ fontSize: movil ? 11 : 12.5, color: t.muted }}>{b}</span>
            </span>
          ))}
        </div>

        {/* Fichas horizontales: foto cuadrada a la izquierda, el resto al
            lado. Dos por fila en escritorio, una en celular. */}
        <Reveal>
          <div style={{ padding: movil ? '28px 16px 8px' : '46px 44px 12px' }}>
            <Titulo t={t} volanta={txt('fila', 'volanta')} texto={txt('fila', 'titulo')} accion={txt('fila', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(2, 1), gap: movil ? 12 : 18 }}>
              {fila(cuantos(2, 1), 'nitida-fila').map((x) => (
                <div key={x.nombre} className="pl-card" data-link={abrir(x) ? '1' : undefined} onClick={abrir(x)} style={{ display: 'grid', gridTemplateColumns: movil ? '112px 1fr' : '150px 1fr', background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
                  <Foto src={x.img} src2={x.img2} alto={movil ? 132 : 168} />
                  <div style={{ padding: movil ? '13px 14px' : '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                    {x.badge && <span style={{ alignSelf: 'flex-start', background: TONOS[x.badgeTono ?? 'verde'], color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999 }}>{x.badge}</span>}
                    <div style={{ fontSize: movil ? 14 : 16, fontWeight: 700, lineHeight: 1.3 }}>{x.nombre}</div>
                    {x.estrellas && <Estrellas n={x.estrellas} resenas={x.resenas} color={t.accent} />}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                      {x.antes && <span style={{ fontSize: 12, color: t.muted, textDecoration: 'line-through' }}>{x.antes}</span>}
                      <span style={{ fontSize: movil ? 17 : 20, fontWeight: 800 }}>{x.precio}</span>
                    </div>
                    {x.transfer && <div style={{ fontSize: 11.5, color: t.muted }}>{x.transfer}</div>}
                    {x.colores && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                        {x.colores.map((c) => <span key={c} className="pl-swatch" style={{ width: 14, height: 14, borderRadius: '50%', background: c, border: `1px solid ${t.border}` }} />)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Categorías verticales (3:4), altas y angostas, con el nombre
            debajo de la foto en vez de encima. */}
        <Reveal>
          <div style={{ padding: movil ? '22px 16px 26px' : '32px 44px 40px' }}>
            <Titulo t={t} texto={txt('categorias', 'titulo')} centrado movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: colsDe(4, (p.categorias ?? []).length, 2), gap: movil ? 12 : 18 }}>
              {(p.categorias ?? []).slice(0, 4).map(([n, src, slug]) => (
                <div
                  key={n} className="pl-tile"
                  onClick={slug && acciones ? () => acciones.irACategoria(slug) : undefined}
                  style={{ textAlign: 'center', cursor: slug && acciones ? 'pointer' : undefined }}
                >
                  <div style={{ borderRadius: t.radio, overflow: 'hidden' }}><Foto src={src} alto={movil ? 160 : 230} radio={t.radio} /></div>
                  <div style={{ fontSize: movil ? 13.5 : 15, fontWeight: 700, marginTop: 11 }}>{n}</div>
                  <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>Ver productos</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Segunda campaña a lo ancho, con la promo del slide que sobra. */}
        <Reveal>
          <div style={{ position: 'relative', margin: movil ? '0 16px 26px' : '0 44px 38px', borderRadius: t.radio, overflow: 'hidden' }}>
            <Foto src={extra.img} alto={movil ? 200 : 260} radio={t.radio} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: movil ? '0 22px' : '0 40px', background: 'linear-gradient(90deg, rgba(31,42,36,0.82) 8%, rgba(31,42,36,0.35) 58%, transparent 88%)' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#fff', opacity: 0.85, fontWeight: 700 }}>{extra.kicker}</div>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 40 : 58, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, margin: '8px 0 6px' }}>{extra.titulo}</div>
              <div style={{ fontSize: movil ? 14 : 17, color: 'rgba(255,255,255,0.92)' }}>{extra.bajada}</div>
            </div>
          </div>
        </Reveal>

        {p.cupon && (
          <Reveal>
            <div style={{ margin: movil ? '0 16px 26px' : '0 44px 38px', border: `1px solid ${t.border}`, background: t.soft, borderRadius: t.radio, padding: movil ? 22 : '28px 32px', textAlign: 'center' }}>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 20 : 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{p.cupon.titulo}</div>
              <div style={{ fontSize: 13, color: t.muted, margin: '8px 0 16px' }}>{p.cupon.bajada}</div>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, letterSpacing: '0.16em', fontWeight: 700, color: t.primary, border: `1px dashed ${t.primary}`, padding: '10px 22px', borderRadius: 999 }}>{p.cupon.codigo}</span>
            </div>
          </Reveal>
        )}

        <Reveal>
          <div style={{ borderTop: `1px solid ${t.border}`, padding: movil ? '26px 20px' : '36px 44px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{txt('whatsapp', 'titulo')}</div>
              <div style={{ fontSize: 13.5, color: t.muted, marginTop: 6 }}>{txt('whatsapp', 'bajada')}</div>
            </div>
            <Boton t={t} grande onClick={acciones?.abrirWhatsapp}>{txt('whatsapp', 'cta')}</Boton>
          </div>
        </Reveal>

        {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
      </div>
    )
  }

  // ── GLOW ──────────────────────────────────────────────────────────────────
  // Belleza: degradé rosa, rutina mostrada con PRODUCTOS numerados (no
  // párrafos), antes y después, y galería de Instagram al pie.
  const s = p.slides[iActual]

  const encabezado = (
    <>
      {!!txt('cintillo', 'texto') && (
        <div style={{ background: t.primary, color: '#fff', textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>
          {txt('cintillo', 'texto')}
        </div>
      )}
      <div style={{ textAlign: 'center', padding: movil ? '14px 16px' : '18px 34px 14px', background: t.surf, borderBottom: `1px solid ${t.border}`, position: 'relative' }}>
        <div
          onClick={acciones?.irAInicio}
          style={{ fontFamily: t.fh, fontSize: movil ? 24 : 30, fontWeight: 800, letterSpacing: '-0.03em', color: t.primary, cursor: acciones?.irAInicio ? 'pointer' : undefined }}
        >{p.marca}</div>
        {!movil && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 26, marginTop: 10, fontSize: 13.5, color: t.text }}>
            {navDe(p.links ?? ['Rostro', 'Maquillaje', 'Rutinas', 'Sets de regalo'], acciones).map((l) => <span key={l.label} className="pl-nav" onClick={l.onClick} style={{ cursor: l.onClick ? 'pointer' : undefined }}>{l.label}</span>)}
          </div>
        )}
        {movil && <span style={{ position: 'absolute', left: 16, top: 16 }}><MenuMovil t={t} links={p.links ?? []} acciones={acciones} /></span>}
        <span style={{ position: 'absolute', right: movil ? 16 : 34, top: movil ? 16 : 22, display: 'inline-flex' }}>
          <AccionesTienda t={t} movil={movil} acciones={acciones} />
        </span>
      </div>
    </>
  )

  if (soloHeader) return <div style={marco}>{encabezado}</div>

  return (
    <div style={marco}>
      {encabezado}

      <div style={{ background: `linear-gradient(120deg, ${t.soft} 0%, #FFFFFF 52%, ${t.soft} 100%)` }}>
        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', gap: movil ? 0 : 30, padding: movil ? '30px 20px 0' : '54px 44px', alignItems: 'center' }}>
          <div style={{ order: movil ? 2 : 1, paddingBottom: movil ? 34 : 0 }}>
            {s.kicker && <div style={{ fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.primary, fontWeight: 800, marginBottom: 14 }}>{s.kicker}</div>}
            <h1 style={{ fontFamily: t.fh, fontSize: movil ? 40 : 62, lineHeight: 1.0, margin: 0, whiteSpace: 'pre-line', fontWeight: 800, letterSpacing: '-0.04em' }}>{s.titulo}</h1>
            <p style={{ fontSize: 15.5, color: t.muted, margin: '18px 0 26px', lineHeight: 1.75, maxWidth: 400 }}>{s.bajada}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Boton t={t} grande onClick={s.link && acciones?.irALink ? () => acciones.irALink!(s.link!) : undefined}>{s.cta}</Boton>
              <Boton t={t} secundario grande onClick={acciones?.abrirWhatsapp}>{txt('hero', 'cta2')}</Boton>
            </div>
          </div>
          <div style={{ order: movil ? 1 : 2 }}>
            <Foto src={s.img} alto={movil ? 280 : 420} radio={t.radio} />
            {navHero({ marginTop: 16, justifyContent: 'center' })}
          </div>
        </div>
      </div>

      {/* Sellos de producto. */}
      <div style={{ background: t.surf, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '16px' : '20px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 14 }}>
          {([
            [txt('sellos', 't1'), txt('sellos', 'b1')],
            [txt('sellos', 't2'), txt('sellos', 'b2')],
            [txt('sellos', 't3'), txt('sellos', 'b3')],
            [txt('sellos', 't4'), txt('sellos', 'b4')],
          ] as [string, string][]).filter(([a]) => a).map(([a, b]) => (
            <div key={a} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: movil ? 13 : 14.5, fontWeight: 800, color: t.primary }}>{a}</div>
              <div style={{ fontSize: movil ? 11 : 12, color: t.muted, marginTop: 3 }}>{b}</div>
            </div>
          ))}
        </div>
      </div>

      {/* La rutina, mostrada con productos numerados y su precio. */}
      <Reveal>
        <div style={{ padding: movil ? '32px 16px' : '52px 40px' }}>
          <Titulo t={t} volanta={txt('rutina', 'volanta')} texto={txt('rutina', 'titulo')} centrado movil={movil} />
          <div style={{ display: 'grid', gridTemplateColumns: cols(3, 1), gap: 18 }}>
            {/* Los tres pasos de la rutina: los elige el dueño (categoría o
                producto) y los que no tocó salen del catálogo. Una categoría
                no tiene precio ni estrellas, por eso van con guarda. */}
            {lugares(cuantos(3, 1), 'rutina', 'glow-trio').map((x, i) => (
              <div key={x.nombre} className="pl-card" data-link={x.ir ? '1' : undefined} onClick={x.ir} style={{ background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden', boxShadow: t.sombra }}>
                <div style={{ position: 'relative' }}>
                  <Foto src={x.img} src2={x.producto?.img2} alto={movil ? 210 : 250} />
                  <span style={{ position: 'absolute', top: 14, left: 14, width: 32, height: 32, borderRadius: '50%', background: '#fff', color: t.primary, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800, boxShadow: '0 4px 12px rgba(0,0,0,0.14)' }}>{i + 1}</span>
                </div>
                <div style={{ padding: '15px 16px 18px' }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.primary, fontWeight: 800 }}>{txt('rutina', `paso${i + 1}`)}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>{x.nombre}</div>
                  {x.producto && (
                    <>
                      <div style={{ marginTop: 6 }}><Estrellas n={x.producto.estrellas ?? 5} resenas={x.producto.resenas} color={t.accent} /></div>
                      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 8 }}>{x.producto.precio}</div>
                      {x.producto.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.producto.transfer}</div>}
                    </>
                  )}
                  <div style={{ marginTop: 12 }}><Boton t={t} ancho onClick={x.ir}>{acciones ? 'Ver' : 'Agregar'}</Boton></div>
                </div>
              </div>
            ))}
          </div>
          {/* El combo de los tres a precio especial no existe en Órbita: no
              hay forma de agregar tres productos con una sola accion. Queda
              como una linea de texto que el dueno escribe --o vacia. */}
          {txt('rutina', 'pie') && (
            <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13.5, color: t.muted }}>{txt('rutina', 'pie')}</div>
          )}
        </div>
      </Reveal>

      <Reveal>
        <div style={{ background: t.soft, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '32px 16px' : '52px 40px' }}>
          <Titulo t={t} volanta={txt('fila', 'volanta')} texto={txt('fila', 'titulo')} accion={txt('fila', 'accion')} movil={movil} onAccion={acciones?.irACatalogo} />
          <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 16 }}>
            {fila(cuantos(4), 'glow-fila').map((x) => (
              <div key={x.nombre} className="pl-card" data-link={abrir(x) ? '1' : undefined} onClick={abrir(x)} style={{ background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
                <div style={{ position: 'relative' }}>
                  <Foto src={x.img} src2={x.img2} alto={movil ? 150 : 190} />
                  {x.badge && <span style={{ position: 'absolute', top: 11, left: 11, background: TONOS[x.badgeTono ?? 'violeta'], color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>{x.badge}</span>}
                </div>
                <div style={{ padding: '13px 14px 16px' }}>
                  <Estrellas n={x.estrellas ?? 5} resenas={x.resenas} color={t.accent} />
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{x.nombre}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                    {x.antes && <span style={{ fontSize: 12, color: t.muted, textDecoration: 'line-through' }}>{x.antes}</span>}
                    <span style={{ fontSize: 17, fontWeight: 800 }}>{x.precio}</span>
                  </div>
                  {x.transfer && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.transfer}</div>}
                  {x.colores && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                      {x.colores.map((c) => <span key={c} className="pl-swatch" style={{ width: 15, height: 15, borderRadius: '50%', background: c, border: `1px solid ${t.border}` }} />)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Antes y después. */}
      <Reveal>
        <div style={{ padding: movil ? '32px 16px' : '52px 40px' }}>
          <Titulo t={t} volanta={txt('antesDespues', 'volanta')} texto={txt('antesDespues', 'titulo')} centrado movil={movil} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, maxWidth: 760, margin: '0 auto', borderRadius: t.radio, overflow: 'hidden' }}>
            {([
              [txt('antesDespues', 'etiqueta1'), txt('antesDespues', 'foto1')],
              [txt('antesDespues', 'etiqueta2'), txt('antesDespues', 'foto2')],
            ] as [string, string][]).filter(([v]) => v).map(([l, src]) => (
              <div key={l} style={{ position: 'relative' }}>
                <Foto src={src} alto={movil ? 200 : 300} radio={0} />
                <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.94)', color: t.text, fontSize: 11.5, fontWeight: 800, padding: '5px 12px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</span>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: t.muted, marginTop: 14 }}>{txt('antesDespues', 'leyenda')}</p>
        </div>
      </Reveal>

      {/* Galería de Instagram. */}
      <Reveal>
        <div style={{ padding: movil ? '0 0 30px' : '0 0 44px' }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 11.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.primary, fontWeight: 800 }}>{txt('galeria', 'usuario')}</div>
            <div style={{ fontFamily: t.fh, fontSize: movil ? 21 : 26, fontWeight: 800, marginTop: 6, letterSpacing: '-0.02em' }}>{txt('galeria', 'titulo')}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: cols(6, 3), gap: 3 }}>
            {['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((k) => txt('galeria', k)).filter(Boolean).map((src, i) => (
              <div key={i} className="pl-tile"><Foto src={src} alto={movil ? 110 : 165} radio={0} /></div>
            ))}
          </div>
        </div>
      </Reveal>

      {!p.ocultarPie && <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} redes={p.pie?.redes} legales={p.pie?.legales} onDevolucion={acciones?.abrirDevolucion} />}
    </div>
  )
}
