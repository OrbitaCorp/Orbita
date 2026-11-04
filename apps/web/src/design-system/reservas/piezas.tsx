// Piezas chicas de reservas (design system): encabezado de pantalla, campos, modal, aviso,
// indicadores, el gráfico de barras, el borrador de un formulario y su barra de
// guardar. Todas pintan con las clases rv- de estilo.tsx. Nada de acá sabe de
// canchas, de socios ni de turnos.
import { useEffect, useEffectEvent, useId, useRef, useState, type CSSProperties, type ReactNode, type Ref, type RefObject } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { Toast } from '@/design-system/components/Toast'

export function Encabezado({ rotulo, titulo, bajada, acciones }: { rotulo?: string; titulo: ReactNode; bajada?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="rv-cab">
      <div style={{ minWidth: 0 }}>
        {rotulo && <div className="rv-rotulo" style={{ marginBottom: 6 }}>{rotulo}</div>}
        <h1 className="rv-h1">{titulo}</h1>
        {bajada && <p className="rv-bajada">{bajada}</p>}
      </div>
      {acciones && <div className="rv-cab-acciones">{acciones}</div>}
    </div>
  )
}

export function Seccion({ titulo, bajada, children, acciones }: { titulo: ReactNode; bajada?: ReactNode; children: ReactNode; acciones?: ReactNode }) {
  return (
    <section className="rv-card rv-card--pad">
      <div className="rv-entre" style={{ marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="rv-h2">{titulo}</h2>
          {bajada && <p className="rv-bajada" style={{ marginTop: 3 }}>{bajada}</p>}
        </div>
        {acciones}
      </div>
      {children}
    </section>
  )
}

// Campo, Area y Selector: el <label> lleva solo el rótulo; la ayuda y el error van
// debajo del control, fuera del label, y el control los enlaza con aria-describedby
// (y aria-invalid si hay error). Adentro del label el lector de pantalla los leía dos
// veces: como parte del nombre del campo y otra vez como su descripción.

/** El id de lo que describe al control: el error si hay; si no, la ayuda. */
const idNota = (id: string, error?: string, ayuda?: string) => (error ? `${id}-e` : ayuda ? `${id}-a` : undefined)

/**
 * La ayuda o el error de un campo. El error reemplaza a la ayuda y se anuncia solo
 * (role=alert). La key los hace dos elementos distintos: si el error fuera la misma
 * ayuda con otro texto y otro rol, el anuncio podía no salir.
 */
function NotaCampo({ id, error, ayuda }: { id: string; error?: string; ayuda?: string }) {
  if (error) return <span key="e" id={`${id}-e`} className="rv-error" role="alert">{error}</span>
  if (ayuda) return <span key="a" id={`${id}-a`} className="rv-ayuda">{ayuda}</span>
  return null
}

export function Campo({ label, ayuda, error, prefijo, ...resto }: {
  label: string; ayuda?: string; error?: string; prefijo?: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; maxLength?: number; inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal'; autoComplete?: string; disabled?: boolean; readOnly?: boolean; children?: never
  /** Para un campo de fecha: desde y hasta qué día deja elegir el navegador. */
  min?: string; max?: string
}) {
  const id = useId()
  const { value, onChange, type = 'text', placeholder, maxLength, inputMode, autoComplete, disabled, readOnly, min, max } = resto
  const input = <input id={id} className="rv-input" type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} autoComplete={autoComplete} disabled={disabled} readOnly={readOnly} min={min} max={max} aria-invalid={error ? true : undefined} aria-describedby={idNota(id, error, ayuda)} />
  return (
    <div className="rv-campo">
      <label htmlFor={id}>{label}</label>
      {prefijo ? <span className="rv-con-prefijo"><i>{prefijo}</i>{input}</span> : input}
      <NotaCampo id={id} error={error} ayuda={ayuda} />
    </div>
  )
}

// `ref` (React 19 lo pasa como prop) para insertar texto donde está el cursor, p. ej. una llave en un mensaje.
export function Area({ label, ayuda, value, onChange, placeholder, maxLength, disabled, ref }: { label: string; ayuda?: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; disabled?: boolean; ref?: Ref<HTMLTextAreaElement> }) {
  const id = useId()
  return (
    <div className="rv-campo">
      <label htmlFor={id}>{label}</label>
      <textarea ref={ref} id={id} className="rv-textarea" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} disabled={disabled} aria-describedby={idNota(id, undefined, ayuda)} />
      <NotaCampo id={id} ayuda={ayuda} />
    </div>
  )
}

