// Armazón del panel de Turnos. Mantiene las medidas del panel de Tienda
// (sidebar de 240px, header de 64px, `.admin-main` de fondo, drawer en celular)
// para que los dos productos se sientan el mismo lugar, y suma encima el
// lenguaje de Turnos: el negocio como planeta del menú, grupos rotulados, el
// ítem activo con su filo de luz y la tarjeta de la página de reservas.
// No reusa AdminLayout porque ese exige sesión y arma el menú de Tienda; cuando
// Turnos sea real, lo correcto es sumar un módulo `turnos` a Sidebar.MODULOS y
// a AdminSeccionShell en vez de este archivo. Los 40px de --tuo-tope y del alto
// son la tira de la demo (BarraDemo), que en el producto real no existe.
//
// El buscador y la campanita abren paneles flotantes. Van position: fixed y
// fuera del <header> a propósito: el header tiene backdrop-filter (arma su
// propia capa) y lo que se abra adentro quedaría tapado por las tarjetas.
import { useEffect, useRef, useState, type KeyboardEvent as TeclaReact, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Menu, Moon, Sun, Bell, ArrowUpRight, Search, X, CheckCheck, BellOff, SearchX, ChevronDown, Undo2, Eye } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { useDarkMode } from '@/hooks/useDarkMode'
import { EstiloTurnos } from '@/modules/turnos/_shared/orbita/estilo'

export interface ItemNav { id: string; label: string; Icon: LucideIcon; badge?: number; grupo?: string }
/** Aviso de la campanita. `nueva` arranca sin leer. */
export interface AvisoNav { id: string; Icon: LucideIcon; tono?: 'primario' | 'aviso' | 'error' | 'ok'; titulo: string; detalle?: string; cuando: string; nueva?: boolean; onAbrir: () => void }
/** Algo que el buscador del header puede encontrar: un turno, un cliente, una sección. */
export interface ItemBusqueda { id: string; grupo: string; titulo: string; detalle?: string; Icon: LucideIcon; onElegir: () => void }
/** Quien está usando el panel, o alguien del equipo como quien se lo puede mirar. */
export interface CuentaNav { id: string; nombre: string; rol: string; color: string }

