// Detalle de un turno, en un modal. Acciones: confirmar, marcar atendido o
// ausente, mover (a otro horario o a otro día) y cancelar. En la demo solo
// cambian el estado en memoria. Escribirle por WhatsApp y agendar otro turno
// abren sus propios modales (los maneja PanelTurnos).
// Un turno que todavía no empezó no se puede marcar atendido ni ausente: en su
// lugar se le manda un recordatorio.
//
// La hora es el título: es lo primero que se busca al abrir un turno, antes
// que el nombre del servicio, que va en la bajada con el estado.
//
// Lo que se puede hacer depende del rol de quien mira: sin permiso para cambiar
// turnos el detalle es de solo lectura, y sin permiso para ver contactos el
// teléfono va tapado y no hay WhatsApp.
import { useState } from 'react'
import { Phone, MessageCircle, CalendarClock, Check, UserX, Ban, Coins, FileText, ShieldCheck, Timer, Wallet, StickyNote, Lock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Avatar } from '@/design-system/components/Avatar'
import { DIAS, horaTxt, duracionTxt, pesos, esSalud, type Cliente, type Recurso, type RubroTurnos, type EstadoTurno } from '@/modules/turnos/datos'
import { AHORA_DEMO, ChipEstado } from '@/modules/turnos/_shared/components/ChipEstado'
import { Modal, TiraDias, HorasLibres } from './piezasPanel'
import { fechaDe, fechaLarga, indiceDia, type GrupoLibres, type TurnoAgenda } from '../datos/agenda'
import { taparTelefono } from '../datos/equipo'

const CSS = `
  .tu-det { display: flex; flex-direction: column; gap: 16px; }
  .tu-det-datos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .tu-det-dato { padding: 11px 12px; border-radius: var(--rv-r-sm); background: var(--color-surface); border: 1px solid var(--color-border); min-width: 0; }
  .tu-det-dato > small { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--color-muted); margin-bottom: 4px; white-space: nowrap; }
  .tu-det-dato > b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-det-sec { padding: 16px; }
  .tu-det-fila { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid var(--color-border); font-size: 13px; }
  .tu-det-fila:first-of-type { border-top: none; }
  .tu-det-nota { margin: 0; padding-left: 12px; border-left: 2px solid var(--color-border-strong); font-size: 13px; line-height: 1.5; color: var(--color-body); }
  .tu-det-cancelar { font-size: 13.5px; color: var(--color-text); font-weight: 500; }
  @media (max-width: 480px) { .tu-det-datos { grid-template-columns: minmax(0, 1fr); } }
`

interface Props {
  turno: TurnoAgenda
  rubro: RubroTurnos
  cliente?: Cliente
  recurso?: Recurso
  /** Los días a los que se puede mover el turno: de hoy en adelante, con los que esa agenda no atiende apagados. */
  diasMover: { dia: number; cerrado?: boolean }[]
  /** Los horarios libres de un día para este turno, por la mañana y por la tarde. */
  libresMover: (dia: number) => GrupoLibres[]
  /** Quien mira puede confirmar, mover y cancelar este turno. */
  puedeEditar: boolean
  /** Puede registrar la seña como cobrada. */
  puedeCobrar: boolean
  /** Puede ver el teléfono y escribirle. */
  verContacto: boolean
  onCerrar: () => void
  onEstado: (id: string, estado: EstadoTurno) => void
  onMover: (dia: number, inicio: number) => void
  onSena: () => void
  onAgendarOtro: () => void
  onWhatsApp: () => void
}