export function Selector<T extends string | number>({ label, ayuda, valor, onChange, opciones }: { label: string; ayuda?: string; valor: T; onChange: (v: T) => void; opciones: { id: T; label: string }[] }) {
  const id = useId()
  return (
    <div className="rv-campo">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="rv-select" value={String(valor)} onChange={e => { const o = opciones.find(x => String(x.id) === e.target.value); if (o) onChange(o.id) }} aria-describedby={idNota(id, undefined, ayuda)}>
        {opciones.map(o => <option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}
      </select>
      <NotaCampo id={id} ayuda={ayuda} />
    </div>
  )
}

export function Segmentado<T extends string | number>({ label, valor, onChange, opciones, lleno }: { label: string; valor: T; onChange: (v: T) => void; opciones: { id: T; label: string }[]; lleno?: boolean }) {
  return (
    <div role="group" aria-label={label} className={`rv-seg${lleno ? ' rv-seg--lleno' : ''}`}>
      {opciones.map(o => <button key={String(o.id)} type="button" aria-pressed={o.id === valor} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  )
}

// La llave sola, para cabeceras o tablas donde el rótulo ya está en otro lado (`label` o `labelledBy`).
export function Switch({ on, onChange, label, labelledBy, disabled }: { on: boolean; onChange: (v: boolean) => void; label?: string; labelledBy?: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} aria-labelledby={labelledBy} disabled={disabled} className="rv-switch" onClick={() => onChange(!on)} />
}

export function FilaSwitch({ titulo, ayuda, on, onChange }: { titulo: string; ayuda?: string; on: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="rv-fila-switch">
      <div><b id={id}>{titulo}</b>{ayuda && <small>{ayuda}</small>}</div>
      <Switch on={on} onChange={onChange} labelledBy={id} />
    </div>
  )
}

export const Chip = ({ tono, children, style }: { tono?: 'primario' | 'ok' | 'aviso' | 'error' | 'gris' | 'borde'; children: ReactNode; style?: CSSProperties }) =>
  <span className={`rv-chip${tono ? ` rv-chip--${tono}` : ''}`} style={style}>{children}</span>

export function Sigla({ nombre, color, size = 36 }: { nombre: string; color?: string; size?: number }) {
  const s = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'
  // Tonos 700: todos dan 4,5:1 o más con la sigla blanca encima (los 600 daban 3,0-3,9:1).
  const COLORES = ['#1D4ED8', '#BE185D', '#047857', '#B45309', '#6D28D9', '#0E7490']
  const c = color ?? COLORES[(nombre.length + s.charCodeAt(0)) % COLORES.length]
  return <span className="rv-sigla" style={{ width: size, height: size, background: c, fontSize: Math.round(size / 3) }} aria-hidden>{s}</span>
}

export function Vacio({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="rv-vacio">
      <div className="rv-h3">{titulo}</div>
      {texto && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{texto}</p>}
      {accion}
    </div>
  )
}

/** Lo que puede recibir el foco adentro de un modal o un cajón. */
export const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Tab y Shift+Tab dan la vuelta adentro de `caja`: el foco no se escapa a lo que quedó detrás. */
export function retenerFoco(e: globalThis.KeyboardEvent, caja: HTMLElement) {
  if (e.key !== 'Tab') return
  const focos = [...caja.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(el => el.getClientRects().length > 0)
  if (!focos.length) { e.preventDefault(); return }
  const primero = focos[0]
  const ultimo = focos[focos.length - 1]
  const actual = document.activeElement
  if (e.shiftKey && (actual === primero || actual === caja || !caja.contains(actual))) { e.preventDefault(); ultimo.focus() }
  else if (!e.shiftKey && (actual === ultimo || !caja.contains(actual))) { e.preventDefault(); primero.focus() }
}

/**
 * Frena el scroll de la página mientras hay un modal o un cajón abierto. Va en
 * <html>, que es el que scrollea (globals.css le pone overflow-x): con
 * overflow en <body>, body pasaba a ser un contenedor de scroll y todo lo
 * sticky (la tira de la demo, el header del sitio y el del panel) se anclaba a
 * él y se iba de la pantalla mientras el modal estaba abierto. Devuelve cómo
 * dejarlo como estaba.
 */
export function frenarScroll(): () => void {
  const raiz = document.documentElement
  const antes = raiz.style.overflow
  raiz.style.overflow = 'hidden'
  return () => { raiz.style.overflow = antes }
}

/**
 * Modal centrado (hoja desde abajo en celular): Escape y el velo cierran, el
 * foco entra, da la vuelta adentro y vuelve a donde estaba al cerrar. La
 * cabecera lleva rótulo, título y bajada; `icono` va a la izquierda del título
 * y conserva su tamaño (solo el texto se estira). Con `onEnviar` el cuerpo y el
 * pie van dentro de un <form>: Enter guarda y un botón type="submit" del pie
 * envía. `encima` lo apila sobre otro modal abierto; `foco` es el campo donde
 * arranca el teclado al abrir (un buscador); sin eso, el modal.
 *
 * Con dos abiertos, Escape y Tab los atiende solo el de más arriba (el último
 * del documento). Un desplegable abierto adentro (data-esc="propio") se cierra
 * primero: recién el segundo Escape cierra el modal.
 */
export function Modal({ titulo, rotulo, bajada, icono, onCerrar, onEnviar, children, pie, encima, ancho, foco }: {
  titulo: ReactNode; rotulo?: string; bajada?: ReactNode; icono?: ReactNode; onCerrar: () => void; onEnviar?: () => void
  children: ReactNode; pie?: ReactNode; encima?: boolean; ancho?: number; foco?: RefObject<HTMLElement | null>
}) {
  const caja = useRef<HTMLDivElement>(null)
  const id = useId()
  // Los últimos onCerrar y foco sin volver a montar el efecto: los padres los
  // pasan como valores nuevos en cada render, y remontar devolvía el foco al
  // disparador y lo traía de nuevo al modal (con el teclado, el foco saltaba en
  // cada clic).
  const cerrar = useEffectEvent(() => onCerrar())
  const enfocar = useEffectEvent(() => (foco?.current ?? caja.current)?.focus())
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    enfocar()
    // En captura, para ganarle a lo que quedó abajo del velo.
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Tab') return
      const abiertos = document.querySelectorAll('.rv-modal')
      if (abiertos[abiertos.length - 1] !== caja.current) return
      if (e.key === 'Tab') { if (caja.current) retenerFoco(e, caja.current); return }
      if (e.target instanceof Element && e.target.closest('[data-esc="propio"]')) return
      e.stopPropagation()
      cerrar()
    }
    window.addEventListener('keydown', tecla, true)
    const soltar = frenarScroll()
    return () => { window.removeEventListener('keydown', tecla, true); soltar(); if (antes?.isConnected) antes.focus({ preventScroll: true }) }
  }, [])
  const cuerpo = <div className="rv-modal-cuerpo">{children}</div>
  const acciones = pie ? <div className="rv-modal-pie">{pie}</div> : null
  return (
    // mousedown y no click: soltar el mouse afuera después de seleccionar un texto no cierra.
    <div className="rv-velo" data-encima={encima || undefined} onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div ref={caja} className="rv-modal" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} style={ancho ? ({ ['--rv-ancho' as string]: `${ancho}px` } as CSSProperties) : undefined}>
        <div className="rv-modal-cab">
          {icono}
          <div className="rv-modal-cab-txt">
            {rotulo && <div className="rv-rotulo" style={{ marginBottom: 6 }}>{rotulo}</div>}
            <h2 id={id} className="rv-h2" style={{ fontSize: 18, overflowWrap: 'anywhere' }}>{titulo}</h2>
            {bajada && <div className="rv-bajada" style={{ marginTop: 3, fontSize: 13 }}>{bajada}</div>}
          </div>
          <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
        </div>
        {onEnviar
          ? <form className="rv-modal-form" noValidate onSubmit={e => { e.preventDefault(); onEnviar() }}>{cuerpo}{acciones}</form>
          : <>{cuerpo}{acciones}</>}
      </div>
    </div>
  )
}

