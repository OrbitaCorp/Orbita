// Clientes (o huéspedes) del negocio: quiénes reservaron, cuántas veces y
// cuánto gastaron, con su historial. Todo sale de las reservas: no hay una
// lista aparte que mantener. En el salón esta sección es Eventos (Eventos.tsx).
// La ficha abierta viaja en ?cliente=: el buscador del header la abre desde
// cualquier parte.
import { useState } from 'react'
import { ArrowRight, CalendarCheck, Contact, Search, UserPlus } from 'lucide-react'
import { MESES, fechaCorta, hhmm, moverMes, partes, rangoTxt } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { nochesEntre } from '@/lib/reservas/estadia'
import { ESTADO_RESERVA, HOY, TIPOS, fechaDeReserva, nochesTxt, unidadPorId, type Cliente, type NegocioAlquiler, type Reserva } from '../datos'
import { Chip, Encabezado, Kpi, Modal, Sigla, Vacio } from '@/design-system/reservas/piezas'

interface P {
  negocio: NegocioAlquiler
  reservas: Reserva[]
  clientes: Cliente[]
  /** La ficha abierta (viaja en ?cliente=) y cómo abrir otra o cerrar (null). */
  abierto: string | null
  onAbrir: (id: string | null) => void
}

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Los tres números de la ficha. En la hoja del celular (350 px) un "$1.234.000" a 20 px no entraba en un tercio.
const CSS_FICHA = `
  .alcl-resumen { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0 0 14px; }
  .alcl-resumen > div { padding: 12px 14px; min-width: 0; }
  .alcl-resumen dd { margin: 6px 0 0; font-family: var(--rv-mono); font-size: 18px; font-weight: 600; color: var(--color-text); overflow-wrap: anywhere; }
  @media (max-width: 640px) { .alcl-resumen > div { padding: 10px; } .alcl-resumen dd { font-size: 15px; } }
`

/** Los que llegaron con la demo: desde el sitio (kn…) o agendados a mano en el panel (ka…). Se ven aunque hayan cancelado. */
const esNuevo = (c: Cliente) => c.id.startsWith('kn') || c.id.startsWith('ka')

