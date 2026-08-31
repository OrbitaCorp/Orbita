import { useEffect, useRef, useState } from 'react'
import { User, Package, ShoppingBag } from 'lucide-react'
import type { Producto, Slide, Tema } from './tipos'

// ─── CSS ─────────────────────────────────────────────────────────────────────
//
// Hover, animaciones y reveal necesitan clases: no se pueden hacer con estilos
// inline, que es como está escrito el resto del panel.
export const CSS = `
@keyframes pl-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes pl-fade { from { opacity: 0 } to { opacity: 1 } }
.pl-marquee-track { display: inline-flex; white-space: nowrap; animation: pl-marquee 26s linear infinite; }

.pl-card { transition: transform .38s cubic-bezier(.2,.7,.3,1), box-shadow .38s; }
.pl-card:hover { transform: translateY(-7px); }
.pl-media { position: relative; overflow: hidden; }
.pl-media img { transition: transform .8s cubic-bezier(.2,.7,.3,1), opacity .55s; }
.pl-card:hover .pl-media .pl-a { transform: scale(1.06); }
.pl-media .pl-b { position: absolute; inset: 0; opacity: 0; }
.pl-card:hover .pl-media .pl-b { opacity: 1; }

.pl-tile { position: relative; overflow: hidden; }
.pl-tile img { transition: transform .9s cubic-bezier(.2,.7,.3,1); }
.pl-tile:hover img { transform: scale(1.07); }

.pl-reveal { opacity: 0; transform: translateY(22px); transition: opacity .8s ease, transform .8s cubic-bezier(.2,.7,.3,1); }
.pl-reveal.pl-on { opacity: 1; transform: none; }

.pl-swatch { transition: transform .2s, box-shadow .2s; }
.pl-swatch:hover { transform: scale(1.22); }

.pl-cta { transition: transform .25s, box-shadow .25s, opacity .25s; }
.pl-cta:hover { transform: translateY(-2px); }

.pl-slide { animation: pl-fade .9s ease both; }

.pl-fila { transition: padding-left .28s cubic-bezier(.2,.7,.3,1); }
.pl-fila:hover { padding-left: 12px; }
`

// ─── Piezas ──────────────────────────────────────────────────────────────────

// La vista previa scrollea DENTRO de su marco, no con la página. Un
// IntersectionObserver con root null mira el viewport del navegador y deja
// secciones enteras invisibles ahí adentro, así que el observador tiene que
// apuntar al contenedor que realmente scrollea.
//
// Y por las dudas hay un temporizador de respaldo: en una presentación, una
// sección que no aparece es mucho peor que una que aparece sin animación.
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let n = el?.parentElement ?? null
  while (n) {
    const ov = getComputedStyle(n).overflowY
    if (ov === 'auto' || ov === 'scroll') return n
    n = n.parentElement
  }
  return null
}

// Las plantillas usan tipografías que NO están en lib/fonts.ts a propósito:
// esa lista es la que el dueño puede elegir para SU tienda en Apariencia, y no
// hay por qué ensuciarla con las fuentes de muestra de una vitrina. Además
// varias plantillas piden pesos (800/900) que aquellos specs no traen, así que
// acá se pide exactamente lo que se usa, una sola vez por familia.
const FUENTES_PLANTILLAS = [
  'Playfair+Display:wght@400;600;800',
  'Lato:wght@400;700',
  'Inter:wght@400;600;700;800',
  'Montserrat:wght@400;600;800;900',
  'Poppins:wght@400;600;700;800',
  'Cormorant+Garamond:wght@400;500;600;700',
  'Oswald:wght@400;500;600;700',
  'Nunito:wght@400;600;700;800',
  'Quicksand:wght@400;500;600;700',
]

export function cargarFuentes() {
  if (typeof document === 'undefined') return
  for (const spec of FUENTES_PLANTILLAS) {
    const id = 'pl-font-' + spec.replace(/\W/g, '')
    if (document.getElementById(id)) continue
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
    document.head.appendChild(link)
  }
}

export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const mostrar = () => el.classList.add('pl-on')
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { mostrar(); io.disconnect() } },
      { threshold: 0.05, root: scrollParent(el), rootMargin: '0px 0px -30px 0px' },
    )
    io.observe(el)
    const respaldo = setTimeout(mostrar, 2500)
    return () => { io.disconnect(); clearTimeout(respaldo) }
  }, [])
  return <div ref={ref} className="pl-reveal" style={{ transitionDelay: `${delay}ms` }}>{children}</div>
}