const TONO: Record<NonNullable<AvisoNav['tono']>, { fg: string; bg: string }> = {
  primario: { fg: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
  aviso: { fg: 'var(--chip-warning-fg)', bg: 'var(--color-warning-bg)' },
  error: { fg: 'var(--chip-error-fg)', bg: 'var(--color-error-bg)' },
  ok: { fg: 'var(--chip-success-fg)', bg: 'var(--color-success-bg)' },
}
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const MAX_RESULTADOS = 8

interface Props {
  negocio: string
  /** Rubro del negocio, debajo del nombre. */
  rubro?: string
  /** Fecha de hoy, en el header. */
  fecha?: string
  items: ItemNav[]
  activo: string
  onIr: (id: string) => void
  /**
   * Link a la página de reservas del negocio. Se abre en otra pestaña: en la
   * demo, salir del panel en la misma perdería todo lo que se cargó.
   */
  reservas?: string
  /** Avisos de la campanita. */
  avisos?: AvisoNav[]
  /** Lo que encuentra el buscador del header. */
  busqueda?: ItemBusqueda[]
  /** Quien está usando el panel: se ve en el header. */
  usuario?: CuentaNav
  /** El equipo: desde el header se puede mirar el panel como lo ve cada uno. */
  cuentas?: CuentaNav[]
  /** Como quién se está mirando el panel (null = es el dueño, con su propio panel). */
  viendoComo?: string | null
  /** Elegir como quién mirar; null vuelve al panel propio. */
  onCuenta?: (id: string | null) => void
  /** Franja entre el header y la pantalla (avisa que se está mirando el panel de otro). */
  franja?: ReactNode
  children: ReactNode
}

const siglas = (nombre: string) => nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

export default function LayoutTurnos({ negocio, rubro, fecha, items, activo, onIr, reservas, avisos = [], busqueda = [], usuario, cuentas = [], viendoComo = null, onCuenta, franja, children }: Props) {
  const [abierto, setAbierto] = useState(false)
  const { isDark, setTema } = useDarkMode()
  const principal = useRef<HTMLElement>(null)

  // Cada sección arranca arriba: el área que scrollea es <main>, no la ventana.
  useEffect(() => { principal.current?.scrollTo({ top: 0 }) }, [activo])

  // El menú del celular: al abrir, el foco entra (al botón de cerrar); se
  // cierra con Escape, como los paneles, y el foco vuelve al botón del menú.
  const botonMenu = useRef<HTMLButtonElement>(null)
  const botonCerrar = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!abierto) return
    const volver = botonMenu.current
    botonCerrar.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('keydown', esc)
      volver?.focus({ preventScroll: true })
    }
  }, [abierto])

  // ── Campanita ──
  const [verAvisos, setVerAvisos] = useState(false)
  const [leidos, setLeidos] = useState<string[]>([])
  const sinLeer = avisos.filter(a => a.nueva && !leidos.includes(a.id))
  const campana = useRef<HTMLButtonElement>(null)
  const panelAvisos = useRef<HTMLDivElement>(null)

  // ── Quién usa el panel ──
  const [verCuentas, setVerCuentas] = useState(false)
  const botonCuenta = useRef<HTMLButtonElement>(null)
  const panelCuentas = useRef<HTMLDivElement>(null)

  // ── Buscador ──
  const [q, setQ] = useState('')
  const [lugar, setLugar] = useState<{ left: number; top: number; width: number } | null>(null)
  const [cursor, setCursor] = useState(0)
  const buscador = useRef<HTMLLabelElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const panelBusqueda = useRef<HTMLDivElement>(null)
  const texto = sinAcentos(q.trim())
  // Sin nada escrito ofrece las secciones; escribiendo, busca en todo.
  const resultados = (texto
    ? busqueda.filter(b => sinAcentos(`${b.titulo} ${b.detalle ?? ''}`).includes(texto))
    : busqueda.filter(b => b.grupo === 'Ir a')
  ).slice(0, MAX_RESULTADOS)
  const marcado = Math.min(cursor, Math.max(0, resultados.length - 1))

  const abrirBusqueda = () => {
    const r = buscador.current?.getBoundingClientRect()
    if (!r) return
    setLugar({ left: r.left, top: r.bottom + 8, width: r.width })
    setVerAvisos(false)
    setVerCuentas(false)
  }
  const cerrarBusqueda = () => { setLugar(null); setCursor(0) }
  const elegir = (b: ItemBusqueda) => {
    b.onElegir()
    setQ('')
    cerrarBusqueda()
    campo.current?.blur()
  }
  const teclaBusqueda = (e: TeclaReact<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!lugar) abrirBusqueda(); else setCursor(Math.min(marcado + 1, Math.max(0, resultados.length - 1))) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(Math.max(marcado - 1, 0)) }
    else if (e.key === 'Enter') { const b = resultados[marcado]; if (lugar && b) { e.preventDefault(); elegir(b) } }
    else if (e.key === 'Escape') { if (lugar) { e.preventDefault(); cerrarBusqueda() } else if (q) setQ('') }
    else if (e.key === 'Tab') cerrarBusqueda()
  }

  // Ctrl K (o Cmd K) lleva al buscador desde cualquier parte del panel, salvo
  // con un modal abierto: el buscador queda tapado por el velo.
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k' || document.querySelector('.tuo-modal')) return
      e.preventDefault()
      campo.current?.focus()
    }
    window.addEventListener('keydown', atajo)
    return () => window.removeEventListener('keydown', atajo)
  }, [])

  // Los paneles flotantes se cierran al tocar afuera o si cambia el tamaño de
  // la ventana; el de avisos y el de la cuenta, además, con Escape (el buscador tiene el suyo).
  const hayFlotante = verAvisos || verCuentas || lugar !== null
  useEffect(() => {
    if (!hayFlotante) return
    const cerrar = () => { setVerAvisos(false); setVerCuentas(false); setLugar(null); setCursor(0) }
    const afuera = (e: PointerEvent) => {
      const t = e.target as Node
      const adentro = [campana, panelAvisos, buscador, panelBusqueda, botonCuenta, panelCuentas].some(r => r.current?.contains(t))
      if (!adentro) cerrar()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setVerAvisos(false); setVerCuentas(false) } }
    document.addEventListener('pointerdown', afuera)
    window.addEventListener('keydown', esc)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('pointerdown', afuera)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('resize', cerrar)
    }
  }, [hayFlotante])

  const abrirAviso = (a: AvisoNav) => {
    setLeidos(l => (l.includes(a.id) ? l : [...l, a.id]))
    setVerAvisos(false)
    a.onAbrir()
  }
  const actual = items.find(i => i.id === activo)
  const grupos = items.reduce<{ nombre: string; items: ItemNav[] }[]>((acc, it) => {
    const nombre = it.grupo ?? ''
    const g = acc.find(x => x.nombre === nombre)
    if (g) g.items.push(it); else acc.push({ nombre, items: [it] })
    return acc
  }, [])
  const iniciales = negocio.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

  const ir = (id: string) => { onIr(id); setAbierto(false) }

  return (
    <div className="tuo tu-shell" style={{ ['--tuo-tope' as string]: '40px', display: 'flex', height: 'calc(100vh - 40px)', overflow: 'hidden' }}>
      <EstiloTurnos />
      <style>{`
        .tu-sidebar { width: 240px; flex-shrink: 0; transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1); }
        .tu-backdrop { display: none; }
        .tu-menu-btn, .tu-cerrar-btn { display: none !important; }

        .tu-nav-item { position: relative; display: flex; align-items: center; gap: 10px; width: 100%; height: 38px; padding: 0 10px; border-radius: 9px; border: none; background: transparent; color: var(--color-body); font-size: 13.5px; font-weight: 500; font-family: inherit; text-align: left; cursor: pointer; transition: background 160ms ease, color 160ms ease; }
        .tu-nav-item svg { flex-shrink: 0; transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), color 160ms ease; color: var(--color-muted); }
        .tu-nav-item::before { content: ''; position: absolute; left: -8px; top: 9px; bottom: 9px; width: 3px; border-radius: 0 3px 3px 0; background: var(--tuo-grad); opacity: 0; transform: scaleY(0.4); transition: opacity 200ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1); }
        @media (hover: hover) {
          .tu-nav-item:hover { background: var(--color-surface-alt); color: var(--color-text); }
          .tu-nav-item:hover svg { color: var(--color-primary); transform: translateX(1px) scale(1.06); }
        }
        .tu-nav-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
        .tu-nav-item[aria-current="page"] { background: var(--tuo-grad-suave); color: var(--color-text); font-weight: 600; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 22%, transparent); }
        .tu-nav-item[aria-current="page"] svg { color: var(--color-primary); }
        .tu-nav-item[aria-current="page"]::before { opacity: 1; transform: none; }

        .tu-reservas { transition: border-color 180ms ease, box-shadow 220ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1); }
        .tu-reservas .tu-reservas-flecha { transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1); }
        @media (hover: hover) {
          .tu-reservas:hover { border-color: rgba(147,197,253,0.45) !important; box-shadow: 0 10px 28px rgba(37,99,235,0.28); transform: translateY(-1px); }
          .tu-reservas:hover .tu-reservas-flecha { transform: translate(2px, -2px); }
        }
        .tu-reservas:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

        .tu-buscador { transition: border-color 160ms ease, background 160ms ease; }
        @media (hover: hover) { .tu-buscador:hover { border-color: var(--color-border-strong) !important; } }
        .tu-buscador:focus-within { border-color: var(--color-primary) !important; box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent); }

        /* Paneles flotantes del header: resultados del buscador y avisos. */
        .tu-flota { position: fixed; z-index: 145; display: flex; flex-direction: column; max-height: min(460px, calc(100vh - var(--tuo-tope, 0px) - 88px)); overflow: hidden; border-radius: 14px; border: 1px solid var(--color-border); background: var(--color-bg); box-shadow: 0 24px 60px rgba(3,6,14,0.28), 0 2px 8px rgba(3,6,14,0.12); animation: tuFlota 200ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes tuFlota { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: none } }
        .tu-flota-lista { overflow-y: auto; overscroll-behavior: contain; padding: 6px; }
        .tu-flota-item { display: flex; align-items: center; gap: 11px; width: 100%; min-height: 52px; padding: 8px 10px; border: none; border-radius: 10px; background: transparent; text-align: left; font-family: inherit; color: inherit; cursor: pointer; transition: background 140ms ease; }
        .tu-flota-item[aria-selected="true"] { background: var(--color-primary-bg); }
        .tu-flota-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
        @media (hover: hover) { .tu-flota-item:hover { background: var(--color-surface-alt); } .tu-flota-item[aria-selected="true"]:hover { background: var(--color-primary-bg); } }
        .tu-flota-ico { width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center; }
        .tu-avisos { top: calc(var(--tuo-tope, 0px) + 58px); right: 12px; width: min(380px, calc(100vw - 24px)); }
        .tu-cuentas { top: calc(var(--tuo-tope, 0px) + 58px); right: 12px; width: min(340px, calc(100vw - 24px)); }
        .tu-flota-item[aria-current="true"] { background: var(--color-primary-bg); }

        /* Quién usa el panel: la sigla con su color y, si hay lugar, nombre y rol. */
        .tu-usuario { display: inline-flex; align-items: center; gap: 9px; height: 40px; padding: 0 8px 0 5px; flex-shrink: 0; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: inherit; font-family: inherit; text-align: left; cursor: pointer; transition: border-color 150ms ease, background 150ms ease; }
        .tu-usuario:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
        @media (hover: hover) { .tu-usuario:hover { border-color: var(--color-border-strong); background: var(--color-surface); } }
        .tu-sigla { width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0; display: grid; place-items: center; font-family: var(--tuo-fh); font-size: 11.5px; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 15%, var(--color-bg)); border: 1px solid color-mix(in srgb, var(--c) 30%, transparent); }
        .tu-usuario-txt { display: flex; flex-direction: column; min-width: 0; max-width: 150px; line-height: 1.2; }
        .tu-usuario-txt > b { font-size: 12.5px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tu-usuario-txt > small { font-size: 11px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Cada pantalla entra con un fundido corto al cambiar de sección. Solo
           opacidad: un transform acá volvería a este envoltorio el marco de
           referencia de los paneles position: fixed que viven adentro. */
        @keyframes tuVista { from { opacity: 0 } to { opacity: 1 } }
        .tu-vista { animation: tuVista 260ms ease both; }

        @media (max-width: 1100px) { .tu-buscador { display: none !important; } }
        @media (max-width: 768px) { .tu-flota-item { min-height: 58px; } .tu-flota .tuo-btn--sm { height: 44px; min-width: 44px; } .tu-usuario { padding: 0 4px; height: 44px; } }
        @media (max-width: 768px) {
          /* Cerrado queda fuera de la pantalla y también fuera del Tab (visibility), recién se esconde al terminar de salir. */
          .tu-sidebar { position: fixed; left: 0; top: 0; height: 100vh; height: 100dvh; z-index: 140; width: min(84vw, 300px); transform: translateX(-102%); visibility: hidden; transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear 320ms; }
          .tu-sidebar[data-abierto="true"] { transform: translateX(0); visibility: visible; transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1); box-shadow: 12px 0 48px rgba(0,0,0,0.4); }
          .tu-backdrop[data-abierto="true"] { display: block; position: fixed; inset: 0; z-index: 130; background: rgba(3,6,14,0.6); backdrop-filter: blur(3px); animation: tuoVelo 200ms ease; }
          .tu-menu-btn, .tu-cerrar-btn { display: inline-flex !important; }
          .tu-header-ext { display: none !important; }
          .tu-nav-item { height: 44px; font-size: 14.5px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tu-sidebar, .tu-sidebar[data-abierto="true"], .tu-nav-item, .tu-nav-item svg, .tu-nav-item::before, .tu-reservas, .tu-reservas .tu-reservas-flecha, .tu-usuario { transition: none; }
          .tu-vista, .tu-flota { animation: none; }
          .tu-flota-item { transition: none; }
        }
      `}</style>

      <div className="tu-backdrop" data-abierto={abierto} onClick={() => setAbierto(false)} />

      <aside className="tu-sidebar admin-sidebar" data-abierto={abierto} style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 64, padding: '0 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <OrbitaLogo size={28} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: 'var(--tuo-fh)', fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', lineHeight: 1.1 }}>Órbita</div>
            <div className="tuo-rotulo" style={{ fontSize: 9.5, marginTop: 3 }}>Turnos & Agenda</div>
          </div>
          <button ref={botonCerrar} type="button" onClick={() => setAbierto(false)} aria-label="Cerrar menú" className="tuo-btn tuo-btn--icono tuo-btn--sm tu-cerrar-btn"><X size={16} /></button>
        </div>

        {/* El negocio: el planeta alrededor del que gira el menú. */}
        <div style={{ padding: '14px 12px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--tuo-grad)', color: '#fff', fontFamily: 'var(--tuo-fh)', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(37,99,235,0.35)' }}>{iniciales}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{negocio}</div>
              {rubro && <div style={{ fontSize: 11.5, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rubro}</div>}
            </div>
          </div>
        </div>

        <nav aria-label="Turnos" style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 12px', scrollbarWidth: 'none' }}>
          {grupos.map(g => (
            <div key={g.nombre} style={{ marginTop: 12 }}>
              {g.nombre && <div className="tuo-rotulo" style={{ padding: '0 10px 6px', fontSize: 9.5 }}>{g.nombre}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {g.items.map(m => {
                  const a = m.id === activo
                  return (
                    <button key={m.id} onClick={() => ir(m.id)} aria-current={a ? 'page' : undefined} className="tu-nav-item">
                      <m.Icon size={17} strokeWidth={1.7} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
                      {m.badge ? (
                        <span className="tuo-num" aria-label={`${m.badge} sin confirmar`} style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 600, background: 'var(--color-warning-bg)', color: 'var(--chip-warning-fg)' }}>{m.badge}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {reservas && (
          <div style={{ padding: 12, borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
            <a href={reservas} target="_blank" rel="noreferrer" onClick={() => setAbierto(false)} className="tuo-espacio tu-reservas" style={{ display: 'block', width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(147,197,253,0.2)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden className="tuo-late" style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#34D399', boxShadow: '0 0 0 3px rgba(52,211,153,0.2)' }} />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#F1F5FD' }}>Tu página de reservas</span>
                <ArrowUpRight size={15} className="tu-reservas-flecha" color="#93C5FD" aria-hidden />
              </span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 11.5, color: '#8794B2' }}>Publicada · recibe turnos las 24 h</span>
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}> (se abre en otra pestaña)</span>
            </a>
          </div>
        )}
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, height: 64, padding: '0 16px', flexShrink: 0, background: 'color-mix(in srgb, var(--color-bg) 88%, transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border)' }}>
          <button ref={botonMenu} type="button" onClick={() => setAbierto(true)} aria-label="Abrir menú" aria-expanded={abierto} className="tuo-btn tuo-btn--icono tu-menu-btn"><Menu size={18} strokeWidth={1.8} /></button>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <span className="tu-header-ext" style={{ color: 'var(--color-muted)' }}>Turnos</span>
            <span className="tu-header-ext" aria-hidden style={{ color: 'var(--color-subtle)' }}>/</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actual?.label}</span>
          </div>

          <label ref={buscador} className="tu-buscador" style={{ display: 'flex', alignItems: 'center', gap: 8, width: 280, height: 38, padding: '0 8px 0 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'text' }}>
            <Search size={15} color="var(--color-subtle)" style={{ flexShrink: 0 }} />
            <input
              ref={campo} value={q} role="combobox" aria-expanded={lugar !== null} aria-controls="tu-busqueda" aria-autocomplete="list" autoComplete="off"
              aria-activedescendant={lugar && resultados[marcado] ? `tu-busqueda-${marcado}` : undefined}
              onChange={e => { setQ(e.target.value); setCursor(0); if (!lugar) abrirBusqueda() }} onFocus={abrirBusqueda} onClick={() => { if (!lugar) abrirBusqueda() }} onKeyDown={teclaBusqueda}
              aria-label="Buscar turno o cliente" placeholder="Buscar turno o cliente" style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: 13.5, fontFamily: 'inherit' }} />
            <kbd className="tuo-num" style={{ height: 22, padding: '0 6px', borderRadius: 6, display: 'inline-grid', placeItems: 'center', fontSize: 10.5, color: 'var(--color-muted)', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>Ctrl K</kbd>
          </label>

          {fecha && <span className="tuo-chip tuo-chip--borde tuo-num tu-header-ext" style={{ height: 38, padding: '0 12px', borderRadius: 10, fontSize: 12, fontWeight: 500, color: 'var(--color-body)' }}>{fecha}</span>}

          <button onClick={() => setTema(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Pasar a modo claro' : 'Pasar a modo oscuro'} className="tuo-btn tuo-btn--icono" style={{ flexShrink: 0 }}>
            {isDark ? <Sun size={17} strokeWidth={1.6} /> : <Moon size={17} strokeWidth={1.6} />}
          </button>
          <button
            ref={campana} onClick={() => { setVerAvisos(v => !v); setVerCuentas(false); cerrarBusqueda() }} aria-haspopup="dialog" aria-expanded={verAvisos}
            aria-label={sinLeer.length ? `Notificaciones: ${sinLeer.length} sin leer` : 'Notificaciones'} className="tuo-btn tuo-btn--icono" style={{ position: 'relative', flexShrink: 0 }}
          >
            <Bell size={17} strokeWidth={1.6} />
            {sinLeer.length > 0 && <span aria-hidden style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: '50%', background: 'var(--color-error)', border: '2px solid var(--color-bg)' }} />}
          </button>
          {usuario && (
            <button ref={botonCuenta} type="button" className="tu-usuario" onClick={() => { setVerCuentas(v => !v); setVerAvisos(false); cerrarBusqueda() }}
              aria-haspopup="dialog" aria-expanded={verCuentas} aria-label={`Estás usando el panel como ${usuario.nombre}, ${usuario.rol}. Ver el panel de tu equipo`}>
              <span aria-hidden className="tu-sigla" style={{ ['--c' as string]: usuario.color }}>{siglas(usuario.nombre)}</span>
              <span className="tu-usuario-txt tu-header-ext"><b>{usuario.nombre}</b><small>{usuario.rol}</small></span>
              <ChevronDown size={14} className="tu-header-ext" aria-hidden style={{ color: 'var(--color-muted)' }} />
            </button>
          )}
        </header>
        {franja}
        <main ref={principal} className="admin-main" style={{ flex: 1, overflow: 'auto' }}>
          {/* key: cada sección vuelve a montar el envoltorio y dispara la entrada. */}
          <div key={activo} className="tu-vista">{children}</div>
        </main>

        {lugar && (
          <div ref={panelBusqueda} className="tu-flota" style={{ left: lugar.left, top: lugar.top, width: Math.max(lugar.width, 360) }}>
            <div id="tu-busqueda" role="listbox" aria-label="Resultados" className="tu-flota-lista">
              {resultados.length === 0 && (
                <div style={{ padding: '26px 16px', textAlign: 'center' }}>
                  <SearchX size={20} color="var(--color-subtle)" />
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', marginTop: 8 }}>Nada coincide con “{q.trim()}”</div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 3 }}>Probá con el nombre de un cliente, un servicio o una hora.</div>
                </div>
              )}
              {resultados.map((b, i) => (
                <div key={b.id} role="presentation">
                  {(i === 0 || resultados[i - 1].grupo !== b.grupo) && <div className="tuo-rotulo" role="presentation" style={{ padding: '8px 10px 4px', fontSize: 9.5 }}>{b.grupo}</div>}
                  {/* tabIndex -1: el foco se queda en el campo, las flechas mueven la selección */}
                  <button type="button" id={`tu-busqueda-${i}`} role="option" aria-selected={i === marcado} tabIndex={-1} className="tu-flota-item" onMouseEnter={() => setCursor(i)} onClick={() => elegir(b)}>
                    <span aria-hidden className="tu-flota-ico" style={{ color: 'var(--color-primary)', background: 'var(--tuo-grad-suave)' }}><b.Icon size={16} strokeWidth={1.7} /></span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.titulo}</span>
                      {b.detalle && <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.detalle}</span>}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {verCuentas && usuario && (
          <div ref={panelCuentas} role="dialog" aria-label="Quién usa el panel" className="tu-flota tu-cuentas">
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
              <span aria-hidden className="tu-sigla" style={{ ['--c' as string]: usuario.color, width: 38, height: 38, borderRadius: 11, fontSize: 13.5 }}>{siglas(usuario.nombre)}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{viendoComo ? `Estás mirando su panel · ${usuario.rol}` : `${usuario.rol} · tu panel`}</div>
              </div>
            </div>
            <div className="tu-flota-lista">
              {viendoComo && (
                <button type="button" className="tu-flota-item" onClick={() => { setVerCuentas(false); onCuenta?.(null) }}>
                  <span aria-hidden className="tu-flota-ico" style={{ color: 'var(--color-primary)', background: 'var(--tuo-grad-suave)' }}><Undo2 size={16} strokeWidth={1.7} /></span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-primary)' }}>Volver a mi panel</span>
                </button>
              )}
              {cuentas.length > 0 && (
                <div role="presentation" style={{ padding: '10px 10px 6px' }}>
                  <div className="tuo-rotulo" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5 }}><Eye size={12} aria-hidden /> Ver el panel como</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.45 }}>Cada persona entra con su cuenta y ve solo lo que su rol le permite. Mirá cómo lo ve cada una.</div>
                </div>
              )}
              {cuentas.map(c => (
                <button key={c.id} type="button" className="tu-flota-item" aria-current={c.id === viendoComo ? 'true' : undefined} onClick={() => { setVerCuentas(false); onCuenta?.(c.id) }}>
                  <span aria-hidden className="tu-sigla" style={{ ['--c' as string]: c.color, width: 34, height: 34, borderRadius: 10 }}>{siglas(c.nombre)}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.rol}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {verAvisos && (
          <div ref={panelAvisos} role="dialog" aria-label="Notificaciones" className="tu-flota tu-avisos">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px 10px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tuo-h2" style={{ fontSize: 15 }}>Notificaciones</div>
                <div role="status" style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>{sinLeer.length ? `${sinLeer.length} sin leer` : 'Estás al día'}</div>
              </div>
              {sinLeer.length > 0 && (
                <button type="button" onClick={() => setLeidos(avisos.map(a => a.id))} className="tuo-btn tuo-btn--fantasma tuo-btn--sm" style={{ color: 'var(--color-primary)' }}><CheckCheck size={14} /> Marcar leídas</button>
              )}
              <button type="button" onClick={() => setVerAvisos(false)} aria-label="Cerrar notificaciones" className="tuo-btn tuo-btn--icono tuo-btn--sm tuo-btn--fantasma"><X size={16} /></button>
            </div>
            <div className="tu-flota-lista">
              {avisos.length === 0 && (
                <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                  <BellOff size={20} color="var(--color-subtle)" />
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', marginTop: 8 }}>No hay novedades</div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 3 }}>Cuando alguien reserve, cancele o no confirme, te avisamos acá.</div>
                </div>
              )}
              {avisos.map(a => {
                const nueva = a.nueva && !leidos.includes(a.id)
                const tono = TONO[a.tono ?? 'primario']
                return (
                  <button key={a.id} type="button" onClick={() => abrirAviso(a)} className="tu-flota-item" style={{ alignItems: 'flex-start' }}>
                    <span aria-hidden className="tu-flota-ico" style={{ color: tono.fg, background: tono.bg }}><a.Icon size={16} strokeWidth={1.7} /></span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: nueva ? 600 : 500, color: 'var(--color-text)', lineHeight: 1.35 }}>{a.titulo}</span>
                      {a.detalle && <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.detalle}</span>}
                      <span className="tuo-num" style={{ display: 'block', fontSize: 11, color: 'var(--color-subtle)', marginTop: 3 }}>{a.cuando}</span>
                    </span>
                    {nueva && <span role="img" aria-label="Sin leer" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6, background: 'var(--color-primary)' }} />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
