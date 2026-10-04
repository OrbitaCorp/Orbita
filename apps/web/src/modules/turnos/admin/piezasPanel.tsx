// Piezas de los formularios del panel de Turnos (demo): el modal donde se crea,
// se edita o se mira el detalle de algo, la confirmación antes de borrar, los
// días y los turnos de atención (mañana y tarde) y el mensaje de WhatsApp.
//
// Todo lo que se abre es un MODAL centrado, como en el resto de Órbita
// (design-system/Modal): nada se abre desde el costado. En celular el mismo
// modal es una hoja que sube desde abajo.
// Los campos son los de Configuración (tuc-, en configuracion/ui.tsx); PanelTurnos
// monta esa hoja de estilos una sola vez.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { X, Copy, Check, CheckCheck, Clock3, Send, Share2, Trash2, PhoneOff, Sun, Sunset, CalendarX } from 'lucide-react'
import { DIAS, DIAS_CORTOS, horaTxt, type Recurso, type Turno } from '@/modules/turnos/datos'
import { AHORA_DEMO, MEDIAS_HORAS, diasAbiertos, diasTxt, errorJornada, hhmm, jornadaDe, jornadaTxt, tramosDe, type Bloque, type Jornada, type Semana, type Tramo } from '@/modules/turnos/horario'
import { Llave } from '@/modules/turnos/_shared/orbita/piezas'
import { Segmentado } from './configuracion/ui'
import { copiar, fechaDe, indiceDia, type Avisar, type GrupoLibres, type MensajeWA } from './agendaDemo'