// Foto con degradé de respaldo: si el archivo faltara, queda un color sólido y
// no un cuadro roto (pedido explícito del dueño).
export function Foto({ src, src2, alto, radio, fit = 'cover' }: { src: string; src2?: string; alto: number | string; radio?: number; fit?: 'cover' | 'contain' }) {
  return (
    <div className="pl-media" style={{ height: alto, borderRadius: radio ?? 0, background: '#E7E5E4' }}>
      <img className="pl-a" src={src} alt="" style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }} />
      {src2 && <img className="pl-b" src={src2} alt="" style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }} />}
    </div>
  )
}

export const TONOS: Record<string, string> = { azul: '#1E3A8A', violeta: '#6D28D9', verde: '#065F46', rojo: '#B91C1C' }

export function Estrellas({ n = 5, resenas, color }: { n?: number; resenas?: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ color, letterSpacing: '0.06em' }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
      {resenas !== undefined && <span style={{ color: 'inherit', opacity: 0.6 }}>({resenas})</span>}
    </span>
  )
}

export function Card({ p, t, sangre, alto = 300 }: { p: Producto; t: Tema; sangre?: boolean; alto?: number }) {
  return (
    <div
      className="pl-card"
      style={{
        background: t.surf,
        border: sangre ? 'none' : `1px solid ${t.border}`,
        borderRight: sangre ? `1px solid ${t.border}` : undefined,
        borderRadius: sangre ? 0 : t.radio,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative' }}>
        <Foto src={p.img} src2={p.img2} alto={alto} />
        {p.badge && (
          <span style={{ position: 'absolute', top: 12, right: 12, background: TONOS[p.badgeTono ?? 'azul'], color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 7, boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }}>{p.badge}</span>
        )}
        {p.tag && (
          <span style={{ position: 'absolute', bottom: 12, left: 12, border: `1px solid ${t.text}`, color: t.text, background: t.surf, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5 }}>{p.tag}</span>
        )}
        {p.stock && (
          <span style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(185,28,28,0.94)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 5 }}>{p.stock}</span>
        )}
      </div>
      <div style={{ padding: sangre ? '14px 16px 20px' : 14, display: 'flex', flexDirection: 'column', gap: 6, color: t.text }}>
        {p.estrellas && <Estrellas n={p.estrellas} resenas={p.resenas} color={t.accent} />}
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{p.nombre}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {p.antes && <span style={{ fontSize: 12.5, color: t.muted, textDecoration: 'line-through' }}>{p.antes}</span>}
          <span style={{ fontSize: 18, fontWeight: 800 }}>{p.precio}</span>
        </div>
        {p.transfer && <div style={{ fontSize: 11.5, color: t.muted, lineHeight: 1.4 }}>{p.transfer}</div>}
        {p.cuotas && <div style={{ fontSize: 12, fontWeight: 600 }}>{p.cuotas}</div>}
        {p.colores && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {p.colores.map((c) => (
              <span key={c} className="pl-swatch" style={{ width: 15, height: 15, borderRadius: '50%', background: c, border: `1px solid ${t.border}`, cursor: 'pointer' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function Boton({ t, children, grande, secundario, ancho }: { t: Tema; children: React.ReactNode; grande?: boolean; secundario?: boolean; ancho?: boolean }) {
  return (
    <span
      className="pl-cta"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: grande ? '15px 34px' : '11px 22px',
        borderRadius: t.radio === 0 ? 0 : 999,
        background: secundario ? 'transparent' : t.primary,
        color: secundario ? t.text : t.onPrimary,
        border: secundario ? `1px solid ${t.border}` : 'none',
        fontSize: grande ? 14.5 : 13.5, fontWeight: 700, fontFamily: t.fb, whiteSpace: 'nowrap',
        boxShadow: secundario ? 'none' : t.sombra,
        width: ancho ? '100%' : undefined, cursor: 'pointer',
      }}
    >{children}</span>
  )
}

export function Titulo({ t, volanta, texto, centrado, accion, movil }: { t: Tema; volanta?: string; texto: string; centrado?: boolean; accion?: string; movil?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 20, ...(centrado ? { flexDirection: 'column', alignItems: 'center', textAlign: 'center' } : {}) }}>
      <div>
        {volanta && <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.primary, fontWeight: 700, marginBottom: 7 }}>{volanta}</div>}
        <h2 style={{ fontFamily: t.fh, fontSize: movil ? 22 : 28, margin: 0, fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.18 }}>{texto}</h2>
      </div>
      {accion && !centrado && !movil && <span style={{ marginLeft: 'auto', fontSize: 13, color: t.primary, fontWeight: 600 }}>{accion}</span>}
    </div>
  )
}

export function Marquee({ t, texto }: { t: Tema; texto: string }) {
  const bloque = `${texto}   `
  return (
    <div style={{ background: t.text, color: t.bg, padding: '9px 0', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', overflow: 'hidden' }}>
      <div className="pl-marquee-track">
        <span>{bloque.repeat(10)}</span><span>{bloque.repeat(10)}</span>
      </div>
    </div>
  )
}

// Acciones de cuenta y carrito. Son las MISMAS en las seis plantillas a
// propósito: lo que cambia es la portada, no la forma de entrar a la cuenta ni
// de comprar. Replican lo que ya hace StorefrontHeader en la tienda real
// (ingresar / mis pedidos / carrito con contador), pintadas con el tema de
// cada plantilla para que no se vean pegadas encima.
export function AccionesTienda({ t, movil, items = 2 }: { t: Tema; movil?: boolean; items?: number }) {
  const redondeo = t.radio === 0 ? 4 : 999
  const globo = (
    <span style={{
      position: 'absolute', top: -6, right: -8, minWidth: 16, height: 16, padding: '0 4px',
      background: t.primary, color: t.onPrimary, borderRadius: 999, fontSize: 10, fontWeight: 800,
      display: 'grid', placeItems: 'center', lineHeight: 1,
    }}>{items}</span>
  )

  if (movil) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 15, color: t.text }}>
        <User size={18} strokeWidth={1.6} />
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <ShoppingBag size={18} strokeWidth={1.6} />
          {globo}
        </span>
      </span>
    )
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 15, fontSize: 12.5, color: t.muted, fontFamily: t.fb, whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Package size={14} strokeWidth={1.7} /> Mis pedidos
      </span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, color: t.text, fontWeight: 600,
        border: `1px solid ${t.border}`, borderRadius: redondeo, padding: '6px 13px',
      }}>
        <User size={13} strokeWidth={2} /> Ingresar
      </span>
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', color: t.text }}>
        <ShoppingBag size={17} strokeWidth={1.7} />
        {globo}
      </span>
    </span>
  )
}

