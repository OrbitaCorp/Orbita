// El sitio público de un gimnasio, box o estudio: lo que ven los socios para
// reservar su lugar en una clase. Claro, con fotos grandes, un acento y una
// sola acción por pantalla. Redefine los tokens --color-* adentro de .gis,
// así las piezas rv- del design system se pintan solas.
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPin, Phone } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { EstiloReservas } from '@/design-system/reservas/estilo'
import type { NegocioGym } from '../datos'

export type PaginaSitio = 'inicio' | 'reserva' | 'mis-clases'
const RUTAS: Record<PaginaSitio, string> = { inicio: '/gimnasio-demo/negocio', reserva: '/gimnasio-demo/reserva', 'mis-clases': '/gimnasio-demo/mis-clases' }

/** Link a una página del sitio, conservando el rubro de la demo. */
export function ruta(p: PaginaSitio, rubro: string, q: Record<string, string> = {}, hash = '') {
  const s = new URLSearchParams({ rubro, ...q }).toString()
  return `${RUTAS[p]}?${s}${hash}`
}

/**
 * La barra de cupo (BarraCupo) la usan el sitio y el panel: su hoja va aparte y
 * cada uno la monta. Antes vivía solo en la del sitio y en el panel la barra no
 * se dibujaba (quedaba el texto suelto, grande y en un naranja ilegible). El
 * texto usa los tonos de chip: el --color-warning del panel (#F59E0B) sobre
 * blanco da 2,1:1.
 */
export const CSS_CUPO = `
  .gis-cupo { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 12.5px; color: var(--color-muted); }
  .gis-cupo-barra { flex: 1; height: 6px; border-radius: 3px; background: var(--color-surface-alt); overflow: hidden; }
  .gis-cupo-barra i { display: block; height: 100%; background: var(--color-primary); border-radius: 3px; }
  .gis-cupo-barra i[data-tono='aviso'] { background: var(--color-warning); }
  .gis-cupo-barra i[data-tono='lleno'] { background: var(--color-error); }
  .gis-cupo > span { flex-shrink: 0; }
  .gis-cupo > span[data-tono] { font-weight: 600; }
  .gis-cupo > span[data-tono='aviso'] { color: var(--chip-warning-fg); }
  .gis-cupo > span[data-tono='lleno'] { color: var(--chip-error-fg); }
`

