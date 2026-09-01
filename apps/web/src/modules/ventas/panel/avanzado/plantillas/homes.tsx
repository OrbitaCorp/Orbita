import type { Plantilla, Producto, AccionesHome } from './tipos'
import { IMG } from './tipos'
import {
  Reveal, Foto, Estrellas, Card, Boton, Titulo, Marquee,
  HeaderCentrado, Carrusel, Pie, TONOS, AccionesTienda,
} from './piezas'

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

export function Home({ p, movil, acciones, soloCuerpo }: {
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
}) {
  const t = p.tema
  const marco: React.CSSProperties = soloCuerpo ? {} : { background: t.bg, color: t.text, fontFamily: t.fb }
  const cols = (d: number, m = 2) => `repeat(${movil ? m : d}, 1fr)`
  // En el panel la grilla dibuja la maqueta `Card`; en la tienda real, la
  // ProductCard de verdad. El layout (altos, si va a sangre) no cambia.
  const producto = (x: Producto, i: number, props: { sangre?: boolean; alto: number }) =>
    acciones?.renderProducto
      ? <div key={x.slug ?? x.nombre}>{acciones.renderProducto(x, i)}</div>
      : <Card key={x.nombre} p={x} t={t} sangre={props.sangre} alto={props.alto} />

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
            <HeaderCentrado t={t} marca={p.marca} links={links} conBuscador movil={movil} />
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

        <Reveal>
          <div style={{ padding: movil ? '30px 0 0' : '48px 0 0' }}>
            <h2 style={{ fontFamily: t.fh, fontSize: movil ? 24 : 32, textAlign: 'center', margin: '0 0 4px', fontWeight: 800, letterSpacing: '-0.025em' }}>Destacados</h2>
            <p style={{ textAlign: 'center', color: t.muted, fontSize: 13.5, margin: '0 0 26px' }}>Los que más se venden esta semana</p>
            <div style={{ display: 'grid', gridTemplateColumns: cols(4), borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }}>
              {p.productos.map((x, i) => producto(x, i, { sangre: true, alto: movil ? 190 : 290 }))}
            </div>
          </div>
        </Reveal>

        {categorias.length > 0 && (
          <Reveal>
            <div style={{ padding: movil ? '30px 16px' : '46px 40px' }}>
              <Titulo t={t} texto="Comprá por categoría" centrado movil={movil} />
              <div style={{ display: 'grid', gridTemplateColumns: cols(4), gap: 12 }}>
                {categorias.map(([n, src, slug]) => (
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
        <Reveal>
          <div style={{ padding: movil ? '4px 16px 30px' : '0 40px 44px' }}>
            <Titulo t={t} volanta="Top ventas" texto="Más vendidos" accion="Ver el catálogo →" movil={movil} onAccion={acciones?.irACatalogo} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 12 : 16 }}>
              {masVendidos.map((x, i) => producto(x, i, { alto: movil ? 150 : 215 }))}
            </div>
          </div>
        </Reveal>

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
              <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 24, fontWeight: 800, letterSpacing: '-0.02em' }}>¿Dudas con tu compra?</div>
              <div style={{ fontSize: 13.5, color: t.muted, marginTop: 6 }}>Escribinos por WhatsApp y te respondemos en el día.</div>
            </div>
            <Boton t={t} grande onClick={acciones?.abrirWhatsapp}>Escribir por WhatsApp</Boton>
          </div>
        </Reveal>

        {!soloCuerpo && (
          <Pie
            t={t} marca={p.marca} tagline={p.tagline} movil={movil}
            cierre={p.pie?.cierre ?? 'Defensa al consumidor'}
            columnas={p.pie?.columnas ?? [['Comprar', links.slice(1)], ['Ayuda', ['Envíos', 'Cambios', 'Contacto']], ['Legales', ['Términos', 'Privacidad']]]}
          />
        )}
      </div>
    )
  }

  // ── MOSAICO ───────────────────────────────────────────────────────────────
  // Sin hero: arranca con un muro de bloques de distinta altura. Los productos
  // van compactos, cinco por fila, con lo mínimo.
  if (p.layout === 'mosaico') {
    const s = p.slides[0]
    return (
      <div style={marco}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: movil ? '14px 16px' : '18px 28px', background: t.surf, borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontSize: 19, lineHeight: 1 }}>☰</span>
          <span style={{ fontFamily: t.fh, fontSize: movil ? 18 : 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{p.marca}</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 14, fontSize: 12.5, color: t.muted, alignItems: 'center' }}>
            {!movil && <span style={{ border: `1px solid ${t.border}`, borderRadius: 999, padding: '7px 16px', background: t.soft }}>Buscar…</span>}
            <AccionesTienda t={t} movil={movil} />
          </span>
        </div>

        {/* El muro. Alturas desparejas a propósito. */}
        <div style={{ padding: movil ? 12 : 16, display: 'grid', gridTemplateColumns: movil ? '1fr 1fr' : '1.7fr 1fr 1fr', gap: 12 }}>
          <div className="pl-tile" style={{ gridRow: movil ? undefined : 'span 2', gridColumn: movil ? 'span 2' : undefined, position: 'relative', borderRadius: t.radio, boxShadow: t.sombra }}>
            <Foto src={s.img} alto={movil ? 250 : 480} radio={t.radio} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(4,47,46,0.86), transparent 72%)', padding: movil ? 22 : 38, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: t.radio }}>
              <div style={{ fontSize: 11.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>{s.kicker}</div>
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 28 : 46, lineHeight: 1.04, margin: '12px 0 10px', color: '#fff', whiteSpace: 'pre-line', fontWeight: 800, letterSpacing: '-0.03em' }}>{s.titulo}</h1>
              <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.9)', margin: '0 0 20px', maxWidth: 380 }}>{s.bajada}</p>
              <div><Boton t={t}>{s.cta}</Boton></div>
            </div>
          </div>
          {([['Cocina', '-40%', `${IMG}/casa-ceramica.jpg`, 230], ['Textil', '-25%', `${IMG}/casa-sillon.jpg`, 230], ['Jardín', '-30%', `${IMG}/casa-plantas.jpg`, 238], ['Deco', 'Nuevo', `${IMG}/casa-deco.jpg`, 238]] as [string, string, string, number][]).map(([n, off, src, h]) => (
            <div key={n} className="pl-tile" style={{ position: 'relative', borderRadius: t.radio }}>
              <Foto src={src} alto={movil ? 128 : h} radio={t.radio} />
              <div style={{ position: 'absolute', inset: 0, padding: 15, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent 58%)', borderRadius: t.radio }}>
                <span style={{ alignSelf: 'flex-start', background: t.accent, color: '#3B1D00', fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>{off}</span>
                <span style={{ fontSize: movil ? 15 : 19, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{n}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Productos compactos: cinco por fila, imagen cuadrada, sin ficha larga. */}
        <Reveal>
          <div style={{ padding: movil ? '24px 16px 30px' : '34px 28px 40px' }}>
            <Titulo t={t} volanta="Se van rápido" texto="Lo más vendido" accion="Ver todo →" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(5, 2), gap: 14 }}>
              {[...p.productos, p.productos[0]].map((x, i) => (
                <div key={i} className="pl-card" style={{ background: t.surf, borderRadius: t.radio, overflow: 'hidden', border: `1px solid ${t.border}` }}>
                  <div className="pl-media" style={{ position: 'relative' }}>
                    <Foto src={x.img} src2={x.img2} alto={movil ? 150 : 172} />
                    {x.badge && <span style={{ position: 'absolute', top: 9, left: 9, background: TONOS[x.badgeTono ?? 'azul'], color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{x.badge}</span>}
                  </div>
                  <div style={{ padding: '11px 12px 14px' }}>
                    <div style={{ fontSize: 12.5, lineHeight: 1.35, height: 34, overflow: 'hidden' }}>{x.nombre}</div>
                    <div style={{ fontSize: 15.5, fontWeight: 800, marginTop: 6 }}>{x.precio}</div>
                    {x.antes && <div style={{ fontSize: 11.5, color: t.muted, textDecoration: 'line-through' }}>{x.antes}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ background: t.primary, color: '#fff', padding: movil ? '26px 18px' : '38px 28px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 230 }}>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 21 : 30, fontWeight: 800, letterSpacing: '-0.02em' }}>Envío gratis desde $70.000</div>
              <div style={{ fontSize: 13.5, opacity: 0.9, marginTop: 6 }}>A todo el país. Llega en 48 a 72 horas.</div>
            </div>
            <span className="pl-cta" style={{ background: '#fff', color: t.primary, padding: '13px 28px', borderRadius: 999, fontWeight: 700, fontSize: 13.5 }}>Aprovechar</span>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ padding: movil ? '28px 16px' : '38px 28px' }}>
            <Titulo t={t} texto="Marcas que trabajamos" centrado movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(6, 3), gap: 12 }}>
              {['Lume', 'Ronda', 'Casa Nova', 'Verde', 'Tramo', 'Norte'].map((m) => (
                <div key={m} style={{ border: `1px solid ${t.border}`, borderRadius: t.radio, padding: '20px 8px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: t.muted, background: t.surf }}>{m}</div>
              ))}
            </div>
          </div>
        </Reveal>

        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre="CUIT 30-71234567-8"
          columnas={[['Categorías', ['Cocina', 'Textil', 'Jardín', 'Deco']], ['Comprar', ['Pagos', 'Envíos', 'Sucursales']], ['Empresa', ['Nosotros', 'Contacto']]]} />
      </div>
    )
  }

  // ── ESCAPARATE ────────────────────────────────────────────────────────────
  // Marca de ropa: dos campañas a pantalla partida y "comprá el look" con
  // puntos sobre la foto. Todo foto grande, nada de párrafos.
  if (p.layout === 'escaparate') {
    return (
      <div style={marco}>
        <div style={{ background: t.primary, color: t.onPrimary, textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' }}>
          Envío gratis en compras desde $90.000 · 3 cuotas sin interés
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: movil ? '13px 16px' : '17px 34px', borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontFamily: t.fh, fontSize: movil ? 19 : 23, fontWeight: 800, letterSpacing: '-0.04em', textTransform: 'uppercase' }}>{p.marca}</span>
          {!movil && <div style={{ display: 'flex', gap: 22, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{['Mujer', 'Hombre', 'Calzado', 'Sale'].map((l) => <span key={l} style={{ color: l === 'Sale' ? t.accent : t.text }}>{l}</span>)}</div>}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 14, fontSize: 12.5, color: t.muted, alignItems: 'center' }}>
            {!movil && <span style={{ border: `1px solid ${t.border}`, borderRadius: 4, padding: '7px 14px' }}>Buscar</span>}
            <AccionesTienda t={t} movil={movil} />
          </span>
        </div>

        {/* Dos campañas, mitad y mitad. */}
        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr' }}>
          {([['Mujer', 'Abrigos\nque abrigan', `${IMG}/moda-mujer-invierno.jpg`], ['Hombre', 'Calzado\nde todos los días', `${IMG}/vidriera-zapatilla-roja.jpg`]] as [string, string, string][]).map(([k, tit, src]) => (
            <div key={k} className="pl-tile" style={{ position: 'relative' }}>
              <Foto src={src} alto={movil ? 330 : 540} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(9,9,11,0.72), transparent 58%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: movil ? 24 : 40 }}>
                <div style={{ fontSize: 11.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', fontWeight: 700, marginBottom: 12 }}>{k}</div>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 32 : 46, lineHeight: 1.02, color: '#fff', whiteSpace: 'pre-line', fontWeight: 800, letterSpacing: '-0.035em', marginBottom: 20 }}>{tit}</div>
                <div><span style={{ display: 'inline-block', background: '#fff', color: t.text, padding: '12px 26px', fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ver {k.toLowerCase()}</span></div>
              </div>
            </div>
          ))}
        </div>

        <Reveal>
          <div style={{ padding: movil ? '30px 0 34px 16px' : '48px 0 52px 34px' }}>
            <div style={{ paddingRight: movil ? 16 : 34 }}>
              <Titulo t={t} volanta="Recién llegado" texto="Lo nuevo de la semana" accion="Ver todo →" movil={movil} />
            </div>
            <Tira gap={14}>
              {[...p.productos, p.productos[0]].map((x, i) => (
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
                    <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>{x.cuotas}</div>
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

        {/* Comprá el look: puntos numerados sobre la foto + lista al costado. */}
        <Reveal>
          <div style={{ background: t.soft, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '30px 16px' : '52px 34px' }}>
            <Titulo t={t} volanta="Total look" texto="Comprá el look completo" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 0.85fr', gap: movil ? 20 : 34, alignItems: 'start' }}>
              <div style={{ position: 'relative' }}>
                <Foto src={`${IMG}/vidriera-modelo.jpg`} alto={movil ? 340 : 460} radio={t.radio} />
                {([[26, 32], [58, 54], [72, 78]] as [number, number][]).map(([top, left], i) => (
                  <span key={i} style={{
                    position: 'absolute', top: `${top}%`, left: `${left}%`, width: 30, height: 30, borderRadius: '50%',
                    background: '#fff', color: t.text, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.35)', border: '2px solid rgba(255,255,255,0.9)',
                  }}>{i + 1}</span>
                ))}
              </div>
              <div>
                {p.productos.slice(0, 3).map((x, i) => (
                  <div key={x.nombre} className="pl-card" style={{ display: 'flex', gap: 14, alignItems: 'center', background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, padding: 12, marginBottom: 12 }}>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: t.primary, color: t.onPrimary, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ width: 62, flexShrink: 0 }}><Foto src={x.img} alto={72} radio={t.radio} /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{x.nombre}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>{x.precio}</div>
                    </div>
                    <span className="pl-cta" style={{ background: t.primary, color: t.onPrimary, fontSize: 11.5, fontWeight: 700, padding: '9px 14px', borderRadius: t.radio, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Agregar</span>
                  </div>
                ))}
                <div style={{ marginTop: 14 }}><Boton t={t} ancho>Agregar los 3 · $446.000</Boton></div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ padding: movil ? '30px 16px' : '48px 34px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 12 }}>
              {([['Camperas', `${IMG}/moda-mujer-invierno.jpg`], ['Calzado', `${IMG}/moda-zapato.jpg`], ['Zapatillas', `${IMG}/vidriera-zapatilla-blanca.jpg`], ['Accesorios', `${IMG}/vidriera-anteojos.jpg`]] as [string, string][]).map(([n, src]) => (
                <div key={n} className="pl-tile" style={{ position: 'relative' }}>
                  <Foto src={src} alto={movil ? 130 : 210} />
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(9,9,11,0.30)', display: 'grid', placeItems: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: movil ? 13 : 17, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{n}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre="Defensa al consumidor"
          columnas={[['Comprar', ['Mujer', 'Hombre', 'Calzado', 'Sale']], ['Ayuda', ['Guía de talles', 'Envíos', 'Cambios']], ['Legales', ['Términos', 'Privacidad']]]} />
      </div>
    )
  }

  // ── PREMIUM ───────────────────────────────────────────────────────────────
  // Joyería. Lo que la separa de las otras cinco: el producto se presenta de a
  // uno, con aire alrededor, y no hay un solo tachado ni cartel de oferta — el
  // argumento es la pieza, no el descuento. Todo lo demás (dorado sobre
  // carbón, serif, filetes de un pixel) está al servicio de eso.
  if (p.layout === 'premium') {
    const s = p.slides[0]
    const filete = `1px solid ${t.border}`
    const enlaceOro: React.CSSProperties = {
      fontSize: 11.5, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700,
      color: t.primary, borderBottom: `1px solid ${t.primary}`, paddingBottom: 6,
    }
    return (
      <div style={marco}>
        <div style={{ textAlign: 'center', padding: '9px 12px', fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: t.primary, borderBottom: filete }}>
          Envío asegurado · Certificado de autenticidad · Grabado sin cargo
        </div>

        {/* Logo centrado, buscador a la izquierda y las acciones de la tienda a
            la derecha — la misma cuenta y el mismo carrito que el resto del
            sitio, pintados en dorado. */}
        <div style={{ display: 'grid', gridTemplateColumns: movil ? 'auto 1fr auto' : '1fr auto 1fr', alignItems: 'center', padding: movil ? '14px 16px' : '22px 44px', borderBottom: filete, gap: 14 }}>
          {movil
            ? <span style={{ fontSize: 18, color: t.primary }}>☰</span>
            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.muted }}>⌕ Buscar</span>}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: t.fh, fontSize: movil ? 24 : 34, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.primary }}>{p.marca}</div>
            {!movil && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 12, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.muted }}>
                {['Anillos', 'Collares', 'Aros', 'Relojes', 'A pedido'].map((l) => <span key={l}>{l}</span>)}
              </div>
            )}
          </div>
          <span style={{ justifySelf: 'end' }}><AccionesTienda t={t} movil={movil} /></span>
        </div>

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
              <div style={{ fontSize: 10.5, letterSpacing: '0.3em', textTransform: 'uppercase', color: t.primary, marginBottom: 18 }}>{s.kicker}</div>
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 44 : 78, lineHeight: 0.98, margin: 0, whiteSpace: 'pre-line', fontWeight: 400, letterSpacing: '-0.015em', color: '#F7F2E8' }}>{s.titulo}</h1>
              <p style={{ fontSize: movil ? 14 : 15, color: 'rgba(247,242,232,0.7)', margin: '22px 0 30px', lineHeight: 1.85 }}>{s.bajada}</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="pl-cta" style={{ background: t.primary, color: t.onPrimary, padding: '14px 30px', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{s.cta}</span>
                <span className="pl-cta" style={{ border: '1px solid rgba(247,242,232,0.35)', color: '#F7F2E8', padding: '14px 26px', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Pedir a medida</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tres promesas en una línea, separadas por filetes. */}
        <div style={{ borderBottom: filete, display: 'grid', gridTemplateColumns: movil ? '1fr' : 'repeat(3, 1fr)' }}>
          {([['Oro 18k con sello', 'Cada pieza sale con su certificado'], ['Garantía de por vida', 'Ajustes y pulido sin cargo'], ['Envío asegurado', 'Con seguimiento a todo el país']] as [string, string][]).map(([a, b], i) => (
            <div key={a} style={{ padding: movil ? '20px 22px' : '30px 34px', textAlign: 'center', borderLeft: !movil && i > 0 ? filete : undefined, borderTop: movil && i > 0 ? filete : undefined }}>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 22, color: t.primary }}>{a}</div>
              <div style={{ fontSize: 12, color: t.muted, marginTop: 6, letterSpacing: '0.04em' }}>{b}</div>
            </div>
          ))}
        </div>

        <Reveal>
          <div style={{ padding: movil ? '30px 16px 8px' : '58px 44px 16px' }}>
            <Titulo t={t} volanta="Por categoría" texto="Qué estás buscando" accion="Ver todo →" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 12 }}>
              {([['Anillos', `${IMG}/joya-anillo-piedras.jpg`], ['Collares', `${IMG}/joya-collar.jpg`], ['Aros', `${IMG}/joya-aros.jpg`], ['Relojes', `${IMG}/joya-reloj.jpg`]] as [string, string][]).map(([n, src]) => (
                <div key={n} className="pl-tile" style={{ position: 'relative' }}>
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

        {/* Las piezas: tres, grandes, con aire. Sin tachados ni badges de oferta. */}
        <Reveal>
          <div style={{ padding: movil ? '26px 16px 34px' : '46px 44px 62px' }}>
            <Titulo t={t} volanta="Disponibles ahora" texto="Piezas de la colección" accion="Ver las 24 →" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(3, 1), gap: movil ? 24 : 32 }}>
              {p.productos.slice(0, 3).map((x) => (
                <div key={x.nombre} className="pl-card" style={{ textAlign: 'center' }}>
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
                  <div style={{ fontSize: 11.5, color: t.muted, marginTop: 6 }}>3 cuotas sin interés · Envío asegurado</div>
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
            <Foto src={`${IMG}/joya-pulsera-rosa.jpg`} alto={movil ? 250 : 420} />
            <div style={{ padding: movil ? '32px 22px' : '56px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: t.soft }}>
              <div style={{ width: 40, height: 1, background: t.primary, marginBottom: 16 }} />
              <div style={{ fontSize: 10.5, letterSpacing: '0.28em', textTransform: 'uppercase', color: t.primary, marginBottom: 14 }}>El taller</div>
              <h2 style={{ fontFamily: t.fh, fontSize: movil ? 30 : 42, margin: 0, fontWeight: 400, lineHeight: 1.1 }}>Cuatro manos, una pieza por vez</h2>
              <p style={{ fontSize: 14.5, color: t.muted, lineHeight: 1.85, margin: '20px 0 28px', maxWidth: 420 }}>
                Fundimos, engarzamos y pulimos en el mismo lugar desde 1998. Nada sale del taller
                sin pasar por lupa dos veces.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: movil ? 20 : 38, justifyContent: 'start' }}>
                {([['26', 'años'], ['4.100', 'piezas'], ['100%', 'a mano']] as [string, string][]).map(([n, l]) => (
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
              <Titulo t={t} volanta="A pedido" texto="Grabá la pieza por dentro" movil={movil} />
              <p style={{ fontSize: 14.5, color: t.muted, lineHeight: 1.85, margin: '0 0 24px', maxWidth: 400 }}>
                Una fecha, un nombre o las coordenadas de un lugar. El grabado se hace a mano y suma
                cinco días hábiles a la entrega, sin costo adicional.
              </p>
              <span style={enlaceOro}>Pedir una pieza</span>
            </div>
            <div style={{ order: movil ? 1 : 2 }}><Foto src={`${IMG}/joya-anillos-caja.jpg`} alto={movil ? 260 : 420} /></div>
          </div>
        </Reveal>


        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre="Taller en Buenos Aires"
          columnas={[['Colección', ['Anillos', 'Collares', 'Aros', 'Relojes']], ['A pedido', ['Grabado', 'Talles', 'Encargues']], ['Ayuda', ['Envíos', 'Garantía', 'Contacto']]]} />
      </div>
    )
  }

  // ── NOCTURNO ──────────────────────────────────────────────────────────────
  // Tech: contador de lanzamiento, foco radial detrás del producto, categorías
  // con cantidad, carrusel con specs y armador de setup.
  if (p.layout === 'nocturno') {
    const s = p.slides[0]
    return (
      <div style={marco}>
        <div style={{ background: t.soft, borderBottom: `1px solid ${t.border}`, padding: '9px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.primary, fontWeight: 700 }}>Lanzamiento V-90 Pro</span>
          <span style={{ display: 'flex', gap: 5 }}>
            {([['02', 'd'], ['11', 'h'], ['46', 'm']] as [string, string][]).map(([n, l]) => (
              <span key={l} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6, padding: '3px 8px' }}>
                <strong style={{ color: t.text }}>{n}</strong><span style={{ color: t.muted }}>{l}</span>
              </span>
            ))}
          </span>
          {!movil && <span style={{ fontSize: 12, color: t.muted }}>· 15% off reservando</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: movil ? '13px 16px' : '15px 32px', borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontFamily: t.fh, fontSize: movil ? 18 : 21, fontWeight: 800, letterSpacing: '-0.02em' }}>{p.marca}</span>
          {!movil && <div style={{ display: 'flex', gap: 20, fontSize: 13, color: t.muted }}>{['Periféricos', 'Audio', 'Monitores', 'Reacondicionados'].map((l) => <span key={l}>{l}</span>)}</div>}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12, alignItems: 'center', fontSize: 12.5, color: t.muted }}>
            {!movil && <span style={{ border: `1px solid ${t.border}`, borderRadius: 8, padding: '7px 14px', background: t.soft, fontFamily: 'ui-monospace, monospace' }}>buscar…</span>}
            {!movil && <span style={{ border: `1px solid ${t.primary}`, color: t.primary, borderRadius: 8, padding: '6px 12px', fontWeight: 600 }}>Comparar</span>}
            <AccionesTienda t={t} movil={movil} />
          </span>
        </div>

        <div style={{ position: 'relative', overflow: 'hidden', background: `radial-gradient(1100px 500px at 72% 46%, rgba(34,211,238,0.20), transparent 62%), ${t.bg}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1.05fr', gap: movil ? 0 : 40, padding: movil ? '30px 18px' : '62px 40px', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-block', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.primary, fontWeight: 700, border: `1px solid ${t.primary}`, borderRadius: 999, padding: '5px 13px', marginBottom: 18 }}>{s.kicker}</div>
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 36 : 62, lineHeight: 0.96, margin: 0, fontWeight: 800, letterSpacing: '-0.045em', whiteSpace: 'pre-line' }}>{s.titulo}</h1>
              <p style={{ fontSize: 15, color: t.muted, margin: '18px 0 26px', lineHeight: 1.7, maxWidth: 420 }}>{s.bajada}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
                <Boton t={t}>{s.cta}</Boton>
                <Boton t={t} secundario>Ver comparativa</Boton>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {([['50 mm', 'driver'], ['38 h', 'batería'], ['35 dB', 'ANC']] as [string, string][]).map(([v, l]) => (
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
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 12 }}>
              {([['Teclados', '42 modelos', `${IMG}/tech-teclado.jpg`], ['Mouses', '31 modelos', `${IMG}/tech-mouse.jpg`], ['Audio', '58 modelos', `${IMG}/tech-auriculares-2.jpg`], ['Setups', '12 combos', `${IMG}/tech-setup.jpg`]] as [string, string, string][]).map(([n, c, src]) => (
                <div key={n} className="pl-tile" style={{ position: 'relative', borderRadius: t.radio, border: `1px solid ${t.border}` }}>
                  <Foto src={src} alto={movil ? 100 : 140} radio={t.radio} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,17,32,0.92), transparent 62%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 13, borderRadius: t.radio }}>
                    <span style={{ fontSize: movil ? 13.5 : 15.5, fontWeight: 700 }}>{n}</span>
                    <span style={{ fontSize: 11.5, color: t.primary, fontFamily: 'ui-monospace, monospace' }}>{c}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ padding: movil ? '20px 0 30px 16px' : '26px 0 44px 40px' }}>
            <div style={{ paddingRight: movil ? 16 : 40 }}>
              <Titulo t={t} volanta="Arman buen setup" texto="Se compran juntos" accion="Ver los 42 →" movil={movil} />
            </div>
            <Tira gap={14}>
              {p.productos.map((x) => (
                <div key={x.nombre} className="pl-card" style={{ width: movil ? 235 : 280, flexShrink: 0, scrollSnapAlign: 'start', background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
                  <div style={{ position: 'relative' }}>
                    <Foto src={x.img} src2={x.img2} alto={movil ? 150 : 178} />
                    {x.badge && <span style={{ position: 'absolute', top: 10, left: 10, background: TONOS[x.badgeTono ?? 'azul'], color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 6, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em' }}>{x.badge}</span>}
                  </div>
                  <div style={{ padding: '13px 14px 15px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{x.nombre}</div>
                    <div style={{ marginTop: 8, borderTop: `1px solid ${t.border}` }}>
                      {([['Garantía', '12 meses'], ['Envío', '24 h'], ['Stock', '12 u.']] as [string, string][]).map(([a, b]) => (
                        <div key={a} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 11.5, color: t.muted, fontFamily: 'ui-monospace, monospace' }}>
                          <span>{a}</span><span style={{ color: t.text }}>{b}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                      {x.antes && <span style={{ fontSize: 12, color: t.muted, textDecoration: 'line-through' }}>{x.antes}</span>}
                      <span style={{ fontSize: 18, fontWeight: 800 }}>{x.precio}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: t.muted, marginTop: 4 }}>{x.cuotas}</div>
                  </div>
                </div>
              ))}
            </Tira>
          </div>
        </Reveal>

        {/* Armá tu setup: tres pasos con producto, no con texto. */}
        <Reveal>
          <div style={{ background: t.soft, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '30px 16px' : '46px 40px' }}>
            <Titulo t={t} volanta="En tres pasos" texto="Armá tu setup y ahorrá 15%" centrado movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(3, 1), gap: 16 }}>
              {([['Elegí el teclado', `${IMG}/tech-teclado-2.jpg`, '$189.000'], ['Sumá el mouse', `${IMG}/tech-mouse.jpg`, '$142.000'], ['Cerrá con el audio', `${IMG}/tech-auriculares-2.jpg`, '$249.000']] as [string, string, string][]).map(([n, src, pr], i) => (
                <div key={n} className="pl-card" style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
                  <div style={{ position: 'relative' }}>
                    <Foto src={src} alto={movil ? 140 : 158} />
                    <span style={{ position: 'absolute', top: 10, left: 10, width: 26, height: 26, borderRadius: '50%', background: t.primary, color: t.onPrimary, display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 800 }}>{i + 1}</span>
                  </div>
                  <div style={{ padding: '13px 14px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{n}</div>
                      <div style={{ fontSize: 12, color: t.muted, fontFamily: 'ui-monospace, monospace', marginTop: 3 }}>desde {pr}</div>
                    </div>
                    <span className="pl-cta" style={{ border: `1px solid ${t.primary}`, color: t.primary, borderRadius: 8, padding: '7px 12px', fontSize: 11.5, fontWeight: 700 }}>Elegir</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 22 }}><Boton t={t} grande>Armar mi setup</Boton></div>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ padding: movil ? '30px 16px 34px' : '46px 40px 52px' }}>
            <Titulo t={t} volanta="Sin vueltas" texto="Cuál te conviene" movil={movil} />
            <div style={{ border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
              {([
                ['', 'V-70', 'V-90 Pro', 'V-90 Studio'],
                ['Driver', '40 mm', '50 mm', '50 mm'],
                ['Batería', '24 h', '38 h', '38 h'],
                ['Cancelación', '—', '35 dB', '35 dB'],
                ['Precio', '$164.000', '$249.000', '$318.000'],
              ] as string[][]).map((fila, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr', background: i === 0 ? t.soft : i % 2 ? t.surf : 'transparent', borderBottom: i === 4 ? 'none' : `1px solid ${t.border}` }}>
                  {fila.map((c, j) => (
                    <div key={j} style={{ padding: movil ? '10px 8px' : '14px 16px', fontSize: movil ? 11.5 : 13, color: j === 0 ? t.muted : t.text, fontWeight: i === 0 || j === 2 ? 700 : 400, fontFamily: j > 0 && i > 0 ? 'ui-monospace, monospace' : t.fb, background: j === 2 && i > 0 ? 'rgba(34,211,238,0.07)' : undefined }}>{c}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div style={{ background: t.soft, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '26px 16px' : '40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 20 }}>
            {([['24 h', 'de envío a todo el país'], ['12', 'meses de garantía'], ['12', 'cuotas sin interés'], ['4,8', 'de 5 en 1.240 reseñas']] as [string, string][]).map(([n, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: movil ? 26 : 40, fontWeight: 800, color: t.primary, fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.03em' }}>{n}</div>
                <div style={{ fontSize: 12.5, color: t.muted, marginTop: 6 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre="Garantía oficial"
          columnas={[['Productos', ['Teclados', 'Mouses', 'Audio', 'Monitores']], ['Soporte', ['Garantía', 'Drivers', 'RMA']], ['Empresa', ['Nosotros', 'Contacto']]]} />
      </div>
    )
  }

  // ── PAPELERÍA ─────────────────────────────────────────────────────────────
  // A una librería no se entra a pasear: se entra a buscar el cuaderno que
  // pidió la maestra. Por eso el buscador es el hero y no un ícono arriba a la
  // derecha, y por eso hay un armador de lista escolar con total.
  if (p.layout === 'papeleria') {
    const s = p.slides[0]
    const lista: [string, string, boolean][] = [
      ['Cuaderno A4 rayado × 3', '$14.700', true],
      ['Cartuchera con 2 cierres', '$12.900', true],
      ['Lápices de colores × 24', '$8.700', false],
      ['Resma A4 75 g', '$9.400', false],
      ['Mochila reforzada 18"', '$38.500', false],
    ]
    return (
      <div style={marco}>
        <div style={{ background: t.primary, color: t.onPrimary, textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>
          Envío gratis desde $25.000 · Retiro en el local sin cargo
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: movil ? 12 : 24, padding: movil ? '13px 16px' : '16px 32px', background: t.surf, borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontFamily: t.fh, fontSize: movil ? 20 : 25, fontWeight: 800, letterSpacing: '-0.03em', color: t.primary }}>{p.marca}</span>
          {!movil && (
            <div style={{ flex: 1, maxWidth: 460, display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${t.border}`, borderRadius: t.radio, padding: '10px 16px', background: t.soft, fontSize: 13.5, color: t.muted }}>
              <span>⌕</span><span>Buscar por nombre, marca o código…</span>
            </div>
          )}
          <span style={{ marginLeft: 'auto' }}><AccionesTienda t={t} movil={movil} /></span>
        </div>
        {!movil && (
          <div style={{ display: 'flex', gap: 26, padding: '11px 32px', background: t.surf, borderBottom: `1px solid ${t.border}`, fontSize: 13, color: t.text }}>
            {['Escolar', 'Oficina', 'Arte', 'Libros', 'Regalería', 'Ofertas'].map((l) => (
              <span key={l} style={{ color: l === 'Ofertas' ? t.accent : t.text, fontWeight: l === 'Ofertas' ? 700 : 400 }}>{l}</span>
            ))}
          </div>
        )}

        {/* Hero: el campo de búsqueda es el protagonista, no un adorno. */}
        <div style={{ background: t.soft, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1.15fr 1fr', gap: movil ? 24 : 40, padding: movil ? '30px 20px' : '54px 40px', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-block', fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.primary, fontWeight: 800, background: t.surf, border: `1px solid ${t.border}`, borderRadius: 999, padding: '6px 14px', marginBottom: 18 }}>{s.kicker}</div>
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 36 : 52, lineHeight: 1.05, margin: 0, fontWeight: 800, letterSpacing: '-0.035em' }}>{s.titulo}</h1>
              <p style={{ fontSize: 14.5, color: t.muted, margin: '14px 0 22px', lineHeight: 1.7, maxWidth: 420 }}>{s.bajada}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: t.surf, border: `2px solid ${t.primary}`, borderRadius: t.radio, padding: movil ? '10px 12px' : '13px 16px', boxShadow: t.sombra, maxWidth: 480 }}>
                <span style={{ fontSize: 17, color: t.primary }}>⌕</span>
                <span style={{ flex: 1, fontSize: movil ? 13 : 15, color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{movil ? 'Ej: cuaderno Rivadavia' : 'Ej: cuaderno Rivadavia 48 hojas'}</span>
                <Boton t={t}>{s.cta}</Boton>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                {['Lista escolar', 'Resma A4', 'Témperas', 'Carpeta N°3', 'Tinta'].map((c) => (
                  <span key={c} style={{ fontSize: 12, color: t.muted, background: t.surf, border: `1px solid ${t.border}`, borderRadius: 999, padding: '6px 13px' }}>{c}</span>
                ))}
              </div>
            </div>
            {!movil && <Foto src={s.img} alto={330} radio={t.radio} />}
          </div>
        </div>

        <Reveal>
          <div style={{ padding: movil ? '26px 16px 6px' : '44px 40px 10px' }}>
            <Titulo t={t} volanta="Buscá por rubro" texto="Categorías" accion="Ver todas →" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(6, 3), gap: 10 }}>
              {([['Escolar', `${IMG}/libre-escolar.jpg`], ['Arte', `${IMG}/libre-lapices.jpg`], ['Oficina', `${IMG}/libre-lapicera.jpg`], ['Cuadernos', `${IMG}/libre-cuaderno.jpg`], ['Libros', `${IMG}/libre-biblioteca.jpg`], ['Mochilas', `${IMG}/libre-mochila.jpg`]] as [string, string][]).map(([n, src]) => (
                <div key={n} className="pl-tile" style={{ background: t.surf, border: `1px solid ${t.border}`, borderRadius: 999, padding: '6px 14px 6px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
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
                <Titulo t={t} volanta="Sin vueltas" texto="Armá la lista de la escuela" movil={movil} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {lista.map(([n, precio, marcado]) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${t.border}` }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'grid', placeItems: 'center',
                        border: `1.5px solid ${marcado ? t.primary : t.border}`, background: marcado ? t.primary : 'transparent',
                        color: t.onPrimary, fontSize: 12, fontWeight: 800,
                      }}>{marcado ? '✓' : ''}</span>
                      <span style={{ fontSize: 13.5, flex: 1, color: marcado ? t.text : t.muted }}>{n}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{precio}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: t.soft, borderRadius: t.radio, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 12, color: t.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>2 de 5 seleccionados</div>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 32 : 40, fontWeight: 800, letterSpacing: '-0.03em', margin: '8px 0 4px' }}>$27.600</div>
                <div style={{ fontSize: 12.5, color: t.muted, marginBottom: 18 }}>3 cuotas sin interés de $9.200</div>
                <Boton t={t} ancho>Agregar los 5 al carrito</Boton>
                <div style={{ fontSize: 11.5, color: t.muted, marginTop: 12, textAlign: 'center' }}>Llevando la lista completa, 10% off</div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ padding: movil ? '10px 16px 30px' : '16px 40px 48px' }}>
            <Titulo t={t} volanta="Lo que más sale" texto="Más vendidos de la semana" accion="Ver todo →" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 12 : 18 }}>
              {p.productos.map((x) => <Card key={x.nombre} p={x} t={t} alto={movil ? 150 : 210} />)}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="pl-tile" style={{ position: 'relative', margin: movil ? '0 16px 28px' : '0 40px 48px', borderRadius: t.radio, overflow: 'hidden' }}>
            <Foto src={`${IMG}/libre-biblioteca.jpg`} alto={movil ? 220 : 300} radio={t.radio} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg, rgba(29,78,216,0.94), rgba(29,78,216,0.35) 70%, transparent)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: movil ? 24 : 44, color: '#fff' }}>
              <div style={{ fontSize: 11.5, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800, marginBottom: 12 }}>Vuelta a clases</div>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 26 : 40, fontWeight: 800, letterSpacing: '-0.035em', maxWidth: 420, lineHeight: 1.1 }}>Traé la lista, nosotros la armamos</div>
              <p style={{ fontSize: 14, margin: '12px 0 20px', maxWidth: 380, opacity: 0.9 }}>Mandala por WhatsApp y te pasamos el presupuesto en el día.</p>
              <div><span className="pl-cta" style={{ display: 'inline-block', background: '#fff', color: t.primary, padding: '12px 24px', borderRadius: t.radio, fontSize: 13.5, fontWeight: 800 }}>Mandar mi lista</span></div>
            </div>
          </div>
        </Reveal>

        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre="Local en Av. Rivadavia 4820"
          columnas={[['Rubros', ['Escolar', 'Oficina', 'Arte', 'Libros']], ['Comprar', ['Lista escolar', 'Mayorista', 'Envíos']], ['Ayuda', ['Cambios', 'Facturación', 'Contacto']]]} />
      </div>
    )
  }

  // ── CORRALÓN ──────────────────────────────────────────────────────────────
  // Catálogo enorme y comprador apurado: la barra de departamentos vive
  // siempre a la vista, el hero informa (retiro, envío, cuenta corriente) en
  // vez de vender, y el producto se lista con su ficha técnica al lado.
  if (p.layout === 'corralon') {
    const s = p.slides[0]
    const deptos = ['Herramientas', 'Pinturas', 'Sanitarios', 'Electricidad', 'Jardín', 'Ferretería', 'Maderas', 'Aberturas', 'Bulonería', 'Cerámicos', 'Seguridad', 'Ofertas']
    return (
      <div style={marco}>
        <div style={{ background: t.primary, color: t.accent, padding: '8px 16px', fontSize: 11.5, fontWeight: 700, display: 'flex', justifyContent: 'center', gap: movil ? 12 : 28, flexWrap: 'wrap', letterSpacing: '0.03em' }}>
          <span>9 sucursales</span><span>Retiro en el día</span>{!movil && <span>Cuenta corriente para empresas</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: movil ? 12 : 22, padding: movil ? '12px 16px' : '15px 30px', borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontFamily: t.fh, fontSize: movil ? 20 : 24, fontWeight: 900, letterSpacing: '-0.04em', textTransform: 'uppercase' }}>
            {p.marca}<span style={{ color: t.accent }}>.</span>
          </span>
          {!movil && (
            <div style={{ flex: 1, maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `2px solid ${t.primary}`, borderRadius: t.radio, padding: '9px 14px', fontSize: 13, color: t.muted }}>
              <span>Buscar producto o código</span><span style={{ background: t.accent, color: t.primary, borderRadius: 3, padding: '2px 8px', fontWeight: 800 }}>⌕</span>
            </div>
          )}
          <span style={{ marginLeft: 'auto' }}><AccionesTienda t={t} movil={movil} /></span>
        </div>
        {/* Los doce departamentos, siempre visibles. */}
        <div style={{ background: t.primary, padding: movil ? '10px 12px' : '11px 30px', display: 'grid', gridTemplateColumns: cols(6, 3), gap: movil ? '7px 10px' : '8px 14px' }}>
          {deptos.map((d) => (
            <span key={d} style={{ fontSize: movil ? 10.5 : 12, fontWeight: 600, color: d === 'Ofertas' ? t.accent : '#E7E5E4', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d}</span>
          ))}
        </div>

        {/* Hero partido en tres: la promo grande y dos avisos operativos. */}
        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1.9fr 1fr', gap: 10, padding: movil ? 12 : 18 }}>
          <div className="pl-tile" style={{ position: 'relative', borderRadius: t.radio, overflow: 'hidden' }}>
            <Foto src={s.img} alto={movil ? 260 : 380} radio={t.radio} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(95deg, rgba(12,10,9,0.9), rgba(12,10,9,0.25) 72%)', padding: movil ? 22 : 38, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ alignSelf: 'flex-start', background: t.accent, color: t.primary, fontSize: 11, fontWeight: 900, padding: '5px 12px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>{s.kicker}</span>
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 30 : 46, lineHeight: 1.05, margin: 0, color: '#fff', whiteSpace: 'pre-line', fontWeight: 900, letterSpacing: '-0.035em', textTransform: 'uppercase' }}>{s.titulo}</h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.86)', margin: '14px 0 20px', maxWidth: 360 }}>{s.bajada}</p>
              <div><span className="pl-cta" style={{ display: 'inline-block', background: t.accent, color: t.primary, padding: '13px 26px', fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.cta}</span></div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateRows: movil ? undefined : '1fr 1fr', gridTemplateColumns: movil ? '1fr 1fr' : undefined, gap: 10 }}>
            {([['Retiro en 2 horas', 'Comprás online y lo pasás a buscar por la sucursal que te quede.', t.accent], ['Envío a obra', 'Camión propio en CABA y GBA. Coordinamos día y horario.', t.soft]] as [string, string, string][]).map(([tit, txt, fondo], i) => (
              <div key={tit} style={{ background: fondo, border: `1px solid ${t.border}`, borderRadius: t.radio, padding: movil ? 16 : 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 16 : 20, fontWeight: 900, letterSpacing: '-0.02em', textTransform: 'uppercase', marginBottom: 8 }}>{tit}</div>
                <div style={{ fontSize: 12.5, color: i === 0 ? 'rgba(12,10,9,0.75)' : t.muted, lineHeight: 1.55 }}>{txt}</div>
              </div>
            ))}
          </div>
        </div>

        <Reveal>
          <div style={{ padding: movil ? '16px 12px' : '26px 18px' }}>
            <Titulo t={t} volanta="Departamentos" texto="Entrá por rubro" accion="Ver los 12 →" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 10 }}>
              {([['Herramientas', `${IMG}/ferre-pared.jpg`], ['Pinturas', `${IMG}/ferre-pintura.jpg`], ['Jardín', `${IMG}/ferre-jardin.jpg`], ['Sanitarios', `${IMG}/ferre-canos.jpg`]] as [string, string][]).map(([n, src]) => (
                <div key={n} className="pl-tile" style={{ position: 'relative', borderRadius: t.radio, overflow: 'hidden', border: `1px solid ${t.border}` }}>
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
              <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.accent, fontWeight: 800, marginBottom: 10 }}>Calculadora</div>
              <h2 style={{ fontFamily: t.fh, fontSize: movil ? 22 : 30, color: '#fff', margin: '0 0 10px', fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase' }}>¿Cuánta pintura necesitás?</h2>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', margin: 0, lineHeight: 1.6, maxWidth: 380 }}>
                Poné los metros cuadrados y las manos, y te decimos cuántas latas comprar. Sin comprar de más ni volver al local.
              </p>
            </div>
            <div style={{ background: '#fff', borderRadius: t.radio, padding: movil ? 16 : 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {([['Metros²', '84'], ['Manos', '2']] as [string, string][]).map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 11, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{l}</div>
                    <div style={{ border: `1.5px solid ${t.border}`, borderRadius: t.radio, padding: '9px 12px', fontSize: 16, fontWeight: 800 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: `1px dashed ${t.border}`, paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: t.muted }}>Necesitás</div>
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 20 : 24, fontWeight: 900, letterSpacing: '-0.02em' }}>2 latas de 20 L</div>
                </div>
                <Boton t={t}>Agregar</Boton>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Productos en lista, con la ficha técnica al lado — no en grilla. */}
        <Reveal>
          <div style={{ padding: movil ? '0 12px 24px' : '0 18px 44px' }}>
            <Titulo t={t} volanta="Lo más pedido" texto="Herramienta y obra" accion="Ver catálogo →" movil={movil} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {p.productos.map((x) => (
                <div key={x.nombre} className="pl-card" style={{ display: 'grid', gridTemplateColumns: movil ? '96px 1fr' : '150px 1fr auto', gap: movil ? 14 : 22, alignItems: 'center', border: `1px solid ${t.border}`, borderRadius: t.radio, padding: movil ? 10 : 14, background: t.surf }}>
                  <div style={{ borderRadius: t.radio, overflow: 'hidden' }}><Foto src={x.img} src2={x.img2} alto={movil ? 96 : 120} /></div>
                  <div style={{ minWidth: 0 }}>
                    {x.badge && <span style={{ display: 'inline-block', background: t.accent, color: t.primary, fontSize: 10, fontWeight: 900, padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>{x.badge}</span>}
                    <div style={{ fontSize: movil ? 14 : 16, fontWeight: 800, letterSpacing: '-0.015em' }}>{x.nombre}</div>
                    <div style={{ fontSize: 12, color: t.muted, marginTop: 5, fontFamily: 'ui-monospace, monospace' }}>{x.tag}</div>
                    {x.estrellas && <div style={{ marginTop: 7 }}><Estrellas n={x.estrellas} resenas={x.resenas} color={t.text} /></div>}
                    {movil && <div style={{ fontSize: 18, fontWeight: 900, marginTop: 8 }}>{x.precio}</div>}
                  </div>
                  {!movil && (
                    <div style={{ textAlign: 'right', paddingRight: 8 }}>
                      {x.antes && <div style={{ fontSize: 12.5, color: t.muted, textDecoration: 'line-through' }}>{x.antes}</div>}
                      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>{x.precio}</div>
                      <div style={{ fontSize: 11.5, color: t.muted, margin: '2px 0 10px' }}>{x.transfer}</div>
                      <Boton t={t}>Agregar al carrito</Boton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div style={{ background: t.soft, borderTop: `1px solid ${t.border}`, padding: movil ? '22px 16px' : '34px 30px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 18 }}>
            {([['9', 'sucursales'], ['2 hs', 'para retirar'], ['52', 'años'], ['+18.000', 'productos']] as [string, string][]).map(([n, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 24 : 32, fontWeight: 900, letterSpacing: '-0.03em' }}>{n}</div>
                <div style={{ fontSize: 11.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre="Casa central: Av. San Martín 2140"
          columnas={[['Departamentos', ['Herramientas', 'Pinturas', 'Jardín', 'Sanitarios']], ['Empresas', ['Cuenta corriente', 'Licitaciones', 'Facturación A']], ['Ayuda', ['Sucursales', 'Envíos', 'Garantías']]]} />
      </div>
    )
  }

  // ── ATLETA ────────────────────────────────────────────────────────────────
  // La más agresiva: negro, lima y condensada en mayúsculas. El catálogo no se
  // muestra en grilla sino en tiras por disciplina que se arrastran, porque el
  // que entra ya sabe si corre, levanta o pedalea.
  if (p.layout === 'atleta') {
    const s = p.slides[0]
    const disciplinas: [string, string[]][] = [
      ['Running', [`${IMG}/dep-pista.jpg`, `${IMG}/dep-zapatilla.jpg`, `${IMG}/dep-correr.jpg`]],
      ['Fuerza', [`${IMG}/dep-sentadilla.jpg`, `${IMG}/dep-pesas.jpg`, `${IMG}/dep-press.jpg`]],
      ['Ciclismo', [`${IMG}/dep-bici.jpg`, `${IMG}/dep-pista.jpg`, `${IMG}/dep-correr.jpg`]],
    ]
    return (
      <div style={marco}>
        <Marquee t={t} texto="ENVÍO GRATIS +$120.000 ✦ 3 CUOTAS SIN INTERÉS ✦ CAMBIO DE TALLE SIN CARGO" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: movil ? '13px 16px' : '16px 34px', borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontFamily: t.fh, fontSize: movil ? 21 : 26, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', color: t.primary }}>{p.marca}</span>
          {!movil && (
            <div style={{ display: 'flex', gap: 22, fontSize: 13, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: t.fh }}>
              {['Running', 'Fuerza', 'Ciclismo', 'Indumentaria', 'Outlet'].map((l) => (
                <span key={l} style={{ color: l === 'Outlet' ? t.accent : t.text }}>{l}</span>
              ))}
            </div>
          )}
          <span style={{ marginLeft: 'auto' }}><AccionesTienda t={t} movil={movil} /></span>
        </div>

        {/* Hero a sangre: la foto ocupa todo y el titular se come el ancho. */}
        <div className="pl-tile" style={{ position: 'relative' }}>
          <Foto src={s.img} alto={movil ? 460 : 620} />
          <div style={{ position: 'absolute', inset: 0, background: movil ? 'linear-gradient(to top, rgba(10,10,10,0.95) 40%, rgba(10,10,10,0.4))' : 'linear-gradient(85deg, rgba(10,10,10,0.9) 30%, rgba(10,10,10,0.25) 70%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: movil ? '0 20px 34px' : '0 44px 56px' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: t.primary, fontWeight: 600, marginBottom: 14 }}>{s.kicker}</div>
            <h1 style={{ fontFamily: t.fh, fontSize: movil ? 50 : 104, lineHeight: movil ? 1.02 : 0.9, margin: 0, whiteSpace: 'pre-line', fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase', color: '#fff' }}>{s.titulo}</h1>
            <p style={{ fontSize: 14.5, color: 'rgba(250,250,250,0.72)', margin: '20px 0 26px', maxWidth: 420, lineHeight: 1.65 }}>{s.bajada}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span className="pl-cta" style={{ background: t.primary, color: t.onPrimary, padding: '14px 30px', fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: t.fh }}>{s.cta}</span>
              <span className="pl-cta" style={{ border: '1px solid rgba(250,250,250,0.4)', color: '#fff', padding: '14px 26px', fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: t.fh }}>Guía de talles</span>
            </div>
          </div>
        </div>

        {/* Tiras por disciplina, no grilla. */}
        {disciplinas.map(([nombre, fotos], di) => (
          <Reveal key={nombre} delay={di * 60}>
            <div style={{ padding: movil ? '24px 0 6px 16px' : '40px 0 10px 34px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, paddingRight: movil ? 16 : 34, marginBottom: 14 }}>
                <h2 style={{ fontFamily: t.fh, fontSize: movil ? 26 : 36, margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{nombre}</h2>
                <span style={{ fontSize: 11.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.14em' }}>{18 + di * 7} artículos</span>
                {!movil && <span style={{ marginLeft: 'auto', fontSize: 12, color: t.primary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ver todo →</span>}
              </div>
              <Tira gap={10}>
                {fotos.map((src, i) => (
                  <div key={src + i} className="pl-tile" style={{ flex: `0 0 ${movil ? '75%' : '32%'}`, scrollSnapAlign: 'start', position: 'relative' }}>
                    <Foto src={src} alto={movil ? 200 : 280} radio={t.radio} />
                    <span style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(10,10,10,0.82)', color: t.primary, fontSize: 10.5, fontWeight: 700, padding: '5px 11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: t.fh }}>{nombre} 0{i + 1}</span>
                  </div>
                ))}
              </Tira>
            </div>
          </Reveal>
        ))}

        <Reveal>
          <div style={{ padding: movil ? '20px 16px 28px' : '34px 34px 48px' }}>
            <Titulo t={t} volanta="Equipate" texto="Lo nuevo de la temporada" accion="Ver todo →" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 10 : 14 }}>
              {p.productos.map((x) => (
                <div key={x.nombre} className="pl-card" style={{ background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
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
            {([['+2.400', 'km este mes'], ['1.180', 'corredores'], ['48 hs', 'de entrega'], ['4,9', 'de puntaje']] as [string, string][]).map(([n, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 28 : 42, fontWeight: 700, letterSpacing: '-0.02em' }}>{n}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 600, marginTop: 6, opacity: 0.75 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre="Entrenamos todos los días"
          columnas={[['Disciplinas', ['Running', 'Fuerza', 'Ciclismo', 'Outdoor']], ['Ayuda', ['Guía de talles', 'Cambios', 'Envíos']], ['Nosotros', ['La marca', 'Equipo', 'Contacto']]]} />
      </div>
    )
  }

  // ── PATITAS ───────────────────────────────────────────────────────────────
  // La compra arranca por la mascota, no por la categoría: tres círculos
  // grandes reemplazan al menú: se compra pensando en el animal, no en la
  // categoría.
  if (p.layout === 'patitas') {
    const s = p.slides[0]
    return (
      <div style={marco}>
        <div style={{ background: t.soft, textAlign: 'center', padding: '9px 12px', fontSize: 12, fontWeight: 700, color: t.primary }}>
          ✦ Envío en el día en CABA comprando antes de las 14 ✦
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: movil ? '13px 16px' : '16px 32px', background: t.surf, borderBottom: `1px solid ${t.border}` }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: t.primary, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 17 }}>🐾</span>
            <span style={{ fontFamily: t.fh, fontSize: movil ? 21 : 26, fontWeight: 800, letterSpacing: '-0.02em', color: t.text }}>{p.marca}</span>
          </span>
          {!movil && (
            <div style={{ display: 'flex', gap: 22, fontSize: 13.5, fontWeight: 600, color: t.muted }}>
              {['Perros', 'Gatos', 'Alimento', 'Juguetes', 'Farmacia'].map((l) => <span key={l}>{l}</span>)}
            </div>
          )}
          <span style={{ marginLeft: 'auto' }}><AccionesTienda t={t} movil={movil} /></span>
        </div>

        <div style={{ background: `linear-gradient(160deg, ${t.soft} 0%, ${t.bg} 60%)` }}>
          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', gap: movil ? 22 : 36, padding: movil ? '28px 20px' : '52px 40px', alignItems: 'center' }}>
            <div style={{ order: movil ? 2 : 1 }}>
              <div style={{ display: 'inline-block', background: t.accent, color: '#fff', fontSize: 11.5, fontWeight: 800, padding: '6px 14px', borderRadius: 999, marginBottom: 16 }}>{s.kicker}</div>
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 36 : 52, lineHeight: 1.08, margin: 0, whiteSpace: 'pre-line', fontWeight: 800, letterSpacing: '-0.03em' }}>{s.titulo}</h1>
              <p style={{ fontSize: 15, color: t.muted, margin: '16px 0 24px', lineHeight: 1.7, maxWidth: 400 }}>{s.bajada}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Boton t={t} grande>{s.cta}</Boton>
                <Boton t={t} secundario grande>Ver el plan mensual</Boton>
              </div>
            </div>
            <div style={{ order: movil ? 1 : 2, borderRadius: 32, overflow: 'hidden', boxShadow: t.sombra }}>
              <Foto src={s.img} alto={movil ? 260 : 400} radio={32} />
            </div>
          </div>
        </div>

        {/* El selector que reemplaza al menú de categorías. */}
        <Reveal>
          <div style={{ padding: movil ? '26px 16px' : '46px 40px' }}>
            <Titulo t={t} centrado volanta="Empecemos por acá" texto="¿Para quién comprás?" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: movil ? 12 : 26, maxWidth: 720, margin: '0 auto' }}>
              {([['Perro', `${IMG}/masc-perro.jpg`, '412 productos'], ['Gato', `${IMG}/masc-gato.jpg`, '268 productos'], ['Otros', `${IMG}/masc-hamster.jpg`, '94 productos']] as [string, string, string][]).map(([n, src, c]) => (
                <div key={n} className="pl-card" style={{ textAlign: 'center' }}>
                  <div className="pl-tile" style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', border: `4px solid ${t.surf}`, boxShadow: t.sombra }}>
                    <Foto src={src} alto="100%" />
                  </div>
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 16 : 21, fontWeight: 800, marginTop: 14 }}>{n}</div>
                  <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{c}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ padding: movil ? '4px 16px 26px' : '10px 40px 44px' }}>
            <Titulo t={t} volanta="Recomendados" texto="Lo que más eligen" accion="Ver todo →" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 12 : 18 }}>
              {p.productos.map((x) => <Card key={x.nombre} p={x} t={t} alto={movil ? 145 : 200} />)}
            </div>
          </div>
        </Reveal>

        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre="Atendemos de lunes a sábado"
          columnas={[['Comprar', ['Perros', 'Gatos', 'Otras mascotas', 'Farmacia']], ['Planes', ['Suscripción', 'Cómo funciona', 'Cancelar']], ['Ayuda', ['Envíos', 'Cambios', 'WhatsApp']]]} />
      </div>
    )
  }

  // ── BODEGA ────────────────────────────────────────────────────────────────
  // Borgoña, serif y carta de restaurante: el corazón es una LISTA de
  // varietales sin una sola foto, que es como se elige un vino. Las botellas
  // van altas y angostas sobre tarjetas crema, para que recorten del fondo.
  if (p.layout === 'bodega') {
    const s = p.slides[0]
    const varietales: [string, string, string, string][] = [
      ['Malbec', 'Valle de Uco · Luján de Cuyo', '34 etiquetas', 'desde $18.900'],
      ['Cabernet Franc', 'Agrelo · Paraje Altamira', '12 etiquetas', 'desde $24.500'],
      ['Pinot Noir', 'Patagonia · Valle de Uco', '9 etiquetas', 'desde $28.400'],
      ['Chardonnay', 'Tupungato · Chapadmalal', '15 etiquetas', 'desde $16.200'],
      ['Blends de autor', 'Todo el país', '21 etiquetas', 'desde $31.000'],
    ]
    return (
      <div style={marco}>
        <div style={{ textAlign: 'center', padding: '9px 12px', fontSize: 10.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: t.primary, borderBottom: `1px solid ${t.border}` }}>
          Envío refrigerado · Retiro en la vinoteca · Venta a mayores de 18
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: movil ? 'auto 1fr auto' : '1fr auto 1fr', alignItems: 'center', padding: movil ? '15px 16px' : '24px 44px', borderBottom: `1px solid ${t.border}`, gap: 14 }}>
          {movil ? <span style={{ fontSize: 18, color: t.primary }}>☰</span> : <span style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.muted }}>⌕ Buscar etiqueta</span>}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: t.fh, fontSize: movil ? 26 : 38, fontWeight: 400, letterSpacing: '0.24em', textTransform: 'uppercase', color: t.primary }}>{p.marca}</div>
            {!movil && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 26, marginTop: 10, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.muted }}>
                {['Tintos', 'Blancos', 'Espumantes', 'Cajas', 'Bodegas'].map((l) => <span key={l}>{l}</span>)}
              </div>
            )}
          </div>
          <span style={{ justifySelf: 'end' }}><AccionesTienda t={t} movil={movil} /></span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', alignItems: 'stretch' }}>
          <div style={{ padding: movil ? '32px 22px' : '70px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'center', order: movil ? 2 : 1 }}>
            <div style={{ width: 44, height: 1, background: t.primary, marginBottom: 20 }} />
            <div style={{ fontSize: 10.5, letterSpacing: '0.28em', textTransform: 'uppercase', color: t.primary, marginBottom: 18 }}>{s.kicker}</div>
            <h1 style={{ fontFamily: t.fh, fontSize: movil ? 40 : 62, lineHeight: 1.02, margin: 0, whiteSpace: 'pre-line', fontWeight: 400, letterSpacing: '-0.015em' }}>{s.titulo}</h1>
            <p style={{ fontSize: 14.5, color: t.muted, margin: '24px 0 30px', lineHeight: 1.9, maxWidth: 400 }}>{s.bajada}</p>
            <span style={{ fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, color: t.primary, borderBottom: `1px solid ${t.primary}`, paddingBottom: 6, alignSelf: 'flex-start' }}>{s.cta}</span>
          </div>
          <div style={{ order: movil ? 1 : 2 }}><Foto src={s.img} alto={movil ? 300 : 560} /></div>
        </div>

        {/* La carta de varietales: puro texto, sin una sola foto. */}
        <Reveal>
          <div style={{ padding: movil ? '32px 22px' : '64px 52px', borderTop: `1px solid ${t.border}` }}>
            <Titulo t={t} volanta="La carta" texto="Elegí por varietal" accion="Ver las 91 etiquetas →" movil={movil} />
            <div>
              {varietales.map(([nombre, region, cant, desde]) => (
                <div key={nombre} className="pl-fila" style={{ display: 'grid', gridTemplateColumns: movil ? '1fr auto' : '1.1fr 1.4fr auto auto', gap: movil ? 6 : 24, alignItems: 'baseline', padding: movil ? '16px 0' : '20px 0', borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ fontFamily: t.fh, fontSize: movil ? 22 : 30, fontWeight: 400 }}>{nombre}</span>
                  {!movil && <span style={{ fontSize: 13, color: t.muted, letterSpacing: '0.03em' }}>{region}</span>}
                  {!movil && <span style={{ fontSize: 12, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{cant}</span>}
                  <span style={{ fontSize: movil ? 13 : 14.5, color: t.primary, justifySelf: 'end', whiteSpace: 'nowrap' }}>{desde}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Botellas: altas y angostas, sobre crema para que recorten. */}
        <Reveal>
          <div style={{ padding: movil ? '10px 22px 34px' : '20px 52px 60px' }}>
            <Titulo t={t} volanta="Selección del mes" texto="Tres para empezar" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(3, 1), gap: movil ? 18 : 26 }}>
              {p.productos.slice(0, 3).map((x) => (
                <div key={x.nombre} className="pl-card" style={{ background: '#F3EADF', padding: movil ? 18 : 24, textAlign: 'center', color: '#2A1A14' }}>
                  <div style={{ margin: '0 auto', maxWidth: movil ? 200 : 230 }}>
                    <Foto src={x.img} src2={x.img2} alto={movil ? 300 : 380} />
                  </div>
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 21 : 25, marginTop: 18 }}>{x.nombre}</div>
                  <div style={{ fontSize: 11.5, color: '#7A6355', marginTop: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{x.tag}</div>
                  {x.estrellas && <div style={{ marginTop: 10, color: '#7A6355' }}><Estrellas n={x.estrellas} resenas={x.resenas} color={t.accent} /></div>}
                  <div style={{ fontSize: 19, marginTop: 10, fontWeight: 700 }}>{x.precio}</div>
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
            <Titulo t={t} centrado volanta="Para acompañar" texto="Maridajes que funcionan" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(3, 1), gap: movil ? 16 : 24 }}>
              {([['Asado y achuras', 'Malbec joven o Bonarda. Fruta y poca madera para no tapar la carne.'], ['Pastas con salsa roja', 'Sangiovese o un blend liviano. Acidez que corte el tomate.'], ['Quesos duros', 'Cabernet Franc con guarda, o un espumante nature bien frío.']] as [string, string][]).map(([tit, txt]) => (
                <div key={tit} style={{ background: t.soft, padding: movil ? 20 : 26 }}>
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 20 : 24, color: t.primary, marginBottom: 10 }}>{tit}</div>
                  <div style={{ fontSize: 13.5, color: t.muted, lineHeight: 1.8 }}>{txt}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre="Vinoteca en Palermo · Beber con moderación"
          columnas={[['Vinos', ['Tintos', 'Blancos', 'Espumantes', 'Naranjos']], ['Cajas', ['Regalos', 'Empresas']], ['Ayuda', ['Envíos', 'Devoluciones', 'Contacto']]]} />
      </div>
    )
  }

  // ── CRECER ────────────────────────────────────────────────────────────────
  // Acá no se navega por categoría sino por EDAD: es como compra el que
  // regala ("tiene ocho meses"). La línea de tiempo horizontal reemplaza al
  // menú, y hay un armador de lista de regalos para baby shower.
  if (p.layout === 'crecer') {
    const s = p.slides[0]
    const edades: [string, string][] = [
      ['0 a 6 m', `${IMG}/bebe-pies.jpg`],
      ['6 a 12 m', `${IMG}/bebe-oso.jpg`],
      ['1 a 2 años', `${IMG}/bebe-juguetes.jpg`],
      ['2 a 4 años', `${IMG}/bebe-nena.jpg`],
    ]
    return (
      <div style={marco}>
        <div style={{ background: t.soft, textAlign: 'center', padding: '9px 12px', fontSize: 12, color: t.text, fontWeight: 600 }}>
          Algodón orgánico certificado · Cambios sin cargo dentro de los 30 días
        </div>
        <div style={{ textAlign: 'center', padding: movil ? '15px 16px' : '20px 34px 16px', background: t.surf, borderBottom: `1px solid ${t.border}`, position: 'relative' }}>
          <div style={{ fontFamily: t.fh, fontSize: movil ? 25 : 32, fontWeight: 700, letterSpacing: '0.04em', color: t.primary }}>{p.marca}</div>
          {!movil && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 26, marginTop: 12, fontSize: 13.5, color: t.muted, fontWeight: 600 }}>
              {['Ropa', 'Juguetes', 'Habitación', 'Paseo', 'Regalos'].map((l) => <span key={l}>{l}</span>)}
            </div>
          )}
          <span style={{ position: 'absolute', right: movil ? 16 : 34, top: movil ? 14 : 22 }}><AccionesTienda t={t} movil={movil} /></span>
        </div>

        <div style={{ background: `linear-gradient(150deg, ${t.soft} 0%, ${t.bg} 55%)`, padding: movil ? '30px 20px' : '56px 44px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', gap: movil ? 24 : 40, alignItems: 'center' }}>
            <div style={{ order: movil ? 2 : 1 }}>
              <div style={{ display: 'inline-block', background: t.accent, color: '#5C3A2C', fontSize: 11.5, fontWeight: 700, padding: '6px 15px', borderRadius: 999, marginBottom: 18 }}>{s.kicker}</div>
              <h1 style={{ fontFamily: t.fh, fontSize: movil ? 36 : 52, lineHeight: 1.1, margin: 0, whiteSpace: 'pre-line', fontWeight: 700, letterSpacing: '-0.02em' }}>{s.titulo}</h1>
              <p style={{ fontSize: 15, color: t.muted, margin: '18px 0 26px', lineHeight: 1.8, maxWidth: 400 }}>{s.bajada}</p>
              <Boton t={t} grande>{s.cta}</Boton>
            </div>
            <div style={{ order: movil ? 1 : 2, borderRadius: movil ? 28 : 40, overflow: 'hidden', boxShadow: t.sombra }}>
              <Foto src={s.img} alto={movil ? 270 : 420} radio={movil ? 28 : 40} />
            </div>
          </div>
        </div>

        {/* La línea de tiempo por edad, que reemplaza al menú de categorías. */}
        <Reveal>
          <div style={{ padding: movil ? '30px 16px' : '52px 44px' }}>
            <Titulo t={t} centrado volanta="Comprá por edad" texto="¿Cuántos meses tiene?" movil={movil} />
            <div style={{ position: 'relative', marginTop: 26 }}>
              <div style={{ position: 'absolute', left: '12%', right: '12%', top: movil ? 40 : 56, height: 2, background: t.border }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: movil ? 8 : 20, position: 'relative' }}>
                {edades.map(([n, src], i) => (
                  <div key={n} className="pl-card" style={{ textAlign: 'center' }}>
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
            <Titulo t={t} volanta="Para 6 a 12 meses" texto="Lo más elegido" accion="Ver todo →" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 12 : 18 }}>
              {p.productos.map((x) => <Card key={x.nombre} p={x} t={t} alto={movil ? 150 : 210} />)}
            </div>
          </div>
        </Reveal>

        <div style={{ padding: movil ? '24px 16px' : '38px 44px', borderTop: `1px solid ${t.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 20 }}>
            {([['Algodón orgánico', 'certificado GOTS'], ['Sin tóxicos', 'pinturas al agua'], ['Costuras planas', 'no marcan la piel'], ['Cambios', 'sin cargo 30 días']] as [string, string][]).map(([a, b]) => (
              <div key={a} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: t.fh, fontSize: movil ? 15 : 18, fontWeight: 700, color: t.primary }}>{a}</div>
                <div style={{ fontSize: 12.5, color: t.muted, marginTop: 4 }}>{b}</div>
              </div>
            ))}
          </div>
        </div>

        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre="Hecho en Argentina"
          columnas={[['Por edad', ['0 a 6 meses', '6 a 12 meses', '1 a 2 años', '2 a 4 años']], ['Productos', ['Ropa', 'Juguetes', 'Habitación', 'Paseo']], ['Ayuda', ['Cambios', 'Envíos', 'Contacto']]]} />
      </div>
    )
  }

  // ── CIRCUITO ──────────────────────────────────────────────────────────────
  // Tech: la única con el header como PANEL LATERAL fijo — marca, nav vertical
  // y acciones de tienda a la izquierda, todo lo demás scrollea a la derecha.
  // El producto se muestra en fichas partidas (foto a un lado, specs al otro),
  // no en tarjeta, porque acá lo que decide la compra es la ficha técnica.
  if (p.layout === 'circuito') {
    const s = p.slides[0]
    const links = p.links ?? []
    const categorias = p.categorias ?? []

    // En celular el panel no puede quedar fijo al costado: pasa a ser una
    // barra común arriba, con el mismo contenido en una línea.
    const panel = movil ? (
      <div style={{ background: t.surf, borderBottom: `1px solid ${t.border}`, padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: t.fh, fontSize: 19, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>{p.marca}</span>
        <AccionesTienda t={t} movil />
      </div>
    ) : (
      <div style={{ width: 232, flexShrink: 0, borderRight: `1px solid ${t.border}`, background: t.surf, padding: '30px 26px', position: 'sticky', top: 0, alignSelf: 'flex-start' }}>
        <div style={{ fontFamily: t.fh, fontSize: 25, fontWeight: 700, color: t.text, letterSpacing: '-0.03em' }}>{p.marca}</div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 7, lineHeight: 1.5 }}>{p.tagline}</div>
        <div style={{ margin: '26px 0 22px', height: 1, background: t.border }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {links.map((l, i) => (
            <span key={l} style={{ fontSize: 13.5, color: i === 0 ? t.primary : t.text, fontWeight: i === 0 ? 700 : 500 }}>{l}</span>
          ))}
        </div>
        <div style={{ margin: '24px 0 18px', height: 1, background: t.border }} />
        <div style={{ border: `1px solid ${t.border}`, borderRadius: t.radio, padding: '9px 13px', fontSize: 12.5, color: t.muted, background: t.soft }}>Buscar…</div>
        <div style={{ marginTop: 20 }}><AccionesTienda t={t} /></div>
      </div>
    )

    return (
      <div style={marco}>
        {p.cartel && <Marquee t={t} texto={p.cartel} />}
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
                <div style={{ fontSize: movil ? 10.5 : 12, letterSpacing: '0.26em', textTransform: 'uppercase', color: t.primary, fontWeight: 700, marginBottom: 10 }}>{s.kicker}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: movil ? 12 : 20, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: t.fh, fontSize: movil ? 58 : 96, lineHeight: 0.86, fontWeight: 700, color: '#fff', letterSpacing: '-0.05em' }}>{s.titulo}</span>
                  <span style={{ fontSize: movil ? 15 : 21, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{s.bajada}</span>
                </div>
                <div style={{ marginTop: movil ? 18 : 24 }}><Boton t={t} grande={!movil}>{s.cta}</Boton></div>
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
                <Titulo t={t} volanta="Ficha técnica a la vista" texto="Lo que más se vende" accion="Ver el catálogo →" movil={movil} />
                <div style={{ display: 'grid', gap: movil ? 14 : 18 }}>
                  {p.productos.slice(0, 3).map((x) => (
                    <div key={x.nombre} className="pl-card" style={{ display: 'grid', gridTemplateColumns: movil ? '116px 1fr' : '260px 1fr', background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
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
                <Titulo t={t} texto="Por categoría" movil={movil} />
                <div style={{ display: 'grid', gridTemplateColumns: cols(2, 1), gap: 10 }}>
                  {categorias.map(([n, src]) => (
                    <div key={n} className="pl-tile" style={{ display: 'flex', alignItems: 'center', gap: 14, background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
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
                <Titulo t={t} volanta="También te puede servir" texto="Nuevos ingresos" movil={movil} />
                <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 12 : 16 }}>
                  {[...p.productos].reverse().map((x) => <Card key={x.nombre} p={x} t={t} alto={movil ? 140 : 190} />)}
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
                  <div style={{ fontFamily: t.fh, fontSize: movil ? 18 : 22, fontWeight: 700, letterSpacing: '-0.02em' }}>¿Dudas con la compatibilidad?</div>
                  <div style={{ fontSize: 13, color: t.muted, marginTop: 5 }}>Escribinos por WhatsApp y te respondemos en el día.</div>
                </div>
                <Boton t={t} grande>Escribir por WhatsApp</Boton>
              </div>
            </Reveal>

            <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre}
              columnas={p.pie?.columnas ?? []} />
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
    const s = p.slides[0]
    const filete = `1px solid ${t.border}`
    return (
      <div style={marco}>
        <div style={{ textAlign: 'center', padding: '9px 12px', fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.primary, borderBottom: filete, background: t.soft }}>
          {p.cartel?.replace(/✦/g, '·')}
        </div>
        <HeaderCentrado t={t} marca={p.marca} links={p.links ?? []} movil={movil} />

        <div style={{ position: 'relative' }}>
          <Foto src={s.img} alto={movil ? 380 : 500} />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: movil ? 22 : 40, background: 'rgba(251,250,248,0.58)' }}>
            <div>
              <div style={{ width: 34, height: 1, background: t.primary, margin: '0 auto 16px' }} />
              <div style={{ fontSize: movil ? 10 : 11.5, letterSpacing: '0.3em', textTransform: 'uppercase', color: t.primary, fontWeight: 700 }}>{s.kicker}</div>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 64 : 104, lineHeight: 1, fontWeight: 700, color: t.text, letterSpacing: '-0.03em', margin: '14px 0 6px' }}>{s.titulo}</div>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 17 : 24, color: t.text }}>{s.bajada}</div>
              <div style={{ marginTop: movil ? 20 : 28 }}><Boton t={t} grande={!movil}>{s.cta}</Boton></div>
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
            <Titulo t={t} volanta="La colección" texto="Piezas disponibles" centrado movil={movil} />
            <div style={{ borderTop: filete }}>
              {p.productos.map((x, i) => (
                <div key={x.nombre} className="pl-fila" style={{ display: 'grid', gridTemplateColumns: movil ? '28px 84px 1fr' : '58px 132px 1fr auto', alignItems: 'center', gap: movil ? 12 : 22, padding: movil ? '14px 0' : '20px 0', borderBottom: filete }}>
                  <span style={{ fontFamily: t.fh, fontSize: movil ? 15 : 22, color: t.accent }}>{String(i + 1).padStart(2, '0')}</span>
                  <div className="pl-tile"><Foto src={x.img} src2={x.img2} alto={movil ? 84 : 132} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: t.fh, fontSize: movil ? 15 : 21, lineHeight: 1.25 }}>{x.nombre}</div>
                    {x.estrellas && <div style={{ marginTop: 7, color: t.muted }}><Estrellas n={x.estrellas} resenas={x.resenas} color={t.primary} /></div>}
                    {x.badge && <div style={{ marginTop: 8, display: 'inline-block', border: `1px solid ${t.primary}`, color: t.primary, fontSize: 9.5, fontWeight: 700, padding: '3px 9px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{x.badge}</div>}
                    {movil && <div style={{ fontSize: 16, fontWeight: 700, color: t.primary, marginTop: 9 }}>{x.precio}</div>}
                  </div>
                  {!movil && (
                    <div style={{ textAlign: 'right', paddingRight: 4 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: t.primary }}>{x.precio}</div>
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
            <Titulo t={t} texto="Buscá por pieza" centrado movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(2, 1), gap: movil ? 10 : 16 }}>
              {(p.categorias ?? []).map(([n, src]) => (
                <div key={n} className="pl-tile" style={{ display: 'flex', alignItems: 'center', gap: 16, border: filete, background: t.surf }}>
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
              <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 24 }}>¿Dudas con el talle o el grabado?</div>
              <div style={{ fontSize: 13, color: t.muted, marginTop: 6 }}>Escribinos por WhatsApp y te asesoramos antes de encargar.</div>
            </div>
            <Boton t={t} grande>Escribir por WhatsApp</Boton>
          </div>
        </Reveal>

        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} />
      </div>
    )
  }

  // ── COBIJO ────────────────────────────────────────────────────────────────
  // Deco: se compra por AMBIENTE, no por categoría suelta. Por eso el cuerpo
  // son bloques que alternan lado (foto / texto, texto / foto) y cada uno se
  // lleva sus dos productos abajo. El hero no tapa la foto con un degradé:
  // apoya una tarjeta blanca encima, como una revista de decoración.
  if (p.layout === 'cobijo') {
    const s = p.slides[0]
    const cat = p.categorias ?? []
    const ambientes: [string, string, string, typeof p.productos][] = [
      ['El living', 'Sillones, sofás y mesas ratonas que entran por la puerta y duran.', cat[0]?.[1] ?? s.img, p.productos.slice(0, 2)],
      ['La mesa', 'Cerámica esmaltada y textiles de algodón, hechos por talleres de acá.', cat[2]?.[1] ?? s.img, p.productos.slice(2, 4)],
    ]
    return (
      <div style={marco}>
        {p.cartel && <Marquee t={t} texto={p.cartel} />}
        <HeaderCentrado t={t} marca={p.marca} links={p.links ?? []} conBuscador movil={movil} />

        <div style={{ position: 'relative' }}>
          <Foto src={s.img} alto={movil ? 340 : 470} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: movil ? '0 16px 20px' : '0 44px 40px' }}>
            <div style={{ background: t.surf, borderRadius: t.radio, padding: movil ? '20px 22px' : '30px 34px', maxWidth: movil ? '100%' : 430, boxShadow: t.sombra }}>
              <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.primary, fontWeight: 700 }}>{s.kicker}</div>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 46 : 64, lineHeight: 0.95, fontWeight: 700, letterSpacing: '-0.04em', margin: '10px 0 4px' }}>{s.titulo}</div>
              <div style={{ fontFamily: t.fh, fontSize: movil ? 17 : 22, color: t.muted, fontWeight: 500 }}>{s.bajada}</div>
              <div style={{ marginTop: 18 }}><Boton t={t} grande={!movil}>{s.cta}</Boton></div>
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
        {ambientes.map(([titulo, bajada, foto, items], k) => (
          <Reveal key={titulo}>
            <div style={{ padding: movil ? '28px 16px 8px' : '48px 44px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', gap: movil ? 18 : 34, alignItems: 'center' }}>
                <div className="pl-tile" style={{ order: movil ? 1 : k % 2 === 0 ? 1 : 2, borderRadius: t.radio, overflow: 'hidden' }}>
                  <Foto src={foto} alto={movil ? 230 : 340} radio={t.radio} />
                </div>
                <div style={{ order: movil ? 2 : k % 2 === 0 ? 2 : 1 }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.accent, fontWeight: 700, marginBottom: 10 }}>Ambiente {k + 1}</div>
                  <h2 style={{ fontFamily: t.fh, fontSize: movil ? 28 : 40, margin: 0, fontWeight: 700, letterSpacing: '-0.03em' }}>{titulo}</h2>
                  <p style={{ fontSize: 14.5, color: t.muted, lineHeight: 1.75, margin: '14px 0 20px', maxWidth: 400 }}>{bajada}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {items.map((x) => (
                      <div key={x.nombre} className="pl-card" style={{ background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
                        <Foto src={x.img} src2={x.img2} alto={movil ? 108 : 132} />
                        <div style={{ padding: '11px 13px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{x.nombre}</div>
                          <div style={{ fontSize: 15.5, fontWeight: 800, marginTop: 6 }}>{x.precio}</div>
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
            <Titulo t={t} volanta="Todo el catálogo" texto="Comprá por categoría" accion="Ver todo →" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 12 }}>
              {cat.map(([n, src]) => (
                <div key={n} className="pl-tile" style={{ position: 'relative', borderRadius: t.radio }}>
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
              <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 24, fontWeight: 700, letterSpacing: '-0.02em' }}>¿Entra por tu puerta?</div>
              <div style={{ fontSize: 13.5, color: t.muted, marginTop: 6 }}>Mandanos las medidas por WhatsApp y lo chequeamos con vos.</div>
            </div>
            <Boton t={t} grande>Escribir por WhatsApp</Boton>
          </div>
        </Reveal>

        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} />
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
    const s = p.slides[0]
    const extra = p.slides[1] ?? s
    return (
      <div style={marco}>
        {p.cartel && <Marquee t={t} texto={p.cartel} />}
        <HeaderCentrado t={t} marca={p.marca} links={p.links ?? []} movil={movil} />

        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr' }}>
          <div style={{ background: t.soft, padding: movil ? '32px 20px' : '58px 46px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: t.primary, fontWeight: 700 }}>{s.kicker}</div>
            <div style={{ fontFamily: t.fh, fontSize: movil ? 56 : 88, lineHeight: 0.9, fontWeight: 800, letterSpacing: '-0.045em', margin: '14px 0 8px' }}>{s.titulo}</div>
            <div style={{ fontFamily: t.fh, fontSize: movil ? 18 : 26, color: t.muted, fontWeight: 600 }}>{s.bajada}</div>
            <div style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Boton t={t} grande={!movil}>{s.cta}</Boton>
              <Boton t={t} grande={!movil} secundario>Ver todo</Boton>
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
            <Titulo t={t} volanta="Lo esencial" texto="Los que más se repiten" accion="Ver el catálogo →" movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(2, 1), gap: movil ? 12 : 18 }}>
              {p.productos.map((x) => (
                <div key={x.nombre} className="pl-card" style={{ display: 'grid', gridTemplateColumns: movil ? '112px 1fr' : '150px 1fr', background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
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
            <Titulo t={t} texto="Por familia" centrado movil={movil} />
            <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: movil ? 12 : 18 }}>
              {(p.categorias ?? []).map(([n, src]) => (
                <div key={n} className="pl-tile" style={{ textAlign: 'center' }}>
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
              <div style={{ fontFamily: t.fh, fontSize: movil ? 19 : 24, fontWeight: 800, letterSpacing: '-0.02em' }}>¿No sabés cuál te sirve?</div>
              <div style={{ fontSize: 13.5, color: t.muted, marginTop: 6 }}>Contanos tu tipo de piel por WhatsApp y te armamos la rutina.</div>
            </div>
            <Boton t={t} grande>Escribir por WhatsApp</Boton>
          </div>
        </Reveal>

        <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre={p.pie?.cierre} columnas={p.pie?.columnas ?? []} />
      </div>
    )
  }

  // ── GLOW ──────────────────────────────────────────────────────────────────
  // Belleza: degradé rosa, rutina mostrada con PRODUCTOS numerados (no
  // párrafos), antes y después, y galería de Instagram al pie.
  const s = p.slides[0]
  return (
    <div style={marco}>
      <div style={{ background: t.primary, color: '#fff', textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>
        ✦ Envío gratis desde $45.000 · 3 cuotas sin interés
      </div>
      <div style={{ textAlign: 'center', padding: movil ? '14px 16px' : '18px 34px 14px', background: t.surf, borderBottom: `1px solid ${t.border}`, position: 'relative' }}>
        <div style={{ fontFamily: t.fh, fontSize: movil ? 24 : 30, fontWeight: 800, letterSpacing: '-0.03em', color: t.primary }}>{p.marca}</div>
        {!movil && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 26, marginTop: 10, fontSize: 13.5, color: t.text }}>
            {['Rostro', 'Maquillaje', 'Rutinas', 'Sets de regalo'].map((l) => <span key={l}>{l}</span>)}
          </div>
        )}
        <span style={{ position: movil ? 'absolute' : 'absolute', right: movil ? 16 : 34, top: movil ? 16 : 22, display: 'inline-flex' }}>
          <AccionesTienda t={t} movil={movil} />
        </span>
      </div>

      <div style={{ background: `linear-gradient(120deg, ${t.soft} 0%, #FFFFFF 52%, ${t.soft} 100%)` }}>
        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', gap: movil ? 0 : 30, padding: movil ? '30px 20px 0' : '54px 44px', alignItems: 'center' }}>
          <div style={{ order: movil ? 2 : 1, paddingBottom: movil ? 34 : 0 }}>
            <div style={{ fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.primary, fontWeight: 800, marginBottom: 14 }}>{s.kicker}</div>
            <h1 style={{ fontFamily: t.fh, fontSize: movil ? 40 : 62, lineHeight: 1.0, margin: 0, whiteSpace: 'pre-line', fontWeight: 800, letterSpacing: '-0.04em' }}>{s.titulo}</h1>
            <p style={{ fontSize: 15.5, color: t.muted, margin: '18px 0 26px', lineHeight: 1.75, maxWidth: 400 }}>{s.bajada}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Boton t={t} grande>{s.cta}</Boton>
              <Boton t={t} secundario grande>Hacer el test de piel</Boton>
            </div>
          </div>
          <div style={{ order: movil ? 1 : 2 }}><Foto src={s.img} alto={movil ? 280 : 420} radio={t.radio} /></div>
        </div>
      </div>

      {/* Sellos de producto. */}
      <div style={{ background: t.surf, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '16px' : '20px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 14 }}>
          {([['Vegano', 'sin ingredientes animales'], ['Sin crueldad', 'no testeado en animales'], ['Dermatológico', 'testeado en piel sensible'], ['Sin fragancia', 'apto rosácea']] as [string, string][]).map(([a, b]) => (
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
          <Titulo t={t} volanta="Tres pasos" texto="Tu rutina, resuelta" centrado movil={movil} />
          <div style={{ display: 'grid', gridTemplateColumns: cols(3, 1), gap: 18 }}>
            {p.productos.slice(0, 3).map((x, i) => (
              <div key={x.nombre} className="pl-card" style={{ background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden', boxShadow: t.sombra }}>
                <div style={{ position: 'relative' }}>
                  <Foto src={x.img} src2={x.img2} alto={movil ? 210 : 250} />
                  <span style={{ position: 'absolute', top: 14, left: 14, width: 32, height: 32, borderRadius: '50%', background: '#fff', color: t.primary, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800, boxShadow: '0 4px 12px rgba(0,0,0,0.14)' }}>{i + 1}</span>
                </div>
                <div style={{ padding: '15px 16px 18px' }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.primary, fontWeight: 800 }}>{['Limpiar', 'Tratar', 'Hidratar'][i]}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>{x.nombre}</div>
                  <div style={{ marginTop: 6 }}><Estrellas n={x.estrellas ?? 5} resenas={x.resenas} color={t.accent} /></div>
                  <div style={{ fontSize: 19, fontWeight: 800, marginTop: 8 }}>{x.precio}</div>
                  <div style={{ marginTop: 12 }}><Boton t={t} ancho>Agregar</Boton></div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13.5, color: t.muted }}>
            Los tres juntos: <strong style={{ color: t.text }}>$68.900</strong> en vez de $77.400
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div style={{ background: t.soft, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '32px 16px' : '52px 40px' }}>
          <Titulo t={t} volanta="Se llevan todo" texto="Las más elegidas" accion="Ver todo →" movil={movil} />
          <div style={{ display: 'grid', gridTemplateColumns: cols(4, 2), gap: 16 }}>
            {p.productos.map((x) => (
              <div key={x.nombre} className="pl-card" style={{ background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, overflow: 'hidden' }}>
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
          <Titulo t={t} volanta="Ocho semanas" texto="Antes y después" centrado movil={movil} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, maxWidth: 760, margin: '0 auto', borderRadius: t.radio, overflow: 'hidden' }}>
            {([['Antes', `${IMG}/belleza-spa.jpg`], ['Después', `${IMG}/belleza-labial.jpg`]] as [string, string][]).map(([l, src]) => (
              <div key={l} style={{ position: 'relative' }}>
                <Foto src={src} alto={movil ? 200 : 300} radio={0} />
                <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.94)', color: t.text, fontSize: 11.5, fontWeight: 800, padding: '5px 12px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</span>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: t.muted, marginTop: 14 }}>
            Resultados sobre 240 personas, uso diario durante ocho semanas. Fotos sin retoque.
          </p>
        </div>
      </Reveal>

      {/* Galería de Instagram. */}
      <Reveal>
        <div style={{ padding: movil ? '0 0 30px' : '0 0 44px' }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 11.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.primary, fontWeight: 800 }}>@aura.skincare</div>
            <div style={{ fontFamily: t.fh, fontSize: movil ? 21 : 26, fontWeight: 800, marginTop: 6, letterSpacing: '-0.02em' }}>Seguinos en Instagram</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: cols(6, 3), gap: 3 }}>
            {[`${IMG}/belleza-maquillaje.jpg`, `${IMG}/belleza-paletas.jpg`, `${IMG}/belleza-manos.jpg`, `${IMG}/belleza-coral.jpg`, `${IMG}/belleza-cosmetica.jpg`, `${IMG}/belleza-spa.jpg`].map((src, i) => (
              <div key={i} className="pl-tile"><Foto src={src} alto={movil ? 110 : 165} radio={0} /></div>
            ))}
          </div>
        </div>
      </Reveal>

      <Pie t={t} marca={p.marca} tagline={p.tagline} movil={movil} cierre="Elaborado en Argentina"
        columnas={[['Productos', ['Rostro', 'Maquillaje', 'Sets', 'Rutinas']], ['Conocenos', ['Ingredientes', 'Nuestra historia', 'Sustentabilidad']], ['Ayuda', ['Envíos', 'Cambios', 'Contacto']]]} />
    </div>
  )
}