export function HeaderCentrado({ t, marca, links, conBuscador, movil }: { t: Tema; marca: string; links: string[]; conBuscador?: boolean; movil?: boolean }) {
  if (movil) {
    return (
      <div style={{ borderBottom: `1px solid ${t.border}`, background: t.surf, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18 }}>☰</span>
        <span style={{ fontFamily: t.fh, fontSize: 19, fontWeight: 800, color: t.text }}>{marca}</span>
        <AccionesTienda t={t} movil />
      </div>
    )
  }
  return (
    <div style={{ borderBottom: `1px solid ${t.border}`, background: t.surf }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '16px 28px 12px', gap: 20 }}>
        {conBuscador ? (
          <div style={{ border: `1px solid ${t.border}`, borderRadius: t.radio === 0 ? 6 : 999, padding: '8px 14px', fontSize: 12.5, color: t.muted, maxWidth: 230, display: 'flex', justifyContent: 'space-between' }}>
            <span>¿Qué estás buscando?</span><span>⌕</span>
          </div>
        ) : <span />}
        <span style={{ fontFamily: t.fh, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: t.text }}>{marca}</span>
        <span style={{ justifySelf: 'end' }}><AccionesTienda t={t} /></span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 26, padding: '0 28px 14px', fontSize: 13.5, color: t.text }}>
        {links.map((l) => <span key={l}>{l}</span>)}
      </div>
    </div>
  )
}

