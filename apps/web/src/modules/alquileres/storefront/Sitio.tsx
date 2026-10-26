// El sitio público de un negocio de alquileres: lo que ven sus clientes para
// reservar. Manda la marca del negocio: cada modo trae un tema (verde para
// canchas, rosa para salones, terracota para alojamiento) que redefine los
// tokens --color-* adentro de .als, así las piezas rv- se pintan solas.
// Es claro siempre (es el sitio de un negocio, no una app), con fotos grandes
// y una sola acción por pantalla: reservar.
//
// Header fijo con el nombre y tres links; en celular, un botón de reservar
// fijo al pie que no tapa el contenido: el sitio entero (pie incluido) deja
// abajo el lugar que ocupa la barra.
//
// --color-muted va un punto más oscuro que el del panel: los textos
// secundarios caen sobre los fondos tintados del tema y con el gris de
// siempre no llegaban a 4.5:1 (AA).
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPin, Phone } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { hhmm, DIAS_CORTOS } from '@/lib/reservas/fechas'
import { TIPOS, type NegocioAlquiler, type TipoAlquiler } from '../datos'
import { EstiloReservas } from '@/design-system/reservas/estilo'

export type PaginaSitio = 'inicio' | 'reserva' | 'mis-reservas'

const RUTAS: Record<PaginaSitio, string> = { inicio: '/alquileres-demo/negocio', reserva: '/alquileres-demo/reserva', 'mis-reservas': '/alquileres-demo/mis-reservas' }

/** Link a una página del sitio, conservando el modo de la demo. */
export function ruta(p: PaginaSitio, tipo: TipoAlquiler, q: Record<string, string> = {}, hash = '') {
  const s = new URLSearchParams({ tipo, ...q }).toString()
  return `${RUTAS[p]}?${s}${hash}`
}

const TEMAS: Record<TipoAlquiler, string> = {
  cancha: '--color-primary: #15803D; --color-primary-h: #166534; --color-primary-bg: #DCFCE7; --chip-primary-fg: #166534; --color-surface: #F3F7F4; --color-surface-alt: #E8F0EA;',
  bloque: '--color-primary: #DB2777; --color-primary-h: #BE185D; --color-primary-bg: #FCE7F3; --chip-primary-fg: #9D174D; --color-surface: #FDF5F9; --color-surface-alt: #FBE4EF;',
  estadia: '--color-primary: #B45309; --color-primary-h: #92400E; --color-primary-bg: #FEF3C7; --chip-primary-fg: #92400E; --color-surface: #FBF6EF; --color-surface-alt: #F3EADB;',
}