export default function Clientes({ negocio, reservas, clientes, abierto, onAbrir }: P) {
  const [q, setQ] = useState('')
  const t = TIPOS[negocio.tipo]
  const filas = clientes.map(c => {
    const suyas = reservas.filter(r => r.clienteId === c.id && r.estado !== 'cancelada').sort((a, b) => fechaDeReserva(b).localeCompare(fechaDeReserva(a)))
    const gastado = suyas.filter(r => r.estado === 'completada' || r.estado === 'confirmada').reduce((s, r) => s + r.total, 0)
    // "Última" es la última que ya pasó: con la más lejana de todas salía una fecha futura, después de "Próxima".
    const pasada = suyas.find(r => fechaDeReserva(r) < HOY)
    return { c, suyas, cuantas: suyas.length, reciente: suyas[0] ? fechaDeReserva(suyas[0]) : null, primera: suyas.length ? fechaDeReserva(suyas[suyas.length - 1]) : null, ultima: pasada ? fechaDeReserva(pasada) : null, gastado, proxima: suyas.filter(r => fechaDeReserva(r) >= HOY).sort((a, b) => fechaDeReserva(a).localeCompare(fechaDeReserva(b)))[0] ?? null }
  }).filter(f => f.cuantas > 0 || esNuevo(f.c)).sort((a, b) => (b.reciente ?? '').localeCompare(a.reciente ?? ''))
  const visibles = filas.filter(f => !q.trim() || plano(`${f.c.nombre} ${f.c.telefono} ${f.c.email ?? ''}`).includes(plano(q.trim())))
  const fila = abierto ? filas.find(f => f.c.id === abierto) ?? null : null
  const cuando = (r: Reserva) => r.entrada && r.salida ? `${rangoTxt(r.entrada, r.salida)} · ${nochesTxt(nochesEntre(r.entrada, r.salida))}` : r.fecha ? `${fechaCorta(r.fecha)} · ${hhmm(r.inicio ?? 0)}` : ''
  const plural = t.cliente === 'huésped' ? 'Huéspedes' : 'Clientes'
  // Nuevo este mes: su primera reserva es de este mes (o llegó con la demo y todavía no tiene ninguna).
  const primerDia = moverMes(HOY, 0)
  const nuevos = filas.filter(f => (f.primera ? f.primera >= primerDia : true)).length
  const conProxima = filas.filter(f => f.proxima).length

  return (
    <div className="rv-pagina">
      <Encabezado rotulo={`${filas.length} en total`} titulo={plural} bajada={`Quiénes reservaron, cuántas veces y cuánto gastaron. Se arma solo con cada ${negocio.tipo === 'bloque' ? 'evento' : 'reserva'}.`} />
      <div className="rv-kpis rv-kpis--3" style={{ marginBottom: 16 }}>
        <Kpi i={0} label={plural} Icon={Contact} valor={filas.length} nota="con al menos una reserva" />
        <Kpi i={1} label="Nuevos este mes" Icon={UserPlus} valor={nuevos} nota={`primera reserva en ${MESES[partes(HOY).mes - 1]}`} />
        <Kpi i={2} label="Con reserva próxima" Icon={CalendarCheck} valor={conProxima} nota="ya tienen fecha" />
      </div>
      <label className="rv-campo" style={{ maxWidth: 380, marginBottom: 16 }}>
        <span className="rv-sr">Buscar</span>
        <span className="rv-con-prefijo"><i><Search size={15} /></i><input className="rv-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono" style={{ paddingLeft: 36 }} /></span>
      </label>
      {visibles.length === 0 ? <Vacio titulo={`Nada coincide con “${q}”`} /> : (
        // Entre 769 y 1024 (con la barra lateral) la tabla puede no entrar: corre adentro de su tarjeta, nunca la página.
        <div className="rv-card" style={{ padding: '0 16px', overflowX: 'auto' }}>
          <table className="rv-tabla">
            <thead><tr><th>{t.cliente === 'huésped' ? 'Huésped' : 'Cliente'}</th><th>Reservas</th><th>Última</th><th>Próxima</th><th>Gastado</th><th><span className="rv-sr">Abrir</span></th></tr></thead>
            <tbody>
              {visibles.map(f => (
                <tr key={f.c.id}>
                  <td data-label="Nombre"><span className="rv-fila" style={{ gap: 10, flexWrap: 'nowrap' }}><Sigla nombre={f.c.nombre} size={32} /><span style={{ minWidth: 0 }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.c.nombre}</span><span className="rv-ayuda" style={{ fontWeight: 400 }}>{f.c.telefono}</span></span></span></td>
                  <td data-label="Reservas" className="rv-num">{f.cuantas}</td>
                  <td data-label="Última">{f.ultima ? fechaCorta(f.ultima) : '—'}</td>
                  <td data-label="Próxima">{f.proxima ? <Chip tono="ok">{fechaCorta(fechaDeReserva(f.proxima))}</Chip> : <span className="rv-muted">—</span>}</td>
                  <td data-label="Gastado" className="rv-num">{pesos(f.gastado)}</td>
                  <td><button type="button" className="rv-btn rv-btn--sm" onClick={() => onAbrir(f.c.id)} aria-label={`Ver a ${f.c.nombre}`}>Ver <ArrowRight size={14} aria-hidden /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {fila && (
        <Modal titulo={fila.c.nombre} bajada={`${fila.c.telefono}${fila.c.email ? ` · ${fila.c.email}` : ''}`} onCerrar={() => onAbrir(null)} pie={<button type="button" className="rv-btn" onClick={() => onAbrir(null)}>Cerrar</button>}>
          {fila.c.nota && <p className="rv-nota" style={{ marginBottom: 12 }}>{fila.c.nota}</p>}
          <style>{CSS_FICHA}</style>
          <dl className="alcl-resumen">
            <div className="rv-card"><dt className="rv-rotulo">Reservas</dt><dd>{fila.cuantas}</dd></div>
            <div className="rv-card"><dt className="rv-rotulo">Gastado</dt><dd>{pesos(fila.gastado)}</dd></div>
            <div className="rv-card"><dt className="rv-rotulo">Última</dt><dd>{fila.ultima ? fechaCorta(fila.ultima) : '—'}</dd></div>
          </dl>
          <div className="rv-rotulo" style={{ marginBottom: 6 }}>Historial</div>
          <div className="rv-lista">
            {fila.suyas.map(r => (
              <div key={r.id} className="rv-item">
                <span className="rv-item-cuerpo"><span className="rv-item-titulo">{unidadPorId(negocio, r.unidadId)?.nombre ?? negocio.nombre}{r.evento ? ` · ${r.evento.agasajado}` : ''}</span><span className="rv-item-sub">{cuando(r)} · {pesos(r.total)}</span></span>
                <Chip tono={ESTADO_RESERVA[r.estado].tono}>{ESTADO_RESERVA[r.estado].label}</Chip>
              </div>
            ))}
            {fila.suyas.length === 0 && <p className="rv-ayuda" style={{ margin: '6px 0' }}>Todavía sin reservas.</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}