export const CSS_PIEZAS_PANEL = `
  .tu-error { display: flex; align-items: center; gap: 6px; margin: -8px 0 14px; font-size: 12.5px; font-weight: 500; color: var(--color-error); }
  .tu-dato-fila { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; font-size: 13px; border-top: 1px solid var(--color-border); }
  .tu-dato-fila:first-child { border-top: none; }
  .tu-borrar { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 12px; background: var(--color-error-bg); border: 1px solid color-mix(in srgb, var(--color-error) 28%, transparent); animation: tuoEntra 320ms var(--tuo-ease, ease) both; }
  .tu-nota { display: flex; gap: 9px; padding: 11px 13px; margin-bottom: 16px; border-radius: 12px; font-size: 13px; line-height: 1.5; }
  .tu-nota--aviso { background: var(--color-warning-bg); color: var(--chip-warning-fg); border: 1px solid color-mix(in srgb, var(--color-warning) 28%, transparent); }
  .tu-nota--info { background: var(--color-primary-bg); color: var(--chip-primary-fg); border: 1px solid color-mix(in srgb, var(--color-primary) 24%, transparent); }
  .tu-nota--ok { background: var(--color-success-bg); color: var(--chip-success-fg); border: 1px solid color-mix(in srgb, var(--color-success) 28%, transparent); animation: tuoEntra 320ms var(--tuo-ease, ease) both; }
  .tu-nota > svg { flex-shrink: 0; margin-top: 2px; }
  .tu-seccion { margin: 6px 0 12px; padding-top: 16px; border-top: 1px solid var(--color-border); }
  .tu-seccion > .tuo-rotulo { display: block; margin-bottom: 12px; }

  /* Días de la semana: siete botones que se prenden y se apagan. */
  .tu-dias { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .tu-dias > button { height: 40px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-muted); font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: border-color 150ms ease, background 150ms ease, color 150ms ease; }
  .tu-dias > button[aria-pressed='true'] { border-color: var(--color-primary); background: var(--color-primary-bg); color: var(--chip-primary-fg); }
  .tu-dias > button:disabled { cursor: not-allowed; opacity: 0.42; border-style: dashed; }
  .tu-dias > button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .tu-dias > button:not(:disabled):not([aria-pressed='true']):hover { border-color: var(--color-border-strong); color: var(--color-text); } }

  /* Turnos de atención: un renglón para la mañana y otro para la tarde. */
  .tu-bloques { display: grid; gap: 8px; }
  .tu-bloque { display: grid; grid-template-columns: 34px 70px minmax(0, 1fr) auto; gap: 10px; align-items: center; min-height: 54px; padding: 6px 12px; border-radius: 12px; border: 1px solid var(--color-border); background: var(--color-surface); transition: border-color 160ms ease, background 160ms ease; }
  .tu-bloque[data-on='true'] { border-color: color-mix(in srgb, var(--color-primary) 34%, var(--color-border)); background: color-mix(in srgb, var(--color-primary) 5%, var(--color-bg)); }
  .tu-bloque-ico { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; color: var(--color-subtle); background: var(--color-surface-alt); transition: color 160ms ease, background 160ms ease; }
  .tu-bloque[data-on='true'] .tu-bloque-ico { color: var(--color-primary); background: var(--color-primary-bg); }
  .tu-bloque > strong { font-size: 13.5px; font-weight: 600; color: var(--color-text); }
  .tu-bloque-horas { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13px; color: var(--color-muted); }
  .tu-bloque-horas select.tuc-field { width: 104px; height: 40px; padding: 0 8px 0 10px; appearance: auto; }
  .tu-bloque-off { font-size: 13px; color: var(--color-muted); }

  /* Tira de días: el día se elige tocándolo, igual que en la reserva del cliente. */
  .tu-tira-dias { display: flex; gap: 6px; overflow-x: auto; padding: 3px 3px 8px; margin: 0 -3px; scrollbar-width: thin; }
  .tu-dia-btn { flex: 0 0 auto; width: 58px; min-height: 62px; padding: 7px 4px; border-radius: 12px; border: 1px solid var(--color-border); background: var(--color-bg); font-family: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease; }
  .tu-dia-btn > small { font-size: 11px; font-weight: 500; color: var(--color-muted); }
  .tu-dia-btn > b { font-family: var(--tuo-mono); font-size: 16px; font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }
  .tu-dia-btn[aria-pressed='true'] { border-color: var(--color-primary); background: var(--color-primary-bg); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 14%, transparent); }
  .tu-dia-btn[aria-pressed='true'] > small, .tu-dia-btn[aria-pressed='true'] > b { color: var(--chip-primary-fg); }
  .tu-dia-btn:disabled { cursor: not-allowed; opacity: 0.42; border-style: dashed; }
  .tu-dia-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .tu-dia-btn:not(:disabled):not([aria-pressed='true']):hover { border-color: var(--color-border-strong); background: var(--color-surface); } }

  /* Horarios libres, agrupados por la mañana y la tarde. */
  .tu-horas-cab { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; font-size: 12.5px; font-weight: 600; color: var(--color-text); }
  .tu-horas-cab > span { font-weight: 400; color: var(--color-muted); }
  .tu-horas { display: grid; grid-template-columns: repeat(auto-fill, minmax(68px, 1fr)); gap: 6px; }
  .tu-hora-btn { height: 40px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-family: var(--tuo-mono); font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; cursor: pointer; transition: border-color 150ms ease, background 150ms ease, color 150ms ease, box-shadow 180ms ease; }
  .tu-hora-btn[aria-pressed='true'] { border-color: transparent; background: var(--tuo-grad); color: #fff; box-shadow: 0 6px 16px rgba(37,99,235,0.3); }
  .tu-hora-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .tu-hora-btn:not([aria-pressed='true']):hover { border-color: var(--color-primary); background: var(--color-primary-bg); color: var(--chip-primary-fg); } }
  .tu-corte { display: flex; align-items: center; gap: 10px; margin: 12px 0; font-size: 11.5px; color: var(--color-muted); }
  .tu-corte::before, .tu-corte::after { content: ''; flex: 1; height: 1px; background: var(--color-border); }

  /* La jornada en línea: rayado = cerrado, liso = atiende, color = un turno. */
  .tu-jornada { position: relative; height: 10px; }
  .tu-jornada-pista { position: absolute; inset: 0; border-radius: 999px; overflow: hidden; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-border-strong) 60%, transparent) 0 1.5px, transparent 1.5px 6px), var(--color-surface); }
  .tu-jornada-abre { position: absolute; top: 0; bottom: 0; background: var(--color-surface-alt); }
  .tu-jornada-turno { position: absolute; top: 0; bottom: 0; min-width: 4px; border-radius: 999px; transition: filter 180ms ease; }
  @media (hover: hover) { .tu-jornada-turno:hover { filter: brightness(1.2); } }
  .tu-jornada-ahora { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; border-radius: 2px; background: var(--color-text); }
  .tu-jornada-escala { position: relative; height: 16px; margin-top: 5px; font-family: var(--tuo-mono); font-size: 10.5px; color: var(--color-subtle); font-variant-numeric: tabular-nums; }
  .tu-jornada-escala > span { position: absolute; top: 0; transform: translateX(-50%); white-space: nowrap; }
  .tu-jornada-escala > span:first-child { transform: none; }
  .tu-jornada-escala > span:last-child { transform: translateX(-100%); }

  /* Chat de WhatsApp: sus colores son los de WhatsApp (claro y oscuro) y no
     los del panel, igual que en Configuración > Mensajes. */
  .tu-wa { border-radius: 14px; overflow: hidden; border: 1px solid var(--color-border); margin-bottom: 16px; }
  .tu-wa-cab { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: #F0F2F5; color: #111B21; }
  .tu-wa-fondo { padding: 14px 12px 16px; background: #EFEAE2; background-image: radial-gradient(rgba(0,0,0,.045) 1px, transparent 1px); background-size: 14px 14px; }
  .tu-wa-burbuja { position: relative; max-width: 92%; margin-left: auto; padding: 7px 9px 20px 10px; border-radius: 10px 0 10px 10px; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; background: #D9FDD3; color: #111B21; box-shadow: 0 1px 1px rgba(0,0,0,.12); }
  .tu-wa-hora { position: absolute; right: 8px; bottom: 3px; display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; opacity: 0.7; }
  .dark .tu-wa-cab { background: #202C33; color: #E9EDEF; }
  .dark .tu-wa-fondo { background-color: #0B141A; background-image: radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px); }
  .dark .tu-wa-burbuja { background: #005C4B; color: #E9EDEF; }
  @media (max-width: 640px) {
    .tu-bloque { grid-template-columns: 34px minmax(0, 1fr) auto; }
    .tu-bloque > .tuo-switch { grid-column: 3; grid-row: 1; }
    .tu-bloque-horas, .tu-bloque-off { grid-column: 1 / -1; grid-row: 2; padding-bottom: 6px; }
    .tu-bloque-horas select.tuc-field { flex: 1; width: auto; height: 46px; }
    .tu-dias > button { height: 44px; }
    .tu-hora-btn { height: 44px; }
    .tu-dia-btn { width: 60px; min-height: 64px; }
  }
  @media (prefers-reduced-motion: reduce) { .tu-borrar, .tu-nota--ok { animation: none; } .tu-dias > button, .tu-bloque, .tu-bloque-ico, .tu-dia-btn, .tu-hora-btn, .tu-jornada-turno { transition: none; } }
`