export const CSS_SITIO = `
  /* --rv-tope: los 40 px de la tira de la demo, que en el producto real no existe. */
  /* --color-muted un punto más oscuro que el del panel: sobre los fondos verdosos del sitio (#F2F7F6, #CCFBF1) el #64748B quedaba en 4,4:1, debajo de AA. */
  .gis { --rv-tope: 40px; min-height: 100vh; background: var(--color-bg); color: var(--color-body); font-size: 15px; line-height: 1.5;
    --color-bg: #FFFFFF; --color-surface: #F2F7F6; --color-surface-alt: #E4EFEC; --color-border: #E3E8E7; --color-border-strong: #C6D1CE; --color-text: #0F172A; --color-body: #334155; --color-muted: #5B6B7E; --color-subtle: #94A3B8;
    --color-primary: #0F766E; --color-primary-h: #115E59; --color-primary-bg: #CCFBF1; --chip-primary-fg: #115E59; --color-on-primary: #FFFFFF;
    --color-success: #15803D; --color-success-bg: #DCFCE7; --chip-success-fg: #166534; --color-warning: #B45309; --color-warning-bg: #FEF3C7; --chip-warning-fg: #92400E;
    --color-error: #B91C1C; --color-error-bg: #FEE2E2; --chip-error-fg: #991B1B; }
  .gis-cont { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
  .gis-header { position: sticky; top: var(--rv-tope, 0px); z-index: 50; background: rgba(255,255,255,0.92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--color-border); }
  .gis-header-in { display: flex; align-items: center; gap: 16px; height: 64px; }
  .gis-marca { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--color-text); min-width: 0; }
  .gis-marca-sigla { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--color-primary); color: var(--color-on-primary); font-weight: 700; font-size: 13px; flex-shrink: 0; }
  .gis-marca b { font-size: 15px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gis-nav { display: flex; align-items: center; gap: 4px; margin-left: auto; }
  .gis-nav a { display: inline-flex; align-items: center; min-height: 40px; padding: 0 12px; border-radius: 8px; font-size: 14px; font-weight: 500; color: var(--color-body); text-decoration: none; }
  .gis-nav a[aria-current='page'] { color: var(--color-text); font-weight: 600; background: var(--color-surface); }
  .gis-nav a:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .gis-main { padding-bottom: 48px; }
  .gis-sec { padding: 40px 0 0; }
  .gis-sec-cab { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap; margin-bottom: 18px; }
  .gis-sec-cab h2 { font-size: 22px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); margin: 0; }
  .gis-sec-cab p { margin: 4px 0 0; color: var(--color-muted); font-size: 14px; }
  .gis-link { display: inline-flex; align-items: center; gap: 5px; font-size: 14px; font-weight: 600; color: var(--color-primary); text-decoration: none; min-height: 40px; }
  .gis-link:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 6px; }

  .gis-hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 32px; align-items: center; padding: 32px 0 8px; }
  .gis-hero-foto { aspect-ratio: 4 / 3; border-radius: 16px; overflow: hidden; background: var(--color-surface-alt); }
  .gis-hero-foto img { width: 100%; height: 100%; object-fit: cover; }
  .gis-hero h1 { font-size: clamp(28px, 4vw, 40px); line-height: 1.08; font-weight: 700; letter-spacing: -0.03em; color: var(--color-text); margin: 10px 0 0; text-wrap: balance; }
  .gis-hero p { font-size: 16px; line-height: 1.6; color: var(--color-body); margin: 14px 0 0; max-width: 48ch; }
  .gis-hero-datos { display: flex; margin: 22px 0 0; padding: 0; list-style: none; border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; max-width: 460px; }
  .gis-hero-datos li { flex: 1; padding: 12px 14px; border-left: 1px solid var(--color-border); min-width: 0; }
  .gis-hero-datos li:first-child { border-left: none; }
  .gis-hero-datos b { display: block; font-family: var(--rv-mono); font-size: 20px; font-weight: 600; color: var(--color-text); letter-spacing: -0.02em; }
  .gis-hero-datos span { display: block; font-size: 12px; color: var(--color-muted); margin-top: 3px; }
  .gis-hero-ctas { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px; }

  /* Clases: tarjetas con el cupo a la vista */
  .gis-clases { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
  .gis-clase { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-bg); text-decoration: none; color: inherit; min-width: 0; position: relative; }
  .gis-clase:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .gis-clase:hover { border-color: var(--color-border-strong); } }
  .gis-clase-hora { font-family: var(--rv-mono); font-size: 18px; font-weight: 600; color: var(--color-text); }
  .gis-clase h3 { font-size: 16px; font-weight: 700; color: var(--color-text); margin: 0; }
  .gis-clase-sub { font-size: 13px; color: var(--color-muted); }
  /* La clase que ya empezó no se reserva: va sin link y más quieta. */
  .gis-clase[data-en-curso='true'] { background: var(--color-surface); }

  /* La semana */
  .gis-semana { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
  .gis-dia { border: 1px solid var(--color-border); border-radius: 12px; padding: 10px; min-width: 0; }
  .gis-dia-cab { font-size: 13px; font-weight: 700; color: var(--color-text); margin-bottom: 8px; display: flex; justify-content: space-between; }
  .gis-dia-cab small { font-weight: 500; color: var(--color-muted); }
  .gis-dia-clase { display: block; width: 100%; text-align: left; padding: 7px 8px; border-radius: 8px; border: none; border-left: 3px solid var(--color-primary); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 12.5px; line-height: 1.3; text-decoration: none; margin-bottom: 6px; cursor: pointer; }
  .gis-dia-clase b { display: block; font-family: var(--rv-mono); font-weight: 600; }
  .gis-dia-clase span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Llena: se sigue leyendo (con opacity: 0.6 el texto quedaba en 2,6:1) y se puede tocar para la lista de espera. */
  .gis-dia-clase[data-lleno='true'] { background: var(--color-bg); border-left-color: var(--color-border-strong); box-shadow: inset 0 0 0 1px var(--color-border); }
  .gis-dia-cupo { color: var(--color-muted); }
  .gis-dia-clase[data-lleno='true'] .gis-dia-cupo { color: var(--chip-error-fg); font-weight: 600; }
  .gis-dia-clase:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  .gis-tabs-dias { display: none; }

  /* Planes: la de prueba va aparte, en una franja; los pagos, en una fila que se reparte entera
     (con minmax(220px) cinco planes quedaban en 4 + 1 suelto). En tablet, de a dos, y si sobra
     uno, ocupa la fila. */
  .gis-prueba { display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap; padding: 16px 18px; margin-bottom: 14px; border-radius: 14px; background: var(--color-surface); }
  .gis-prueba p { margin: 0; font-size: 14px; color: var(--color-body); }
  .gis-prueba b { color: var(--color-text); }
  .gis-planes { display: grid; grid-template-columns: repeat(auto-fit, minmax(176px, 1fr)); gap: 14px; }
  .gis-plan { border: 1px solid var(--color-border); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 8px; }
  .gis-plan[data-destacado='true'] { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
  /* La unidad ("la clase", "por mes") no se parte: si no entra al lado del precio, baja entera. */
  .gis-precio { font-family: var(--rv-mono); font-size: 24px; line-height: 1.2; font-weight: 600; color: var(--color-text); letter-spacing: -0.02em; }
  .gis-precio small { font-family: inherit; font-size: 12px; font-weight: 500; color: var(--color-muted); white-space: nowrap; display: inline-block; }

  .gis-pasos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .gis-paso { padding: 18px; border-radius: 14px; background: var(--color-surface); }
  .gis-paso b { display: block; font-size: 15px; color: var(--color-text); margin: 10px 0 4px; }
  .gis-paso p { margin: 0; font-size: 13.5px; color: var(--color-muted); line-height: 1.5; }
  .gis-paso-n { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--color-primary); color: var(--color-on-primary); font-family: var(--rv-mono); font-size: 13px; font-weight: 600; }
  .gis-ubicacion { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
  .gis-mapa { aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; border: 1px solid var(--color-border); background: var(--color-surface-alt); }
  .gis-mapa iframe { width: 100%; height: 100%; border: 0; display: block; }
  .gis-horarios { margin: 0; padding: 0; list-style: none; }
  .gis-horarios li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--color-border); font-size: 14px; }
  .gis-horarios li:first-child { border-top: none; }
  .gis-horarios li[data-cerrado='true'] { color: var(--color-muted); }
  /* El pie va adentro de .gis-cont (no es él): con padding: 24px 0 pisaba el padding lateral del contenedor y quedaba 24 px corrido del contenido. */
  .gis-pie { margin-top: 56px; padding: 24px 0 32px; border-top: 1px solid var(--color-border); font-size: 13px; color: var(--color-muted); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; }
  .gis-pie a { color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
  .gis-cta-movil { display: none; }

  /* Lo que se enfoca con el teclado no queda escondido debajo del header fijo (40 de la demo + 64). */
  html:has(.gis) { scroll-padding-top: 112px; }

  @media (max-width: 960px) {
    .gis-semana { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .gis-planes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .gis-planes > :last-child:nth-child(odd) { grid-column: 1 / -1; }
  }
  @media (max-width: 860px) {
    .gis-hero { grid-template-columns: minmax(0, 1fr); gap: 20px; padding-top: 20px; }
    /* A lo ancho, en 4:3 la foto ocupaba toda la primera pantalla de una tablet. */
    .gis-hero-foto { aspect-ratio: 16 / 10; }
    .gis-ubicacion { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 768px) {
    .gis-cont { padding: 0 16px; }
    .gis-nav a:not([data-fijo]) { display: none; }
    .gis-nav a, .gis-link, .gis-marca { min-height: 44px; }
    .gis-hero-datos { max-width: none; }
    /* El botón fijo al pie mide --rv-pie: el pie de página deja ese aire para que
       nada quede tapado al final, los avisos (rv-toast) salen por encima y el
       foco del teclado tampoco se esconde detrás. */
    .gis[data-cta='true'] { --rv-pie: calc(70px + env(safe-area-inset-bottom, 0px)); }
    .gis[data-cta='true'] .gis-pie { padding-bottom: calc(32px + var(--rv-pie)); }
    html:has(.gis[data-cta='true']) { scroll-padding-bottom: calc(86px + env(safe-area-inset-bottom, 0px)); }
    .gis-cta-movil { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.94); backdrop-filter: blur(8px); border-top: 1px solid var(--color-border); gap: 10px; align-items: center; }
    .gis-cta-movil > div { flex: 1; min-width: 0; font-size: 13px; color: var(--color-muted); }
    .gis-cta-movil b { display: block; font-size: 14px; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gis-sec { padding-top: 32px; }
    .gis-hero-ctas .rv-btn { flex: 1 1 100%; }
    /* La semana en celular: un día por vez, elegido con la tira de días */
    .gis-semana { grid-template-columns: minmax(0, 1fr); }
    .gis-dia[data-oculto='true'] { display: none; }
    /* El padding deja lugar al anillo de foco, que la tira (overflow) recortaba. */
    .gis-tabs-dias { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 4px; margin: -4px -4px 6px; }
    .gis-tabs-dias::-webkit-scrollbar { display: none; }
  }
  /* "Cómo funciona" sigue en tres columnas en una tablet; recién en celular va de a uno. */
  @media (max-width: 600px) { .gis-pasos { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 560px) { .gis-planes { grid-template-columns: minmax(0, 1fr); } .gis-prueba .rv-btn { flex: 1 1 100%; } }
  @media (max-width: 480px) { .gis-hero-datos li { padding: 10px; } .gis-hero-datos b { font-size: 17px; } .gis-clases { grid-template-columns: minmax(0, 1fr); } }
`