export function HeaderLateral({ t, marca, links, conBuscador, movil }: { t: Tema; marca: string; links: string[]; conBuscador?: boolean; movil?: boolean }) {
  if (movil) {
    return (
      <div style={{ borderBottom: `1px solid ${t.border}`, background: t.surf, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18 }}>☰</span>
        <span style={{ fontFamily: t.fh, fontSize: 18, fontWeight: 800, color: t.text }}>{marca}</span>
        <AccionesTienda t={t} movil />
      </div>
    )
  }
  return (
    <div style={{ padding: '16px 32px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 28, background: t.surf }}>
      <span style={{ fontFamily: t.fh, fontSize: 21, fontWeight: 800, color: t.text, letterSpacing: '-0.015em' }}>{marca}</span>
      <div style={{ display: 'flex', gap: 22, fontSize: 13.5, color: t.muted }}>{links.map((l) => <span key={l}>{l}</span>)}</div>
      {conBuscador && (
        <div style={{ marginLeft: 'auto', minWidth: 240, border: `1px solid ${t.border}`, borderRadius: t.radio === 0 ? 6 : 999, padding: '8px 14px', fontSize: 12.5, color: t.muted, background: t.soft }}>Buscar productos…</div>
      )}
      <span style={{ marginLeft: conBuscador ? 18 : 'auto' }}><AccionesTienda t={t} /></span>
    </div>
  )
}

// Carrusel del hero: avanza solo, con dots. Con un solo slide no arranca el
// intervalo (no tiene a dónde ir) y los dots no se dibujan.
export function Carrusel({ t, slides, movil, alto }: { t: Tema; slides: Slide[]; movil?: boolean; alto: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (slides.length < 2) return
    const id = setInterval(() => setI((v) => (v + 1) % slides.length), 4200)
    return () => clearInterval(id)
  }, [slides.length])
  const s = slides[i]
  return (
    <div style={{ position: 'relative', height: alto, overflow: 'hidden', background: t.text }}>
      <img key={s.img} className="pl-slide" src={s.img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: movil ? 'linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0.15))' : 'linear-gradient(100deg, rgba(255,255,255,0.86) 0%, rgba(255,255,255,0.5) 34%, transparent 62%)' }} />
      <div key={`c${i}`} className="pl-slide" style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: movil ? '0 22px' : '0 58px', maxWidth: movil ? undefined : 760 }}>
        {s.kicker && (
          <div style={{ fontSize: movil ? 11 : 14, letterSpacing: '0.3em', textTransform: 'uppercase', color: movil ? 'rgba(255,255,255,0.9)' : t.text, fontWeight: 700, marginBottom: 8 }}>{s.kicker}</div>
        )}
        <div style={{ fontFamily: t.fh, fontSize: movil ? 62 : 132, lineHeight: 0.88, fontWeight: 800, color: movil ? '#fff' : t.text, letterSpacing: '-0.045em', whiteSpace: 'pre-line' }}>{s.titulo}</div>
        <div style={{ fontFamily: t.fh, fontSize: movil ? 20 : 40, fontWeight: 600, color: movil ? 'rgba(255,255,255,0.95)' : t.text, letterSpacing: '-0.02em', marginTop: 6 }}>{s.bajada}</div>
        <div style={{ marginTop: movil ? 18 : 28 }}>
          <span style={{ fontSize: movil ? 13 : 15, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: movil ? '#fff' : t.text, borderBottom: `2px solid ${movil ? '#fff' : t.text}`, paddingBottom: 4 }}>{s.cta}</span>
        </div>
      </div>
      {slides.length > 1 && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 7 }}>
          {slides.map((_, k) => (
            <span key={k} style={{ width: k === i ? 24 : 8, height: 8, borderRadius: 999, background: k === i ? '#fff' : 'rgba(255,255,255,0.55)', transition: 'width .35s, background .35s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
          ))}
        </div>
      )}
    </div>
  )
}

