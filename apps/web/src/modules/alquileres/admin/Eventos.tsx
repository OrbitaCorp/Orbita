// Eventos del salón: todos los cumpleaños y fiestas en una lista, cada uno con
// su ficha (quién cumple, edad, invitados, paquete, extras, saldo y notas).
// En el modo bloque ocupa el lugar de Clientes: lo que el dueño busca es el
// evento, no la persona que lo reservó (que igual figura en la ficha).
//
// En celular la tabla pasa a tarjetas (rv-tabla) y los filtros quedan
// guardados detrás de un botón (Filtros del kit), con el buscador siempre a mano.
import { useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { fechaCorta, hhmm } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { ESTADO_RESERVA, HOY, bloquesDe, clientePorId, tituloEvento, type Cliente, type NegocioAlquiler, type Reserva } from '../datos'
import { Chip, Encabezado, Filtros, Vacio } from '@/design-system/reservas/piezas'
import { Detalle } from './Reservas'

interface P {
  negocio: NegocioAlquiler
  reservas: Reserva[]
  clientes: Cliente[]
  onCambiar: (id: string, cambio: Partial<Reserva>, aviso?: string) => void
}

type Filtro = 'proximos' | 'realizados' | 'cancelados' | 'todos'

const FILTROS: { id: Filtro; label: string; cumple: (r: Reserva) => boolean }[] = [
  { id: 'proximos', label: 'Próximos', cumple: r => (r.estado === 'pendiente' || r.estado === 'confirmada') && (r.fecha ?? '') >= HOY },
  { id: 'realizados', label: 'Realizados', cumple: r => r.estado === 'completada' || (r.estado === 'confirmada' && (r.fecha ?? '') < HOY) },
  { id: 'cancelados', label: 'Cancelados', cumple: r => r.estado === 'cancelada' },
  { id: 'todos', label: 'Todos', cumple: () => true },
]

const CSS = `
  .ale-barra { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px 16px; margin-bottom: 16px; }
  .ale-buscar { flex: 1 1 260px; max-width: 380px; }
  .ale-filtros { display: flex; flex-wrap: wrap; gap: 8px; }
  .ale-filtros .rv-chip b { font-family: var(--rv-mono); font-weight: 600; opacity: 0.8; }
  .ale-evento { display: block; min-width: 0; }
  .ale-evento small { display: block; font-size: 12.5px; font-weight: 400; color: var(--color-muted); }
  @media (max-width: 768px) { .ale-buscar { max-width: none; flex-basis: 100%; } }
`

const plano = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function Eventos({ negocio, reservas, clientes, onCambiar }: P) {
  const [filtro, setFiltro] = useState<Filtro>('proximos')
  const [q, setQ] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)
  const s = negocio.salon
  const bloques = bloquesDe(negocio)
  const eventos = reservas.filter(r => r.bloqueId && r.fecha)
  const elegido = FILTROS.find(f => f.id === filtro) ?? FILTROS[0]
  const nombre = (r: Reserva) => clientePorId(r.clienteId, clientes)?.nombre ?? ''
  const visibles = eventos
    .filter(elegido.cumple)
    .filter(r => !q.trim() || plano(`${r.evento?.agasajado ?? ''} ${nombre(r)}`).includes(plano(q.trim())))
    // Los próximos, del más cercano al más lejano; el resto, del último para atrás.
    .sort((a, b) => (filtro === 'proximos' ? 1 : -1) * ((a.fecha ?? '').localeCompare(b.fecha ?? '') || (a.inicio ?? 0) - (b.inicio ?? 0)))
  const reserva = abierta ? reservas.find(r => r.id === abierta) ?? null : null
  const proximos = eventos.filter(FILTROS[0].cumple).length

  return (
    <div className="rv-pagina">
      <style>{CSS}</style>
      <Encabezado rotulo={`${proximos} ${proximos === 1 ? 'evento próximo' : 'eventos próximos'}`} titulo="Eventos" bajada="La ficha de cada cumpleaños o fiesta: quién cumple, invitados, paquete, extras, lo que falta cobrar y las notas." />
      <div className="ale-barra">
        <label className="rv-campo ale-buscar">
          <span className="rv-sr">Buscar</span>
          <span className="rv-con-prefijo"><i><Search size={15} aria-hidden /></i><input className="rv-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por quién cumple o por cliente" style={{ paddingLeft: 36 }} /></span>
        </label>
        <Filtros resumen={elegido.label}>
          <div className="ale-filtros" role="group" aria-label="Qué eventos mostrar">
            {FILTROS.map(f => (
              <button key={f.id} type="button" className="rv-chip rv-chip--borde" aria-pressed={f.id === filtro} onClick={() => setFiltro(f.id)}>
                {f.label} <b>{eventos.filter(f.cumple).length}</b>
              </button>
            ))}
          </div>
        </Filtros>
      </div>
      {visibles.length === 0 ? <Vacio titulo={q.trim() ? `Nada coincide con “${q.trim()}”` : 'No hay eventos acá'} texto={q.trim() ? undefined : 'Probá con otro filtro.'} /> : (
        // Entre 769 y 1024 (con la barra lateral) la tabla puede no entrar: corre adentro de su tarjeta, nunca la página.
        <div className="rv-card" style={{ padding: '0 16px', overflowX: 'auto' }}>
          <table className="rv-tabla">
            <thead><tr><th>Evento</th><th>Cuándo</th><th>Invitados</th><th>Paquete y extras</th><th>Saldo</th><th>Estado</th><th><span className="rv-sr">Abrir</span></th></tr></thead>
            <tbody>
              {visibles.map(r => {
                const b = bloques.find(x => x.id === r.bloqueId)
                const paquete = s?.paquetes.find(p => p.id === r.paqueteId)
                const saldo = r.total - r.sena
                return (
                  <tr key={r.id}>
                    <td data-label="Evento"><span className="ale-evento">{tituloEvento(r.evento)}<small>{nombre(r) || '—'}</small></span></td>
                    <td data-label="Cuándo">{fechaCorta(r.fecha!)} · {b ? b.nombre.toLowerCase() : hhmm(r.inicio ?? 0)}</td>
                    <td data-label="Invitados" className="rv-num">{r.evento?.invitados ?? '—'}</td>
                    <td data-label="Paquete y extras">{paquete ? paquete.nombre : '—'}{r.extras.length ? ` · ${r.extras.length} ${r.extras.length === 1 ? 'extra' : 'extras'}` : ''}</td>
                    <td data-label="Saldo" className="rv-num">{r.estado === 'cancelada' ? '—' : saldo > 0 && !r.saldoPagado ? pesos(saldo) : 'Pagado'}</td>
                    <td data-label="Estado"><Chip tono={ESTADO_RESERVA[r.estado].tono}>{ESTADO_RESERVA[r.estado].label}</Chip></td>
                    <td><button type="button" className="rv-btn rv-btn--sm" onClick={() => setAbierta(r.id)} aria-label={`Ver la ficha de ${r.evento?.agasajado ?? 'este evento'}`}>Ficha <ArrowRight size={14} aria-hidden /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {reserva && <Detalle negocio={negocio} reserva={reserva} cliente={clientePorId(reserva.clienteId, clientes)} onCerrar={() => setAbierta(null)} onCambiar={onCambiar} />}
    </div>
  )
}
