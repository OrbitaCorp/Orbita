// Detalle de un turno, en un modal. Acciones: confirmar, marcar atendido o
// ausente, mover (a otro horario o a otro día) y cancelar. En la demo solo
// cambian el estado en memoria. Escribirle por WhatsApp y agendar otro turno
// abren sus propios modales (los maneja PanelTurnos).
// Un turno que todavía no empezó no se puede marcar atendido ni ausente: en su
// lugar se le manda un recordatorio.
//
// La cabecera es un bloque "espacio" con la hora como protagonista: es lo
// primero que se busca al abrir un turno, antes que el nombre del servicio.
//
// Lo que se puede hacer depende del rol de quien mira: sin permiso para cambiar
// turnos el detalle es de solo lectura, y sin permiso para ver contactos el
// teléfono va tapado y no hay WhatsApp.
import { useState } from 'react'
import { X, Phone, MessageCircle, CalendarClock, Check, UserX, Ban, Coins, FileText, ShieldCheck, Timer, Wallet, StickyNote, Lock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Avatar } from '@/design-system/components/Avatar'
import { DIAS, horaTxt, duracionTxt, pesos, esSalud, type Cliente, type Recurso, type RubroTurnos, type EstadoTurno } from '@/modules/turnos/datos'
import { ChipEstado } from '@/modules/turnos/_shared/components/ChipEstado'
import { Estrellas } from '@/modules/turnos/_shared/orbita/Cielo'
import { Modal, TiraDias, HorasLibres } from './piezasPanel'
import { useCalendarioDemo, type GrupoLibres, type TurnoAgenda } from './agendaDemo'
import { taparTelefono } from './equipoDemo'

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
  const { ahora, fechaCorta, fechaLarga, indiceDia, numeroDia } = useCalendarioDemo()
  const [aDia, setADia] = useState(Math.max(0, dia))
  const [aHora, setAHora] = useState<number | null>(null)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)

  const salud = esSalud(rubro)
  const cerrado = turno.estado === 'cancelado' || turno.estado === 'completado' || turno.estado === 'ausente'
  const nombrePila = cliente?.nombre.split(' ')[0]
  const porVenir = dia > 0 || (dia === 0 && turno.inicio > ahora.minutos)
  const senaMonto = rubro.sena > 0 ? Math.round(turno.precio * rubro.sena / 100) : 0
  const grupos = moviendo ? libresMover(aDia) : []
  const elegida = aHora !== null && grupos.some(g => g.libres.includes(aHora)) ? aHora : null
  // "a las", "a mañana, a las", "al lunes 28, a las": adónde va el turno, para el botón.
  const destino = (d: number) => (d === dia ? 'a las' : d === 0 ? 'a hoy, a las' : d === 1 ? 'a mañana, a las' : `al ${DIAS[indiceDia(d)].toLowerCase()} ${numeroDia(d)}, a las`)

  const cabecera = (
    <div className="tuo-espacio" style={{ padding: '18px 20px 20px', flexShrink: 0 }}>
      <Estrellas cantidad={18} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ChipEstado estado={turno.estado} />
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="tuo-btn tuo-btn--icono tuo-btn--sm tuo-modal-cerrar" style={{ background: 'rgba(255,255,255,0.06)' }}><X size={16} /></button>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--tuo-fh)', fontSize: 40, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', textDecoration: turno.estado === 'cancelado' ? 'line-through' : undefined }}>{horaTxt(turno.inicio)}</span>
        <span className="tuo-num" style={{ fontSize: 14, color: 'var(--color-muted)' }}>→ {horaTxt(turno.inicio + turno.duracion)}</span>
      </div>
      <h2 style={{ fontFamily: 'var(--tuo-fh)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '10px 0 0' }}>{turno.servicio}</h2>
      <div style={{ fontSize: 13, color: 'var(--color-body)', marginTop: 4 }}>{fechaLarga(dia)}{recurso ? ` · ${recurso.nombre}` : ''}</div>
    </div>
  )

  const pie = confirmarCancelar ? (
    <>
      <span className="tuo-modal-izq" style={{ fontSize: 13.5, color: 'var(--color-text)', fontWeight: 500 }}>¿Cancelar el turno? {cliente ? `Le avisamos a ${nombrePila}.` : ''}</span>
      <button type="button" onClick={() => setConfirmarCancelar(false)} className="tuo-btn">Volver</button>
      <button type="button" onClick={() => { onEstado(turno.id, 'cancelado'); setConfirmarCancelar(false) }} className="tuo-btn" style={{ background: 'var(--color-error)', borderColor: 'var(--color-error)', color: '#fff' }}>Sí, cancelar</button>
    </>
  ) : !puedeEditar ? (
    <button type="button" onClick={onCerrar} className="tuo-btn tuo-btn--primario">Listo</button>
  ) : cerrado ? (
    <button type="button" onClick={onAgendarOtro} className="tuo-btn tuo-btn--primario"><CalendarClock size={16} /> Agendar otro turno{nombrePila ? ` para ${nombrePila}` : ''}</button>
  ) : moviendo ? (
    <>
      <button type="button" onClick={() => { setMoviendo(false); setAHora(null) }} className="tuo-btn">Dejarlo como está</button>
      <button type="button" disabled={elegida === null} onClick={() => { if (elegida !== null) { onMover(aDia, elegida); setMoviendo(false); setAHora(null) } }} className="tuo-btn tuo-btn--primario">
        <CalendarClock size={16} /> {elegida === null ? 'Elegí un horario' : `Mover ${destino(aDia)} ${horaTxt(elegida)}`}
      </button>
    </>
  ) : (
    <>
      <button type="button" onClick={() => setConfirmarCancelar(true)} className="tuo-btn tuo-btn--peligro tuo-modal-izq"><Ban size={15} /> Cancelar turno</button>
      <button type="button" onClick={() => setMoviendo(true)} className="tuo-btn"><CalendarClock size={15} /> Mover</button>
      {!porVenir && <button type="button" onClick={() => onEstado(turno.id, 'ausente')} className="tuo-btn"><UserX size={15} /> Ausente</button>}
      {turno.estado === 'pendiente'
        ? <button type="button" onClick={() => onEstado(turno.id, 'confirmado')} className="tuo-btn tuo-btn--primario"><Check size={16} /> Confirmar turno</button>
        : !porVenir
          ? <button type="button" onClick={() => onEstado(turno.id, 'completado')} className="tuo-btn tuo-btn--primario"><Check size={16} /> Marcar atendido</button>
          : cliente && verContacto && <button type="button" onClick={onWhatsApp} className="tuo-btn tuo-btn--primario"><MessageCircle size={16} /> Mandar recordatorio</button>}
    </>
  )

  return (
    <Modal titulo="Detalle del turno" ancho={560} cabecera={cabecera} onCerrar={onCerrar} pie={pie}>
      <style>{`
        .tu-det { display: flex; flex-direction: column; gap: 16px; }
        .tu-det-sec { animation: tuoEntra 420ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(var(--i, 0) * 60ms + 100ms); }
        @media (prefers-reduced-motion: reduce) { .tu-det-sec { animation: none; } }
      `}</style>
      <div className="tu-det">
        {/* Datos del turno */}
        <div className="tu-det-sec" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <Dato Icon={Timer} label="Duración" valor={duracionTxt(turno.duracion)} />
          <Dato Icon={Wallet} label="Precio" valor={pesos(turno.precio)} mono />
          {rubro.sena > 0
            ? <Dato Icon={Coins} label={`Seña ${rubro.sena}%`} valor={turno.senaPagada ? 'Pagada' : 'Pendiente'} tono={turno.senaPagada ? 'var(--chip-success-fg)' : 'var(--chip-warning-fg)'} />
            : <Dato Icon={Coins} label="Seña" valor="No pide" />}
        </div>
        {senaMonto > 0 && !turno.senaPagada && !cerrado && puedeCobrar && (
          <button type="button" onClick={onSena} className="tuo-btn tu-det-sec" style={{ ['--i' as string]: 1, alignSelf: 'flex-start', height: 44 }}><Coins size={15} /> Registrar la seña de <span className="tuo-num">{pesos(senaMonto)}</span></button>
        )}
        {turno.nota && (
          <div className="tu-det-sec" style={{ ['--i' as string]: 1, display: 'flex', gap: 9, padding: '11px 13px', borderRadius: 12, background: 'var(--color-warning-bg)', color: 'var(--chip-warning-fg)', fontSize: 13, lineHeight: 1.5, border: '1px solid color-mix(in srgb, var(--color-warning) 28%, transparent)' }}>
            <StickyNote size={15} style={{ flexShrink: 0, marginTop: 2 }} />{turno.nota}
          </div>
        )}

        {/* Mover: el día y el horario, entre lo que esa agenda tiene libre */}
        {moviendo && (
          <section className="tuo-card tuo-entra" style={{ padding: 16, boxShadow: 'none', borderColor: 'color-mix(in srgb, var(--color-primary) 40%, var(--color-border))' }} aria-label="Mover el turno">
            <div className="tuo-rotulo" style={{ marginBottom: 10 }}>Mover a</div>
            <TiraDias dias={diasMover} valor={aDia} onElegir={d => { setADia(d); setAHora(null) }} etiqueta="Día al que se mueve" />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: '8px 0 12px' }}>{fechaLarga(aDia)}{recurso ? ` · ${recurso.nombre}` : ''}</div>
            <HorasLibres grupos={grupos} valor={elegida} onElegir={setAHora}
              vacio={<>{recurso ? `${recurso.nombre} no tiene` : 'No hay'} lugar ese día para un turno de {duracionTxt(turno.duracion)}. Probá con otro día.</>} />
          </section>
        )}

        {/* Cliente / paciente */}
        {cliente && (
          <section className="tuo-card tu-det-sec" style={{ ['--i' as string]: 2, padding: 16, boxShadow: 'none' }}>
            <div className="tuo-rotulo" style={{ marginBottom: 12 }}>{rubro.cliente}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={cliente.nombre} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--color-text)' }}>{cliente.nombre}</div>
                <div className="tuo-num" style={{ fontSize: 12.5, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  {verContacto ? <><Phone size={12} /> {cliente.telefono}</> : <><Lock size={12} /> {taparTelefono(cliente.telefono)}</>}
                </div>
              </div>
              {verContacto && <button type="button" onClick={onWhatsApp} aria-label={`Escribirle a ${nombrePila} por WhatsApp`} className="tuo-btn tuo-btn--icono" style={{ width: 44, height: 44 }}><MessageCircle size={16} /></button>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <span className="tuo-chip"><b className="tuo-num" style={{ color: 'var(--color-text)' }}>{cliente.visitas}</b> visitas</span>
              <span className="tuo-chip">Última <b className="tuo-num" style={{ color: 'var(--color-text)' }}>{cliente.ultima === null ? '—' : fechaCorta(cliente.ultima)}</b></span>
              {salud && cliente.obraSocial && <span className="tuo-chip tuo-chip--primario"><ShieldCheck size={13} /> {cliente.obraSocial}</span>}
            </div>
            {cliente.nota && <p style={{ fontSize: 13, color: 'var(--color-body)', margin: '12px 0 0', paddingLeft: 12, borderLeft: '2px solid var(--color-border-strong)', lineHeight: 1.5 }}>{cliente.nota}</p>}
          </section>
        )}

        {/* Ficha mínima (solo salud): estructura, sin datos clínicos reales */}
        {salud && (
          <section className="tuo-card tu-det-sec" style={{ ['--i' as string]: 3, padding: 16, boxShadow: 'none' }}>
            <div className="tuo-rotulo" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <FileText size={13} /> Ficha del paciente
            </div>
            {[['Motivo de la consulta', 'Control de rutina'], ['Alergias', 'No registra'], ['Última atención', cliente?.ultima == null ? '—' : fechaCorta(cliente.ultima)]].map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: i ? '1px solid var(--color-border)' : 'none', fontSize: 13 }}>
                <span style={{ color: 'var(--color-muted)' }}>{k}</span><span style={{ color: 'var(--color-text)', textAlign: 'right', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <p style={{ fontSize: 11.5, color: 'var(--color-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>Solo lo ve el equipo del consultorio. Las notas clínicas no se envían por mail ni WhatsApp.</p>
          </section>
        )}

        {!puedeEditar && !cerrado && (
          <p className="tu-det-sec" style={{ ['--i' as string]: 4, display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--color-muted)', margin: 0, lineHeight: 1.5 }}>
            <Lock size={14} style={{ flexShrink: 0, marginTop: 2 }} /> Con tu rol podés ver este turno, pero no confirmarlo, moverlo ni cancelarlo.
          </p>
        )}
      </div>
    </Modal>
  )
}

function Dato({ label, valor, mono, tono, Icon }: { label: string; valor: string; mono?: boolean; tono?: string; Icon: LucideIcon }) {
  return (
    <div style={{ padding: '11px 12px', borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-muted)', marginBottom: 4, whiteSpace: 'nowrap' }}><Icon size={12} /> {label}</div>
      <div className={mono ? 'tuo-num' : undefined} style={{ fontSize: 14, fontWeight: 600, color: tono ?? 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor}</div>
    </div>
  )
}
