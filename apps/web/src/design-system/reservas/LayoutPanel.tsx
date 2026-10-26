// Armazón del panel de un módulo de reservas (design system): barra lateral de 240 px en escritorio (las
// mismas medidas que el panel de Tienda), cajón que entra desde la izquierda
// en celular, y un header de 64 px con el nombre del negocio y el link al
// sitio. Sin buscador ni campanita: el panel es corto y se recorre de un
// vistazo. Los 40 px de --rv-tope son la tira de la demo.
//
// El cajón (hasta 768 px, como el resto del panel): se abre con el botón de
// menú, el foco entra al ítem activo y no se escapa mientras está abierto (lo
// de atrás queda inert); Escape, el velo, la X o elegir una sección lo cierran
// y el foco vuelve al botón de menú. Cerrado, queda fuera del orden del Tab.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight, Menu, Moon, Sun, X } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { useDarkMode } from '@/hooks/useDarkMode'
import { EstiloReservas } from './estilo'
import { frenarScroll, retenerFoco } from './piezas'

export interface ItemNav { id: string; label: string; Icon: LucideIcon; badge?: number }

const CSS = `
  .rvp { --rv-tope: 40px; display: flex; min-height: calc(100vh - var(--rv-tope)); background: var(--color-surface); color: var(--color-body); }
  .rvp-lateral { position: sticky; top: var(--rv-tope); align-self: flex-start; height: calc(100vh - var(--rv-tope)); width: 240px; flex-shrink: 0; display: flex; flex-direction: column; background: var(--color-bg); border-right: 1px solid var(--color-border); z-index: 40; }
  .rvp-negocio { display: flex; align-items: center; gap: 10px; height: 64px; padding: 0 16px; border-bottom: 1px solid var(--color-border); min-width: 0; }
  .rvp-negocio-sigla { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-primary); color: var(--color-on-primary); font-size: 13px; font-weight: 700; }
  .rvp-negocio b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rvp-negocio small { display: block; font-size: 12px; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rvp-nav { flex: 1; overflow-y: auto; padding: 10px 8px; display: flex; flex-direction: column; gap: 2px; }
  .rvp-item { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 10px; border-radius: 8px; border: none; background: transparent; color: var(--color-body); font: inherit; font-size: 13.5px; font-weight: 500; cursor: pointer; text-align: left; width: 100%; }
  .rvp-item > svg { flex-shrink: 0; color: var(--color-subtle); }
  .rvp-item[aria-current='page'] { background: var(--color-primary-bg); color: var(--color-primary); font-weight: 600; }
  .rvp-item[aria-current='page'] > svg { color: var(--color-primary); }
  .rvp-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .rvp-item-badge { margin-left: auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center; font-family: "Geist Mono", ui-monospace, monospace; font-size: 10.5px; font-weight: 600; background: var(--color-warning-bg); color: var(--chip-warning-fg); }
  .rvp-sitio { margin: 8px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--color-border); background: var(--color-surface); text-decoration: none; color: inherit; display: block; }
  .rvp-sitio b { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--color-text); }
  .rvp-sitio small { display: block; font-size: 12px; color: var(--color-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rvp-cuerpo { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .rvp-header { position: sticky; top: var(--rv-tope); z-index: 30; display: flex; align-items: center; gap: 10px; height: 64px; padding: 0 16px; background: var(--color-bg); border-bottom: 1px solid var(--color-border); }
  .rvp-header-titulo { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rvp-menu { display: none; }
  .rvp-main { flex: 1; min-width: 0; }
  .rvp-velo { display: none; }
  @media (max-width: 768px) {
    /* visibility: hidden con retardo = sale de la pantalla con la animación y recién ahí deja de recibir el Tab.
       align-self: auto: el flex-start del sticky de escritorio también vale para un fixed, y el
       cajón medía lo que su contenido en vez de ir de la tira hasta abajo. */
    .rvp-lateral { position: fixed; left: 0; top: var(--rv-tope); bottom: 0; height: auto; align-self: auto; width: min(280px, 86vw); transform: translateX(-100%); visibility: hidden; transition: transform 240ms var(--rv-ease, ease), visibility 0s linear 240ms; box-shadow: none; z-index: 140; padding-bottom: env(safe-area-inset-bottom, 0px); }
    .rvp-lateral[data-abierto='true'] { transform: none; visibility: visible; transition: transform 240ms var(--rv-ease, ease), visibility 0s; box-shadow: 8px 0 32px rgba(0,0,0,0.25); }
    .rvp-menu { display: inline-flex; }
    .rvp-velo[data-abierto='true'] { display: block; position: fixed; inset: var(--rv-tope) 0 0 0; z-index: 130; background: rgba(15,23,42,0.5); }
    .rvp-item { min-height: 44px; }
    .rvp-sitio { padding: 12px 14px; min-height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) { .rvp-lateral, .rvp-lateral[data-abierto='true'] { transition: none; } }
`