export function Beneficios({ t, items, movil }: { t: Tema; items: [string, string][]; movil?: boolean }) {
  return (
    <div style={{ background: t.soft, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: movil ? '18px 16px' : '24px 40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr 1fr' : `repeat(${items.length}, 1fr)`, gap: movil ? 14 : 24 }}>
        {items.map(([tit, sub]) => (
          <div key={tit} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: movil ? 13 : 14.5, fontWeight: 700, color: t.text }}>{tit}</div>
            <div style={{ fontSize: movil ? 11.5 : 12.5, color: t.muted, marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Resenas({ t, items, titulo, movil }: { t: Tema; items: [string, string][]; titulo?: string; movil?: boolean }) {
  return (
    <div style={{ padding: movil ? '30px 16px' : 44, background: t.soft, borderTop: `1px solid ${t.border}` }}>
      <Titulo t={t} texto={titulo ?? 'Lo que dicen'} centrado movil={movil} />
      <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : 'repeat(3, 1fr)', gap: 18 }}>
        {items.map(([txt, quien]) => (
          <div key={quien} style={{ background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio, padding: '18px 20px', boxShadow: t.sombra }}>
            <Estrellas color={t.accent} />
            <p style={{ fontSize: 13.5, color: t.text, lineHeight: 1.65, margin: '10px 0 12px' }}>{txt}</p>
            <div style={{ fontSize: 12.5, color: t.muted }}>{quien}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Newsletter({ t, titulo, bajada, cta, movil }: { t: Tema; titulo: string; bajada: string; cta: string; movil?: boolean }) {
  return (
    <div style={{ padding: movil ? '32px 18px' : '48px 40px', background: t.soft, borderTop: `1px solid ${t.border}`, textAlign: 'center' }}>
      <h2 style={{ fontFamily: t.fh, fontSize: movil ? 22 : 28, margin: 0, fontWeight: 800, letterSpacing: '-0.015em' }}>{titulo}</h2>
      <p style={{ fontSize: 14, color: t.muted, margin: '10px auto 20px', maxWidth: 440, lineHeight: 1.6 }}>{bajada}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <span style={{ minWidth: movil ? 200 : 280, background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio === 0 ? 6 : 999, padding: '12px 18px', fontSize: 13.5, color: t.muted, textAlign: 'left' }}>tu@email.com</span>
        <Boton t={t}>{cta}</Boton>
      </div>
    </div>
  )
}

export function Pie({ t, marca, tagline, columnas, cierre, movil }: { t: Tema; marca: string; tagline: string; columnas: [string, string[]][]; cierre?: string; movil?: boolean }) {
  return (
    <div style={{ borderTop: `1px solid ${t.border}`, background: t.surf }}>
      <div style={{ padding: movil ? '28px 18px' : '40px', display: 'grid', gridTemplateColumns: movil ? '1fr 1fr' : `1.4fr repeat(${columnas.length}, 1fr)`, gap: movil ? 22 : 34 }}>
        <div style={{ gridColumn: movil ? 'span 2' : undefined }}>
          <div style={{ fontFamily: t.fh, fontSize: 20, fontWeight: 800, color: t.text }}>{marca}</div>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 6, lineHeight: 1.6, maxWidth: 260 }}>{tagline}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {['IG', 'FB', 'TK'].map((r) => (
              <span key={r} style={{ width: 30, height: 30, borderRadius: t.radio === 0 ? 6 : '50%', border: `1px solid ${t.border}`, display: 'grid', placeItems: 'center', fontSize: 11, color: t.muted, fontWeight: 700 }}>{r}</span>
            ))}
          </div>
        </div>
        {columnas.map(([tit, items]) => (
          <div key={tit}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', color: t.muted, fontWeight: 700, marginBottom: 13 }}>{tit}</div>
            {items.map((i) => <div key={i} style={{ fontSize: 13, color: t.text, marginBottom: 9, lineHeight: 1.4 }}>{i}</div>)}
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${t.border}`, padding: '14px 40px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, fontSize: 12, color: t.muted }}>
        <span>© 2026 {marca}{cierre ? ` · ${cierre}` : ''}</span>
        <span>Hecho con Órbita</span>
      </div>
    </div>
  )
}

// ─── Marcos de dispositivo ───────────────────────────────────────────────────

export function Notebook({ children, url }: { children: React.ReactNode; url: string }) {
  return (
    <div>
      <div style={{ background: '#1E293B', borderRadius: '14px 14px 0 0', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #334155', borderBottom: 'none' }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#EF4444' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#F59E0B' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#10B981' }} />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11.5, color: '#94A3B8', fontFamily: 'ui-monospace, monospace' }}>{url}</span>
      </div>
      <div style={{ border: '1px solid #334155', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden', background: '#fff', maxHeight: '74vh', overflowY: 'auto' }}>
        {children}
      </div>
      <div style={{ height: 12, background: 'linear-gradient(#334155,#1E293B)', borderRadius: '0 0 22px 22px', margin: '0 auto', width: '86%' }} />
    </div>
  )
}

export function Celular({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 390, margin: '0 auto', border: '11px solid #1E293B', borderRadius: 40, overflow: 'hidden', boxShadow: '0 30px 70px -30px rgba(0,0,0,0.7)', background: '#fff' }}>
      <div style={{ background: '#1E293B', height: 24, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <span style={{ width: 110, height: 17, background: '#0F172A', borderRadius: '0 0 12px 12px' }} />
      </div>
      <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>{children}</div>
    </div>
  )
}