/**
 * Modal del panel: cabecera, cuerpo que scrollea y pie de acciones (a la
 * derecha). Con `onEnviar` el cuerpo y el pie van dentro de un <form> (Enter
 * guarda). `encima` lo apila sobre otro modal que ya está abierto; `icono` va
 * a la izquierda del título (la foto de un cliente, por ejemplo) y `cabecera`
 * reemplaza la cabecera entera (el detalle de un turno arma la suya). `foco` es
 * el campo donde arranca el teclado al abrir (un buscador); sin eso, el modal.
 */
export function Modal({ titulo, rotulo, bajada, icono, cabecera, onCerrar, onEnviar, pie, encima, ancho = 520, foco, children }: {
  titulo: string; rotulo?: string; bajada?: ReactNode; icono?: ReactNode; cabecera?: ReactNode; onCerrar: () => void; onEnviar?: () => void
  pie?: ReactNode; encima?: boolean; ancho?: number; foco?: RefObject<HTMLElement | null>; children: ReactNode
}) {
  const caja = useRef<HTMLDivElement>(null)

  // Escape cierra solo el modal de más arriba (el último de la página). Se
  // escucha en captura para ganarle a los que quedan abajo.
  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const abiertos = document.querySelectorAll('.tuo-modal')
      if (abiertos[abiertos.length - 1] !== caja.current) return
      // Un desplegable abierto adentro (el buscador de clientes) se cierra primero:
      // recién el segundo Escape cierra el modal.
      if (e.target instanceof Element && e.target.closest('[data-esc="propio"]')) return
      e.stopPropagation()
      onCerrar()
    }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [onCerrar])

  // El foco entra al modal al abrir, para que el teclado y el lector arranquen
  // ahí, y al cerrar vuelve a lo que se había tocado para abrirlo.
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ;(foco?.current ?? caja.current)?.focus()
    return () => { if (antes?.isConnected) antes.focus({ preventScroll: true }) }
    // Solo al abrir: `foco` es una ref, no cambia entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tab da la vuelta adentro del modal: no se escapa a lo que quedó detrás del velo.
  const vuelta = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !caja.current) return
    const f = Array.from(caja.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null)
    if (!f.length) return
    const foco = document.activeElement
    if (e.shiftKey && (foco === f[0] || foco === caja.current)) { e.preventDefault(); f[f.length - 1].focus() }
    else if (!e.shiftKey && foco === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
  }

  const cuerpo = <div className="tuo-modal-cuerpo">{children}</div>
  const acciones = pie ? <div className="tuo-modal-pie">{pie}</div> : null

  return (
    // mousedown y no click: soltar el mouse afuera después de seleccionar un texto no cierra.
    <div className="tuo-modal-velo" data-encima={!!encima} onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div ref={caja} tabIndex={-1} className="tuo tuo-modal" role="dialog" aria-modal="true" aria-label={titulo} style={{ ['--tuo-ancho' as string]: `${ancho}px` }} onKeyDown={vuelta}>
        {cabecera ?? (
          <header className="tuo-modal-cab">
            {icono}
            <div style={{ flex: 1, minWidth: 0 }}>
              {rotulo && <div className="tuo-eyebrow" style={{ marginBottom: 8 }}>{rotulo}</div>}
              <h2 className="tuo-modal-titulo">{titulo}</h2>
              {bajada && <p className="tuo-modal-bajada">{bajada}</p>}
            </div>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="tuo-btn tuo-btn--icono tuo-btn--sm tuo-btn--fantasma tuo-modal-cerrar" style={{ flexShrink: 0 }}><X size={17} /></button>
          </header>
        )}
        {onEnviar
          ? <form className="tuo-modal-form" noValidate onSubmit={e => { e.preventDefault(); onEnviar() }}>{cuerpo}{acciones}</form>
          : <>{cuerpo}{acciones}</>}
      </div>
    </div>
  )
}