export const CSS_SITIO = `
  /* --rv-tope: los 40 px de la tira de la demo, que en el producto real no existe. */
  .als { --rv-tope: 40px; box-sizing: border-box; min-height: 100vh; background: var(--color-bg); color: var(--color-body); font-size: 15px; line-height: 1.5;
    --color-bg: #FFFFFF; --color-border: #E6E8EC; --color-border-strong: #CBD1DA; --color-text: #0F172A; --color-body: #334155; --color-muted: #5A6A80; --color-subtle: #94A3B8;
    --color-on-primary: #FFFFFF; --color-success: #15803D; --color-success-bg: #DCFCE7; --chip-success-fg: #166534; --color-warning: #B45309; --color-warning-bg: #FEF3C7; --chip-warning-fg: #92400E;
    --color-error: #B91C1C; --color-error-bg: #FEE2E2; --chip-error-fg: #991B1B; }
  .als[data-tipo='cancha'] { ${TEMAS.cancha} }
  .als[data-tipo='bloque'] { ${TEMAS.bloque} }
  .als[data-tipo='estadia'] { ${TEMAS.estadia} }
  .als-cont { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
  .als-header { position: sticky; top: var(--rv-tope, 0px); z-index: 50; background: rgba(255,255,255,0.92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--color-border); }
  .als-header-in { display: flex; align-items: center; gap: 16px; height: 64px; }
  .als-marca { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--color-text); min-width: 0; }
  .als-marca-sigla { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--color-primary); color: var(--color-on-primary); font-weight: 700; font-size: 13px; flex-shrink: 0; }
  .als-marca b { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .als-nav { display: flex; align-items: center; gap: 4px; margin-left: auto; }
  .als-nav a { display: inline-flex; align-items: center; min-height: 40px; padding: 0 12px; border-radius: 8px; font-size: 14px; font-weight: 500; color: var(--color-body); text-decoration: none; }
  .als-nav a[aria-current='page'] { color: var(--color-text); font-weight: 600; background: var(--color-surface); }
  .als-nav a:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .als-main { padding-bottom: 48px; }
  .als-sec { padding: 40px 0 0; }
  .als-sec-cab { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap; margin-bottom: 18px; }
  .als-sec-cab h2 { font-size: 22px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); margin: 0; }
  .als-sec-cab p { margin: 4px 0 0; color: var(--color-muted); font-size: 14px; }
  .als-link { display: inline-flex; align-items: center; gap: 5px; font-size: 14px; font-weight: 600; color: var(--color-primary); text-decoration: none; min-height: 40px; }
  .als-link:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 6px; }

  /* Hero: foto grande a la izquierda, texto a la derecha; en celular, apilado. */
  .als-hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 32px; align-items: center; padding: 32px 0 8px; }
  .als-hero-foto { aspect-ratio: 4 / 3; border-radius: 16px; overflow: hidden; background: var(--color-surface-alt); }
  .als-hero-foto img { width: 100%; height: 100%; object-fit: cover; }
  .als-hero h1 { font-size: clamp(28px, 4vw, 40px); line-height: 1.08; font-weight: 700; letter-spacing: -0.03em; color: var(--color-text); margin: 10px 0 0; text-wrap: balance; }
  .als-hero p { font-size: 16px; line-height: 1.6; color: var(--color-body); margin: 14px 0 0; max-width: 48ch; }
  .als-hero-datos { display: flex; gap: 0; margin: 22px 0 0; padding: 0; list-style: none; border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; max-width: 460px; }
  .als-hero-datos li { flex: 1; padding: 12px 14px; border-left: 1px solid var(--color-border); min-width: 0; }
  .als-hero-datos li:first-child { border-left: none; }
  .als-hero-datos b { display: block; font-family: var(--rv-mono); font-size: 20px; font-weight: 600; color: var(--color-text); letter-spacing: -0.02em; }
  .als-hero-datos span { display: block; font-size: 12px; color: var(--color-muted); margin-top: 3px; }
  .als-hero-ctas { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px; }

  /* Tarjetas con foto */
  .als-tarjetas { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  .als-tarjeta { display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: 14px; overflow: hidden; background: var(--color-bg); min-width: 0; text-decoration: none; color: inherit; }
  .als-tarjeta-foto { aspect-ratio: 16 / 10; background: var(--color-surface-alt); overflow: hidden; }
  .als-tarjeta-foto img { width: 100%; height: 100%; object-fit: cover; }
  .als-tarjeta-cuerpo { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .als-tarjeta h3 { font-size: 17px; font-weight: 700; color: var(--color-text); margin: 0; letter-spacing: -0.01em; }
  .als-tarjeta-sub { font-size: 13.5px; color: var(--color-muted); }
  .als-precio { font-family: var(--rv-mono); font-size: 15px; font-weight: 600; color: var(--color-text); }
  .als-precio small { font-family: inherit; font-size: 12px; font-weight: 500; color: var(--color-muted); }
  .als-horas { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .als-hora { display: inline-flex; align-items: center; min-height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--color-border); font-family: var(--rv-mono); font-size: 13px; color: var(--color-text); text-decoration: none; }
  .als-hora:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .als-hora:hover { border-color: var(--color-primary); color: var(--color-primary); } }

  /* Paquetes */
  .als-paquetes { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
  .als-paquete { border: 1px solid var(--color-border); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
  .als-paquete[data-destacado='true'] { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
  .als-paquete ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--color-body); }
  .als-paquete li { display: flex; gap: 8px; align-items: flex-start; }
  .als-paquete li::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary); margin-top: 7px; flex-shrink: 0; }
  .als-extras { display: flex; flex-wrap: wrap; gap: 8px; }

  /* Galería y detalle */
  .als-galeria { display: grid; grid-template-columns: 2fr 1fr 1fr; grid-template-rows: 220px 220px; gap: 8px; border-radius: 16px; overflow: hidden; }
  .als-galeria > button { padding: 0; border: none; background: var(--color-surface-alt); cursor: pointer; overflow: hidden; }
  .als-galeria > button:first-child { grid-row: span 2; }
  .als-galeria img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .als-galeria > button:focus-visible { outline: 3px solid var(--color-primary); outline-offset: -3px; }
  .als-detalle { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 32px; align-items: start; padding-top: 24px; }
  .als-lateral { position: sticky; top: calc(var(--rv-tope, 0px) + 80px); }
  .als-comodidades { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin: 0; padding: 0; list-style: none; font-size: 14px; color: var(--color-body); }
  .als-comodidades li { display: flex; align-items: center; gap: 8px; }
  .als-mapa { aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; border: 1px solid var(--color-border); background: var(--color-surface-alt); }
  .als-mapa iframe { width: 100%; height: 100%; border: 0; display: block; }

  /* Pasos */
  .als-pasos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .als-paso { padding: 18px; border-radius: 14px; background: var(--color-surface); }
  .als-paso b { display: block; font-size: 15px; color: var(--color-text); margin: 10px 0 4px; }
  .als-paso p { margin: 0; font-size: 13.5px; color: var(--color-muted); line-height: 1.5; }
  .als-paso-n { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--color-primary); color: var(--color-on-primary); font-family: var(--rv-mono); font-size: 13px; font-weight: 600; }

  /* Ubicación y pie */
  .als-ubicacion { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
  .als-horarios { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
  .als-horarios li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--color-border); font-size: 14px; }
  .als-horarios li:first-child { border-top: none; }
  .als-horarios li[data-cerrado='true'] { color: var(--color-muted); }
  .als-pie { margin-top: 56px; padding: 24px 0 32px; border-top: 1px solid var(--color-border); font-size: 13px; color: var(--color-muted); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; }
  .als-pie a { color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }

  /* Botón fijo al pie en celular */
  .als-cta-movil { display: none; }

  @media (max-width: 1024px) { .als-detalle { grid-template-columns: minmax(0, 1fr) 320px; } }
  @media (max-width: 860px) {
    .als-hero { grid-template-columns: minmax(0, 1fr); gap: 20px; padding-top: 20px; }
    .als-detalle { grid-template-columns: minmax(0, 1fr); }
    .als-lateral { position: static; }
    .als-ubicacion { grid-template-columns: minmax(0, 1fr); }
    .als-galeria { grid-template-columns: 1fr 1fr; grid-template-rows: 200px 140px; }
    .als-galeria > button:first-child { grid-column: span 2; grid-row: auto; }
    .als-galeria > button:nth-child(n + 4) { display: none; }
  }
  @media (max-width: 768px) {
    .als-cont { padding: 0 16px; }
    .als-nav a:not([data-fijo]) { display: none; }
    .als-nav a { white-space: nowrap; }
    /* Lo que se toca con el dedo, de 44 px. */
    .als-nav a, .als-link, .als-hora { min-height: 44px; }
    /* La barra mide 10 + 48 + 10 px más el borde y el área segura del iPhone: todo el sitio deja ese lugar abajo. */
    /* --rv-pie es la variable del kit para que los avisos salgan encima de la barra. */
    .als[data-cta='true'] { --rv-pie: calc(64px + env(safe-area-inset-bottom)); padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
    .als-cta-movil { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.94); backdrop-filter: blur(8px); border-top: 1px solid var(--color-border); gap: 10px; align-items: center; }
    .als-cta-movil > div { flex: 1; min-width: 0; font-size: 13px; color: var(--color-muted); }
    .als-cta-movil b { display: block; font-size: 14px; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .als-pasos { grid-template-columns: minmax(0, 1fr); }
    .als-sec { padding-top: 32px; }
    .als-hero-ctas .rv-btn { flex: 1 1 100%; }
  }
  @media (max-width: 480px) {
    .als-hero-datos li { padding: 10px; } .als-hero-datos b { font-size: 17px; } .als-tarjetas { grid-template-columns: minmax(0, 1fr); } .als-comodidades { grid-template-columns: minmax(0, 1fr); }
    /* Con la barra de reservar al pie, el link del header sobra y le come el lugar al nombre del negocio. */
    .als[data-cta='true'] .als-nav a[data-accion] { display: none; }
  }
`