/** Un aviso que se va solo. Devuelve la función para avisar y el elemento a montar. */
export function useAviso(): [(titulo: string, descripcion?: string) => void, ReactNode] {
  const [toast, setToast] = useState<{ id: number; titulo: string; descripcion?: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const serie = useRef(0)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const avisar = (titulo: string, descripcion?: string) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ id: ++serie.current, titulo, descripcion })
    timer.current = setTimeout(() => setToast(null), 3200)
  }
  const nodo = toast ? (
    <div key={toast.id} className="rv-toast" aria-live="polite">
      <Toast variant="success" title={toast.titulo} description={toast.descripcion} onClose={() => setToast(null)} />
    </div>
  ) : null
  return [avisar, nodo]
}

/**
 * El borrador de un formulario: arranca igual a lo guardado y sabe si cambió.
 * `set` toca una clave; `descartar` vuelve a lo guardado. `base` es lo guardado:
 * - un valor (lo que llega del negocio): si cambia de afuera, el borrador lo
 *   sigue y `cambiado` se apaga solo al guardar;
 * - una función que lo arma: lo guardado queda en memoria y `guardar` lo pisa
 *   con el borrador (las pantallas de la demo que no persisten nada).
 */
export function useBorrador<T extends object>(base: T | (() => T)) {
  const [enMemoria, setEnMemoria] = useState<T | null>(() => (typeof base === 'function' ? (base as () => T)() : null))
  const guardado = enMemoria ?? (base as T)
  const [v, setV] = useState<T>(() => guardado)
  const cambiado = JSON.stringify(v) !== JSON.stringify(guardado)
  return {
    v, setV, cambiado,
    set: <K extends keyof T>(k: K, x: T[K]) => setV(a => ({ ...a, [k]: x })),
    descartar: () => setV(guardado),
    guardar: () => setEnMemoria(v),
  }
}