export function ErrorCampo({ children }: { children: ReactNode }) {
  return <p role="alert" className="tu-error">{children}</p>
}

/** Renglón "dato: valor" de los resúmenes. */
export function DatoFila({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tu-dato-fila">
      <span style={{ color: 'var(--color-muted)' }}>{label}</span>
      <span style={{ color: 'var(--color-text)', fontWeight: 500, textAlign: 'right', minWidth: 0 }}>{children}</span>
    </div>
  )
}

/** Borrar en dos pasos: primero el botón, después la pregunta con su consecuencia. */
export function Borrar({ etiqueta, pregunta, onBorrar }: { etiqueta: string; pregunta: ReactNode; onBorrar: () => void }) {
  const [pide, setPide] = useState(false)
  if (!pide) {
    return <button type="button" onClick={() => setPide(true)} className="tuo-btn tuo-btn--peligro" style={{ width: '100%', height: 44, marginTop: 8 }}><Trash2 size={15} /> {etiqueta}</button>
  }
  return (
    <div className="tu-borrar" style={{ marginTop: 8 }}>
      <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.5 }}>{pregunta}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setPide(false)} className="tuo-btn" style={{ flex: 1, height: 44 }}>Volver</button>
        <button type="button" onClick={onBorrar} className="tuo-btn" style={{ flex: 1, height: 44, background: 'var(--color-error)', borderColor: 'var(--color-error)', color: '#fff' }}>Sí, eliminar</button>
      </div>
    </div>
  )
}

// ─── Días y turnos de atención ───────────────────────────────────────────────

