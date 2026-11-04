// Campos de formulario del alta: label siempre visible, ayuda y error debajo,
// y el error enganchado al control con aria-describedby para que el lector de
// pantalla lo lea junto con el campo.
import type { InputHTMLAttributes, ReactNode } from 'react'
import { AlertCircle, Check, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DatosAlta } from './modelo'
import { BotonQueEs } from './QueEs'

/** Lo que recibe cada paso con formulario. */
export interface PropsPaso {
  d: DatosAlta
  poner: <K extends keyof DatosAlta>(campo: K, valor: DatosAlta[K]) => void
  /** Error a mostrar en ese campo, si corresponde mostrarlo ya. */
  error: (campo: string) => string | undefined
  tocar: (campo: string) => void
}

export function MensajeError({ id, children }: { id: string; children: ReactNode }) {
  return <p id={id} className="tuob-error" role="alert"><AlertCircle size={14} aria-hidden /> {children}</p>
}

/** Debajo de un campo que completó Orbi, hasta que la persona lo edita a mano. */
export function Sugerido({ id }: { id?: string }) {
  return <p id={id} className="tuob-sugerido"><Sparkles size={13} aria-hidden /> Sugerido por Orbi, editá si querés</p>
}

/** Recuadro de aviso: información (azul), advertencia (ámbar) o confirmación (verde). */
export function Aviso({ tono = 'info', Icon, children }: { tono?: 'info' | 'aviso' | 'ok'; Icon: LucideIcon; children: ReactNode }) {
  return <div className="tuob-aviso" data-tono={tono}><Icon size={16} aria-hidden /><div>{children}</div></div>
}

interface PropsCampo {
  id: string
  label: string
  opcional?: boolean
  ayuda?: ReactNode
  /** Se muestra solo si el campo ya se tocó o si se intentó avanzar: lo decide quien lo usa. */
  error?: string
  /** Lo completó Orbi: el campo se marca y abajo lo dice, hasta que la persona lo edita. */
  sugerido?: boolean
  children?: ReactNode
}

export function Marco({ id, label, opcional, ayuda, error, sugerido, children }: PropsCampo) {
  return (
    <div className="tuob-campo">
      <label htmlFor={id}>{label}{opcional && <small>opcional</small>}</label>
      {children}
      {error ? <MensajeError id={`${id}-error`}>{error}</MensajeError>
        : sugerido ? <Sugerido id={`${id}-ayuda`} />
        : ayuda ? <p id={`${id}-ayuda`} className="tuob-ayuda">{ayuda}</p> : null}
    </div>
  )
}

export const describe = (id: string, error?: string, ayuda?: ReactNode) => (error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined)

type PropsEntrada = PropsCampo & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'onChange' | 'value' | 'prefix'> & {
  valor: string
  onCambio: (v: string) => void
  onTocar?: () => void
  prefijo?: ReactNode
  sufijo?: ReactNode
  /** Botón adentro del campo, a la derecha (mostrar/ocultar contraseña). */
  accion?: ReactNode
  mono?: boolean
}

export function Entrada({ id, label, opcional, ayuda, error, sugerido, valor, onCambio, onTocar, prefijo, sufijo, accion, mono, className, ...resto }: PropsEntrada) {
  return (
    <Marco id={id} label={label} opcional={opcional} ayuda={ayuda} error={error} sugerido={sugerido}>
      <span className="tuob-control" data-sugerido={sugerido || undefined}>
        {prefijo && <span className="tuob-prefijo" aria-hidden>{prefijo}</span>}
        <input
          {...resto} id={id} value={valor}
          onChange={e => onCambio(e.target.value)} onBlur={onTocar}
          aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, sugerido || ayuda)}
          className={`tuob-input${prefijo ? ' tuob-input--prefijo' : ''}${sufijo ? ' tuob-input--sufijo' : ''}${mono ? ' tuob-input--mono' : ''}${className ? ` ${className}` : ''}`}
          style={accion ? { paddingRight: 48 } : undefined}
        />
        {sufijo && <span className="tuob-sufijo" aria-hidden>{sufijo}</span>}
        {accion}
      </span>
    </Marco>
  )
}