/**
 * La barra de guardar: solo aparece con cambios, pegada abajo mientras se
 * sigue bajando. `motivo` es por qué todavía no se puede guardar ("Marcá al
 * menos un día"): se muestra y el botón queda apagado. `nota` es un detalle
 * debajo del estado ("Al quitar una actividad, sus clases salen de la grilla").
 */
export function BarraGuardar({ cambiado, onGuardar, onDescartar, motivo, nota }: { cambiado: boolean; onGuardar: () => void; onDescartar: () => void; motivo?: string; nota?: string }) {
  if (!cambiado) return null
  return (
    <div className="rv-guardar" role="region" aria-label="Cambios sin guardar">
      <span className="rv-guardar-txt">{motivo ?? 'Tenés cambios sin guardar.'}{nota && !motivo && <small>{nota}</small>}</span>
      <span className="rv-guardar-btns">
        <button type="button" className="rv-btn" onClick={onDescartar}><RotateCcw size={15} aria-hidden /> Descartar</button>
        <button type="button" className="rv-btn rv-btn--primario" onClick={onGuardar} disabled={!!motivo}><Check size={15} aria-hidden /> Guardar cambios</button>
      </span>
    </div>
  )
}

/**
 * La variación de un indicador contra el período anterior: un porcentaje o,
 * con `unidades`, una cantidad (con `sufijo`, p. ej. " pts"). `valor: null` es
 * que no hay período anterior: el chip lo dice en vez de inventar un número.
 * `invertir` da vuelta el color cuando subir es malo (ausencias, costos).
 * `vs` es contra qué se compara ("el mes pasado"): va en la nota y en el tooltip.
 */
export interface DeltaKpi { valor: number | null; unidades?: boolean; sufijo?: string; invertir?: boolean; vs?: string }

const TOPE_PCT = 999

/**
 * Un indicador, con la anatomía de la KpiCard de Tienda: rótulo en mayúsculas,
 * ícono en un chip (con `tono`), el valor en mono y, al pie, la variación con
 * una nota corta. Sin `Icon` es un número con rótulo y nota. Sin `nota`, con
 * `delta` la nota dice contra qué se compara. `i` escalona la entrada.
 */