/**
 * Los días de la semana que alguien atiende. `abiertos` son los días que abre
 * el negocio: los demás se ven apagados y no se pueden elegir (nadie atiende
 * con el negocio cerrado).
 */
export function DiasSemana({ dias, onChange, abiertos, etiqueta = 'Días' }: { dias: number[]; onChange: (d: number[]) => void; abiertos?: number[]; etiqueta?: string }) {
  const alternar = (i: number) => onChange(dias.includes(i) ? dias.filter(x => x !== i) : [...dias, i].sort((a, b) => a - b))
  return (
    <div className="tu-dias" role="group" aria-label={etiqueta}>
      {DIAS_CORTOS.map((d, i) => {
        const cerrado = !!abiertos && !abiertos.includes(i)
        return <button key={d} type="button" aria-pressed={dias.includes(i) && !cerrado} aria-label={DIAS[i]} title={cerrado ? `${DIAS[i]}: el negocio no abre` : DIAS[i]} disabled={cerrado} onClick={() => alternar(i)}>{d}</button>
      })}
    </div>
  )
}

/**
 * La mañana y la tarde de una jornada, cada una con su llave y su "de… a…".
 * Es la misma idea del alta: se atiende en dos turnos, con el corte del
 * mediodía en el medio, y cada turno se puede apagar.
 */
export function BloquesJornada({ jornada, onChange, id }: { jornada: Jornada; onChange: (j: Jornada) => void; id: string }) {
  const fila = (clave: 'manana' | 'tarde') => {
    const b: Bloque = jornada[clave]
    const titulo = clave === 'manana' ? 'Mañana' : 'Tarde'
    const Icono = clave === 'manana' ? Sun : Sunset
    const set = (cambio: Partial<Bloque>) => onChange({ ...jornada, [clave]: { ...b, ...cambio } })
    return (
      <div className="tu-bloque" data-on={b.on}>
        <span className="tu-bloque-ico" aria-hidden><Icono size={16} /></span>
        <strong>{titulo}</strong>
        {b.on ? (
          <span className="tu-bloque-horas">
            <label className="tuc-sr" htmlFor={`${id}-${clave}-desde`}>{titulo}: desde</label>
            <select id={`${id}-${clave}-desde`} className="tuc-field tuc-mono" value={b.desde} onChange={e => set({ desde: Number(e.target.value) })}>
              {MEDIAS_HORAS.map(m => <option key={m} value={m}>{hhmm(m)}</option>)}
            </select>
            <span aria-hidden>a</span>
            <label className="tuc-sr" htmlFor={`${id}-${clave}-hasta`}>{titulo}: hasta</label>
            <select id={`${id}-${clave}-hasta`} className="tuc-field tuc-mono" value={b.hasta} onChange={e => set({ hasta: Number(e.target.value) })}>
              {MEDIAS_HORAS.map(m => <option key={m} value={m}>{hhmm(m)}</option>)}
            </select>
          </span>
        ) : <span className="tu-bloque-off">No se atiende</span>}
        <Llave on={b.on} onChange={on => set({ on })} label={`Atender a la ${titulo.toLowerCase()}`} />
      </div>
    )
  }
  return <div className="tu-bloques">{fila('manana')}{fila('tarde')}</div>
}

/** Lo que se edita de una agenda en un formulario: qué días atiende y si sigue el horario del negocio o tiene uno propio. */
export interface AgendaForm { atiende: number[]; propio: boolean; jornada: Jornada }

/** El formulario arranca con la agenda como está; sin agenda (alguien nuevo), con todos los días que abre el negocio. */
export function agendaFormDe(rec: Pick<Recurso, 'atiende' | 'horario'> | null, semana: Semana): AgendaForm {
  const abiertos = diasAbiertos(semana)
  return {
    atiende: rec ? rec.atiende.filter(d => abiertos.includes(d)) : abiertos,
    propio: !!rec?.horario,
    jornada: jornadaDe(tramosDe(rec?.horario || semana[abiertos[0]]?.[1])),
  }
}
export const agendaDeForm = (f: AgendaForm) => ({ atiende: f.atiende, horario: f.propio ? jornadaTxt(f.jornada) : '', dias: diasTxt(f.atiende) })
export function errorAgenda(f: AgendaForm): string | null {
  if (f.atiende.length === 0) return 'Elegí al menos un día de atención.'
  return f.propio ? errorJornada(f.jornada) : null
}

