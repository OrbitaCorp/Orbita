// Lista de espera del panel de Turnos (semana 3 del plan, tarea del 19/11).
// Quiénes esperan un horario lleno, de hoy en adelante, con dos acciones:
// darle el lugar (la API crea su turno confirmado si todavía hay lugar) o
// sacarlo de la lista. Solo aparece en un negocio real (la API) y solo si hay
// alguien esperando: vive arriba de la Agenda, que es donde se decide.
import { useState } from 'react'
import { Hourglass } from 'lucide-react'
import { cuandoTxt } from '../datos/agenda'
import { horaTxt, type Recurso } from '@/modules/turnos/datos'
import type { EnEspera } from '../datos/origen/mapear'

const CSS = `
  .tu-esp { padding: 14px 16px; margin-bottom: 16px; }
  .tu-esp-cab { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .tu-esp-cab h2 { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .tu-esp-lista { list-style: none; margin: 0; padding: 0; }
  .tu-esp-fila { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 0; border-top: 1px solid var(--color-border); }
  .tu-esp-fila:first-child { border-top: none; }
  .tu-esp-quien { flex: 1 1 220px; min-width: 0; }
  .tu-esp-quien b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .tu-esp-quien span { display: block; margin-top: 2px; font-size: 12.5px; color: var(--color-muted); }
  .tu-esp-acciones { display: flex; gap: 8px; flex-wrap: wrap; }
  .tu-esp-acciones .rv-btn { min-height: 40px; }
`

export default function ListaEspera({ esperas, recursos, puedeEditar, verContacto, onDarLugar, onQuitar }: {
  esperas: EnEspera[]
  recursos: Recurso[]
  puedeEditar: boolean
  verContacto: boolean
  onDarLugar: (e: EnEspera) => Promise<void>
  onQuitar: (e: EnEspera) => Promise<void>
}) {
  // La fila que está guardando: sus botones se apagan hasta que responde la API.
  const [ocupada, setOcupada] = useState<string | null>(null)
  const hacer = async (e: EnEspera, accion: (e: EnEspera) => Promise<void>) => {
    setOcupada(e.id)
    try { await accion(e) } finally { setOcupada(null) }
  }
  const nombreAgenda = (id: string) => recursos.find(r => r.id === id)?.nombre ?? ''
  const ordenadas = [...esperas].sort((a, b) => a.dia - b.dia || a.inicio - b.inicio)

  return (
    <section className="rv-card tu-esp" aria-labelledby="tu-esp-titulo">
      <style>{CSS}</style>
      <div className="tu-esp-cab">
        <Hourglass size={15} aria-hidden style={{ color: 'var(--color-muted)' }} />
        <h2 id="tu-esp-titulo">Lista de espera</h2>
        <span className="rv-chip rv-num">{esperas.length}</span>
      </div>
      <ul className="tu-esp-lista">
        {ordenadas.map(e => {
          const agenda = nombreAgenda(e.recursoId)
          return (
            <li key={e.id} className="tu-esp-fila">
              <div className="tu-esp-quien">
                <b>{e.nombre}</b>
                <span className="rv-num">
                  {cuandoTxt(e.dia)} · {horaTxt(e.inicio)}{agenda ? ` · ${agenda}` : ''}{verContacto && e.telefono ? ` · ${e.telefono}` : ''}
                </span>
              </div>
              {puedeEditar && (
                <div className="tu-esp-acciones">
                  <button type="button" className="rv-btn rv-btn--sm" disabled={ocupada === e.id} onClick={() => void hacer(e, onQuitar)} aria-label={`Sacar a ${e.nombre} de la lista de espera`}>Quitar</button>
                  <button type="button" className="rv-btn rv-btn--sm rv-btn--primario" disabled={ocupada === e.id} onClick={() => void hacer(e, onDarLugar)}>Darle el lugar</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