export default function DetalleTurno({ turno, rubro, cliente, recurso, diasMover, libresMover, puedeEditar, puedeCobrar, verContacto, onCerrar, onEstado, onMover, onSena, onAgendarOtro, onWhatsApp }: Props) {
  const dia = turno.dia ?? 0
  const [moviendo, setMoviendo] = useState(false)
  const [aDia, setADia] = useState(Math.max(0, dia))
  const [aHora, setAHora] = useState<number | null>(null)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)

  const salud = esSalud(rubro)
  const cerrado = turno.estado === 'cancelado' || turno.estado === 'completado' || turno.estado === 'ausente'
  const nombrePila = cliente?.nombre.split(' ')[0]
  const porVenir = dia > 0 || (dia === 0 && turno.inicio > AHORA_DEMO)
  const senaMonto = rubro.sena > 0 ? Math.round(turno.precio * rubro.sena / 100) : 0
  const grupos = moviendo ? libresMover(aDia) : []
  const elegida = aHora !== null && grupos.some(g => g.libres.includes(aHora)) ? aHora : null
  // "a las", "a mañana, a las", "al lunes 28, a las": adónde va el turno, para el botón.
  const destino = (d: number) => (d === dia ? 'a las' : d === 0 ? 'a hoy, a las' : d === 1 ? 'a mañana, a las' : `al ${DIAS[indiceDia(d)].toLowerCase()} ${fechaDe(d).getDate()}, a las`)

  const pie = confirmarCancelar ? (
    <>
      <span className="rv-modal-izq tu-det-cancelar">¿Cancelar el turno? {cliente ? `Le avisamos a ${nombrePila}.` : ''}</span>
      <button type="button" onClick={() => setConfirmarCancelar(false)} className="rv-btn">Volver</button>
      <button type="button" onClick={() => { onEstado(turno.id, 'cancelado'); setConfirmarCancelar(false) }} className="rv-btn tu-borrar-si">Sí, cancelar</button>
    </>
  ) : !puedeEditar ? (
    <button type="button" onClick={onCerrar} className="rv-btn rv-btn--primario">Listo</button>
  ) : cerrado ? (
    <button type="button" onClick={onAgendarOtro} className="rv-btn rv-btn--primario"><CalendarClock size={16} /> Agendar otro turno{nombrePila ? ` para ${nombrePila}` : ''}</button>
  ) : moviendo ? (
    <>
      <button type="button" onClick={() => { setMoviendo(false); setAHora(null) }} className="rv-btn">Dejarlo como está</button>
      <button type="button" disabled={elegida === null} onClick={() => { if (elegida !== null) { onMover(aDia, elegida); setMoviendo(false); setAHora(null) } }} className="rv-btn rv-btn--primario">
        <CalendarClock size={16} /> {elegida === null ? 'Elegí un horario' : `Mover ${destino(aDia)} ${horaTxt(elegida)}`}
      </button>
    </>
  ) : (
    <>
      <button type="button" onClick={() => setConfirmarCancelar(true)} className="rv-btn rv-btn--fantasma rv-btn--peligro rv-modal-izq"><Ban size={15} /> Cancelar turno</button>
      <button type="button" onClick={() => setMoviendo(true)} className="rv-btn"><CalendarClock size={15} /> Mover</button>
      {!porVenir && <button type="button" onClick={() => onEstado(turno.id, 'ausente')} className="rv-btn"><UserX size={15} /> Ausente</button>}
      {turno.estado === 'pendiente'
        ? <button type="button" onClick={() => onEstado(turno.id, 'confirmado')} className="rv-btn rv-btn--primario"><Check size={16} /> Confirmar turno</button>
        : !porVenir
          ? <button type="button" onClick={() => onEstado(turno.id, 'completado')} className="rv-btn rv-btn--primario"><Check size={16} /> Marcar atendido</button>
          : cliente && verContacto && <button type="button" onClick={onWhatsApp} className="rv-btn rv-btn--primario"><MessageCircle size={16} /> Mandar recordatorio</button>}
    </>
  )

  return (
    <Modal
      ancho={560}
      rotulo={`${fechaLarga(dia)}${recurso ? ` · ${recurso.nombre}` : ''}`}
      titulo={<span className="rv-num" style={{ textDecoration: turno.estado === 'cancelado' ? 'line-through' : undefined }}>{horaTxt(turno.inicio)} – {horaTxt(turno.inicio + turno.duracion)}</span>}
      bajada={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span>{turno.servicio}</span><ChipEstado estado={turno.estado} size="sm" /></span>}
      onCerrar={onCerrar}
      pie={pie}
    >
      <style>{CSS}</style>
      <div className="tu-det">
        {/* Datos del turno */}
        <div className="tu-det-datos">
          <Dato Icon={Timer} label="Duración" valor={duracionTxt(turno.duracion)} />
          <Dato Icon={Wallet} label="Precio" valor={pesos(turno.precio)} mono />
          {rubro.sena > 0
            ? <Dato Icon={Coins} label={`Seña ${rubro.sena}%`} valor={turno.senaPagada ? 'Pagada' : 'Pendiente'} tono={turno.senaPagada ? 'var(--chip-success-fg)' : 'var(--chip-warning-fg)'} />
            : <Dato Icon={Coins} label="Seña" valor="No pide" />}
        </div>
        {senaMonto > 0 && !turno.senaPagada && !cerrado && puedeCobrar && (
          <button type="button" onClick={onSena} className="rv-btn" style={{ alignSelf: 'flex-start' }}><Coins size={15} /> Registrar la seña de <span className="rv-num">{pesos(senaMonto)}</span></button>
        )}
        {turno.nota && (
          <div className="rv-nota rv-nota--aviso"><StickyNote size={15} aria-hidden /><span>{turno.nota}</span></div>
        )}

        {/* Mover: el día y el horario, entre lo que esa agenda tiene libre */}
        {moviendo && (
          <section className="rv-card tu-det-sec" style={{ borderColor: 'var(--color-primary)' }} aria-label="Mover el turno">
            <div className="rv-rotulo" style={{ marginBottom: 10 }}>Mover a</div>
            <TiraDias dias={diasMover} valor={aDia} onElegir={d => { setADia(d); setAHora(null) }} etiqueta="Día al que se mueve" />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: '8px 0 12px' }}>{fechaLarga(aDia)}{recurso ? ` · ${recurso.nombre}` : ''}</div>
            <HorasLibres grupos={grupos} valor={elegida} onElegir={setAHora}
              vacio={<>{recurso ? `${recurso.nombre} no tiene` : 'No hay'} lugar ese día para un turno de {duracionTxt(turno.duracion)}. Probá con otro día.</>} />
          </section>
        )}

        {/* Cliente / paciente */}
        {cliente && (
          <section className="rv-card tu-det-sec" aria-label={rubro.cliente}>
            <div className="rv-rotulo" style={{ marginBottom: 12 }}>{rubro.cliente}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={cliente.nombre} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{cliente.nombre}</div>
                <div className="rv-num" style={{ fontSize: 12.5, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  {verContacto ? <><Phone size={12} /> {cliente.telefono}</> : <><Lock size={12} /> {taparTelefono(cliente.telefono)}</>}
                </div>
              </div>
              {verContacto && <button type="button" onClick={onWhatsApp} aria-label={`Escribirle a ${nombrePila} por WhatsApp`} className="rv-btn rv-btn--icono"><MessageCircle size={16} /></button>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <span className="rv-chip"><b className="rv-num" style={{ color: 'var(--color-text)' }}>{cliente.visitas}</b> visitas</span>
              <span className="rv-chip">Última <b className="rv-num" style={{ color: 'var(--color-text)' }}>{cliente.ultima}</b></span>
              {salud && cliente.obraSocial && <span className="rv-chip rv-chip--primario"><ShieldCheck size={13} /> {cliente.obraSocial}</span>}
            </div>
            {cliente.nota && <p className="tu-det-nota" style={{ marginTop: 12 }}>{cliente.nota}</p>}
          </section>
        )}

        {/* Ficha mínima (solo salud): estructura, sin datos clínicos reales */}
        {salud && (
          <section className="rv-card tu-det-sec" aria-label="Ficha del paciente">
            <div className="rv-rotulo" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><FileText size={13} aria-hidden /> Ficha del paciente</div>
            {[['Motivo de la consulta', 'Control de rutina'], ['Alergias', 'No registra'], ['Última atención', cliente?.ultima ?? '—']].map(([k, v]) => (
              <div key={k} className="tu-det-fila">
                <span style={{ color: 'var(--color-muted)' }}>{k}</span><span style={{ color: 'var(--color-text)', textAlign: 'right', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <p className="rv-ayuda" style={{ margin: '8px 0 0' }}>Solo lo ve el equipo del consultorio. Las notas clínicas no se envían por mail ni WhatsApp.</p>
          </section>
        )}

        {!puedeEditar && !cerrado && (
          <p className="rv-ayuda" style={{ display: 'flex', gap: 8, margin: 0 }}>
            <Lock size={14} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} /> Con tu rol podés ver este turno, pero no confirmarlo, moverlo ni cancelarlo.
          </p>
        )}
      </div>
    </Modal>
  )
}

function Dato({ label, valor, mono, tono, Icon }: { label: string; valor: string; mono?: boolean; tono?: string; Icon: LucideIcon }) {
  return (
    <div className="tu-det-dato">
      <small><Icon size={12} aria-hidden /> {label}</small>
      <b className={mono ? 'rv-num' : undefined} style={tono ? { color: tono } : undefined}>{valor}</b>
    </div>
  )
}
