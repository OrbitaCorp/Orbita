// Piezas del panel de Turnos (demo) que no trae el kit de reservas: la
// confirmación antes de borrar, la llave, los días y los turnos de atención
// (mañana y tarde), la tira de días y los horarios libres, la jornada en línea
// y el mensaje de WhatsApp. El modal (con formulario, apilable y con ícono) y
// el indicador con variación son del kit (design-system/reservas/piezas.tsx).
//
// Todo pinta con las clases rv- del kit (design-system/reservas/estilo.tsx) y
// lo propio va con prefijo tu- en CSS_PIEZAS_PANEL, que PanelTurnos monta una
// sola vez. Nada de hover por JS: lo que se toca lleva ds-hover o una clase
// del kit que ya trae su hover y su foco.
import { useId, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Copy, Check, CheckCheck, Clock3, Search, Send, Share2, Trash2, PhoneOff, Sun, Sunset, CalendarX } from 'lucide-react'
import { Modal } from '@/design-system/reservas/piezas'
import { DIAS, DIAS_CORTOS, horaTxt, type Recurso, type Turno } from '@/modules/turnos/datos'
import { AHORA_DEMO, MEDIAS_HORAS, diasAbiertos, diasTxt, errorJornada, hhmm, jornadaDe, jornadaTxt, tramosDe, type Bloque, type Jornada, type Semana, type Tramo } from '@/modules/turnos/horario'
import { Segmentado } from './configuracion/ui'
import { copiar, fechaDe, indiceDia, type Avisar, type GrupoLibres, type MensajeWA } from '../datos/agenda'