export function AreaTexto({ id, label, opcional, ayuda, error, sugerido, valor, onCambio, placeholder, maxLength, filas = 3 }: PropsCampo & { valor: string; onCambio: (v: string) => void; placeholder?: string; maxLength?: number; filas?: number }) {
  return (
    <Marco id={id} label={label} opcional={opcional} ayuda={ayuda} error={error} sugerido={sugerido}>
      <span className="tuob-control" data-sugerido={sugerido || undefined}>
        <textarea id={id} className="tuob-input" rows={filas} value={valor} placeholder={placeholder} maxLength={maxLength}
          onChange={e => onCambio(e.target.value)} aria-describedby={describe(id, error, sugerido || ayuda)} />
        {maxLength !== undefined && <span className="tuob-cuenta tuo-num" aria-hidden>{valor.length}/{maxLength}</span>}
      </span>
    </Marco>
  )
}

export function Desplegable({ id, label, ayuda, error, valor, onCambio, opciones }: PropsCampo & { valor: number; onCambio: (v: number) => void; opciones: { valor: number; texto: string }[] }) {
  return (
    <Marco id={id} label={label} ayuda={ayuda} error={error}>
      <select id={id} className="tuob-input" value={valor} onChange={e => onCambio(Number(e.target.value))}
        aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, ayuda)}>
        {opciones.map(o => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
    </Marco>
  )
}

interface PropsTarjeta { elegido: boolean; onElegir: () => void; Icon: LucideIcon; titulo: ReactNode; texto: ReactNode; deshabilitado?: boolean }

/**
 * Opción excluyente en forma de tarjeta. Es un radio de verdad (flechas y lector
 * de pantalla salen solos) que cubre la tarjeta entera, invisible: se elige
 * tocando en cualquier lado. La tarjeta es un div y no un label a propósito: así
 * el botón de "qué es" (`ayuda`) puede ser un <button> de verdad, por encima del
 * radio, y no un control adentro de un label (HTML inválido, y tocarlo elegiría
 * la opción). El título y el texto le dan el nombre al radio por aria.
 */
export function Opcion({ grupo, valor, elegido, onElegir, Icon, titulo, texto, ayuda }: PropsTarjeta & {
  grupo: string
  valor: string
  /** Abre el "qué es" de la opción en un modal. `de` es el nombre de la opción, para el lector de pantalla. */
  ayuda?: { de: string; onAbrir: () => void }
}) {
  const id = `${grupo}-${valor}`
  return (
    <div className="tuob-opcion" data-elegido={elegido}>
      <input type="radio" name={grupo} value={valor} checked={elegido} onChange={onElegir} aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} />
      <Icon size={20} strokeWidth={1.8} aria-hidden />
      <span><strong id={`${id}-t`}>{titulo}</strong><span id={`${id}-d`}>{texto}</span></span>
      {ayuda && <BotonQueEs de={ayuda.de} onAbrir={ayuda.onAbrir} />}
      <i className="tuob-marca-opcion" aria-hidden><Check size={12} strokeWidth={3.2} /></i>
    </div>
  )
}

/** Igual que Opcion pero se pueden marcar varias: es un checkbox de verdad. */
export function Casilla({ elegido, onElegir, Icon, titulo, texto, deshabilitado }: PropsTarjeta) {
  return (
    <label className="tuob-opcion" data-elegido={elegido} data-fija={deshabilitado}>
      <input type="checkbox" checked={elegido} onChange={onElegir} disabled={deshabilitado} />
      <Icon size={20} strokeWidth={1.8} aria-hidden />
      <span><strong>{titulo}</strong><span>{texto}</span></span>
      <i className="tuob-marca-opcion tuob-marca-opcion--casilla" aria-hidden><Check size={12} strokeWidth={3.2} /></i>
    </label>
  )
}