/** Los días y el horario de una agenda: los del negocio, o unos propios (siempre dentro de los del negocio). */
export function CamposAgenda({ valor, onChange, semana, id }: { valor: AgendaForm; onChange: (f: AgendaForm) => void; semana: Semana; id: string }) {
  const abiertos = diasAbiertos(semana)
  const delNegocio = semana[valor.atiende[0] ?? abiertos[0]]?.[1]
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div className="tuc-rotulo" style={{ marginBottom: 8 }}>Días</div>
        <DiasSemana dias={valor.atiende} onChange={atiende => onChange({ ...valor, atiende })} abiertos={abiertos} />
        {abiertos.length < 7 && <p className="tuc-ayuda" style={{ marginTop: 6 }}>Los días apagados son los que el negocio no abre.</p>}
      </div>
      <div style={{ marginBottom: 16 }}>
        <div className="tuc-rotulo" style={{ marginBottom: 8 }}>Horario</div>
        <Segmentado label="Horario" lleno valor={valor.propio ? 'propio' : 'negocio'} onChange={v => onChange({ ...valor, propio: v === 'propio' })}
          opciones={[{ id: 'negocio', label: 'El del negocio' }, { id: 'propio', label: 'Uno propio' }]} />
        {valor.propio ? (
          <div style={{ marginTop: 10 }}>
            <BloquesJornada id={id} jornada={valor.jornada} onChange={jornada => onChange({ ...valor, jornada })} />
            <p className="tuc-ayuda" style={{ marginTop: 8 }}>Siempre dentro del horario del negocio: lo que quede afuera no se ofrece.</p>
          </div>
        ) : (
          <p className="tuc-ayuda" style={{ marginTop: 8 }}>Sigue el horario del negocio{delNegocio ? <>: <span className="tuo-num">{delNegocio}</span></> : ''}. Si el negocio lo cambia, cambia con él.</p>
        )}
      </div>
    </>
  )
}

/**
 * La jornada de alguien en una línea: lo rayado es cuando no atiende (antes de
 * abrir, el corte del mediodía, después de cerrar), lo liso es su horario y cada
 * tramo de color es un turno. `rango` es de la primera apertura al último cierre
 * del negocio ese día.
 */
export function TiraJornada({ rango, tramos, turnos, color, ahora, label }: { rango: Tramo; tramos: Tramo[]; turnos: Turno[]; color: string; ahora?: number; label: string }) {
  const [a, b] = rango
  const pct = (m: number) => `${((Math.min(b, Math.max(a, m)) - a) / Math.max(1, b - a)) * 100}%`
  const marcas = [...new Set([a, ...tramos.flat(), b])].sort((x, y) => x - y)
  return (
    <>
      <div role="img" aria-label={label} className="tu-jornada">
        <div className="tu-jornada-pista">
          {tramos.map(([x, y]) => <span key={x} className="tu-jornada-abre" style={{ left: pct(x), width: `calc(${pct(y)} - ${pct(x)})` }} />)}
          {turnos.map(t => (
            <span key={t.id} className="tu-jornada-turno" title={`${horaTxt(t.inicio)} · ${t.servicio}`}
              style={{ left: pct(t.inicio), width: `calc(${pct(t.inicio + t.duracion)} - ${pct(t.inicio)} - 2px)`, background: color, opacity: ahora !== undefined && t.inicio + t.duracion <= ahora ? 0.4 : 1 }} />
          ))}
        </div>
        {ahora !== undefined && ahora >= a && ahora <= b && <span aria-hidden className="tu-jornada-ahora" style={{ left: pct(ahora) }} />}
      </div>
      <div aria-hidden className="tu-jornada-escala">
        {marcas.map(m => <span key={m} style={{ left: pct(m) }}>{String(Math.floor(m / 60)).padStart(2, '0')}{m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''}</span>)}
      </div>
    </>
  )
}