interface Props {
  negocio: NegocioGym
  pagina: PaginaSitio
  cta?: { texto: string; sub?: string; href?: string; onClick?: () => void; deshabilitado?: boolean }
  children: ReactNode
}

export default function Sitio({ negocio, pagina, cta, children }: Props) {
  const sigla = negocio.nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
  const nav: { id: PaginaSitio; label: string; fijo?: boolean }[] = [
    { id: 'inicio', label: 'Inicio' },
    { id: 'reserva', label: 'Reservar clase', fijo: true },
    { id: 'mis-clases', label: 'Mis clases', fijo: true },
  ]
  return (
    <div className="rv gis" data-cta={!!cta || undefined}>
      <EstiloReservas />
      <style>{CSS_SITIO + CSS_CUPO}</style>
      <header className="gis-header">
        <div className="gis-cont gis-header-in">
          <Link href={ruta('inicio', negocio.rubro)} className="gis-marca" aria-label={`${negocio.nombre}: inicio`}>
            {negocio.logo ? <img src={negocio.logo} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} /> : <span className="gis-marca-sigla" aria-hidden>{sigla}</span>}
            <b>{negocio.nombre}</b>
          </Link>
          <nav className="gis-nav" aria-label="Secciones del sitio">
            {nav.map(n => <Link key={n.id} href={ruta(n.id, negocio.rubro)} aria-current={pagina === n.id ? 'page' : undefined} data-fijo={n.fijo || undefined}>{n.label}</Link>)}
          </nav>
        </div>
      </header>
      <main className="gis-main">{children}</main>
      <footer className="gis-cont">
        <div className="gis-pie">
          <span><Phone size={13} aria-hidden style={{ verticalAlign: '-2px', marginRight: 5 }} />{negocio.telefono} · <MapPin size={13} aria-hidden style={{ verticalAlign: '-2px', marginRight: 4 }} />{negocio.direccion}, {negocio.ciudad}</span>
          <span>Reservas con <a href="https://orbita.site" target="_blank" rel="noreferrer"><OrbitaLogo size={14} animated={false} /> Órbita</a></span>
        </div>
      </footer>
      {cta && (
        <div className="gis-cta-movil">
          {cta.sub && <div><b>{cta.sub}</b></div>}
          {cta.href
            ? <Link href={cta.href} className="rv-btn rv-btn--primario rv-btn--lg" style={{ flex: cta.sub ? '0 0 auto' : 1 }} aria-disabled={cta.deshabilitado}>{cta.texto} <ArrowRight size={16} aria-hidden /></Link>
            : <button type="button" className="rv-btn rv-btn--primario rv-btn--lg" style={{ flex: cta.sub ? '0 0 auto' : 1 }} onClick={cta.onClick} disabled={cta.deshabilitado}>{cta.texto} <ArrowRight size={16} aria-hidden /></button>}
        </div>
      )}
    </div>
  )
}