export function Kpi({ label, valor, Icon, tono, delta, nota, i = 0 }: {
  label: string; valor: ReactNode; Icon?: LucideIcon; tono?: 'primario' | 'ok' | 'aviso' | 'error'; delta?: DeltaKpi; nota?: ReactNode; i?: number
}) {
  let chip: ReactNode = null
  if (delta) {
    const v = delta.valor
    if (v === null) chip = <span className="rv-kpi-delta">– sin datos previos</span>
    else {
      const abs = Math.abs(v)
      const texto = delta.unidades ? `${Math.round(abs)}${delta.sufijo ?? ''}` : abs > TOPE_PCT ? `>${TOPE_PCT}%` : `${abs.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
      // Neutro es lo que se leería como cero: 0,04 % o 0,3 unidades no son una suba.
      const neutro = delta.unidades ? Math.round(abs) === 0 : Math.round(abs * 10) === 0
      const sube = v > 0
      const bueno = delta.invertir ? !sube : sube
      const vs = delta.vs ?? 'el período anterior'
      // El número exacto queda en el tooltip (arriba de 999 % el chip dice ">999%").
      const exacto = neutro ? undefined : `${sube ? '+' : '-'}${abs.toLocaleString('es-AR', { maximumFractionDigits: 1 })}${delta.unidades ? delta.sufijo ?? '' : '%'} vs ${vs}`
      chip = (
        <span className="rv-kpi-delta" data-tono={neutro ? undefined : bueno ? 'ok' : 'mal'} title={exacto}>
          <span aria-hidden>{neutro ? '–' : sube ? '▲' : '▼'}</span>
          <span className="rv-sr">{neutro ? 'Sin cambios:' : sube ? 'Subió' : 'Bajó'}</span>
          {texto}
        </span>
      )
    }
  }
  const notaPie = nota ?? (delta ? `vs ${delta.vs ?? 'el período anterior'}` : null)
  const titulo = typeof valor === 'string' || typeof valor === 'number' ? String(valor) : undefined
  return (
    <div className="rv-card rv-kpi rv-entra" style={{ ['--i' as string]: i } as CSSProperties}>
      <div className="rv-kpi-cab">
        <span className="rv-kpi-rotulo">{label}</span>
        {Icon && <span className="rv-kpi-ico" data-tono={tono} aria-hidden><Icon size={16} strokeWidth={1.5} /></span>}
      </div>
      <span className="rv-kpi-valor" title={titulo}>{valor}</span>
      {(chip || notaPie) && (
        <div className="rv-kpi-pie">
          {chip}
          {notaPie && <span className="rv-kpi-nota">{notaPie}</span>}
        </div>
      )}
    </div>
  )
}

/**
 * Barras simples: una serie, con rótulo abajo. Sin librería: es un gráfico de
 * una serie y así se lee igual en claro y en oscuro con el acento del sistema.
 * La columna más alta lleva su valor escrito (da la escala); el de cada una se
 * ve al pasar el mouse, al llegar con Tab o al tocarla (cada columna recibe el
 * foco), así que ningún número depende del hover. El lector de pantalla las
 * recorre como una lista: "2 nov: $ 85.000".
 */
export function Barras({ datos, formato, label }: { datos: { rotulo: string; valor: number; suave?: boolean }[]; formato: (v: number) => string; label: string }) {
  const max = Math.max(1, ...datos.map(d => d.valor))
  const alta = datos.reduce((m, d, i) => (d.valor > datos[m].valor ? i : m), 0)
  return (
    <div className="rv-barras" role="list" aria-label={label}>
      {/* El índice en la key: dos rótulos pueden repetirse (dos planes con el mismo nombre). */}
      {datos.map((d, i) => (
        <div key={`${i}-${d.rotulo}`} className="rv-barra" role="listitem" tabIndex={0} aria-label={`${d.rotulo}: ${formato(d.valor)}`} data-max={(i === alta && d.valor > 0) || undefined}>
          <i data-tono={d.suave ? 'suave' : undefined} style={{ height: `${Math.max(3, Math.round((d.valor / max) * 100))}%` }}>
            <b className="rv-barra-dato" aria-hidden>{formato(d.valor)}</b>
          </i>
          <span aria-hidden>{d.rotulo}</span>
        </div>
      ))}
    </div>
  )
}

// El texto va en un span: la nota es flex (para un ícono o una acción al lado) y un texto con
// un <b> adentro se partía en ítems separados por el gap.
export function Nota({ tono, children }: { tono?: 'aviso' | 'info'; children: ReactNode }) {
  return <div className={`rv-nota${tono ? ` rv-nota--${tono}` : ''}`}><span className="rv-nota-txt">{children}</span></div>
}

/**
 * Filtros de una lista. En escritorio, siempre a la vista; en celular quedan
 * plegados detrás de un botón "Filtros" (con lo elegido en `resumen`), para
 * que la lista arranque arriba de todo y no después de una pared de chips.
 */
export function Filtros({ resumen, children }: { resumen?: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  return (
    <div className="rv-filtros">
      <button type="button" className="rv-btn rv-btn--sm rv-filtros-boton" aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto(!abierto)}>
        <SlidersHorizontal size={15} aria-hidden /> Filtros{resumen ? `: ${resumen}` : ''}
      </button>
      <div id={id} className="rv-filtros-cuerpo" data-abierto={abierto}>{children}</div>
    </div>
  )
}

export const EtiquetaDemo = ({ children = 'Demo: sincronización simulada' }: { children?: ReactNode }) => <span className="rv-demo">{children}</span>