// ─── Elegir día y horario ────────────────────────────────────────────────────

/**
 * Tira de días para elegir (los días se cuentan desde hoy: 0 = hoy). Los que
 * vienen con `cerrado` se ven apagados y no se pueden tocar: la agenda no
 * atiende ese día.
 */
export function TiraDias({ dias, valor, onElegir, etiqueta = 'Día' }: { dias: { dia: number; cerrado?: boolean }[]; valor: number; onElegir: (dia: number) => void; etiqueta?: string }) {
  return (
    <div className="tu-tira-dias" role="group" aria-label={etiqueta}>
      {dias.map(({ dia, cerrado }) => {
        const semana = indiceDia(dia)
        const nombre = `${DIAS[semana]} ${fechaDe(dia).getDate()}`
        return (
          <button key={dia} type="button" className="tu-dia-btn" aria-pressed={dia === valor} disabled={cerrado} onClick={() => onElegir(dia)}
            aria-label={cerrado ? `${nombre}: no atiende` : dia === 0 ? `Hoy, ${nombre}` : nombre} title={cerrado ? `${nombre}: no atiende` : nombre}>
            <small>{dia === 0 ? 'Hoy' : DIAS_CORTOS[semana]}</small>
            <b>{fechaDe(dia).getDate()}</b>
          </button>
        )
      })}
    </div>
  )
}

