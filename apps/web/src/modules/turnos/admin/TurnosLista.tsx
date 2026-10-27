// Lista de turnos: la hora manda a la izquierda, después quién y qué, quién
// atiende, el precio y el estado. Una fila es un botón que abre el detalle.
// La lista se acomoda al ancho que le toca (container query), no al de la
// ventana: en el Resumen vive al lado de otra columna. Angosta, quién atiende
// pasa abajo del servicio; muy angosta (celular), cada fila se apila.
import { ChevronRight, Coins } from 'lucide-react'
import { Avatar } from '@/design-system/components/Avatar'
import { ESTADO_TURNO, duracionTxt, horaTxt, pesos, type Turno, type Cliente, type Recurso } from '@/modules/turnos/datos'
import { ChipEstado } from '@/modules/turnos/_shared/components/ChipEstado'

const CSS = `
  .tu-tl { container: tu-tl / inline-size; overflow: hidden; }
  .tu-tl-fila { display: grid; grid-template-columns: 72px minmax(0, 1.5fr) minmax(0, 1fr) 96px 132px 18px; gap: 12px; }
  .tu-tl-hora { display: flex; flex-direction: column; gap: 2px; }
  .tu-tl-hora > b { font-size: 15px; font-weight: 600; color: var(--color-text); }
  .tu-tl-hora > small { font-size: 11.5px; color: var(--color-muted); }
  .tu-tl-quien { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .tu-tl-quien > span { min-width: 0; }
  .tu-tl-quien b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-tl-quien small { display: block; font-size: 12.5px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-tl-sub-rec { display: none; }
  .tu-tl-rec { display: flex; align-items: center; gap: 7px; min-width: 0; font-size: 13px; color: var(--color-body); }
  .tu-tl-rec > i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .tu-tl-rec > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-tl-precio { display: inline-flex; align-items: center; gap: 5px; font-size: 13.5px; font-weight: 500; color: var(--color-text); }
  .tu-tl-flecha { color: var(--color-subtle); }
  .tu-tl-vacio { padding: 36px 16px; text-align: center; font-size: 13.5px; color: var(--color-muted); }
  @container tu-tl (max-width: 780px) {
    .tu-tl-fila { grid-template-columns: 64px minmax(0, 1fr) auto auto 16px; gap: 10px; }
    .tu-tl-rec { display: none; }
    .tu-tl-sub-rec { display: inline; }
  }
  @container tu-tl (max-width: 520px) {
    .tu-tl-fila { grid-template-columns: 58px minmax(0, 1fr) auto; row-gap: 6px; }
    .tu-tl-flecha { display: none; }
    .tu-tl-precio { grid-column: 2; justify-self: start; }
    .tu-tl-estado { grid-column: 3; grid-row: 1; justify-self: end; }
  }
`

export default function TurnosLista({ turnos, clientes, recursos, onAbrir, etiquetaRecurso, vacio = 'No quedan turnos por hoy.' }: {
  turnos: Turno[]; clientes: Cliente[]; recursos: Recurso[]; onAbrir: (t: Turno) => void; etiquetaRecurso: string; vacio?: string
}) {
  const nombre = (id: string) => clientes.find(c => c.id === id)?.nombre ?? '—'
  const rec = (id: string) => recursos.find(r => r.id === id)
  return (
    <div className="rv-card tu-tl">
      <style>{CSS}</style>
      {turnos.length === 0 && <div className="tu-tl-vacio">{vacio}</div>}
      <div className="tu-filas">
        {turnos.map(t => {
          const r = rec(t.recursoId)
          const e = ESTADO_TURNO[t.estado]
          const cliente = nombre(t.clienteId)
          return (
            <button key={t.id} type="button" onClick={() => onAbrir(t)} className="ds-hover tu-fila tu-tl-fila" aria-label={`${horaTxt(t.inicio)}, ${cliente}, ${t.servicio}, ${e.label}`}>
              <span className="tu-tl-hora"><b className="rv-num">{horaTxt(t.inicio)}</b><small>{duracionTxt(t.duracion)}</small></span>
              <span className="tu-tl-quien">
                <Avatar name={cliente} size={34} />
                <span><b>{cliente}</b><small>{t.servicio}<span className="tu-tl-sub-rec"> · {r?.nombre}</span></small></span>
              </span>
              <span className="tu-tl-rec" title={etiquetaRecurso}><i aria-hidden style={{ background: r?.color }} /><span>{r?.nombre}</span></span>
              <span className="tu-tl-precio rv-num">{pesos(t.precio)}{t.senaPagada && <Coins size={13} aria-label="Seña pagada" color="var(--color-success)" />}</span>
              <span className="tu-tl-estado"><ChipEstado estado={t.estado} size="sm" /></span>
              <ChevronRight size={16} className="tu-tl-flecha" aria-hidden />
            </button>
          )
        })}
      </div>
    </div>
  )
}
