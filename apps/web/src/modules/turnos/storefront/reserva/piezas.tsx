// Piezas chicas que comparten la reserva y "Mis turnos".
import type { ReactNode, Ref } from 'react'
import { AlertCircle, Check, CheckCircle2, Loader2 } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import type { TemaNegocio } from '../tema'

/** Brillos del color del negocio detrás del contenido. Puro adorno. */
export function Fondo({ t }: { t: TemaNegocio }) {
  const luz = (pct: number) => `radial-gradient(circle, color-mix(in srgb, ${t.c.primary} ${pct}%, transparent), transparent 65%)`
  return (
    <div className="tur-fondo" aria-hidden>
      <span style={{ top: -160, right: '-8%', width: 620, height: 620, background: luz(t.oscuro ? 20 : 13) }} />
      <span style={{ top: 420, left: '-12%', width: 480, height: 480, background: luz(t.oscuro ? 11 : 8) }} />
    </div>
  )
}

/** Título + bajada de un paso. El título recibe el foco al cambiar de paso (tabIndex -1). */
export function Bloque({ titulo, sub, refTitulo, children }: { titulo: string; sub?: ReactNode; refTitulo?: Ref<HTMLHeadingElement>; children: ReactNode }) {
  return (
    <section>
      <h1 ref={refTitulo} tabIndex={-1} className="tur-h tur-titulo">{titulo}</h1>
      {sub && <p className="tur-bajada">{sub}</p>}
      <div style={{ marginTop: 28 }}>{children}</div>
    </section>
  )
}

/** Check de la esquina de una opción elegida. Va como hijo directo del botón. */
export function Tilde() {
  return <span className="tur-tilde" aria-hidden><Check size={16} strokeWidth={3} /></span>
}

/** Botón principal que se traba y muestra el giro mientras "envía". */
export function BotonCarga({ cargando, textoCargando, children, className = '', disabled, ...resto }: {
  cargando: boolean; textoCargando: string; children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...resto} className={`tur-btn ${className}`} disabled={disabled || cargando} data-cargando={cargando} aria-busy={cargando}>
      {cargando ? <><Loader2 size={18} className="tur-gira" aria-hidden /> {textoCargando}</> : children}
    </button>
  )
}

interface PropsCampo {
  id: string
  label: string
  opcional?: boolean
  valor: string
  onChange: (v: string) => void
  onBlur?: () => void
  /** Mensaje de error ya decidido por quien lo usa (solo si corresponde mostrarlo). */
  error?: string
  ayuda?: string
  /** El campo está bien y conviene confirmarlo con un check. */
  ok?: boolean
  tipo?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  autoCapitalize?: string
  placeholder?: string
  prefijo?: string
  maxLength?: number
}

/** Campo con label visible, ayuda y error al pie. Letra de 16 px: con menos, iOS hace zoom. */
export function Campo({ id, label, opcional, valor, onChange, onBlur, error, ayuda, ok, tipo = 'text', inputMode, autoComplete, autoCapitalize, placeholder, prefijo, maxLength }: PropsCampo) {
  return (
    <div className="tur-campo">
      <label htmlFor={id}>{label}{opcional && <span> (opcional)</span>}</label>
      <div className="tur-caja" data-error={!!error}>
        {prefijo && <span className="tur-caja-pre" aria-hidden>{prefijo}</span>}
        <input id={id} type={tipo} value={valor} inputMode={inputMode} autoComplete={autoComplete} autoCapitalize={autoCapitalize} placeholder={placeholder} maxLength={maxLength}
          required={!opcional} aria-invalid={!!error} aria-describedby={`${id}-ayuda`}
          onChange={e => onChange(e.target.value)} onBlur={onBlur} />
        {ok && !error && <span className="tur-caja-icono" aria-hidden><CheckCircle2 size={19} color="var(--tur-ok)" /></span>}
      </div>
      <p id={`${id}-ayuda`} className="tur-ayuda" data-error={!!error} aria-live="polite">
        {error ? <><AlertCircle size={15} aria-hidden /> {error}</> : ayuda}
      </p>
    </div>
  )
}

export function Interruptor({ on, onChange, etiqueta }: { on: boolean; onChange: (v: boolean) => void; etiqueta: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={etiqueta} onClick={() => onChange(!on)} className="tur-switch" />
}

/** La firma: quién hizo posible la reserva, sin competir con la marca del negocio. */
export function FirmaOrbita({ texto = 'Reservado con Órbita' }: { texto?: string }) {
  return (
    <span className="tur-firma">
      <OrbitaLogo size={26} />
      {texto}
    </span>
  )
}