export const CSS_PIEZAS_PANEL = `
  .tu-error { display: flex; align-items: center; gap: 6px; margin: -8px 0 14px; font-size: 12.5px; font-weight: 500; color: var(--color-error); }
  .tu-dato-fila { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; font-size: 13px; border-top: 1px solid var(--color-border); }
  .tu-dato-fila:first-child { border-top: none; }
  .tu-borrar { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: var(--rv-r-sm); background: var(--color-error-bg); }
  .tu-borrar > span { font-size: 13.5px; font-weight: 500; color: var(--color-text); line-height: 1.5; }
  .tu-borrar-si { background: var(--color-error); border-color: transparent; color: var(--color-on-primary); }
  .rv-nota.tu-nota--ok { background: var(--color-success-bg); border-color: transparent; color: var(--chip-success-fg); }
  .rv-nota > svg { flex-shrink: 0; margin-top: 2px; }
  .tu-seccion { margin: 6px 0 12px; padding-top: 16px; border-top: 1px solid var(--color-border); }
  .tu-seccion > .rv-rotulo { display: block; margin-bottom: 12px; }

  /* ── Volver (el de Tienda: arriba del título, dice adónde se vuelve) ── */
  .tu-volver { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; padding: 4px 6px; margin: -4px 0 10px -6px; font: inherit; font-size: 13px; font-weight: 500; color: var(--rv-tinta-fondo, var(--color-muted)); cursor: pointer; border-radius: 6px; }
  .tu-volver:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .tu-volver:hover { color: var(--color-text); } }

  /* ── Buscador de una lista: el input del kit con la lupa adentro ── */
  .tu-buscar { position: relative; display: block; width: 100%; max-width: 380px; }
  .tu-buscar > svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-subtle); pointer-events: none; }
  .tu-buscar > .rv-input { padding-left: 36px; }

  /* ── Barra fina de avance (ocupación, uso) ── */
  .tu-barra { display: block; height: 6px; border-radius: 999px; background: var(--color-surface-alt); overflow: hidden; }
  .tu-barra > i { display: block; height: 100%; border-radius: 999px; background: var(--c, var(--color-primary)); }

  /* ── Filas que se tocan (clientes, liquidaciones): una lista dentro de una tarjeta ── */
  .tu-filas { display: flex; flex-direction: column; }
  .tu-fila { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 64px; padding: 10px 16px; border: none; border-top: 1px solid var(--color-border); border-radius: 0; background: transparent; text-align: left; font: inherit; color: inherit; cursor: pointer; }
  .tu-fila:first-child { border-top: none; }
  .tu-fila:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .tu-fila-cab { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--color-border); }
  .tu-fila-cab > span { font-family: var(--rv-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-muted); }

  /* ── Días de la semana: siete botones que se prenden y se apagan ── */
  .tu-dias { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .tu-dias > button { min-height: 40px; border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-muted); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
  .tu-dias > button[aria-pressed='true'] { border-color: var(--color-primary); background: var(--color-primary-bg); color: var(--chip-primary-fg); }
  .tu-dias > button:disabled { cursor: not-allowed; opacity: 0.42; border-style: dashed; }
  .tu-dias > button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

  /* ── Turnos de atención: un renglón para la mañana y otro para la tarde ── */
  .tu-bloques { display: grid; gap: 8px; }
  .tu-bloque { display: grid; grid-template-columns: 34px 70px minmax(0, 1fr) auto; gap: 10px; align-items: center; min-height: 54px; padding: 6px 12px; border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-surface); }
  .tu-bloque[data-on='true'] { background: var(--color-bg); }
  .tu-bloque-ico { width: 34px; height: 34px; border-radius: 8px; display: grid; place-items: center; color: var(--color-subtle); background: var(--color-surface-alt); }
  .tu-bloque[data-on='true'] .tu-bloque-ico { color: var(--color-primary); background: var(--color-primary-bg); }
  .tu-bloque > strong { font-size: 13.5px; font-weight: 600; color: var(--color-text); }
  .tu-bloque-horas { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13px; color: var(--color-muted); }
  .tu-bloque-horas > .rv-select { width: 104px; min-height: 40px; padding-left: 10px; font-family: var(--rv-mono); }
  .tu-bloque-off { font-size: 13px; color: var(--color-muted); }

  /* ── Tira de días: el día se elige tocándolo, igual que en la reserva del cliente ── */
  .tu-tira-dias { display: flex; gap: 6px; overflow-x: auto; padding: 3px 3px 8px; margin: 0 -3px; scrollbar-width: thin; }
  .tu-dia-btn { flex: 0 0 auto; width: 58px; min-height: 62px; padding: 7px 4px; border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); font: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
  .tu-dia-btn > small { font-size: 11px; font-weight: 500; color: var(--color-muted); }
  .tu-dia-btn > b { font-family: var(--rv-mono); font-size: 16px; font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }
  .tu-dia-btn[aria-pressed='true'] { border-color: var(--color-primary); background: var(--color-primary-bg); }
  .tu-dia-btn[aria-pressed='true'] > small, .tu-dia-btn[aria-pressed='true'] > b { color: var(--chip-primary-fg); }
  .tu-dia-btn:disabled { cursor: not-allowed; opacity: 0.42; border-style: dashed; }
  .tu-dia-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

  /* ── Horarios libres, agrupados por la mañana y la tarde ── */
  .tu-horas-cab { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; font-size: 12.5px; font-weight: 600; color: var(--color-text); }
  .tu-horas-cab > span { font-weight: 400; color: var(--color-muted); }
  .tu-corte { display: flex; align-items: center; gap: 10px; margin: 12px 0; font-size: 11.5px; color: var(--color-muted); }
  .tu-corte::before, .tu-corte::after { content: ''; flex: 1; height: 1px; background: var(--color-border); }

  /* ── La jornada en línea: rayado = cerrado, liso = atiende, color = un turno ── */
  .tu-jornada { position: relative; height: 10px; }
  .tu-jornada-pista { position: absolute; inset: 0; border-radius: 999px; overflow: hidden; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-border-strong) 60%, transparent) 0 1.5px, transparent 1.5px 6px), var(--color-surface); }
  .tu-jornada-abre { position: absolute; top: 0; bottom: 0; background: var(--color-surface-alt); }
  .tu-jornada-turno { position: absolute; top: 0; bottom: 0; min-width: 4px; border-radius: 999px; }
  .tu-jornada-ahora { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; border-radius: 2px; background: var(--color-text); }
  .tu-jornada-escala { position: relative; height: 16px; margin-top: 5px; font-family: var(--rv-mono); font-size: 11px; color: var(--color-muted); font-variant-numeric: tabular-nums; }
  .tu-jornada-escala > span { position: absolute; top: 0; transform: translateX(-50%); white-space: nowrap; }
  .tu-jornada-escala > span:first-child { transform: none; }
  .tu-jornada-escala > span:last-child { transform: translateX(-100%); }

  /* ── Chat de WhatsApp: la forma de un chat (burbuja, hora, tildes) con los colores del panel, un solo acento ── */
  .tu-wa { border-radius: var(--rv-r); overflow: hidden; border: 1px solid var(--color-border); margin-bottom: 16px; }
  .tu-wa-cab { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: var(--color-surface); color: var(--color-text); border-bottom: 1px solid var(--color-border); }
  .tu-wa-fondo { padding: 14px 12px 16px; background: var(--color-surface-alt); background-image: radial-gradient(var(--color-border) 1px, transparent 1px); background-size: 14px 14px; }
  .tu-wa-burbuja { position: relative; max-width: 92%; margin-left: auto; padding: 7px 9px 20px 10px; border-radius: 10px 0 10px 10px; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--color-primary-bg); color: var(--color-text); }
  .tu-wa-hora { position: absolute; right: 8px; bottom: 3px; display: inline-flex; align-items: center; gap: 3px; font-family: var(--rv-mono); font-size: 10.5px; color: var(--color-body); }

  @media (max-width: 768px) {
    .tu-volver { min-height: 44px; padding: 0 8px; margin: -12px 0 0 -8px; }
    .tu-buscar { max-width: none; }
    .tu-fila { min-height: 56px; padding: 12px 14px; }
    .tu-bloque { grid-template-columns: 34px minmax(0, 1fr) auto; }
    .tu-bloque > .rv-switch { grid-column: 3; grid-row: 1; }
    .tu-bloque-horas, .tu-bloque-off { grid-column: 1 / -1; grid-row: 2; padding-bottom: 6px; }
    .tu-bloque-horas > .rv-select { flex: 1; width: auto; min-height: 46px; }
    .tu-dias > button { min-height: 44px; }
    .tu-dia-btn { width: 60px; min-height: 64px; }
  }
  /* A 390 los siete días adentro de una tarjeta quedaban en 42 px de ancho: menos aire entre ellos y 4 px robados a cada lado. */
  @media (max-width: 420px) { .tu-dias { gap: 3px; margin: 0 -4px; } }
`

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
    return <button type="button" onClick={() => setPide(true)} className="rv-btn rv-btn--peligro rv-btn--ancho" style={{ marginTop: 8 }}><Trash2 size={15} /> {etiqueta}</button>
  }
  return (
    <div className="tu-borrar" role="group" aria-label={etiqueta} style={{ marginTop: 8 }}>
      <span>{pregunta}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setPide(false)} className="rv-btn" style={{ flex: 1 }}>Volver</button>
        <button type="button" onClick={onBorrar} className="rv-btn tu-borrar-si" style={{ flex: 1 }}>Sí, eliminar</button>
      </div>
    </div>
  )
}

