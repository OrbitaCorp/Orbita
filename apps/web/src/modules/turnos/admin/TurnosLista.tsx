// Lista de turnos como línea de tiempo: la hora manda a la izquierda, un riel
// une los turnos del día y el estado se lee en el punto del riel y en el chip.
// En celular cada fila se apila (hora arriba, precio y estado abajo).
import { ChevronRight, Coins } from 'lucide-react'
import { Avatar } from '@/design-system/components/Avatar'
import { ESTADO_TURNO, duracionTxt, horaTxt, pesos, type Turno, type Cliente, type Recurso } from '@/modules/turnos/datos'
import { ChipEstado } from '@/modules/turnos/_shared/components/ChipEstado'

export default function TurnosLista({ turnos, clientes, recursos, onAbrir, etiquetaRecurso, vacio = 'No quedan turnos por hoy.' }: {
  turnos: Turno[]; clientes: Cliente[]; recursos: Recurso[]; onAbrir: (t: Turno) => void; etiquetaRecurso: string; vacio?: string
}) {
  const nombre = (id: string) => clientes.find(c => c.id === id)?.nombre ?? '—'
  const rec = (id: string) => recursos.find(r => r.id === id)
  return (
    <div className="tuo-card tu-tl" style={{ overflow: 'hidden' }}>
      <style>{`
        .tu-tl-fila { display: grid; grid-template-columns: 74px 18px minmax(0, 1.5fr) minmax(0, 1fr) 96px 132px 18px; gap: 12px; align-items: center; width: 100%; min-height: 68px; padding: 10px 18px; border: none; border-bottom: 1px solid var(--color-border); background: transparent; text-align: left; font-family: inherit; color: inherit; }
        .tu-tl-fila:last-child { border-bottom: none; }
        .tu-tl-flecha { color: var(--color-subtle); transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1), color 160ms ease; }
        .tu-tl-riel { position: relative; align-self: stretch; display: grid; place-items: center; }
        .tu-tl-riel::before { content: ''; position: absolute; top: -10px; bottom: -10px; left: 50%; width: 1px; background: var(--color-border); }
        .tu-tl-fila:first-child .tu-tl-riel::before { top: 50%; }
        .tu-tl-fila:last-child .tu-tl-riel::before { bottom: 50%; }
        .tu-tl-punto { position: relative; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--color-bg); box-shadow: 0 0 0 1px var(--color-border); transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease; }
        @media (hover: hover) {
          .tu-tl-fila:hover .tu-tl-flecha { transform: translateX(3px); color: var(--color-primary); }
          .tu-tl-fila:hover .tu-tl-punto { transform: scale(1.35); box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 22%, transparent); }
        }
        @media (max-width: 900px) {
          .tu-tl-fila { grid-template-columns: 58px 14px minmax(0, 1fr) auto; row-gap: 6px; padding: 12px 14px; }
          .tu-tl-rec, .tu-tl-flecha { display: none !important; }
          .tu-tl-precio { grid-column: 3; justify-self: start; }
          .tu-tl-estado { grid-column: 4; grid-row: 1; justify-self: end; }
        }
        @media (prefers-reduced-motion: reduce) { .tu-tl-flecha, .tu-tl-punto { transition: none; } }
      `}</style>
      {turnos.length === 0 && <div style={{ padding: '36px 16px', textAlign: 'center', fontSize: 13.5, color: 'var(--color-muted)' }}>{vacio}</div>}
      {turnos.map((t, i) => {
        const r = rec(t.recursoId)
        const e = ESTADO_TURNO[t.estado]
        const cliente = nombre(t.clienteId)
        return (
          <button key={t.id} type="button" onClick={() => onAbrir(t)} className="tu-tl-fila tuo-fila tuo-entra" style={{ ['--i' as string]: Math.min(i, 8) }} aria-label={`${horaTxt(t.inicio)}, ${cliente}, ${t.servicio}, ${e.label}`}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="tuo-num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{horaTxt(t.inicio)}</span>
              <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{duracionTxt(t.duracion)}</span>
            </span>
            <span className="tu-tl-riel" aria-hidden style={{ color: e.dot }}>
              <span className={t.estado === 'en-curso' ? 'tu-tl-punto tuo-late' : 'tu-tl-punto'} style={{ background: e.dot }} />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <Avatar name={cliente} size={36} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cliente}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.servicio}</span>
              </span>
            </span>
            <span className="tu-tl-rec" title={etiquetaRecurso} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, fontSize: 13, color: 'var(--color-body)' }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: r?.color, flexShrink: 0, boxShadow: `0 0 0 3px color-mix(in srgb, ${r?.color ?? 'transparent'} 18%, transparent)` }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r?.nombre}</span>
            </span>
            <span className="tu-tl-precio tuo-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>
              {pesos(t.precio)}
              {t.senaPagada && <Coins size={13} aria-label="Seña pagada" color="var(--color-success)" />}
            </span>
            <span className="tu-tl-estado"><ChipEstado estado={t.estado} size="sm" /></span>
            <ChevronRight size={16} className="tu-tl-flecha" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
