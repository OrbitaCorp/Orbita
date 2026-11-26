// Grilla de ocupación (design system): una fila por unidad (propiedad,
// cabaña, depto) y una columna por noche, con cada estadía como una barra
// que dice quién y por dónde llegó. Es la vista de "cómo viene todo" de un
// hotel: de un vistazo, qué está libre y cuándo hay recambio.
//
// Pura y controlada: el padre arma las filas y las barras (la cuenta de
// dónde cae cada una está en ocupacion.ts), elige desde qué día se mira
// y cuántos días, y decide qué pasa al tocar una barra o una noche libre.
//
// - 7, 14 o 30 días; las flechas mueven la ventana entera y "Hoy" vuelve.
// - La primera columna (los nombres) y la cabecera de días quedan fijas: la
//   grilla scrollea adentro de su caja, nunca la página.
// - Las barras son botones (Tab llega a cada una). Las noches libres se tocan
//   con el mouse o el dedo pero no entran al Tab (serían 30 por fila): para el
//   teclado está el botón de agendar a mano de la pantalla que la usa.
import type { CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { DIAS_CORTOS, MESES_CORTOS, diaSemana, esFinDeSemana, fechaLarga, partes, rangoTxt, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { Segmentado } from './piezas'
import { diasDeVentana, inicioConHoy, nocheTomada, rangoVentana, ubicar, type BarraGrilla, type FilaGrilla, type TonoBarra } from './ocupacion'

export type { BarraGrilla, FilaGrilla, TonoBarra } from './ocupacion'

export type DiasGrilla = 7 | 14 | 30

interface P {
  filas: FilaGrilla[]
  barras: BarraGrilla[]
  hoy: ISO
  /** El primer día que se ve. */
  desde: ISO
  dias: DiasGrilla
  onDesde: (f: ISO) => void
  onDias: (n: DiasGrilla) => void
  onBarra: (b: BarraGrilla) => void
  /** Tocar una noche libre (si falta, las noches libres no se tocan). Las noches pasadas nunca. */
  onLibre?: (filaId: string, fecha: ISO) => void
  /** El rótulo de la columna de nombres: "Propiedad", "Cabaña". */
  rotuloFilas: string
  /** Qué dice la leyenda para cada tono; muestra solo los de las barras que se ven en la ventana. */
  leyenda?: Partial<Record<TonoBarra, string>>
}

const CSS = `
  .gro { display: flex; flex-direction: column; gap: 12px; }
  .gro-barra-sup { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; }
  .gro-rango { font-family: var(--rv-mono); font-size: 14px; color: var(--color-text); white-space: nowrap; }
  .gro-nav { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .gro-nav .rv-btn { flex-shrink: 0; }
  /* La caja scrollea en los dos sentidos: así la cabecera (top) y los nombres (left) quedan fijos. */
  .gro-caja { position: relative; max-height: min(70vh, 720px); overflow: auto; border: 1px solid var(--color-border); border-radius: var(--rv-r); background: var(--color-bg); overscroll-behavior-x: contain; }
  .gro-tabla { display: grid; grid-template-columns: var(--gro-nombre) repeat(var(--gro-n), minmax(var(--gro-col), 1fr)); min-width: max-content; }
  .gro-fila { display: contents; }
  .gro-esq, .gro-nombre { position: sticky; left: 0; z-index: 3; background: var(--color-surface); border-right: 1px solid var(--color-border); }
  .gro-esq { top: 0; z-index: 5; display: flex; align-items: end; padding: 8px 12px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-muted); border-bottom: 1px solid var(--color-border); }
  .gro-dia { position: sticky; top: 0; z-index: 4; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-height: 52px; padding: 6px 2px; background: var(--color-surface); border-bottom: 1px solid var(--color-border); border-left: 1px solid var(--color-border); color: var(--color-body); }
  .gro-dia small { font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
  .gro-dia b { font-family: var(--rv-mono); font-size: 15px; font-weight: 600; color: var(--color-text); line-height: 1.1; }
  .gro-dia i { font-style: normal; font-family: var(--rv-mono); font-size: 10px; color: var(--color-muted); text-transform: uppercase; }
  .gro-dia[data-finde='true'] { background: color-mix(in srgb, var(--color-surface-alt) 60%, var(--color-surface)); }
  /* Hoy: la cabecera tintada con el acento y un borde abajo que baja por la columna. */
  .gro-dia[data-hoy='true'] { background: var(--color-primary-bg); color: var(--chip-primary-fg); box-shadow: inset 0 -3px 0 var(--color-primary); }
  .gro-dia[data-hoy='true'] b { color: inherit; }
  .gro-nombre { display: flex; flex-direction: column; justify-content: center; min-width: 0; padding: 6px 12px; min-height: 52px; border-top: 1px solid var(--color-border); }
  .gro-nombre b { font-size: 14px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gro-nombre small { font-size: 12px; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gro-celda { grid-row: var(--gro-fila); min-height: 52px; border-top: 1px solid var(--color-border); border-left: 1px solid var(--color-border); padding: 0; margin: 0; font: inherit; background: transparent; color: transparent; display: grid; place-items: center; }
  .gro-celda[data-finde='true'] { background: color-mix(in srgb, var(--color-surface-alt) 45%, transparent); }
  .gro-celda[data-hoy='true'] { background: color-mix(in srgb, var(--color-primary-bg) 55%, transparent); }
  .gro-celda[data-pasada='true'] { background-image: linear-gradient(color-mix(in srgb, var(--color-surface-alt) 50%, transparent), color-mix(in srgb, var(--color-surface-alt) 50%, transparent)); }
  button.gro-celda { cursor: pointer; }
  button.gro-celda:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; color: var(--color-primary); }
  @media (hover: hover) { button.gro-celda:hover { background-color: var(--color-surface); color: var(--color-primary); } }
  /* La barra: en la misma fila de la grilla que las celdas, encima. container-type deja esconder la etiqueta cuando no entra. */
  .gro-barra { grid-row: var(--gro-fila); z-index: 2; align-self: center; margin: 0 2px; min-width: 0; height: 36px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid transparent; border-left-width: 3px; border-radius: 7px; font: inherit; text-align: left; cursor: pointer; overflow: hidden; container-type: inline-size; transition: filter 160ms ease; }
  .gro-barra b { flex: 1 1 auto; min-width: 0; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gro-barra small { flex: 0 0 auto; font-family: var(--rv-mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.85; white-space: nowrap; }
  @container (max-width: 150px) { .gro-barra small { display: none; } }
  .gro-barra[data-sigue-izq='true'] { border-top-left-radius: 0; border-bottom-left-radius: 0; margin-left: 0; }
  .gro-barra[data-sigue-der='true'] { border-top-right-radius: 0; border-bottom-right-radius: 0; margin-right: 0; }
  .gro-barra:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  @media (hover: hover) { .gro-barra:hover { filter: brightness(0.96); } }
  .gro [data-tono='reserva'] { background: var(--color-primary-bg); border-color: var(--color-primary); color: var(--chip-primary-fg); }
  .gro [data-tono='pendiente'] { background: var(--color-warning-bg); border-color: var(--color-warning); color: var(--chip-warning-fg); }
  .gro [data-tono='pasada'] { background: var(--color-surface-alt); border-color: var(--color-border-strong); color: var(--color-body); }
  /* De otro calendario (Airbnb): otro color y borde punteado, para no confundirla con una reserva propia. */
  .gro [data-tono='externo'] { background: var(--color-violet-bg, var(--color-info-bg)); border-color: var(--color-border-strong); border-style: dashed; border-left-style: solid; color: var(--color-text); }
  .gro [data-tono='cerrado'], .gro [data-tono='bloqueo'] { background: repeating-linear-gradient(135deg, var(--color-surface-alt) 0 5px, var(--color-bg) 5px 10px); border-color: var(--color-border-strong); color: var(--color-body); }
  .gro-leyenda { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12.5px; color: var(--color-muted); }
  .gro-leyenda span { display: inline-flex; align-items: center; gap: 6px; }
  .gro-leyenda i { width: 14px; height: 12px; border-radius: 3px; border: 1px solid transparent; border-left-width: 3px; }
  .gro-vacia { padding: 28px 16px; text-align: center; font-size: 14px; color: var(--color-muted); grid-column: 1 / -1; }
  @media (prefers-reduced-motion: reduce) { .gro-barra { transition: none; } }
  @media (max-width: 768px) {
    .gro-barra-sup { flex-direction: column; align-items: stretch; }
    .gro-nav { justify-content: space-between; }
    .gro-nav .rv-btn { min-height: 44px; min-width: 44px; }
    .gro-celda, .gro-nombre { min-height: 56px; }
    .gro-barra { height: 40px; }
    .gro-nombre { padding: 6px 10px; }
    /* La columna de nombres es angosta: el nombre baja a dos líneas antes de cortarse. */
    .gro-nombre b { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 13px; line-height: 1.25; }
  }
`

/** El ancho de la columna de nombres y el mínimo de cada día, según cuántos días se ven. */
const ANCHOS: Record<DiasGrilla, { nombre: string; col: string }> = {
  7: { nombre: 'clamp(112px, 22vw, 220px)', col: '64px' },
  14: { nombre: 'clamp(112px, 18vw, 200px)', col: '52px' },
  30: { nombre: 'clamp(112px, 16vw, 180px)', col: '40px' },
}

const ORDEN_LEYENDA: TonoBarra[] = ['reserva', 'pendiente', 'pasada', 'externo', 'cerrado', 'bloqueo']

export default function GrillaOcupacion({ filas, barras, hoy, desde, dias, onDesde, onDias, onBarra, onLibre, rotuloFilas, leyenda }: P) {
  const ventana = diasDeVentana(desde, dias)
  const estilo = { '--gro-n': dias, '--gro-nombre': ANCHOS[dias].nombre, '--gro-col': ANCHOS[dias].col } as CSSProperties
  const conHoy = ventana.includes(hoy)
  const tonosVisibles = new Set(barras.filter(b => ubicar(b, desde, dias)).map(b => b.tono))
  return (
    <div className="gro">
      <style>{CSS}</style>
      <div className="gro-barra-sup">
        <span className="gro-rango" aria-live="polite">{rangoVentana(desde, dias, MESES_CORTOS)}</span>
        <div className="gro-nav">
          <Segmentado label="Días que se ven" valor={dias} onChange={n => onDias(n as DiasGrilla)} opciones={[7, 14, 30].map(n => ({ id: n, label: `${n} días` }))} />
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => onDesde(sumarDias(desde, -dias))} aria-label={`${dias} días antes`}><ChevronLeft size={16} aria-hidden /></button>
            <button type="button" className="rv-btn rv-btn--sm" onClick={() => onDesde(inicioConHoy(hoy))} aria-pressed={conHoy && desde === inicioConHoy(hoy)}>Hoy</button>
            <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => onDesde(sumarDias(desde, dias))} aria-label={`${dias} días después`}><ChevronRight size={16} aria-hidden /></button>
          </span>
        </div>
      </div>
      <div className="gro-caja" role="region" aria-label={`Ocupación del ${rangoTxt(desde, sumarDias(desde, dias - 1))}`} tabIndex={0}>
        <div className="gro-tabla" style={estilo}>
          <div className="gro-esq" style={{ gridRow: 1 }}>{rotuloFilas}</div>
          {ventana.map((f, i) => {
            const { dia, mes } = partes(f)
            return (
              <div key={f} className="gro-dia" style={{ gridRow: 1, gridColumn: i + 2 }} data-hoy={f === hoy} data-finde={esFinDeSemana(f)} aria-label={fechaLarga(f)}>
                <small>{f === hoy ? 'Hoy' : DIAS_CORTOS[diaSemana(f)]}</small>
                <b>{dia}</b>
                {(dia === 1 || i === 0) && <i>{MESES_CORTOS[mes - 1]}</i>}
              </div>
            )
          })}
          {filas.length === 0 && <div className="gro-vacia" style={{ gridRow: 2 }}>Nada para mostrar.</div>}
          {filas.map((fila, r) => {
            const fRow = r + 2
            const suyas = barras.filter(b => b.filaId === fila.id)
            const varFila = { '--gro-fila': fRow } as CSSProperties
            return (
              <div key={fila.id} className="gro-fila" role="group" aria-label={fila.nombre}>
                <div className="gro-nombre" style={{ gridRow: fRow, gridColumn: 1 }}>
                  <b title={fila.nombre}>{fila.nombre}</b>
                  {fila.detalle && <small>{fila.detalle}</small>}
                </div>
                {ventana.map((f, i) => {
                  const comun = { className: 'gro-celda', style: { ...varFila, gridColumn: i + 2 }, 'data-hoy': f === hoy, 'data-finde': esFinDeSemana(f), 'data-pasada': f < hoy }
                  const libre = onLibre && f >= hoy && !nocheTomada(suyas, fila.id, f)
                  return libre
                    ? <button key={f} {...comun} type="button" tabIndex={-1} onClick={() => onLibre(fila.id, f)} aria-label={`${fila.nombre}: agendar desde el ${fechaLarga(f).toLowerCase()}`}><Plus size={14} aria-hidden /></button>
                    : <div key={f} {...comun} aria-hidden />
                })}
                {suyas.map(b => {
                  const u = ubicar(b, desde, dias)
                  if (!u) return null
                  return (
                    <button key={b.id} type="button" className="gro-barra" data-tono={b.tono} data-sigue-izq={u.sigueIzq} data-sigue-der={u.sigueDer}
                      style={{ ...varFila, gridColumn: `${u.col + 2} / span ${u.span}` }} onClick={() => onBarra(b)}
                      title={`${b.titulo}${b.etiqueta ? ` · ${b.etiqueta}` : ''} · ${rangoTxt(b.desde, b.hasta)}`}
                      aria-label={b.aria ?? `${fila.nombre}: ${b.titulo}${b.etiqueta ? `, ${b.etiqueta}` : ''}, ${rangoTxt(b.desde, b.hasta)}`}>
                      <b>{b.titulo}</b>
                      {b.etiqueta && <small>{b.etiqueta}</small>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      {leyenda && (
        <div className="gro-leyenda">
          {ORDEN_LEYENDA.filter(t => leyenda[t] && tonosVisibles.has(t)).map(t => <span key={t}><i data-tono={t} aria-hidden />{leyenda[t]}</span>)}
        </div>
      )}
    </div>
  )
}