/** Los horarios libres de un día, en botones, separados por la mañana y la tarde (con el corte a la vista). */
export function HorasLibres({ grupos, valor, onElegir, vacio }: { grupos: GrupoLibres[]; valor: number | null; onElegir: (m: number) => void; vacio: ReactNode }) {
  if (!grupos.some(g => g.libres.length > 0)) {
    return <div role="status" className="tu-nota tu-nota--aviso" style={{ marginBottom: 0 }}><CalendarX size={15} /><span>{vacio}</span></div>
  }
  return (
    <div>
      {grupos.map((g, i) => (
        <div key={`${g.nombre}${g.rango}`}>
          {i > 0 && g.rango && grupos[i - 1].rango && <div className="tu-corte">Cerrado de {grupos[i - 1].rango.split(' a ')[1]} a {g.rango.split(' a ')[0]}</div>}
          {i > 0 && !g.rango && <div style={{ height: 14 }} />}
          <div className="tu-horas-cab">{g.nombre}{g.rango && <span className="tuo-num">{g.rango}</span>}<span>· {g.libres.length ? `${g.libres.length} libre${g.libres.length === 1 ? '' : 's'}` : 'sin lugar'}</span></div>
          {g.libres.length > 0 && (
            <div className="tu-horas" role="group" aria-label={`Horarios de la ${g.nombre.toLowerCase()}`}>
              {g.libres.map(m => <button key={m} type="button" className="tu-hora-btn" aria-pressed={m === valor} onClick={() => onElegir(m)}>{horaTxt(m)}</button>)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────

const iniciales = (nombre: string) => nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

/**
 * Mensaje de WhatsApp. A una persona (`para`), "Enviar" no sale de la demo:
 * muestra cómo le llega y lo marca como enviado. Nunca abre WhatsApp con su
 * teléfono: los de la demo son inventados y podrían ser de alguien real.
 * Sin `para` es un mensaje para compartir (los huecos del día): abre el menú
 * de compartir del equipo y, si el navegador no lo tiene, lo copia.
 */
export function MensajeWhatsApp({ mensaje, onCerrar, avisar }: { mensaje: MensajeWA; onCerrar: () => void; avisar: Avisar }) {
  const [texto, setTexto] = useState(mensaje.texto)
  // null: todavía no se copió; false: el navegador no dejó copiar.
  const [copiado, setCopiado] = useState<boolean | null>(null)
  const [enviado, setEnviado] = useState(false)
  const persona = mensaje.para
  const vacio = !texto.trim()
  const sinTelefono = !!persona && !mensaje.telefono

  const copiarTexto = async () => setCopiado(await copiar(texto))
  const compartirTexto = () => {
    if (typeof navigator.share !== 'function') { void copiarTexto(); return }
    navigator.share({ text: texto })
      .then(() => { avisar('Mensaje compartido', 'Salió por donde lo elegiste en tu equipo.'); onCerrar() })
      // Cancelar el menú no es un error; si el navegador no lo deja abrir, se copia.
      .catch((e: unknown) => { if (!(e instanceof DOMException && e.name === 'AbortError')) void copiarTexto() })
  }

  const pie = enviado
    ? <button type="button" onClick={onCerrar} className="tuo-btn tuo-btn--primario"><Check size={16} /> Listo</button>
    : <>
      <button type="button" onClick={copiarTexto} disabled={vacio} className="tuo-btn">{copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? 'Copiado' : 'Copiar'}</button>
      {persona
        ? <button type="button" onClick={() => setEnviado(true)} disabled={vacio || sinTelefono} className="tuo-btn tuo-btn--primario"><Send size={16} /> Enviar</button>
        : <button type="button" onClick={compartirTexto} disabled={vacio} className="tuo-btn tuo-btn--primario"><Share2 size={16} /> Compartir</button>}
    </>

  return (
    <Modal
      encima
      ancho={480}
      rotulo="WhatsApp"
      titulo={mensaje.titulo}
      bajada={mensaje.telefono ? <span className="tuo-num">{mensaje.telefono}</span> : persona ? 'Sin teléfono cargado' : 'Copialo o compartilo donde quieras: tu estado, un grupo o tus redes.'}
      onCerrar={onCerrar}
      pie={pie}
    >
      {/* Así le llega: la burbuja sigue lo que se escribe abajo */}
      <div className="tu-wa" role="img" aria-label={`Vista previa del mensaje${persona ? ` para ${persona}` : ''}`}>
        <div className="tu-wa-cab">
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: '#128C7E', color: '#fff', fontSize: 11.5, fontWeight: 700 }}>{persona ? iniciales(persona) : <Share2 size={14} />}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{persona ?? 'Vista previa'}</span>
            <span style={{ display: 'block', fontSize: 11, opacity: 0.75 }}>{enviado ? 'Entregado' : 'WhatsApp'}</span>
          </span>
        </div>
        <div className="tu-wa-fondo">
          <div className="tu-wa-burbuja">
            {texto.trim() || '…'}
            <span className="tu-wa-hora">{horaTxt(AHORA_DEMO)} {enviado ? <CheckCheck size={13} style={{ color: '#53BDEB', opacity: 1 }} /> : <Clock3 size={11} />}</span>
          </div>
        </div>
      </div>

      {enviado ? (
        <div role="status" className="tu-nota tu-nota--ok" style={{ marginBottom: 0 }}>
          <CheckCheck size={16} />
          <span><b>Enviado a {persona}.</b> Es una demo: no salió ningún mensaje real.</span>
        </div>
      ) : (
        <>
          {sinTelefono && (
            <div role="status" className="tu-nota tu-nota--aviso">
              <PhoneOff size={15} />
              <span>{persona} no tiene un teléfono cargado. Copiá el mensaje y mandáselo por otro lado.</span>
            </div>
          )}
          <label htmlFor="tu-wa-texto" className="tuc-rotulo" style={{ marginBottom: 8 }}>Mensaje{persona ? ` para ${persona.split(' ')[0]}` : ''}</label>
          <textarea id="tu-wa-texto" className="tuc-field" rows={6} value={texto} onChange={e => { setTexto(e.target.value); setCopiado(null) }} style={{ minHeight: 140 }} />
          <p className="tuc-ayuda" style={{ marginTop: 8 }}>{persona ? 'Podés cambiar el texto antes de mandarlo. En la demo el envío es de mentira: no le llega a nadie.' : 'Podés cambiar el texto antes de compartirlo.'}</p>
          {copiado === true && <p role="status" className="tuc-ayuda" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0 0', color: 'var(--chip-success-fg)', fontWeight: 500 }}><Check size={13} /> Copiado: pegalo en el chat que quieras.</p>}
          {copiado === false && <div style={{ marginTop: 18 }}><ErrorCampo>No se pudo copiar. Seleccioná el texto y copialo a mano.</ErrorCampo></div>}
        </>
      )}
    </Modal>
  )
}
