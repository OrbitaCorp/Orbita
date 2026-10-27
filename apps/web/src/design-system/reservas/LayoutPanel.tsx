// Armazón del panel de un módulo de reservas (Turnos, Alquileres, Gimnasio):
// el estándar visual del panel de Tienda (layouts/AdminLayout, Sidebar y
// Header) sin su sesión ni su API. Mismas medidas y mismo lenguaje:
//
//   - barra lateral de 240 px con el logo arriba (64 px), el negocio, los
//     grupos rotulados y, en los ítems que las tienen, sub-secciones plegables
//     unidas por la línea que se enciende hasta la activa (como Configuración
//     en Tienda);
//   - header de 64 px con la miga (producto › sección › sub-sección), el
//     buscador (Ctrl K), la fecha, el tema, la campanita y la cuenta, desde
//     donde se mira el panel como alguien del equipo;
//   - el contenido scrollea adentro de <main> (.admin-main, el fondo del
//     panel), no la ventana; en celular (hasta 768 px) la barra es un cajón.
//
// Los 40 px de --rv-tope son la tira de la demo que va arriba. El cajón: se
// abre con el botón de menú, el foco entra, no se escapa (lo de atrás queda
// inert), Escape, el velo, la X o elegir una sección lo cierran y el foco
// vuelve al botón de menú. Nada de hover por JS: ds-hover y ds-field.
import { useEffect, useId, useRef, useState, type KeyboardEvent as TeclaReact, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, ArrowUpRight, Bell, BellOff, CheckCheck, ChevronDown, Eye, Menu, Moon, Search, SearchX, Sun, Undo2, X } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { useDarkMode } from '@/hooks/useDarkMode'
import { EstiloReservas } from './estilo'
import { retenerFoco } from './piezas'

/** Una sub-sección de un ítem (viaja en ?tab=). `separador` abre un grupo nuevo con una línea fina antes. */
export interface SubNav { id: string; label: string; badge?: number; separador?: boolean }
/** Un ítem del menú. `grupo` lo rotula; con `subs` se pliega y despliega como Configuración en Tienda. */
export interface ItemNav { id: string; label: string; Icon: LucideIcon; badge?: number; grupo?: string; subs?: SubNav[] }
/** Aviso de la campanita. `nueva` arranca sin leer. */
export interface AvisoNav { id: string; Icon: LucideIcon; tono?: 'primario' | 'aviso' | 'error' | 'ok'; titulo: string; detalle?: string; cuando: string; nueva?: boolean; onAbrir: () => void }
/** Algo que el buscador del header puede encontrar. Los del grupo "Ir a" se ofrecen sin escribir nada. */
export interface ItemBusqueda { id: string; grupo: string; titulo: string; detalle?: string; Icon: LucideIcon; onElegir: () => void }
/** Quien usa el panel, o alguien del equipo como quien se lo puede mirar. */
export interface CuentaNav { id: string; nombre: string; rol: string; color: string }