interface Props {
  negocio: NegocioAlquiler
  pagina: PaginaSitio
  /** El botón fijo al pie en celular. Sin esto, no se muestra. */
  cta?: { texto: string; sub?: string; href?: string; onClick?: () => void; deshabilitado?: boolean }
  children: ReactNode
}

export default function Sitio({ negocio, pagina, cta, children }: Props) {
  const tipo = negocio.tipo
  const sigla = negocio.nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
  const nav: { id: PaginaSitio; label: string; fijo?: boolean }[] = [
    { id: 'inicio', label: 'Inicio' },
    { id: 'reserva', label: TIPOS[tipo].verbo, fijo: true },
    { id: 'mis-reservas', label: 'Mis reservas', fijo: true },
  ]
  const ctaAncho = { flex: cta?.sub ? '0 0 auto' : 1 }
  return (
    <div className="rv als" data-tipo={tipo} data-cta={cta ? true : undefined}>
      <EstiloReservas />
      <style>{CSS_SITIO}</style>
      <header className="als-header">
        <div className="als-cont als-header-in">
          <Link href={ruta('inicio', tipo)} className="als-marca" aria-label={`${negocio.nombre}: inicio`}>
            {negocio.logo ? <img src={negocio.logo} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} /> : <span className="als-marca-sigla" aria-hidden>{sigla}</span>}
            <b>{negocio.nombre}</b>
          </Link>
          <nav className="als-nav" aria-label="Secciones del sitio">
            {nav.map(n => <Link key={n.id} href={ruta(n.id, tipo)} aria-current={pagina === n.id ? 'page' : undefined} data-fijo={n.fijo || undefined} data-accion={n.id === 'reserva' || undefined}>{n.label}</Link>)}
          </nav>
        </div>
      </header>
      <main className="als-main">{children}</main>
      <footer className="als-cont als-pie">
        <span><Phone size={13} aria-hidden style={{ verticalAlign: '-2px', marginRight: 5 }} />{negocio.telefono} · <MapPin size={13} aria-hidden style={{ verticalAlign: '-2px', marginRight: 4 }} />{negocio.direccion}, {negocio.ciudad}</span>
        <span>Reservas con <a href="https://orbita.site" target="_blank" rel="noreferrer"><OrbitaLogo size={14} animated={false} /> Órbita</a></span>
      </footer>
      {cta && (
        <div className="als-cta-movil">
          {cta.sub && <div><b>{cta.sub}</b></div>}
          {/* Un link deshabilitado igual navega: si no se puede seguir, va un botón apagado. */}
          {cta.href && !cta.deshabilitado
            ? <Link href={cta.href} className="rv-btn rv-btn--primario rv-btn--lg" style={ctaAncho}>{cta.texto} <ArrowRight size={16} aria-hidden /></Link>
            : <button type="button" className="rv-btn rv-btn--primario rv-btn--lg" style={ctaAncho} onClick={cta.onClick} disabled={cta.deshabilitado}>{cta.texto} <ArrowRight size={16} aria-hidden /></button>}
        </div>
      )}
    </div>
  )
}

/** Horarios de atención, para el pie de cada portada. */
export function Horarios({ negocio }: { negocio: NegocioAlquiler }) {
  const a = negocio.apertura
  return (
    <ul className="als-horarios">
      {DIAS_CORTOS.map((d, i) => {
        const abre = a.dias.includes(i)
        return <li key={d} data-cerrado={!abre}><span>{d}</span><span className="rv-num">{abre ? (a.desde === 0 && a.hasta === 24 * 60 ? 'Todo el día' : `${hhmm(a.desde)} – ${hhmm(a.hasta)}`) : 'Cerrado'}</span></li>
      })}
    </ul>
  )
}

/** Mapa de OpenStreetMap embebido, sin librerías: alcanza para mostrar dónde queda. */
export function Mapa({ latLng, titulo }: { latLng: [number, number]; titulo: string }) {
  const [lat, lng] = latLng
  const d = 0.008
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`
  return <div className="als-mapa"><iframe title={`Mapa: ${titulo}`} src={src} loading="lazy" referrerPolicy="no-referrer" /></div>
}