/** La llave del kit, con rótulo accesible (sin texto al lado). */
export function Llave({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className="rv-switch" onClick={() => onChange(!on)} />
}

/** Volver, como en Tienda: arriba del título y diciendo adónde se vuelve. */
export function Volver({ a, onClick }: { a: string; onClick: () => void }) {
  return <button type="button" className="tu-volver" onClick={onClick}><ArrowLeft size={15} strokeWidth={2} aria-hidden /> {a}</button>
}

/** Buscador de una lista: el input del kit con la lupa adentro. */
export function Buscador({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }) {
  return (
    <span className="tu-buscar">
      <Search size={15} aria-hidden />
      <input type="search" className="rv-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label ?? placeholder} />
    </span>
  )
}

/** Barra fina de avance: cuánto de algo está tomado (0 a 1). */
export function Barra({ valor, color, label }: { valor: number; color?: string; label: string }) {
  const v = Math.min(1, Math.max(0, valor))
  return (
    <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className="tu-barra" style={color ? { ['--c' as string]: color } : undefined}>
      <i style={{ width: `${Math.round(v * 100)}%` }} />
    </span>
  )
}

/** El ícono de un espacio (cabina, consultorio) sobre su color: lo que la Sigla es para una persona. */
export function IconoRecurso({ color, Icon, size = 36 }: { color: string; Icon: LucideIcon; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', color, background: `color-mix(in srgb, ${color} 15%, var(--color-bg))` }}>
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.8} />
    </span>
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
            <label className="rv-sr" htmlFor={`${id}-${clave}-desde`}>{titulo}: desde</label>
            <select id={`${id}-${clave}-desde`} className="rv-select" value={b.desde} onChange={e => set({ desde: Number(e.target.value) })}>
              {MEDIAS_HORAS.map(m => <option key={m} value={m}>{hhmm(m)}</option>)}
            </select>
            <span aria-hidden>a</span>
            <label className="rv-sr" htmlFor={`${id}-${clave}-hasta`}>{titulo}: hasta</label>
            <select id={`${id}-${clave}-hasta`} className="rv-select" value={b.hasta} onChange={e => set({ hasta: Number(e.target.value) })}>
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
        <div className="rv-rotulo" style={{ marginBottom: 8 }}>Días</div>
        <DiasSemana dias={valor.atiende} onChange={atiende => onChange({ ...valor, atiende })} abiertos={abiertos} />
        {abiertos.length < 7 && <p className="rv-ayuda" style={{ margin: '6px 0 0' }}>Los días apagados son los que el negocio no abre.</p>}
      </div>
      <div style={{ marginBottom: 16 }}>
        <div className="rv-rotulo" style={{ marginBottom: 8 }}>Horario</div>
        <Segmentado label="Horario" lleno valor={valor.propio ? 'propio' : 'negocio'} onChange={v => onChange({ ...valor, propio: v === 'propio' })}
          opciones={[{ id: 'negocio', label: 'El del negocio' }, { id: 'propio', label: 'Uno propio' }]} />
        {valor.propio ? (
          <div style={{ marginTop: 10 }}>
            <BloquesJornada id={id} jornada={valor.jornada} onChange={jornada => onChange({ ...valor, jornada })} />
            <p className="rv-ayuda" style={{ margin: '8px 0 0' }}>Siempre dentro del horario del negocio: lo que quede afuera no se ofrece.</p>
          </div>
        ) : (
          <p className="rv-ayuda" style={{ margin: '8px 0 0' }}>Sigue el horario del negocio{delNegocio ? <>: <span className="rv-num">{delNegocio}</span></> : ''}. Si el negocio lo cambia, cambia con él.</p>
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

/** Los horarios libres de un día, en las franjas del kit, separados por la mañana y la tarde (con el corte a la vista). */
export function HorasLibres({ grupos, valor, onElegir, vacio }: { grupos: GrupoLibres[]; valor: number | null; onElegir: (m: number) => void; vacio: ReactNode }) {
  if (!grupos.some(g => g.libres.length > 0)) {
    return <div role="status" className="rv-nota rv-nota--aviso"><CalendarX size={15} aria-hidden /><span>{vacio}</span></div>
  }
  return (
    <div>
      {grupos.map((g, i) => (
        <div key={`${g.nombre}${g.rango}`}>
          {i > 0 && g.rango && grupos[i - 1].rango && <div className="tu-corte">Cerrado de {grupos[i - 1].rango.split(' a ')[1]} a {g.rango.split(' a ')[0]}</div>}
          {i > 0 && !g.rango && <div style={{ height: 14 }} />}
          <div className="tu-horas-cab">{g.nombre}{g.rango && <span className="rv-num">{g.rango}</span>}<span>· {g.libres.length ? `${g.libres.length} libre${g.libres.length === 1 ? '' : 's'}` : 'sin lugar'}</span></div>
          {g.libres.length > 0 && (
            <div className="rv-franjas" role="group" aria-label={`Horarios de la ${g.nombre.toLowerCase()}`}>
              {g.libres.map(m => <button key={m} type="button" className="rv-franja" aria-pressed={m === valor} onClick={() => onElegir(m)}>{horaTxt(m)}</button>)}
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
  const idTexto = useId()
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
    ? <button type="button" onClick={onCerrar} className="rv-btn rv-btn--primario"><Check size={16} /> Listo</button>
    : <>
      <button type="button" onClick={copiarTexto} disabled={vacio} className="rv-btn">{copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? 'Copiado' : 'Copiar'}</button>
      {persona
        ? <button type="button" onClick={() => setEnviado(true)} disabled={vacio || sinTelefono} className="rv-btn rv-btn--primario"><Send size={16} /> Enviar</button>
        : <button type="button" onClick={compartirTexto} disabled={vacio} className="rv-btn rv-btn--primario"><Share2 size={16} /> Compartir</button>}
    </>

  return (
    <Modal
      encima
      ancho={480}
      rotulo="WhatsApp"
      titulo={mensaje.titulo}
      bajada={mensaje.telefono ? <span className="rv-num">{mensaje.telefono}</span> : persona ? 'Sin teléfono cargado' : 'Copialo o compartilo donde quieras: tu estado, un grupo o tus redes.'}
      onCerrar={onCerrar}
      pie={pie}
    >
      {/* Así le llega: la burbuja sigue lo que se escribe abajo */}
      <div className="tu-wa" role="img" aria-label={`Vista previa del mensaje${persona ? ` para ${persona}` : ''}`}>
        <div className="tu-wa-cab">
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)', color: 'var(--chip-primary-fg)', fontSize: 11.5, fontWeight: 700 }}>{persona ? iniciales(persona) : <Share2 size={14} />}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{persona ?? 'Vista previa'}</span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--color-muted)' }}>{enviado ? 'Entregado' : 'WhatsApp'}</span>
          </span>
        </div>
        <div className="tu-wa-fondo">
          <div className="tu-wa-burbuja">
            {texto.trim() || '…'}
            <span className="tu-wa-hora">{horaTxt(AHORA_DEMO)} {enviado ? <CheckCheck size={13} style={{ color: 'var(--color-primary)' }} /> : <Clock3 size={11} />}</span>
          </div>
        </div>
      </div>

      {enviado ? (
        <div role="status" className="rv-nota tu-nota--ok">
          <CheckCheck size={16} aria-hidden />
          <span><b>Enviado a {persona}.</b> Es una demo: no salió ningún mensaje real.</span>
        </div>
      ) : (
        <>
          {sinTelefono && (
            <div role="status" className="rv-nota rv-nota--aviso" style={{ marginBottom: 14 }}>
              <PhoneOff size={15} aria-hidden />
              <span>{persona} no tiene un teléfono cargado. Copiá el mensaje y mandáselo por otro lado.</span>
            </div>
          )}
          <div className="rv-campo">
            <label htmlFor={idTexto}>Mensaje{persona ? ` para ${persona.split(' ')[0]}` : ''}</label>
            <textarea id={idTexto} className="rv-textarea" rows={6} value={texto} onChange={e => { setTexto(e.target.value); setCopiado(null) }} style={{ minHeight: 140 }} />
            <span className="rv-ayuda">{persona ? 'Podés cambiar el texto antes de mandarlo. En la demo el envío es de mentira: no le llega a nadie.' : 'Podés cambiar el texto antes de compartirlo.'}</span>
          </div>
          {copiado === true && <p role="status" className="rv-ayuda" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0 0', color: 'var(--chip-success-fg)', fontWeight: 500 }}><Check size={13} /> Copiado: pegalo en el chat que quieras.</p>}
          {copiado === false && <div style={{ marginTop: 18 }}><ErrorCampo>No se pudo copiar. Seleccioná el texto y copialo a mano.</ErrorCampo></div>}
        </>
      )}
    </Modal>
  )
}
