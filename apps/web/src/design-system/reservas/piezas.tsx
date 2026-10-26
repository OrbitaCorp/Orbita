// Piezas chicas de reservas (design system): encabezado de pantalla, campos, modal, aviso,
// indicadores y el gráfico de barras. Todas pintan con las clases rv- de
// estilo.tsx. Nada de acá sabe de canchas ni de propiedades.
import { useEffect, useEffectEvent, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
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

export function Campo({ label, ayuda, error, prefijo, ...resto }: {
  label: string; ayuda?: string; error?: string; prefijo?: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; maxLength?: number; inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal'; autoComplete?: string; children?: never
}) {
  const id = useId()
  const { value, onChange, type = 'text', placeholder, maxLength, inputMode, autoComplete } = resto
  const input = <input id={id} className="rv-input" type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} autoComplete={autoComplete} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-e` : ayuda ? `${id}-a` : undefined} />
  return (
    <label className="rv-campo" htmlFor={id}>
      <span>{label}</span>
      {prefijo ? <span className="rv-con-prefijo"><i>{prefijo}</i>{input}</span> : input}
      {error ? <span id={`${id}-e`} className="rv-error" role="alert">{error}</span> : ayuda ? <span id={`${id}-a`} className="rv-ayuda">{ayuda}</span> : null}
    </label>
  )
}

export function Area({ label, ayuda, value, onChange, placeholder, maxLength }: { label: string; ayuda?: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  const id = useId()
  return (
    <label className="rv-campo" htmlFor={id}>
      <span>{label}</span>
      <textarea id={id} className="rv-textarea" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} />
      {ayuda && <span className="rv-ayuda">{ayuda}</span>}
    </label>
  )
}

export function Selector<T extends string | number>({ label, ayuda, valor, onChange, opciones }: { label: string; ayuda?: string; valor: T; onChange: (v: T) => void; opciones: { id: T; label: string }[] }) {
  const id = useId()
  return (
    <label className="rv-campo" htmlFor={id}>
      <span>{label}</span>
      <select id={id} className="rv-select" value={String(valor)} onChange={e => { const o = opciones.find(x => String(x.id) === e.target.value); if (o) onChange(o.id) }}>
        {opciones.map(o => <option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}
      </select>
      {ayuda && <span className="rv-ayuda">{ayuda}</span>}
    </label>
  )
}

export function Segmentado<T extends string | number>({ label, valor, onChange, opciones, lleno }: { label: string; valor: T; onChange: (v: T) => void; opciones: { id: T; label: string }[]; lleno?: boolean }) {
  return (
    <div role="group" aria-label={label} className={`rv-seg${lleno ? ' rv-seg--lleno' : ''}`}>
      {opciones.map(o => <button key={String(o.id)} type="button" aria-pressed={o.id === valor} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  )
}

export function FilaSwitch({ titulo, ayuda, on, onChange }: { titulo: string; ayuda?: string; on: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="rv-fila-switch">
      <div><b id={id}>{titulo}</b>{ayuda && <small>{ayuda}</small>}</div>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={id} className="rv-switch" onClick={() => onChange(!on)} />
    </div>
  )
}

export const Chip = ({ tono, children, style }: { tono?: 'primario' | 'ok' | 'aviso' | 'error' | 'gris' | 'borde'; children: ReactNode; style?: CSSProperties }) =>
  <span className={`rv-chip${tono ? ` rv-chip--${tono}` : ''}`} style={style}>{children}</span>

export function Sigla({ nombre, color, size = 36 }: { nombre: string; color?: string; size?: number }) {
  const s = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'
  const COLORES = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DB2777', '#0891B2']
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
 * foco entra, da la vuelta adentro y vuelve a donde estaba al cerrar.
 */
export function Modal({ titulo, bajada, onCerrar, children, pie, ancho }: { titulo: string; bajada?: ReactNode; onCerrar: () => void; children: ReactNode; pie?: ReactNode; ancho?: number }) {
  const caja = useRef<HTMLDivElement>(null)
  const id = useId()
  // El último onCerrar sin volver a montar el efecto: los padres lo pasan como
  // función nueva en cada render, y remontar devolvía el foco al disparador y
  // lo traía de nuevo al modal (con el teclado, el foco saltaba en cada clic).
  const cerrarConTecla = useEffectEvent(() => onCerrar())
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    caja.current?.focus()
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { cerrarConTecla(); return }
      if (caja.current) retenerFoco(e, caja.current)
    }
    document.addEventListener('keydown', tecla)
    const soltar = frenarScroll()
    return () => { document.removeEventListener('keydown', tecla); soltar(); antes?.focus?.() }
  }, [])
  return (
    <div className="rv-velo" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div ref={caja} className="rv-modal" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} style={ancho ? ({ ['--rv-ancho' as string]: `${ancho}px` } as CSSProperties) : undefined}>
        <div className="rv-modal-cab">
          <div>
            <h2 id={id} className="rv-h2" style={{ fontSize: 18 }}>{titulo}</h2>
            {bajada && <p className="rv-bajada" style={{ marginTop: 3, fontSize: 13 }}>{bajada}</p>}
          </div>
          <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="rv-modal-cuerpo">{children}</div>
        {pie && <div className="rv-modal-pie">{pie}</div>}
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

export function Kpi({ label, valor, nota, i = 0 }: { label: string; valor: ReactNode; nota?: string; i?: number }) {
  return (
    <div className="rv-card rv-kpi rv-entra" style={{ ['--i' as string]: i } as CSSProperties}>
      <span className="rv-rotulo">{label}</span>
      <span className="rv-kpi-valor">{valor}</span>
      {nota && <span className="rv-kpi-nota">{nota}</span>}
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

export function Nota({ tono, children }: { tono?: 'aviso' | 'info'; children: ReactNode }) {
  return <div className={`rv-nota${tono ? ` rv-nota--${tono}` : ''}`}>{children}</div>
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