interface Props {
  negocio: string
  rubro: string
  items: ItemNav[]
  activo: string
  onIr: (id: string) => void
  /** Link al sitio público; se abre en otra pestaña para no perder el estado del panel. */
  sitio: string
  children: ReactNode
}

export default function LayoutPanel({ negocio, rubro, items, activo, onIr, sitio, children }: Props) {
  const [abierto, setAbierto] = useState(false)
  const { isDark, setTema } = useDarkMode()
  const botonMenu = useRef<HTMLButtonElement>(null)
  const lateral = useRef<HTMLElement>(null)
  // Si al cerrar el cajón el foco vuelve al botón de menú. Se marca al cerrar y
  // se cumple en el efecto: mientras el cajón está abierto, el botón está
  // adentro de lo inert y no puede recibir el foco.
  const devolverFoco = useRef(false)
  const idLateral = useId()
  const sigla = negocio.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

  const cerrar = () => { devolverFoco.current = true; setAbierto(false) }

  useEffect(() => {
    if (!abierto) {
      if (devolverFoco.current) { devolverFoco.current = false; botonMenu.current?.focus() }
      return
    }
    const caja = lateral.current
    // El foco entra al cajón: a la sección en la que estás, o a la primera.
    const inicial = caja?.querySelector<HTMLElement>('.rvp-item[aria-current="page"]') ?? caja?.querySelector<HTMLElement>('.rvp-item')
    inicial?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { devolverFoco.current = true; setAbierto(false); return }
      if (caja) retenerFoco(e, caja)
    }
    window.addEventListener('keydown', tecla)
    // En <html> y no en <body>: así el header del panel (sticky) no se va de la pantalla mientras el cajón está abierto.
    const soltar = frenarScroll()
    // Si la ventana crece a escritorio con el cajón abierto, se cierra solo (ahí no hay botón de menú).
    const mq = window.matchMedia('(min-width: 769px)')
    const alCrecer = () => { devolverFoco.current = false; setAbierto(false) }
    mq.addEventListener('change', alCrecer)
    return () => { window.removeEventListener('keydown', tecla); mq.removeEventListener('change', alCrecer); soltar() }
  }, [abierto])

  const actual = items.find(i => i.id === activo)
  return (
    <div className="rv rvp">
      <EstiloReservas />
      <style>{CSS}</style>
      <aside ref={lateral} id={idLateral} className="rvp-lateral" data-abierto={abierto} aria-label="Menú del panel">
        <div className="rvp-negocio">
          <span className="rvp-negocio-sigla" aria-hidden>{sigla || <OrbitaLogo size={18} />}</span>
          <div style={{ minWidth: 0, flex: 1 }}><b>{negocio}</b><small>{rubro}</small></div>
          <button type="button" className="rv-btn rv-btn--icono rv-btn--sm rvp-menu" onClick={cerrar} aria-label="Cerrar menú"><X size={16} /></button>
        </div>
        <nav className="rvp-nav" aria-label="Secciones">
          {items.map(it => (
            <button key={it.id} type="button" className="rvp-item" aria-current={it.id === activo ? 'page' : undefined} onClick={() => { onIr(it.id); if (abierto) cerrar() }}>
              <it.Icon size={17} strokeWidth={1.7} aria-hidden />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
              {it.badge ? <span className="rvp-item-badge" aria-label={`${it.badge} pendientes`}>{it.badge}</span> : null}
            </button>
          ))}
        </nav>
        <a className="rvp-sitio" href={sitio} target="_blank" rel="noreferrer">
          <b>Tu sitio <ArrowUpRight size={14} aria-hidden /></b>
          <small>Lo que ven tus clientes para reservar</small>
        </a>
      </aside>
      <div className="rvp-velo" data-abierto={abierto} onClick={cerrar} aria-hidden />
      {/* Con el cajón abierto, lo de atrás no recibe foco ni lo lee el lector de pantalla. */}
      <div className="rvp-cuerpo" inert={abierto || undefined}>
        <header className="rvp-header">
          <button ref={botonMenu} type="button" className="rv-btn rv-btn--icono rvp-menu" onClick={() => setAbierto(true)} aria-label="Abrir menú" aria-expanded={abierto} aria-controls={idLateral}><Menu size={18} /></button>
          <span className="rvp-header-titulo">{actual?.label ?? negocio}</span>
          <button type="button" className="rv-btn rv-btn--icono" onClick={() => setTema(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Pasar a modo claro' : 'Pasar a modo oscuro'}>
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </header>
        <main className="rvp-main">{children}</main>
      </div>
    </div>
  )
}
