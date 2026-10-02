import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as KeyboardEventReact, type PointerEvent as PointerEventReact } from 'react'
import { useRouter } from 'next/router'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'
import { useMediaQuery } from '@/components/orbi/useMediaQuery'
import { useDisponibilidadOrbi } from '@/components/orbi/useDisponibilidadOrbi'
import { useOrbiViewport } from '@/components/orbi/useOrbiViewport'
import { ID_PANEL_ORBI } from '@/components/orbi/types'
import { adminPath, currentSlug } from '@/lib/tenant'
import { OrbiV2Contexto, type Vista } from '../piezas/contexto'
import { ANCHO_MAXIMO, ANCHO_MINIMO, topeDeAncho, useOrbiV2 } from '../estado/useOrbiV2'
import { OrbiChat } from './OrbiChat'
import s from '../orbi.module.css'

const PASO_TECLADO_PX = 16

/** Una sola región aria-live para todo Orbi: anuncia estados, nunca el texto que se va escribiendo. */
export function useAnunciador() {
  const [texto, setTexto] = useState('')
  const anunciar = useCallback((t: string) => {
    // Vaciar y volver a poner: el lector repite un aviso igual al anterior.
    setTexto('')
    requestAnimationFrame(() => setTexto(t))
  }, [])
  const region = <div aria-live="polite" role="status" className={s.soloLector}>{texto}</div>
  return { anunciar, region }
}

export function useRutasDeOrbi() {
  const router = useRouter()
  const negocioId = currentSlug() ?? (typeof router.query.negocioId === 'string' ? router.query.negocioId : null)
  const moduloPadre = typeof router.query.moduloPadre === 'string' ? router.query.moduloPadre : 'ventas'
  return useMemo(() => ({
    pagina: negocioId ? `${adminPath(negocioId, moduloPadre, 'orbi')}?vista=chat` : null,
    manual: negocioId ? adminPath(negocioId, moduloPadre, 'manual') : null,
  }), [negocioId, moduloPadre])
}

/** El foco no sale del diálogo con Tab (superpuesto y hoja: son modales). */
function atraparFoco(e: KeyboardEventReact<HTMLElement>) {
  if (e.key !== 'Tab') return
  const enfocables = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
  if (!enfocables.length) return
  const primero = enfocables[0]
  const ultimo = enfocables[enfocables.length - 1]
  if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus() }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus() }
}

/**
 * El Orbi nuevo fuera de su página. Desde 1280 px, acoplado al costado: va
 * como último hijo del shell del panel (un flex en fila), ocupa su ancho y la
 * sección del medio se achica, nunca queda tapada. Entre 768 y 1279 px, encima
 * del contenido: empujar ahí deja a Pedidos o Productos con ~600 px, poco para
 * sus tablas. En el celular, hoja desde abajo. En la página de Orbi no se
 * muestra: ahí el chat es la página.
 */