const TONO: Record<NonNullable<AvisoNav['tono']>, { fg: string; bg: string }> = {
  primario: { fg: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
  aviso: { fg: 'var(--chip-warning-fg)', bg: 'var(--color-warning-bg)' },
  error: { fg: 'var(--chip-error-fg)', bg: 'var(--color-error-bg)' },
  ok: { fg: 'var(--chip-success-fg)', bg: 'var(--color-success-bg)' },
}
const MAX_RESULTADOS = 8
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const siglas = (nombre: string) => nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

const CSS = `
  .rvp { --rv-tope: 40px; display: flex; height: calc(100vh - var(--rv-tope)); height: calc(100dvh - var(--rv-tope)); overflow: hidden; background: var(--color-surface); color: var(--color-body); }

  /* ── Barra lateral ── */
  .rvp-lateral { width: 240px; flex-shrink: 0; display: flex; flex-direction: column; background: var(--color-bg); border-right: 1px solid var(--color-border); z-index: 40; }
  .rvp-logo { display: flex; align-items: center; gap: 10px; height: 64px; padding: 0 16px; border-bottom: 1px solid var(--color-border); flex-shrink: 0; }
  .rvp-logo > div { flex: 1; min-width: 0; }
  .rvp-logo b { display: block; font-size: 15px; font-weight: 700; color: var(--color-text); line-height: 1.1; }
  .rvp-logo small { display: block; margin-top: 3px; font-family: var(--rv-mono); font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rvp-negocio { display: flex; align-items: center; gap: 10px; margin: 12px 12px 2px; padding: 10px; border-radius: 10px; background: var(--color-surface); border: 1px solid var(--color-border); min-width: 0; }
  .rvp-negocio > div { flex: 1; min-width: 0; }
  /* Sigla, ítem activo, badge y contador van en tinta oscura del acento sobre su fondo claro (chip-primary-fg
     sobre primary-bg): el blanco sobre el primario a 10-14 px da 3,4-3,7:1 y no llega a AA. */
  .rvp-sigla { width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-primary-bg); color: var(--chip-primary-fg); font-size: 12.5px; font-weight: 700; }
  .rvp-negocio b { display: block; font-size: 13.5px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rvp-negocio small { display: block; font-size: 11.5px; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rvp-nav { flex: 1; overflow-y: auto; padding: 4px 8px 12px; scrollbar-width: thin; }
  .rvp-grupo { margin-top: 12px; }
  .rvp-grupo-rotulo { padding: 0 10px 6px; font-family: var(--rv-mono); font-size: 10px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-muted); }
  .rvp-item { display: flex; align-items: center; gap: 10px; width: 100%; height: 36px; padding: 0 10px; border-radius: 8px; border: none; background: transparent; color: var(--color-body); font: inherit; font-size: 14px; font-weight: 500; text-align: left; cursor: pointer; }
  .rvp-item > svg { flex-shrink: 0; color: var(--color-muted); }
  .rvp-item[data-activo='true'] { background: var(--color-primary-bg); color: var(--chip-primary-fg); font-weight: 600; }
  .rvp-item[data-activo='true'] > svg { color: var(--color-primary); }
  .rvp-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .rvp-item-txt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rvp-badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; display: grid; place-items: center; font-family: var(--rv-mono); font-size: 10px; font-weight: 700; background: var(--color-surface-alt); color: var(--color-muted); flex-shrink: 0; }
  .rvp-item[data-activo='true'] > .rvp-badge, .rvp-sub-btn[aria-current='page'] > .rvp-badge { background: var(--color-bg); color: var(--chip-primary-fg); box-shadow: 0 0 0 1px var(--color-primary); }
  .rvp-chevron { flex-shrink: 0; opacity: 0.6; transition: transform 220ms ease; }
  .rvp-item[aria-expanded='true'] > .rvp-chevron { transform: rotate(180deg); }
  /* Plegado: la fila del grid pasa de 0fr a 1fr (anima el alto sin medirlo). Plegadas quedan sin foco (visibility). */
  .rvp-subs { display: grid; grid-template-rows: 0fr; visibility: hidden; transition: grid-template-rows 240ms cubic-bezier(0.4, 0, 0.2, 1), visibility 240ms; }
  .rvp-subs[data-abierto='true'] { grid-template-rows: 1fr; visibility: visible; }
  .rvp-subs > div { min-height: 0; overflow: hidden; }
  .rvp-subs-lista { display: flex; flex-direction: column; padding-top: 2px; }
  .rvp-sub { position: relative; display: flex; padding-left: 28px; padding-block: 0.5px; }
  .rvp-sub-btn { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; min-height: 30px; padding: 6px 8px; border-radius: 6px; border: none; background: transparent; color: var(--color-muted); font: inherit; font-size: 12.5px; font-weight: 500; line-height: 1.3; text-align: left; cursor: pointer; }
  .rvp-sub-btn > span:first-child { flex: 1; min-width: 0; }
  .rvp-sub-btn[aria-current='page'] { background: var(--color-primary-bg); color: var(--chip-primary-fg); font-weight: 600; }
  .rvp-sub-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  /* La línea que baja del ítem y une las sub-secciones, encendida hasta la activa. */
  .rvp-tramo { position: absolute; left: 17px; width: 1.5px; background: var(--color-border); transition: background-color 200ms ease; }
  .rvp-ramal { position: absolute; left: 17px; top: 50%; margin-top: -0.75px; width: 8px; height: 1.5px; border-radius: 1px; background: var(--color-border); transition: background-color 200ms ease; }
  .rvp-tramo[data-on='true'], .rvp-ramal[data-on='true'] { background: var(--color-primary); }
  .rvp-sub-sep { position: relative; height: 11px; }
  .rvp-sub-sep > i { position: absolute; left: 36px; right: 8px; top: 5px; height: 1px; background: var(--color-border); }
  .rvp-sitio { padding: 8px; border-top: 1px solid var(--color-border); flex-shrink: 0; }
  .rvp-sitio > a { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px; min-height: 44px; text-decoration: none; color: inherit; }
  .rvp-sitio > a:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .rvp-sitio-ico { width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-primary-bg); color: var(--color-primary); }
  .rvp-sitio > a > div { flex: 1; min-width: 0; }
  .rvp-sitio b { display: block; font-size: 13px; font-weight: 600; color: var(--color-text); }
  .rvp-sitio small { display: block; font-size: 11.5px; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* ── Header ── */
  .rvp-cuerpo { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
  .rvp-header { display: flex; align-items: center; gap: 12px; height: 64px; padding: 0 16px; flex-shrink: 0; background: var(--color-bg); border-bottom: 1px solid var(--color-border); }
  .rvp-miga { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; font-size: 14px; }
  .rvp-miga-producto, .rvp-miga-sep { color: var(--color-muted); white-space: nowrap; }
  .rvp-miga-link { background: none; border: none; padding: 0; font: inherit; font-size: 14px; color: var(--color-muted); white-space: nowrap; cursor: pointer; }
  .rvp-miga-actual { font-weight: 500; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rvp-miga-movil { display: none; }
  .rvp-titulo-movil { font-size: 15px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rvp-acciones { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .rvp-ico { position: relative; width: 36px; height: 36px; flex-shrink: 0; border-radius: 8px; border: 1px solid var(--color-border); background: transparent; color: var(--color-body); display: inline-grid; place-items: center; cursor: pointer; }
  .rvp-ico[aria-expanded='true'] { background: var(--color-surface-alt); border-color: var(--color-border-strong); }
  .rvp-ico:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  /* El botón de menú y la X del cajón existen solo en celular (van después de .rvp-ico para ganarle). */
  .rvp-menu, .rvp-cerrar { display: none; }
  .rvp-sep { width: 1px; height: 20px; background: var(--color-border); flex-shrink: 0; margin: 0 2px; }
  .rvp-fecha { display: inline-flex; align-items: center; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--color-border); font-family: var(--rv-mono); font-size: 12px; color: var(--color-body); white-space: nowrap; }
  .rvp-contador { position: absolute; top: -4px; right: -4px; min-width: 17px; height: 17px; padding: 0 3px; border-radius: 9px; border: 2px solid var(--color-bg); display: grid; place-items: center; background: var(--chip-error-fg); color: var(--color-bg); font-family: var(--rv-mono); font-size: 10px; font-weight: 700; line-height: 1; }
  .rvp-usuario { width: 36px; height: 36px; flex-shrink: 0; padding: 0; border-radius: 50%; border: 2px solid transparent; background: transparent; display: grid; place-items: center; cursor: pointer; transition: border-color 150ms ease; }
  .rvp-usuario[aria-expanded='true'] { border-color: var(--color-primary); }
  .rvp-usuario:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  /* El avatar lleva el color de la persona como tinte y anillo, con las iniciales en tinta de texto: las
     iniciales blancas sobre el color de cada una daban 2,2-4,2:1 según la persona. */
  .rvp-avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 700; background: color-mix(in srgb, var(--c, var(--color-primary)) 16%, var(--color-bg)); color: var(--color-text); box-shadow: inset 0 0 0 2px var(--c, var(--color-primary)); flex-shrink: 0; }
  .rvp-buscar { position: relative; display: flex; align-items: center; }
  .rvp-buscar > svg { position: absolute; left: 12px; pointer-events: none; color: var(--color-subtle); }
  .rvp-buscar > input { height: 36px; width: 220px; padding: 0 12px 0 36px; border-radius: 8px; border: 1px solid var(--color-border-strong); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 14px; outline: none; transition: width 180ms ease; }
  .rvp-buscar > input[aria-expanded='true'] { width: 300px; }
  .rvp-buscar > input::placeholder { color: var(--color-subtle); }

  /* ── Paneles flotantes (buscador, avisos, cuenta) ── */
  .rvp-flota { position: fixed; z-index: 145; display: flex; flex-direction: column; max-height: min(460px, calc(100vh - var(--rv-tope) - 88px)); overflow: hidden; border-radius: 12px; border: 1px solid var(--color-border-strong); background: var(--color-surface); box-shadow: 0 12px 36px rgba(0,0,0,0.30); animation: rvpFlota 180ms ease both; }
  @keyframes rvpFlota { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  .rvp-flota-cab { display: flex; align-items: center; gap: 10px; padding: 12px 10px 10px 16px; border-bottom: 1px solid var(--color-border); flex-shrink: 0; }
  .rvp-flota-cab > div { flex: 1; min-width: 0; }
  .rvp-flota-cerrar { width: 32px; height: 32px; border: none; }
  .rvp-flota-titulo { font-size: 13px; font-weight: 600; color: var(--color-text); }
  .rvp-flota-nota { font-size: 12px; color: var(--color-muted); margin-top: 1px; }
  .rvp-flota-lista { overflow-y: auto; overscroll-behavior: contain; padding: 6px; }
  .rvp-flota-grupo { padding: 8px 10px 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-muted); }
  .rvp-flota-item { display: flex; align-items: center; gap: 11px; width: 100%; min-height: 48px; padding: 8px 10px; border: none; border-radius: 8px; background: transparent; text-align: left; font: inherit; color: inherit; cursor: pointer; }
  .rvp-flota-item[aria-selected='true'], .rvp-flota-item[aria-current='true'] { background: var(--color-primary-bg); }
  .rvp-flota-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .rvp-flota-item > span:not(.rvp-flota-ico):not(.rvp-avatar):not(.rvp-punto) { min-width: 0; flex: 1; }
  .rvp-flota-ico { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center; }
  .rvp-flota-t { display: block; font-size: 13.5px; font-weight: 600; color: var(--color-text); line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rvp-flota-d { display: block; font-size: 12px; color: var(--color-muted); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rvp-flota-c { display: block; font-family: var(--rv-mono); font-size: 11px; color: var(--color-muted); margin-top: 3px; }
  .rvp-punto { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; background: var(--color-primary); }
  .rvp-vacio { padding: 26px 16px; text-align: center; }
  .rvp-vacio b { display: block; font-size: 13.5px; font-weight: 600; color: var(--color-text); margin-top: 8px; }
  .rvp-vacio small { display: block; font-size: 12.5px; color: var(--color-muted); margin-top: 3px; }
  .rvp-avisos { top: calc(var(--rv-tope) + 58px); right: 12px; width: min(380px, calc(100vw - 24px)); }
  .rvp-cuentas { top: calc(var(--rv-tope) + 58px); right: 12px; width: min(340px, calc(100vw - 24px)); }
  .rvp-link { background: none; border: none; padding: 4px 8px; border-radius: 6px; font: inherit; font-size: 12px; font-weight: 600; color: var(--chip-primary-fg); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
  .rvp-link:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }

  /* ── Contenido ── */
  .rvp-main { flex: 1; min-width: 0; overflow: auto; overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; }
  @keyframes rvpVista { from { opacity: 0; } }
  .rvp-vista { animation: rvpVista 220ms ease both; }
  .rvp-velo { display: none; }

  @media (max-width: 1100px) { .rvp-buscar { display: none; } }
  @media (max-width: 768px) {
    /* Cerrado queda fuera de la pantalla y fuera del Tab (visibility), recién se esconde al terminar de salir. */
    .rvp-lateral { position: fixed; left: 0; top: var(--rv-tope); bottom: 0; width: min(272px, 86vw); z-index: 140; transform: translateX(-102%); visibility: hidden; transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1), visibility 0s linear 280ms; padding-bottom: env(safe-area-inset-bottom, 0px); }
    .rvp-lateral[data-abierto='true'] { transform: none; visibility: visible; transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 8px 0 32px rgba(0,0,0,0.25); }
    .rvp-velo[data-abierto='true'] { display: block; position: fixed; inset: var(--rv-tope) 0 0 0; z-index: 130; background: rgba(0,0,0,0.55); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); }
    .rvp-menu, .rvp-cerrar { display: inline-grid; }
    .rvp-miga { display: none; }
    .rvp-miga-movil { display: flex; flex: 1; min-width: 0; align-items: center; gap: 10px; }
    .rvp-fecha, .rvp-sep { display: none; }
    .rvp-item { height: 44px; font-size: 14.5px; }
    .rvp-sub-btn { min-height: 44px; font-size: 13.5px; }
    .rvp-ico, .rvp-usuario, .rvp-cerrar, .rvp-flota-cerrar { width: 44px; height: 44px; }
    .rvp-flota-item { min-height: 56px; }
    .rvp-link { min-height: 44px; }
  }
  @media (max-width: 360px) { .rvp-tema { display: none; } }
  @media (prefers-reduced-motion: reduce) {
    .rvp-lateral, .rvp-lateral[data-abierto='true'], .rvp-subs, .rvp-chevron, .rvp-tramo, .rvp-ramal, .rvp-usuario, .rvp-buscar > input { transition: none; }
    .rvp-vista, .rvp-flota { animation: none; }
  }
`

interface Props {
  /** "Turnos", "Alquileres", "Gimnasio": el primer paso de la miga y el rótulo del logo. */
  producto?: string
  negocio: string
  /** Rubro del negocio, debajo del nombre. */
  rubro?: string
  /** Fecha de hoy, en el header. */
  fecha?: string
  items: ItemNav[]
  /** Ítem activo y, si tiene sub-secciones, cuál (viaja en ?tab=). */
  activo: string
  tab?: string
  onIr: (id: string, tab?: string) => void
  /** Link al sitio público; se abre en otra pestaña para no perder el estado del panel. */
  sitio?: string
  sitioDetalle?: string
  /** Avisos de la campanita. */
  avisos?: AvisoNav[]
  /** Lo que encuentra el buscador del header. */
  busqueda?: ItemBusqueda[]
  buscar?: string
  /** Quien está usando el panel: se ve en el header. */
  usuario?: CuentaNav
  /** El equipo: desde el header se puede mirar el panel como lo ve cada uno. */
  cuentas?: CuentaNav[]
  /** Como quién se está mirando el panel (null = el dueño, con su propio panel). */
  viendoComo?: string | null
  /** Elegir como quién mirar; null vuelve al panel propio. */
  onCuenta?: (id: string | null) => void
  /** Franja entre el header y la pantalla (avisa que se está mirando el panel de otro). */
  franja?: ReactNode
  children: ReactNode
}

export default function LayoutPanel({ producto = '', negocio, rubro, fecha, items, activo, tab, onIr, sitio, sitioDetalle, avisos = [], busqueda = [], buscar, usuario, cuentas = [], viendoComo = null, onCuenta, franja, children }: Props) {
  const { isDark, setTema } = useDarkMode()
  const idLateral = useId()
  const idBusqueda = useId()

  // ── El cajón del celular ──
  const [abierto, setAbierto] = useState(false)
  const botonMenu = useRef<HTMLButtonElement>(null)
  const botonCerrar = useRef<HTMLButtonElement>(null)
  const lateral = useRef<HTMLElement>(null)
  // Si al cerrar el foco vuelve al botón de menú: se marca al cerrar y se cumple
  // en el efecto, porque con el cajón abierto el botón está en lo inert.
  const devolverFoco = useRef(false)
  const cerrar = () => { devolverFoco.current = true; setAbierto(false) }
  useEffect(() => {
    if (!abierto) {
      if (devolverFoco.current) { devolverFoco.current = false; botonMenu.current?.focus({ preventScroll: true }) }
      return
    }
    const caja = lateral.current
    botonCerrar.current?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { devolverFoco.current = true; setAbierto(false); return }
      if (caja) retenerFoco(e, caja)
    }
    // Si la ventana crece a escritorio con el cajón abierto, se cierra solo (ahí no hay botón de menú).
    const mq = window.matchMedia('(min-width: 769px)')
    const alCrecer = () => { devolverFoco.current = false; setAbierto(false) }
    window.addEventListener('keydown', tecla)
    mq.addEventListener('change', alCrecer)
    return () => { window.removeEventListener('keydown', tecla); mq.removeEventListener('change', alCrecer) }
  }, [abierto])

  // ── Qué ítem está desplegado (uno a la vez) ──
  // Arranca en el de la pantalla actual y lo sigue al navegar; tocar un ítem con
  // sub-secciones lo pliega o despliega sin navegar (como en Tienda). El toque
  // manual vale mientras no cambie la sección: después vuelve a seguir la activa.
  const [pliegue, setPliegue] = useState<{ activo: string; abierto: string | null } | null>(null)
  const desplegado = pliegue && pliegue.activo === activo ? pliegue.abierto : activo

  const ir = (id: string, t?: string) => { onIr(id, t); if (abierto) cerrar() }
  const tocarItem = (m: ItemNav) => {
    if (!m.subs?.length) { ir(m.id); return }
    setPliegue({ activo, abierto: desplegado === m.id ? null : m.id })
  }

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
  const buscador = useRef<HTMLDivElement>(null)
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
  // Ctrl K (o Cmd K) lleva al buscador desde cualquier parte del panel, salvo con un modal abierto.
  useEffect(() => {
    if (!busqueda.length) return
    const atajo = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k' || document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      campo.current?.focus()
    }
    window.addEventListener('keydown', atajo)
    return () => window.removeEventListener('keydown', atajo)
  }, [busqueda.length])

  // Los paneles flotantes se cierran al tocar afuera, con Escape o si cambia la ventana.
  const hayFlotante = verAvisos || verCuentas || lugar !== null
  useEffect(() => {
    if (!hayFlotante) return
    const cerrarTodo = () => { setVerAvisos(false); setVerCuentas(false); setLugar(null); setCursor(0) }
    const afuera = (e: PointerEvent) => {
      const t = e.target as Node
      if (![campana, panelAvisos, buscador, panelBusqueda, botonCuenta, panelCuentas].some(r => r.current?.contains(t))) cerrarTodo()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setVerAvisos(false); setVerCuentas(false) } }
    document.addEventListener('pointerdown', afuera)
    window.addEventListener('keydown', esc)
    window.addEventListener('resize', cerrarTodo)
    return () => {
      document.removeEventListener('pointerdown', afuera)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('resize', cerrarTodo)
    }
  }, [hayFlotante])

  const abrirAviso = (a: AvisoNav) => {
    setLeidos(l => (l.includes(a.id) ? l : [...l, a.id]))
    setVerAvisos(false)
    a.onAbrir()
  }

  // ── Miga y grupos ──
  const actual = items.find(i => i.id === activo)
  const subActual = actual?.subs?.length ? actual.subs.find(s => s.id === tab) ?? actual.subs[0] : undefined
  // El que scrollea es <main>, no la ventana: al cambiar de sección o de sub-sección vuelve arriba,
  // si no una sección larga deja a la siguiente empezando por la mitad.
  const principal = useRef<HTMLElement>(null)
  const subActivaId = subActual?.id ?? ''
  useEffect(() => { principal.current?.scrollTo({ top: 0 }) }, [activo, subActivaId])
  const grupos = items.reduce<{ nombre: string; items: ItemNav[] }[]>((acc, it) => {
    const nombre = it.grupo ?? ''
    const g = acc.find(x => x.nombre === nombre)
    if (g) g.items.push(it); else acc.push({ nombre, items: [it] })
    return acc
  }, [])
  const sigla = siglas(negocio)

  return (
    <div className="rv rvp">
      <EstiloReservas />
      <style>{CSS}</style>

      <aside ref={lateral} id={idLateral} className="rvp-lateral admin-sidebar" data-abierto={abierto} aria-label="Menú del panel">
        <div className="rvp-logo">
          <OrbitaLogo size={26} />
          <div><b>Orbita</b>{producto && <small>{producto}</small>}</div>
          <button ref={botonCerrar} type="button" className="ds-hover rvp-ico rvp-cerrar" onClick={cerrar} aria-label="Cerrar menú"><X size={18} strokeWidth={1.8} /></button>
        </div>

        <div className="rvp-negocio">
          <span className="rvp-sigla" aria-hidden>{sigla || <OrbitaLogo size={18} />}</span>
          <div><b>{negocio}</b>{rubro && <small>{rubro}</small>}</div>
        </div>

        <nav className="rvp-nav" aria-label="Secciones">
          {grupos.map(g => (
            <div key={g.nombre} className="rvp-grupo">
              {g.nombre && <div className="rvp-grupo-rotulo">{g.nombre}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {g.items.map(m => {
                  const esActivo = m.id === activo
                  const conSubs = !!m.subs?.length
                  const open = conSubs && desplegado === m.id
                  const idSubs = `${idLateral}-${m.id}`
                  return (
                    <div key={m.id}>
                      <button
                        type="button"
                        className="ds-hover rvp-item"
                        data-activo={esActivo}
                        aria-current={esActivo && !conSubs ? 'page' : undefined}
                        aria-expanded={conSubs ? open : undefined}
                        aria-controls={conSubs ? idSubs : undefined}
                        onClick={() => tocarItem(m)}
                      >
                        <m.Icon size={16} strokeWidth={1.6} aria-hidden />
                        <span className="rvp-item-txt">{m.label}</span>
                        {m.badge ? <span className="rvp-badge" aria-label={`${m.badge} pendientes`}>{m.badge}</span> : null}
                        {conSubs && <ChevronDown size={14} strokeWidth={1.8} className="rvp-chevron" aria-hidden />}
                      </button>
                      {conSubs && (
                        <Subs item={m} id={idSubs} abierto={open} activa={esActivo ? subActual?.id ?? null : null} onIr={ir} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {sitio && (
          <div className="rvp-sitio">
            <a className="ds-hover" href={sitio} target="_blank" rel="noreferrer" onClick={() => { if (abierto) cerrar() }}>
              <span className="rvp-sitio-ico" aria-hidden><ArrowUpRight size={15} strokeWidth={1.8} /></span>
              <div><b>Tu sitio</b><small>{sitioDetalle ?? 'Lo que ven tus clientes para reservar'}</small></div>
              <span className="rv-sr"> (se abre en otra pestaña)</span>
            </a>
          </div>
        )}
      </aside>
      <div className="rvp-velo" data-abierto={abierto} onClick={cerrar} aria-hidden />

      {/* Con el cajón abierto, lo de atrás no recibe foco ni lo lee el lector de pantalla. */}
      <div className="rvp-cuerpo" inert={abierto || undefined}>
        <header className="rvp-header">
          <button ref={botonMenu} type="button" className="ds-hover rvp-ico rvp-menu" onClick={() => setAbierto(true)} aria-label="Abrir menú" aria-expanded={abierto} aria-controls={idLateral}><Menu size={18} strokeWidth={1.8} /></button>

          {/* Miga completa — solo escritorio */}
          <div className="rvp-miga">
            {producto && <><span className="rvp-miga-producto">{producto}</span><span className="rvp-miga-sep" aria-hidden>›</span></>}
            {actual && subActual ? (
              <>
                <button type="button" className="ds-link rvp-miga-link" onClick={() => ir(actual.id, actual.subs![0].id)}>{actual.label}</button>
                <span className="rvp-miga-sep" aria-hidden>›</span>
                <span className="rvp-miga-actual">{subActual.label}</span>
              </>
            ) : (
              <span className="rvp-miga-actual">{actual?.label ?? negocio}</span>
            )}
          </div>
          {/* Header simplificado — solo celular: flecha de volver (desde una sub-sección) y el título */}
          <div className="rvp-miga-movil">
            {actual && subActual && (
              <button type="button" className="ds-hover rvp-ico" onClick={() => ir(actual.id, actual.subs![0].id)} aria-label={`Volver a ${actual.label}`}><ArrowLeft size={17} strokeWidth={1.8} /></button>
            )}
            <span className="rvp-titulo-movil">{subActual?.label ?? actual?.label ?? negocio}</span>
          </div>

          <div className="rvp-acciones">
            {busqueda.length > 0 && (
              <div ref={buscador} className="rvp-buscar">
                <Search size={15} strokeWidth={1.5} aria-hidden />
                <input
                  ref={campo} value={q} role="combobox" aria-expanded={lugar !== null} aria-controls={idBusqueda} aria-autocomplete="list" autoComplete="off"
                  aria-activedescendant={lugar && resultados[marcado] ? `${idBusqueda}-${marcado}` : undefined}
                  onChange={e => { setQ(e.target.value); setCursor(0); if (!lugar) abrirBusqueda() }} onFocus={abrirBusqueda} onClick={() => { if (!lugar) abrirBusqueda() }} onKeyDown={teclaBusqueda}
                  aria-label={buscar ?? 'Buscar'} placeholder={buscar ?? 'Buscar...'} className="ds-field"
                />
              </div>
            )}
            {fecha && <span className="rvp-fecha">{fecha}</span>}
            {(busqueda.length > 0 || fecha) && <span className="rvp-sep" aria-hidden />}
            <button type="button" className="ds-hover rvp-ico rvp-tema" onClick={() => setTema(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Pasar a modo claro' : 'Pasar a modo oscuro'}>
              {isDark ? <Sun size={17} strokeWidth={1.5} /> : <Moon size={17} strokeWidth={1.5} />}
            </button>
            <button
              ref={campana} type="button" className="ds-hover rvp-ico" onClick={() => { setVerAvisos(v => !v); setVerCuentas(false); cerrarBusqueda() }}
              aria-haspopup="dialog" aria-expanded={verAvisos} aria-label={sinLeer.length ? `Notificaciones: ${sinLeer.length} sin leer` : 'Notificaciones'}
            >
              <Bell size={17} strokeWidth={1.5} />
              {sinLeer.length > 0 && <span className="rvp-contador" aria-hidden>{sinLeer.length}</span>}
            </button>
            {usuario && (
              <button
                ref={botonCuenta} type="button" className="rvp-usuario" onClick={() => { setVerCuentas(v => !v); setVerAvisos(false); cerrarBusqueda() }}
                aria-haspopup="dialog" aria-expanded={verCuentas} aria-label={`Tu cuenta: ${usuario.nombre}, ${usuario.rol}${cuentas.length ? '. Ver el panel de tu equipo' : ''}`} title={usuario.nombre}
              >
                <span className="rvp-avatar" style={{ ['--c' as string]: usuario.color }} aria-hidden>{siglas(usuario.nombre)}</span>
              </button>
            )}
          </div>
        </header>
        {franja}
        <main ref={principal} className="rvp-main admin-main">
          {/* key: cada sección vuelve a montar el envoltorio y dispara la entrada. */}
          <div key={`${activo}:${subActual?.id ?? ''}`} className="rvp-vista">{children}</div>
        </main>

        {lugar && (
          <div ref={panelBusqueda} className="rvp-flota" style={{ left: lugar.left, top: lugar.top, width: Math.max(lugar.width, 360) }}>
            <div id={idBusqueda} role="listbox" aria-label="Resultados" className="rvp-flota-lista">
              {resultados.length === 0 && (
                <div className="rvp-vacio">
                  <SearchX size={20} color="var(--color-subtle)" aria-hidden />
                  <b>Nada coincide con “{q.trim()}”</b>
                  <small>Probá con otro nombre, una hora o una sección.</small>
                </div>
              )}
              {resultados.map((b, i) => (
                <div key={b.id} role="presentation">
                  {(i === 0 || resultados[i - 1].grupo !== b.grupo) && <div className="rvp-flota-grupo" role="presentation">{b.grupo}</div>}
                  {/* tabIndex -1: el foco se queda en el campo, las flechas mueven la selección */}
                  <button type="button" id={`${idBusqueda}-${i}`} role="option" aria-selected={i === marcado} tabIndex={-1} className="rvp-flota-item" onMouseEnter={() => setCursor(i)} onClick={() => elegir(b)}>
                    <span aria-hidden className="rvp-flota-ico" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-bg)' }}><b.Icon size={16} strokeWidth={1.7} /></span>
                    <span><span className="rvp-flota-t">{b.titulo}</span>{b.detalle && <span className="rvp-flota-d">{b.detalle}</span>}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {verCuentas && usuario && (
          <div ref={panelCuentas} role="dialog" aria-label="Tu cuenta" className="rvp-flota rvp-cuentas">
            <div className="rvp-flota-cab" style={{ padding: '14px 16px' }}>
              <span className="rvp-avatar" style={{ ['--c' as string]: usuario.color, width: 38, height: 38, fontSize: 13.5 }} aria-hidden>{siglas(usuario.nombre)}</span>
              <div>
                <div className="rvp-flota-titulo" style={{ fontSize: 14 }}>{usuario.nombre}</div>
                <div className="rvp-flota-nota">{viendoComo ? `Estás mirando su panel · ${usuario.rol}` : `${usuario.rol} · tu panel`}</div>
              </div>
            </div>
            <div className="rvp-flota-lista">
              {viendoComo && (
                <button type="button" className="ds-hover rvp-flota-item" onClick={() => { setVerCuentas(false); onCuenta?.(null) }}>
                  <span aria-hidden className="rvp-flota-ico" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-bg)' }}><Undo2 size={16} strokeWidth={1.7} /></span>
                  <span><span className="rvp-flota-t" style={{ color: 'var(--color-primary)' }}>Volver a mi panel</span></span>
                </button>
              )}
              {cuentas.length > 0 && (
                <div role="presentation" style={{ padding: '10px 10px 6px' }}>
                  <div className="rvp-flota-grupo" style={{ padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Eye size={12} aria-hidden /> Ver el panel como</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.45 }}>Cada persona entra con su cuenta y ve solo lo que su rol le permite.</div>
                </div>
              )}
              {cuentas.map(c => (
                <button key={c.id} type="button" className="ds-hover rvp-flota-item" aria-current={c.id === viendoComo ? 'true' : undefined} onClick={() => { setVerCuentas(false); onCuenta?.(c.id) }}>
                  <span aria-hidden className="rvp-avatar" style={{ ['--c' as string]: c.color }}>{siglas(c.nombre)}</span>
                  <span><span className="rvp-flota-t">{c.nombre}</span><span className="rvp-flota-d">{c.rol}</span></span>
                </button>
              ))}
            </div>
          </div>
        )}

        {verAvisos && (
          <div ref={panelAvisos} role="dialog" aria-label="Notificaciones" className="rvp-flota rvp-avisos">
            <div className="rvp-flota-cab">
              <div>
                <div className="rvp-flota-titulo">Notificaciones</div>
                <div className="rvp-flota-nota" role="status">{sinLeer.length ? `${sinLeer.length} sin leer` : 'Estás al día'}</div>
              </div>
              {sinLeer.length > 0 && (
                <button type="button" className="ds-hover rvp-link" onClick={() => setLeidos(avisos.map(a => a.id))}><CheckCheck size={14} aria-hidden /> Marcar leídas</button>
              )}
              <button type="button" className="ds-hover rvp-ico rvp-flota-cerrar" onClick={() => setVerAvisos(false)} aria-label="Cerrar notificaciones"><X size={16} /></button>
            </div>
            <div className="rvp-flota-lista">
              {avisos.length === 0 && (
                <div className="rvp-vacio">
                  <BellOff size={20} color="var(--color-subtle)" aria-hidden />
                  <b>No hay novedades</b>
                  <small>Cuando alguien reserve, cancele o no confirme, te avisamos acá.</small>
                </div>
              )}
              {avisos.map(a => {
                const nueva = a.nueva && !leidos.includes(a.id)
                const tono = TONO[a.tono ?? 'primario']
                return (
                  <button key={a.id} type="button" className="ds-hover rvp-flota-item" style={{ alignItems: 'flex-start' }} onClick={() => abrirAviso(a)}>
                    <span aria-hidden className="rvp-flota-ico" style={{ color: tono.fg, background: tono.bg }}><a.Icon size={16} strokeWidth={1.7} /></span>
                    <span>
                      <span className="rvp-flota-t" style={{ fontWeight: nueva ? 600 : 500, whiteSpace: 'normal' }}>{a.titulo}</span>
                      {a.detalle && <span className="rvp-flota-d">{a.detalle}</span>}
                      <span className="rvp-flota-c">{a.cuando}</span>
                    </span>
                    {nueva && <span className="rvp-punto" role="img" aria-label="Sin leer" />}
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

/**
 * Las sub-secciones de un ítem, unidas por la línea que baja del ícono: queda
 * apagada y se enciende desde arriba HASTA la activa (lo de más abajo sigue
 * apagado). Se dibuja por tramos (medio ítem cada uno) para no medir nada.
 */
function Subs({ item, id, abierto, activa, onIr }: { item: ItemNav; id: string; abierto: boolean; activa: string | null; onIr: (id: string, tab?: string) => void }) {
  const subs = item.subs ?? []
  const iActiva = activa ? subs.findIndex(s => s.id === activa) : -1
  return (
    <div id={id} className="rvp-subs" data-abierto={abierto}>
      <div>
        <div className="rvp-subs-lista">
          {subs.map((s, i) => {
            const sa = i === iActiva
            return (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {s.separador && i > 0 && (
                  <div className="rvp-sub-sep" aria-hidden>
                    <span className="rvp-tramo" data-on={i <= iActiva} style={{ top: 0, bottom: 0 }} />
                    <i />
                  </div>
                )}
                <div className="rvp-sub">
                  <span className="rvp-tramo" data-on={i <= iActiva} style={{ top: 0, height: '50%' }} aria-hidden />
                  {i < subs.length - 1 && <span className="rvp-tramo" data-on={i < iActiva} style={{ top: '50%', bottom: 0 }} aria-hidden />}
                  <span className="rvp-ramal" data-on={sa} aria-hidden />
                  <button type="button" className="ds-hover rvp-sub-btn" aria-current={sa ? 'page' : undefined} onClick={() => onIr(item.id, s.id)}>
                    <span>{s.label}</span>
                    {s.badge ? <span className="rvp-badge">{s.badge}</span> : null}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