/** Mapa de OpenStreetMap embebido, sin librerías. */
export function Mapa({ latLng, titulo }: { latLng: [number, number]; titulo: string }) {
  const [lat, lng] = latLng
  const d = 0.008
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`
  return <div className="gis-mapa"><iframe title={`Mapa: ${titulo}`} src={src} loading="lazy" referrerPolicy="no-referrer" /></div>
}

/**
 * Barra de cupo: cuánto se llenó una clase. El texto dice lo mismo que el color. Necesita CSS_CUPO montado.
 * El id es para que la describa quien la usa (en Reservar, el radio de cada clase).
 */
export function BarraCupo({ anotados, cupo, id }: { anotados: number; cupo: number; id?: string }) {
  const libres = Math.max(0, cupo - anotados)
  const tono = libres === 0 ? 'lleno' : libres <= 3 ? 'aviso' : undefined
  const texto = libres === 0 ? 'Completa · lista de espera' : libres === 1 ? 'Último lugar' : `${libres} lugares libres`
  return (
    <div className="gis-cupo" id={id}>
      {/* Un div no se nombra con aria-label (el lector lo ignora): la cuenta va como texto oculto. */}
      <span className="rv-sr">{`${anotados} de ${cupo} lugares ocupados. `}</span>
      <div className="gis-cupo-barra" aria-hidden><i data-tono={tono} style={{ width: `${Math.min(100, Math.round((anotados / Math.max(1, cupo)) * 100))}%` }} /></div>
      <span data-tono={tono}>{texto}</span>
    </div>
  )
}