export default function OrbiV2() {
  const router = useRouter()
  const isOpen = useOrbiStore(st => st.isOpen)
  const close = useOrbiStore(st => st.close)
  const ancho = useOrbiV2(st => st.ancho)
  const setAncho = useOrbiV2(st => st.setAncho)
  const hoja = useOrbiV2(st => st.hoja)
  const setHoja = useOrbiV2(st => st.setHoja)
  const ancha = useMediaQuery('(min-width: 1280px)')
  const celular = useMediaQuery('(max-width: 767px)')
  const vista: Vista = ancha ? 'lateral' : celular ? 'hoja' : 'superpuesto'
  const rutas = useRutasDeOrbi()
  const { anunciar, region } = useAnunciador()
  const partes = Array.isArray(router.query.slug) ? router.query.slug : []
  const enLaPagina = partes[partes.length - 1] === 'orbi'

  useDisponibilidadOrbi('panel', isOpen)
  useOrbiViewport()
  useEffect(() => { useOrbiV2.getState().cargarAncho() }, [])

  // Foco: al cerrar vuelve a lo que lo abrió (el botón de la barra).
  const abrioDesde = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (isOpen) abrioDesde.current = document.activeElement as HTMLElement | null
    else abrioDesde.current?.focus?.()
  }, [isOpen])

  // Esc cierra el superpuesto y la hoja (modales) desde cualquier lado. El lateral acoplado no es modal:
  // Esc lo cierra solo con el foco adentro, para no pisar el Esc de las
  // pantallas del panel (cerrar un modal de Pedidos no tiene que cerrar Orbi).
  useEffect(() => {
    if (!isOpen || enLaPagina || vista === 'lateral') return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [isOpen, enLaPagina, vista, close])

  // El lateral nunca le deja menos de 720 px a la sección del medio: el tope
  // se recalcula con la ventana y con el menú (abierto o angosto). Se mide
  // `main` + Orbi, que suman lo mismo sea cual sea el ancho de Orbi.
  const refLateral = useRef<HTMLElement>(null)
  const [tope, setTope] = useState(ANCHO_MAXIMO)
  useLayoutEffect(() => {
    const lateral = refLateral.current
    const medio = lateral?.parentElement?.querySelector('main')
    if (!lateral || !medio) return
    // ResizeObserver avisa una vez al empezar a observar: no hace falta medir a mano.
    const ro = new ResizeObserver(() => setTope(topeDeAncho(medio.getBoundingClientRect().width + lateral.getBoundingClientRect().width)))
    ro.observe(medio)
    return () => ro.disconnect()
  }, [vista, isOpen, enLaPagina])
  const anchoEfectivo = Math.min(ancho, tope)
  const ajustarAncho = (px: number) => setAncho(Math.min(tope, px))

  const modal = vista !== 'lateral'
  const navegar = useCallback((ruta: string) => {
    void router.push(ruta)
    if (modal) close()
  }, [router, modal, close])
  const contexto = useMemo(() => ({ vista, navegar, anunciar }), [vista, navegar, anunciar])

  // Tirador del lateral: arrastrar o flechas de a 16 px.
  const arrastre = useRef<{ x: number; ancho: number } | null>(null)
  const alBajar = (e: PointerEventReact<HTMLButtonElement>) => {
    arrastre.current = { x: e.clientX, ancho: anchoEfectivo }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const alMover = (e: PointerEventReact<HTMLButtonElement>) => {
    if (!arrastre.current) return
    ajustarAncho(arrastre.current.ancho + (arrastre.current.x - e.clientX))
  }
  const alSoltar = () => { arrastre.current = null }

  // Hoja: tocar el tirador alterna media/completa; arrastrar abajo desde media cierra.
  const arrastreHoja = useRef<number | null>(null)
  const hojaBajar = (e: PointerEventReact<HTMLButtonElement>) => { arrastreHoja.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId) }
  const hojaSoltar = (e: PointerEventReact<HTMLButtonElement>) => {
    const desde = arrastreHoja.current
    arrastreHoja.current = null
    if (desde === null) return
    const delta = e.clientY - desde
    if (Math.abs(delta) < 8) setHoja(hoja === 'media' ? 'completa' : 'media')
    else if (delta < -60) setHoja('completa')
    else if (delta > 60) { if (hoja === 'completa') setHoja('media'); else close() }
  }

  if (!isOpen || enLaPagina) return null

  const expandir = rutas.pagina ? () => { void router.push(rutas.pagina!) } : undefined
  const pestana = rutas.pagina ? () => { window.open(rutas.pagina!, '_blank', 'noopener') } : undefined
  const manual = rutas.manual ? () => navegar(rutas.manual!) : undefined
  const chat = <OrbiChat onExpandir={expandir} onPestana={pestana} onCerrar={close} onAbrirManual={manual} />

  return (
    <OrbiV2Contexto.Provider value={contexto}>
      {region}
      {vista === 'lateral' && (
        <aside
          ref={refLateral}
          id={ID_PANEL_ORBI}
          className={`${s.raiz} ${s.lateral}`}
          style={{ width: anchoEfectivo }}
          aria-label="Orbi"
          onKeyDown={e => { if (e.key === 'Escape' && !e.defaultPrevented) close() }}
        >
          <button
            type="button"
            className={s.tirador}
            role="separator"
            aria-orientation="vertical"
            aria-label="Ancho de Orbi"
            aria-valuemin={ANCHO_MINIMO}
            aria-valuemax={Math.max(ANCHO_MINIMO, tope)}
            aria-valuenow={anchoEfectivo}
            title="Arrastrá para cambiar el ancho"
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
            onKeyDown={e => {
              if (e.key === 'ArrowLeft') { e.preventDefault(); ajustarAncho(anchoEfectivo + PASO_TECLADO_PX) }
              if (e.key === 'ArrowRight') { e.preventDefault(); ajustarAncho(anchoEfectivo - PASO_TECLADO_PX) }
            }}
          />
          {chat}
        </aside>
      )}
      {vista === 'superpuesto' && (
        <>
          <div className={s.scrim} onClick={close} aria-hidden />
          <div id={ID_PANEL_ORBI} role="dialog" aria-modal="true" aria-label="Orbi" className={`${s.raiz} ${s.superpuesto}`} onKeyDown={atraparFoco}>
            {chat}
          </div>
        </>
      )}
      {vista === 'hoja' && (
        <>
          <div className={s.scrim} onClick={close} aria-hidden />
          <div id={ID_PANEL_ORBI} role="dialog" aria-modal="true" aria-label="Orbi" className={`${s.raiz} ${s.hoja}`} data-alto={hoja} onKeyDown={atraparFoco}>
            <button
              type="button"
              className={s.tiradorHoja}
              aria-label={hoja === 'media' ? 'Agrandar Orbi a pantalla completa' : 'Achicar Orbi a media pantalla'}
              onPointerDown={hojaBajar}
              onPointerUp={hojaSoltar}
              onPointerCancel={() => { arrastreHoja.current = null }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHoja(hoja === 'media' ? 'completa' : 'media') } }}
            >
              <span aria-hidden />
            </button>
            {chat}
          </div>
        </>
      )}
    </OrbiV2Contexto.Provider>
  )
}
