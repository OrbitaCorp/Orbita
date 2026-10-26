// La agenda del panel de Alquileres, una por modo:
//   canchas:  el día, cancha por cancha, hora por hora; en celular, una lista por cancha
//   salón:    el mes con los días que tienen evento, y los eventos del día elegido
//   estadía:  la ocupación de cada propiedad en el mes, con llegadas y salidas
// Desde cualquiera se abre el detalle (registrar seña, saldo o depósito,
// cancelar, marcar realizada) y se agenda a mano. Los bloqueos (del dueño o
// de un calendario externo) cierran la cancha, el salón o la propiedad ese día.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowRight, Ban, Check, ChevronLeft, ChevronRight, Lock, Plus, Wallet } from 'lucide-react'
import { MESES, diasDelMes, duracionTxt, fechaCorta, fechaLarga, fechaRelativa, hhmm, mesTxt, moverMes, partes, rangoTxt, sumarDias, diaSemana, diasEntre, type ISO } from '@/lib/reservas/fechas'
import { consecutivasDesde, franjasDelDia } from '@/lib/reservas/disponibilidad'
import { pesos, precioBloque, precioTurnosSeguidos, senaDe } from '@/lib/reservas/precio'
import { motivoNoReservable, nochesEntre, nochesOcupadas, precioEstadia, salidaMaxima } from '@/lib/reservas/estadia'
import { AHORA, ESTADO_RESERVA, HOY, TIPOS, aperturaDe, bloqueoEn, bloquesDe, bloquesLibresEn, clientePorId, cuenta, fechaDeReserva, nochesTxt, ocupadoDelDia, rangosOcupados, reservasDelDia, tituloEvento, unidadPorId, type Bloqueo, type Cliente, type NegocioAlquiler, type Reserva } from '../datos'
import { CalendarioDia, CalendarioRango, type Rango } from '@/design-system/reservas/Calendario'
import { Area, Campo, Chip, Encabezado, Modal, Nota, Selector, Sigla, Vacio } from '@/design-system/reservas/piezas'

interface P {
  negocio: NegocioAlquiler
  reservas: Reserva[]
  clientes: Cliente[]
  onCambiar: (id: string, cambio: Partial<Reserva>, aviso?: string) => void
  onReservar: (r: Reserva, c: Cliente) => void
  onBloqueo: (b: Bloqueo) => void
  onQuitarBloqueo: (id: string) => void
}

/** Id para lo que se agenda a mano. Se llama solo desde handlers: Date.now no va en el render. */
const idNuevo = (prefijo: string) => `${prefijo}${Date.now().toString(36)}`

const CSS = `
  .alg-tira { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .alg-dias { position: relative; flex: 1 1 auto; min-width: 0; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 2px; }
  .alg-dias::-webkit-scrollbar { display: none; }
  .alg-dia { flex: 0 0 auto; min-width: 64px; min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); font: inherit; color: var(--color-body); cursor: pointer; }
  .alg-dia b { font-family: var(--rv-mono); font-size: 16px; color: var(--color-text); }
  .alg-dia small { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .alg-dia[aria-pressed='true'] { background: var(--color-primary); border-color: transparent; color: var(--color-on-primary); }
  .alg-dia[aria-pressed='true'] b { color: inherit; }
  .alg-dia:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .alg-grilla { display: grid; grid-template-columns: 56px repeat(var(--n), minmax(120px, 1fr)); border: 1px solid var(--color-border); border-radius: var(--rv-r); overflow: auto; background: var(--color-bg); }
  .alg-cab { position: sticky; top: 0; z-index: 1; padding: 10px 8px; font-size: 13px; font-weight: 600; color: var(--color-text); background: var(--color-surface); border-bottom: 1px solid var(--color-border); border-left: 1px solid var(--color-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alg-cab small { display: block; font-size: 11.5px; font-weight: 500; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; }
  .alg-hora { padding: 6px 8px; font-family: var(--rv-mono); font-size: 11.5px; color: var(--color-muted); border-top: 1px solid var(--color-border); min-height: 48px; }
  .alg-celda { position: relative; min-height: 48px; border-top: 1px solid var(--color-border); border-left: 1px solid var(--color-border); padding: 3px; }
  .alg-libre { width: 100%; height: 100%; min-height: 42px; border: none; border-radius: 6px; background: transparent; color: transparent; cursor: pointer; font: inherit; display: grid; place-items: center; }
  .alg-libre:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; color: var(--color-primary); }
  @media (hover: hover) { .alg-libre:hover { background: var(--color-surface); color: var(--color-primary); } }
  /* En táctil no hay hover que lo descubra: el + de los huecos libres se ve siempre. */
  @media (hover: none) { .alg-libre:not(:disabled) { color: var(--color-muted); } }
  .alg-libre:disabled { cursor: default; background: repeating-linear-gradient(135deg, transparent 0 6px, var(--color-surface-alt) 6px 8px); }
  /* En una hora (42 px) entran el nombre y el horario: con 6 px de aire y sin flex-shrink, el nombre se achicaba y quedaba cortado por la mitad. */
  .alg-reserva { position: absolute; left: 3px; right: 3px; top: 3px; z-index: 1; display: flex; flex-direction: column; justify-content: center; gap: 1px; padding: 4px 8px; border-radius: 6px; border: none; background: var(--color-primary-bg); color: var(--color-text); font: inherit; font-size: 12.5px; text-align: left; cursor: pointer; overflow: hidden; }
  .alg-reserva[data-estado='pendiente'] { background: var(--color-warning-bg); }
  .alg-reserva[data-estado='completada'] { background: var(--color-surface-alt); color: var(--color-muted); }
  .alg-reserva b, .alg-reserva small { flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alg-reserva b { font-weight: 600; line-height: 1.25; }
  .alg-reserva small { font-family: var(--rv-mono); font-size: 11px; line-height: 1.2; opacity: 0.85; }
  .alg-reserva:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .alg-lista { display: none; }
  .alg-ocupacion { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
  /* font primero: el atajo pisaba la tipografía mono y el tamaño si iba después. */
  .alg-noche { font: inherit; font-family: var(--rv-mono); font-size: 13px; min-height: 44px; border-radius: 8px; display: grid; place-items: center; color: var(--color-text); border: none; background: transparent; cursor: default; }
  .alg-noche[data-fuera='true'] { color: var(--color-muted); }
  .alg-noche[data-estado='reserva'] { background: var(--color-primary-bg); color: var(--chip-primary-fg); cursor: pointer; }
  .alg-noche[data-estado='pendiente'] { background: var(--color-warning-bg); color: var(--chip-warning-fg); cursor: pointer; }
  .alg-noche[data-estado='bloqueo'] { background: repeating-linear-gradient(135deg, var(--color-surface-alt) 0 4px, transparent 4px 8px); color: var(--color-muted); cursor: pointer; }
  .alg-noche[data-hoy='true'] { box-shadow: inset 0 0 0 2px var(--color-primary); }
  .alg-noche:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .alg-leyenda { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12.5px; color: var(--color-muted); margin-top: 8px; }
  .alg-leyenda i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 5px; }
  /* Ocupación del mes: un medidor, el relleno en el acento y la pista en el tono claro del mismo color. */
  .alg-medidor { height: 8px; border-radius: 999px; background: var(--color-primary-bg); overflow: hidden; margin: 6px 0; }
  .alg-medidor > i { display: block; height: 100%; border-radius: inherit; background: var(--color-primary); }
  .alg-dos { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: 20px; align-items: start; }
  /* En el calendario del salón un día completo se abre igual (para ver sus eventos): va tintado, no tachado ni apagado. Tachado queda solo lo cerrado. */
  .alg-cal-salon .rv-cal-celda[data-ocupado='true'] { text-decoration: none; }
  .alg-cal-salon .rv-cal-celda[data-ocupado='true']:not([aria-pressed='true']) { color: var(--color-text); }
  .alg-extras { display: flex; flex-wrap: wrap; gap: 8px; }
  /* Las franjas son radios (aria-checked) y el kit pinta solo aria-pressed. */
  .alg-nueva .rv-franja[aria-checked='true'] { background: var(--color-primary); color: var(--color-on-primary); border-color: transparent; }
  .alg-nueva .rv-franja[data-en-rango='true'] { background: var(--color-primary-bg); border-color: var(--color-primary); color: var(--chip-primary-fg); }
  @media (max-width: 900px) { .alg-dos { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 768px) {
    .alg-grilla { display: none; }
    .alg-lista { display: flex; flex-direction: column; gap: 14px; }
    .alg-dia { min-width: 52px; }
  }
`

export default function Reservas(p: P) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const [nueva, setNueva] = useState<Partial<Reserva> | null>(null)
  const [bloquear, setBloquear] = useState(false)
  const reserva = abierta ? p.reservas.find(r => r.id === abierta) ?? null : null
  const tipo = p.negocio.tipo
  const titulo = tipo === 'cancha' ? 'Reservas' : 'Calendario'
  const pendientes = p.reservas.filter(r => r.estado === 'pendiente' && fechaDeReserva(r) >= HOY)
  return (
    <div className="rv-pagina">
      <style>{CSS}</style>
      <Encabezado rotulo={fechaLarga(HOY)} titulo={titulo}
        bajada={pendientes.length ? `${pendientes.length} ${pendientes.length === 1 ? 'reserva con seña pendiente' : 'reservas con seña pendiente'}: si no se paga, el lugar se libera.` : 'Todo al día: ninguna seña pendiente.'}
        acciones={<>
          <button type="button" className="rv-btn" onClick={() => setBloquear(true)}><Ban size={15} aria-hidden /> {tipo === 'estadia' ? 'Bloquear fechas' : 'Bloquear un día'}</button>
          <button type="button" className="rv-btn rv-btn--primario" onClick={() => setNueva({})}><Plus size={16} aria-hidden /> {tipo === 'bloque' ? 'Nuevo evento' : 'Nueva reserva'}</button>
        </>} />
      {tipo === 'cancha' && <AgendaCanchas {...p} onAbrir={setAbierta} onNueva={setNueva} />}
      {tipo === 'bloque' && <AgendaSalon {...p} onAbrir={setAbierta} onNueva={setNueva} />}
      {tipo === 'estadia' && <Ocupacion {...p} onAbrir={setAbierta} onNueva={setNueva} />}
      {reserva && <Detalle negocio={p.negocio} reserva={reserva} cliente={clientePorId(reserva.clienteId, p.clientes)} onCerrar={() => setAbierta(null)} onCambiar={p.onCambiar} />}
      {nueva && <Nueva negocio={p.negocio} reservas={p.reservas} clientes={p.clientes} pre={nueva} onCerrar={() => setNueva(null)} onReservar={(r, c) => { p.onReservar(r, c); setNueva(null) }} />}
      {bloquear && (tipo === 'estadia'
        ? <Bloquear negocio={p.negocio} reservas={p.reservas} onCerrar={() => setBloquear(false)} onBloqueo={b => { p.onBloqueo(b); setBloquear(false) }} />
        : <BloquearDia negocio={p.negocio} reservas={p.reservas} onCerrar={() => setBloquear(false)} onBloqueos={bs => { bs.forEach(b => p.onBloqueo(b)); setBloquear(false) }} />)}
    </div>
  )
}

type Sub = P & { onAbrir: (id: string) => void; onNueva: (pre: Partial<Reserva>) => void }

// ─── Canchas: el día, hora por hora ──────────────────────────────────────────

function TiraDias({ dia, onDia }: { dia: ISO; onDia: (f: ISO) => void }) {
  const desde = sumarDias(dia, -3)
  const tira = useRef<HTMLDivElement>(null)
  // En celular no entran los siete días: la tira se corre sola para que el elegido quede a la vista.
  useEffect(() => {
    const el = tira.current
    const elegido = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!el || !elegido) return
    el.scrollLeft = Math.max(0, elegido.offsetLeft - (el.clientWidth - elegido.offsetWidth) / 2)
  }, [dia])
  return (
    <div className="alg-tira">
      <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => onDia(sumarDias(dia, -7))} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
      <div ref={tira} className="alg-dias" role="group" aria-label="Día">
        {Array.from({ length: 7 }, (_, i) => sumarDias(desde, i)).map(f => (
          <button key={f} type="button" className="alg-dia" aria-pressed={f === dia} onClick={() => onDia(f)} aria-label={fechaLarga(f)}>
            <small>{f === HOY ? 'Hoy' : fechaCorta(f).split(' ')[0]}</small><b>{partes(f).dia}</b>
          </button>
        ))}
      </div>
      <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => onDia(sumarDias(dia, 7))} aria-label="Semana siguiente"><ChevronRight size={16} /></button>
      {dia !== HOY && <button type="button" className="rv-btn rv-btn--sm" onClick={() => onDia(HOY)}>Hoy</button>}
    </div>
  )
}

function AgendaCanchas({ negocio, reservas, clientes, onAbrir, onNueva, onQuitarBloqueo }: Sub) {
  const [dia, setDia] = useState<ISO>(HOY)
  const apertura = aperturaDe(negocio, dia)
  const horas = apertura.length ? Array.from({ length: Math.ceil((apertura[0][1] - apertura[0][0]) / negocio.pasoMin) }, (_, i) => apertura[0][0] + i * negocio.pasoMin) : []
  const delDia = reservasDelDia(reservas, dia)
  const nombre = (r: Reserva) => clientePorId(r.clienteId, clientes)?.nombre ?? '—'
  const enCelda = (u: string, h: number) => delDia.find(r => r.unidadId === u && r.inicio === h)
  const tapada = (u: string, h: number) => delDia.some(r => r.unidadId === u && r.inicio !== undefined && r.fin !== undefined && r.inicio < h && h < r.fin)
  const pasada = (h: number) => dia < HOY || (dia === HOY && h < AHORA)
  const bloqueo = (u: string) => bloqueoEn(negocio, u, dia)
  // Las canchas bloqueadas ese día, juntas por motivo: "Todas las canchas" si cerró el complejo entero.
  const bloqueadas: { nombres: string[]; ids: string[]; motivo: string; dueno: boolean }[] = []
  for (const u of negocio.unidades) {
    const b = bloqueo(u.id)
    if (!b) continue
    const g = bloqueadas.find(x => x.motivo === b.motivo && x.dueno === (b.origen === 'dueno'))
    if (g) { g.nombres.push(u.nombre); g.ids.push(b.id) } else bloqueadas.push({ nombres: [u.nombre], ids: [b.id], motivo: b.motivo, dueno: b.origen === 'dueno' })
  }
  return (
    <>
      <TiraDias dia={dia} onDia={setDia} />
      {bloqueadas.length > 0 && (
        <div className="rv-pila" style={{ gap: 8, marginBottom: 12 }}>
          {bloqueadas.map(g => (
            <Nota key={g.ids.join()} tono="aviso">
              <span style={{ flex: 1, minWidth: 0 }}><b>{g.nombres.length === negocio.unidades.length ? 'Todas las canchas' : g.nombres.join(', ')}</b>: no se puede reservar este día ({g.motivo}).{g.dueno ? '' : ' Vino de un calendario externo: se quita en Configuración.'}</span>
              {g.dueno && <button type="button" className="rv-btn rv-btn--sm" onClick={() => g.ids.forEach(id => onQuitarBloqueo(id))}>Quitar</button>}
            </Nota>
          ))}
        </div>
      )}
      {!apertura.length ? <Vacio titulo="Cerrado" texto={`${fechaLarga(dia)}: el complejo no abre.`} /> : (
        <>
          <div className="alg-grilla" style={{ ['--n' as string]: negocio.unidades.length } as CSSProperties} role="grid" aria-label={`Agenda del ${fechaLarga(dia)}`}>
            <div className="alg-cab" style={{ borderLeft: 'none' }} />
            {negocio.unidades.map(u => {
              const b = bloqueo(u.id)
              return <div key={u.id} className="alg-cab" role="columnheader">{u.nombre}{b && <small title={b.motivo}>No disponible: {b.motivo}</small>}</div>
            })}
            {horas.map(h => (
              <div key={h} style={{ display: 'contents' }} role="row">
                <div className="alg-hora" role="rowheader">{hhmm(h)}</div>
                {negocio.unidades.map(u => {
                  const r = enCelda(u.id, h)
                  const b = bloqueo(u.id)
                  const alto = r && r.fin !== undefined && r.inicio !== undefined ? Math.max(1, Math.round((r.fin - r.inicio) / negocio.pasoMin)) : 1
                  return (
                    <div key={u.id} className="alg-celda" role="gridcell">
                      {r ? (
                        <button type="button" className="alg-reserva" data-estado={r.estado} style={{ height: `calc(${alto * 100}% + ${(alto - 1)}px - 6px)` }} onClick={() => onAbrir(r.id)}>
                          <b>{nombre(r)}</b><small>{hhmm(r.inicio ?? 0)}–{hhmm(r.fin ?? 0)} · {ESTADO_RESERVA[r.estado].label}</small>
                        </button>
                      ) : tapada(u.id, h) ? null : (
                        <button type="button" className="alg-libre" disabled={pasada(h) || !!b} onClick={() => onNueva({ unidadId: u.id, fecha: dia, inicio: h })} aria-label={b ? `${u.nombre} a las ${hhmm(h)}: no disponible` : `Reservar ${u.nombre} a las ${hhmm(h)}`}><Plus size={16} aria-hidden /></button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="alg-lista">
            {negocio.unidades.map(u => {
              const suyas = delDia.filter(r => r.unidadId === u.id)
              const b = bloqueo(u.id)
              return (
                <section key={u.id} className="rv-card" style={{ padding: '4px 14px' }} aria-label={u.nombre}>
                  <div className="rv-entre" style={{ padding: '10px 0' }}><b style={{ color: 'var(--color-text)' }}>{u.nombre}</b><span className="rv-ayuda">{b ? `No disponible: ${b.motivo}` : suyas.length ? `${suyas.length} ${suyas.length === 1 ? 'reserva' : 'reservas'}` : 'Libre todo el día'}</span></div>
                  <div className="rv-lista">
                    {suyas.map(r => (
                      <button key={r.id} type="button" className="rv-item" onClick={() => onAbrir(r.id)}>
                        <span className="rv-num" style={{ width: 96, flexShrink: 0, fontSize: 13 }}>{hhmm(r.inicio ?? 0)}–{hhmm(r.fin ?? 0)}</span>
                        <span className="rv-item-cuerpo"><span className="rv-item-titulo">{nombre(r)}</span></span>
                        <Chip tono={ESTADO_RESERVA[r.estado].tono}>{ESTADO_RESERVA[r.estado].label}</Chip>
                      </button>
                    ))}
                    {!b && <button type="button" className="rv-item" onClick={() => onNueva({ unidadId: u.id, fecha: dia })} style={{ color: 'var(--color-primary)', fontWeight: 600, minHeight: 44 }}><Plus size={16} aria-hidden /> Agendar en {u.nombre}</button>}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

// ─── Salón: el mes y los eventos del día ─────────────────────────────────────

function AgendaSalon({ negocio, reservas, clientes, onAbrir, onNueva, onQuitarBloqueo }: Sub) {
  const s = negocio.salon
  const [dia, setDia] = useState<ISO>(HOY)
  const [mes, setMes] = useState<ISO>(HOY)
  if (!s) return null
  const bloques = bloquesDe(negocio)
  const delDia = reservasDelDia(reservas, dia)
  const libres = bloquesLibresEn(negocio, reservas, bloques, dia)
  const bloqueoDia = bloqueoEn(negocio, 'salon', dia)
  const cuantos = (f: ISO) => reservasDelDia(reservas, f).length
  return (
    <div className="alg-dos">
      <div className="rv-card rv-card--pad">
        <CalendarioDia className="alg-cal-salon" mes={mes} onMes={setMes} hoy={HOY} elegido={dia} onElegir={setDia}
          estadoDe={f => {
            const n = cuantos(f)
            const b = bloqueoEn(negocio, 'salon', f)
            return { deshabilitado: !negocio.apertura.dias.includes(diaSemana(f)), ocupado: n >= bloques.length || !!b, aria: b ? `bloqueado, ${b.motivo}` : n ? `${n} ${n === 1 ? 'evento' : 'eventos'}` : undefined }
          }} />
        <div className="alg-leyenda"><span><i style={{ background: 'var(--color-surface-alt)' }} />Completo o bloqueado</span><span><i style={{ background: 'var(--color-primary)' }} />Elegido</span></div>
      </div>
      <div>
        <div className="rv-entre" style={{ marginBottom: 10 }}>
          <h2 className="rv-h2">{dia === HOY ? 'Hoy' : fechaLarga(dia)}</h2>
          <span className="rv-ayuda">{delDia.length} de {bloques.length} bloques tomados</span>
        </div>
        {bloqueoDia && (
          <div style={{ marginBottom: 10 }}>
            <Nota tono="aviso">
              <span style={{ flex: 1, minWidth: 0 }}>Día bloqueado: {bloqueoDia.motivo}. Nadie puede reservar el salón ese día.{bloqueoDia.origen === 'ical' ? ' Vino de un calendario externo: se quita en Configuración.' : ''}</span>
              {bloqueoDia.origen === 'dueno' && <button type="button" className="rv-btn rv-btn--sm" onClick={() => onQuitarBloqueo(bloqueoDia.id)}>Quitar</button>}
            </Nota>
          </div>
        )}
        <div className="rv-pila">
          {bloques.map(b => {
            const r = delDia.find(x => x.bloqueId === b.id)
            const libre = libres.some(x => x.id === b.id)
            if (r) {
              const c = clientePorId(r.clienteId, clientes)
              return (
                <button key={b.id} type="button" className="rv-card rv-card--pad rv-card--accion" onClick={() => onAbrir(r.id)}>
                  <div className="rv-entre">
                    <div style={{ minWidth: 0 }}>
                      <span className="rv-rotulo">{b.nombre} · {hhmm(b.inicio)}–{hhmm(b.fin)}</span>
                      <div className="rv-h2" style={{ marginTop: 4 }}>{tituloEvento(r.evento)}</div>
                      <div className="rv-ayuda">{c?.nombre ?? '—'} · {r.evento?.invitados ?? 0} invitados · {s.paquetes.find(x => x.id === r.paqueteId)?.nombre ?? ''}{r.extras.length ? ` · ${cuenta(r.extras.length, 'extra', 'extras')}` : ''}</div>
                    </div>
                    <Chip tono={ESTADO_RESERVA[r.estado].tono}>{ESTADO_RESERVA[r.estado].label}</Chip>
                  </div>
                </button>
              )
            }
            return (
              <div key={b.id} className="rv-card rv-card--pad rv-entre" style={{ borderStyle: 'dashed' }}>
                <div style={{ minWidth: 0 }}><span className="rv-rotulo">{b.nombre} · {hhmm(b.inicio)}–{hhmm(b.fin)}</span><div className="rv-ayuda" style={{ marginTop: 4 }}>{libre ? 'Libre' : bloqueoDia ? 'Bloqueado' : 'No se puede reservar: queda pegado a otro evento sin tiempo de limpieza.'}</div></div>
                {libre && dia >= HOY && <button type="button" className="rv-btn rv-btn--sm" onClick={() => onNueva({ fecha: dia, bloqueId: b.id })}><Plus size={15} aria-hidden /> Agendar</button>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Estadía: ocupación por propiedad ────────────────────────────────────────

function Ocupacion({ negocio, reservas, clientes, onAbrir, onNueva, onQuitarBloqueo }: Sub) {
  const [propId, setPropId] = useState(negocio.propiedades[0]?.id ?? '')
  const [mes, setMes] = useState<ISO>(HOY)
  const [bloqueoAbierto, setBloqueoAbierto] = useState<string | null>(null)
  const prop = negocio.propiedades.find(p => p.id === propId) ?? negocio.propiedades[0]
  if (!prop) return <Vacio titulo="Sin propiedades" texto="Cargá la primera en Configuración." />
  const suyas = reservas.filter(r => r.unidadId === prop.id && r.estado !== 'cancelada' && r.entrada && r.salida)
  const bloqueos = negocio.bloqueos.filter(b => b.unidadId === prop.id)
  const { anio, mes: m } = partes(mes)
  const primero = `${anio}-${String(m).padStart(2, '0')}-01`
  const desde = sumarDias(primero, -diaSemana(primero))
  const celdas = Array.from({ length: 42 }, (_, i) => sumarDias(desde, i))
  const reservaDe = (f: ISO) => suyas.find(x => x.entrada! <= f && f < x.salida!)
  const bloqueoDe = (f: ISO) => bloqueos.find(x => x.desde <= f && f < x.hasta)
  const estadoNoche = (f: ISO) => {
    const r = reservaDe(f)
    if (r) return { estado: r.estado === 'pendiente' ? 'pendiente' : 'reserva', id: r.id, titulo: `${clientePorId(r.clienteId, clientes)?.nombre ?? ''} · ${rangoTxt(r.entrada!, r.salida!)}` }
    const b = bloqueoDe(f)
    if (b) return { estado: 'bloqueo', id: b.id, titulo: `${b.motivo} · ${rangoTxt(b.desde, b.hasta)}` }
    return null
  }
  // Ocupación del mes que se mira: noches reservadas sobre las noches del mes (los bloqueos aparte).
  const nochesMes = Array.from({ length: diasDelMes(anio, m) }, (_, i) => sumarDias(primero, i))
  const reservadas = nochesMes.filter(f => reservaDe(f)).length
  const bloqueadas = nochesMes.filter(f => !reservaDe(f) && bloqueoDe(f)).length
  const pct = Math.round((reservadas / nochesMes.length) * 100)
  const bloqueo = bloqueoAbierto ? bloqueos.find(b => b.id === bloqueoAbierto) ?? null : null
  const proximas = suyas.filter(r => r.salida! > HOY).sort((a, b) => a.entrada!.localeCompare(b.entrada!)).slice(0, 8)
  const enSemana = (f: ISO) => { const n = diasEntre(HOY, f); return n >= 0 && n < 7 }
  const semana = suyas.filter(r => enSemana(r.entrada!) || enSemana(r.salida!))
  return (
    <>
      <div className="rv-seg" role="group" aria-label="Propiedad" style={{ marginBottom: 16, maxWidth: '100%', overflowX: 'auto' }}>
        {negocio.propiedades.map(p => <button key={p.id} type="button" aria-pressed={p.id === prop.id} onClick={() => setPropId(p.id)}>{p.nombre}</button>)}
      </div>
      <div className="alg-dos">
        <div className="rv-card rv-card--pad">
          <div className="rv-cal-cab">
            <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => setMes(moverMes(primero, -1))} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
            <span className="rv-cal-mes" style={{ textTransform: 'capitalize' }}>{mesTxt(primero)}</span>
            <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => setMes(moverMes(primero, 1))} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
          </div>
          <div className="rv-cal-dias" aria-hidden>{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <span key={d}>{d}</span>)}</div>
          <div className="alg-ocupacion">
            {celdas.map(f => {
              const e = estadoNoche(f)
              return (
                <button key={f} type="button" className="alg-noche" data-fuera={partes(f).mes !== m} data-hoy={f === HOY} data-estado={e?.estado} title={e?.titulo}
                  aria-label={`${fechaLarga(f)}${e ? `, ${e.titulo}` : ', libre'}`} onClick={() => { if (!e) return; if (e.estado === 'bloqueo') setBloqueoAbierto(e.id); else onAbrir(e.id) }} disabled={!e}>
                  {partes(f).dia}
                </button>
              )
            })}
          </div>
          <div className="alg-leyenda">
            <span><i style={{ background: 'var(--color-primary-bg)' }} />Reservada</span>
            <span><i style={{ background: 'var(--color-warning-bg)' }} />Seña pendiente</span>
            <span><i style={{ background: 'repeating-linear-gradient(135deg, var(--color-surface-alt) 0 3px, transparent 3px 6px)' }} />Bloqueada</span>
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
            <div className="rv-entre"><span className="rv-rotulo">Ocupación de {MESES[m - 1]}</span><b style={{ fontSize: 15, color: 'var(--color-text)' }}>{pct}%</b></div>
            <div className="alg-medidor" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Ocupación de ${prop.nombre} en ${mesTxt(primero)}`}><i style={{ width: `${pct}%` }} /></div>
            <p className="rv-ayuda" style={{ margin: 0 }}>{reservadas} de {nochesMes.length} noches reservadas{bloqueadas ? ` · ${cuenta(bloqueadas, 'bloqueada', 'bloqueadas')}` : ''}.</p>
          </div>
          <button type="button" className="rv-btn rv-btn--sm" style={{ marginTop: 12 }} onClick={() => onNueva({ unidadId: prop.id })}><Plus size={15} aria-hidden /> Agendar a mano</button>
        </div>
        <div className="rv-pila">
          <section className="rv-card rv-card--pad">
            <h2 className="rv-h2" style={{ marginBottom: 8 }}>Esta semana en {prop.nombre}</h2>
            {semana.length === 0 ? <p className="rv-ayuda" style={{ margin: 0 }}>Sin llegadas ni salidas en los próximos 7 días.</p> : (
              <div className="rv-lista">
                {semana.map(r => {
                  const llega = enSemana(r.entrada!)
                  return (
                    <button key={r.id} type="button" className="rv-item" onClick={() => onAbrir(r.id)}>
                      <Chip tono={llega ? 'ok' : 'gris'}>{llega ? `Llega ${fechaRelativa(r.entrada!, HOY).toLowerCase()}` : `Sale ${fechaRelativa(r.salida!, HOY).toLowerCase()}`}</Chip>
                      <span className="rv-item-cuerpo"><span className="rv-item-titulo">{clientePorId(r.clienteId, clientes)?.nombre}</span><span className="rv-item-sub">{rangoTxt(r.entrada!, r.salida!)} · {cuenta(r.huespedes ?? 1, 'huésped', 'huéspedes')} · {hhmm(llega ? prop.checkIn : prop.checkOut)}</span></span>
                      <ArrowRight size={16} aria-hidden style={{ color: 'var(--color-subtle)', flexShrink: 0 }} />
                    </button>
                  )
                })}
              </div>
            )}
          </section>
          <section className="rv-card rv-card--pad">
            <h2 className="rv-h2" style={{ marginBottom: 8 }}>Próximas reservas</h2>
            <div className="rv-lista">
              {proximas.map(r => (
                <button key={r.id} type="button" className="rv-item" onClick={() => onAbrir(r.id)}>
                  <span className="rv-item-cuerpo"><span className="rv-item-titulo">{clientePorId(r.clienteId, clientes)?.nombre}</span><span className="rv-item-sub">{rangoTxt(r.entrada!, r.salida!)} · {nochesTxt(nochesEntre(r.entrada!, r.salida!))} · {pesos(r.total)}</span></span>
                  <Chip tono={ESTADO_RESERVA[r.estado].tono}>{ESTADO_RESERVA[r.estado].label}</Chip>
                </button>
              ))}
              {proximas.length === 0 && <p className="rv-ayuda" style={{ margin: '6px 0' }}>Nada reservado todavía.</p>}
            </div>
          </section>
        </div>
      </div>
      {bloqueo && (
        <Modal titulo="Fechas bloqueadas" onCerrar={() => setBloqueoAbierto(null)}
          pie={<><button type="button" className="rv-btn" onClick={() => setBloqueoAbierto(null)}>Cerrar</button>{bloqueo.origen === 'dueno' && <button type="button" className="rv-btn rv-btn--peligro" onClick={() => { onQuitarBloqueo(bloqueo.id); setBloqueoAbierto(null) }}>Quitar el bloqueo</button>}</>}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{rangoTxt(bloqueo.desde, bloqueo.hasta)}</p>
          <p style={{ margin: '6px 0 0', fontSize: 14 }}>{bloqueo.motivo}</p>
          <p className="rv-ayuda" style={{ marginTop: 8 }}>{bloqueo.origen === 'ical' ? 'Vino de un calendario externo: se quita desconectando el calendario en Configuración.' : 'Lo pusiste vos. Mientras esté, nadie puede reservar esas noches.'}</p>
        </Modal>
      )}
    </>
  )
}

// ─── Detalle de una reserva ──────────────────────────────────────────────────

// Afuera de Detalle: definido adentro sería un componente nuevo en cada render y React lo remontaría.
const Fila = ({ k, v }: { k: string; v: ReactNode }) => <div className="rv-entre" style={{ padding: '7px 0', borderTop: '1px solid var(--color-border)', fontSize: 14, flexWrap: 'nowrap', alignItems: 'flex-start' }}><span className="rv-muted" style={{ flexShrink: 0 }}>{k}</span><span style={{ textAlign: 'right', color: 'var(--color-text)', fontWeight: 500, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span></div>

/**
 * El detalle de una reserva, con lo que se registra a mano (seña, saldo,
 * depósito). En un salón es la ficha del evento: quién cumple, edad,
 * invitados, paquete, extras, notas y lo que falta cobrar. Lo usa también la
 * lista de Eventos.
 */
export function Detalle({ negocio, reserva: r, cliente, onCerrar, onCambiar }: { negocio: NegocioAlquiler; reserva: Reserva; cliente?: Cliente; onCerrar: () => void; onCambiar: P['onCambiar'] }) {
  const u = unidadPorId(negocio, r.unidadId)
  const cuando = r.entrada && r.salida ? `${rangoTxt(r.entrada, r.salida)} · ${nochesTxt(nochesEntre(r.entrada, r.salida))}` : r.fecha ? `${fechaLarga(r.fecha)} · ${hhmm(r.inicio ?? 0)} a ${hhmm(r.fin ?? 0)}` : ''
  const saldo = r.total - r.sena
  const activa = r.estado === 'pendiente' || r.estado === 'confirmada'
  const paquete = negocio.salon?.paquetes.find(p => p.id === r.paqueteId)
  const extras = (negocio.tipo === 'cancha' ? negocio.extras : negocio.salon?.extras ?? []).filter(e => r.extras.includes(e.id))
  const ev = r.evento
  const notas = ev?.notas ?? r.nota
  return (
    <Modal titulo={ev ? tituloEvento(ev) : u?.nombre ?? negocio.nombre} bajada={cuando} onCerrar={onCerrar} ancho={560}
      pie={<>
        {activa && <button type="button" className="rv-btn rv-btn--peligro rv-modal-izq" onClick={() => { onCambiar(r.id, { estado: 'cancelada' }, 'Reserva cancelada. El lugar quedó libre.'); onCerrar() }}><Ban size={15} aria-hidden /> Cancelar reserva</button>}
        {r.estado === 'pendiente' && <button type="button" className="rv-btn rv-btn--primario" onClick={() => onCambiar(r.id, { estado: 'confirmada', senaPagada: true }, `Seña de ${pesos(r.sena)} registrada. Reserva confirmada.`)}><Wallet size={15} aria-hidden /> Registrar seña {pesos(r.sena)}</button>}
        {r.estado === 'confirmada' && !r.saldoPagado && saldo > 0 && <button type="button" className="rv-btn" onClick={() => onCambiar(r.id, { saldoPagado: true }, `Saldo de ${pesos(saldo)} registrado.`)}><Wallet size={15} aria-hidden /> Registrar saldo {pesos(saldo)}</button>}
        {r.estado === 'confirmada' && r.deposito && !r.depositoRegistrado ? <button type="button" className="rv-btn" onClick={() => onCambiar(r.id, { depositoRegistrado: true }, `Depósito de ${pesos(r.deposito ?? 0)} registrado.`)}><Lock size={15} aria-hidden /> Registrar depósito</button> : null}
        {r.estado === 'confirmada' && <button type="button" className="rv-btn rv-btn--primario" onClick={() => { onCambiar(r.id, { estado: 'completada', saldoPagado: true }, 'Marcada como realizada.'); onCerrar() }}><Check size={15} aria-hidden /> Marcar realizada</button>}
        {!activa && <button type="button" className="rv-btn" onClick={onCerrar}>Cerrar</button>}
      </>}>
      <div className="rv-fila" style={{ marginBottom: 12 }}>
        <Chip tono={ESTADO_RESERVA[r.estado].tono}>{ESTADO_RESERVA[r.estado].label}</Chip>
        <span className="rv-rotulo">Código {r.id.slice(-6).toUpperCase()}</span>
      </div>
      <div className="rv-fila" style={{ marginBottom: 10, flexWrap: 'nowrap' }}>
        <Sigla nombre={cliente?.nombre ?? '?'} />
        <div style={{ minWidth: 0 }}><b style={{ color: 'var(--color-text)' }}>{cliente?.nombre ?? '—'}</b><div className="rv-ayuda">{cliente?.telefono}{cliente?.email ? ` · ${cliente.email}` : ''}</div></div>
      </div>
      {ev ? (
        <>
          <div className="rv-rotulo" style={{ margin: '14px 0 2px' }}>Ficha del evento</div>
          <Fila k="Cumpleañero/a" v={ev.agasajado || '—'} />
          <Fila k="Edad" v={ev.edad ? `${ev.edad} años` : '—'} />
          <Fila k="Invitados" v={paquete ? `${ev.invitados} (el paquete es hasta ${paquete.hastaInvitados})` : ev.invitados} />
          {paquete && <Fila k="Paquete" v={`${paquete.nombre} · ${pesos(paquete.precio)}`} />}
          <Fila k="Extras" v={extras.length ? extras.map(e => `${e.nombre} (${pesos(e.precio)})`).join(', ') : 'Sin extras'} />
          <Fila k="Notas" v={notas || '—'} />
          <div className="rv-rotulo" style={{ margin: '14px 0 2px' }}>Pagos</div>
        </>
      ) : (
        <>
          {r.huespedes && <Fila k="Huéspedes" v={r.huespedes} />}
          {extras.length > 0 && <Fila k="Extras" v={extras.map(e => `${e.nombre} (${pesos(e.precio)})`).join(', ')} />}
          {notas && <Fila k="Nota" v={notas} />}
        </>
      )}
      <Fila k="Total" v={<b className="rv-num">{pesos(r.total)}</b>} />
      {r.sena > 0 && <Fila k="Seña" v={<span className="rv-num">{pesos(r.sena)} · {r.senaPagada ? 'pagada' : 'pendiente'}</span>} />}
      {saldo > 0 && <Fila k="Saldo" v={<span className="rv-num">{pesos(saldo)} · {r.saldoPagado ? 'pagado' : 'se paga en el lugar'}</span>} />}
      {r.deposito ? <Fila k="Depósito de garantía" v={`${pesos(r.deposito)} · ${r.depositoRegistrado ? 'registrado' : 'pendiente'} (no se cobra desde Órbita)`} /> : null}
      <Fila k="Reservada el" v={fechaCorta(r.creada)} />
    </Modal>
  )
}

// ─── Nueva reserva, a mano ───────────────────────────────────────────────────

function Nueva({ negocio, reservas, clientes, pre, onCerrar, onReservar }: { negocio: NegocioAlquiler; reservas: Reserva[]; clientes: Cliente[]; pre: Partial<Reserva>; onCerrar: () => void; onReservar: (r: Reserva, c: Cliente) => void }) {
  const tipo = negocio.tipo
  const s = negocio.salon
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? '')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTel, setNuevoTel] = useState('')
  const [unidadId, setUnidadId] = useState(pre.unidadId ?? (tipo === 'cancha' ? negocio.unidades[0]?.id : tipo === 'estadia' ? negocio.propiedades[0]?.id : 'salon') ?? '')
  const [fecha, setFecha] = useState<ISO>(pre.fecha ?? HOY)
  const [hora, setHora] = useState<number | ''>(pre.inicio ?? '')
  const [horas, setHoras] = useState(1)
  const [bloqueId, setBloqueId] = useState(pre.bloqueId ?? '')
  const [paqueteId, setPaqueteId] = useState(s?.paquetes[0]?.id ?? '')
  const [agasajado, setAgasajado] = useState('')
  const [edad, setEdad] = useState('')
  const [invitados, setInvitados] = useState('')
  const [extrasElegidos, setExtrasElegidos] = useState<string[]>([])
  const [notas, setNotas] = useState('')
  const [rango, setRango] = useState<Rango>({ entrada: null, salida: null })
  const [mes, setMes] = useState<ISO>(HOY)
  const [huespedes, setHuespedes] = useState('2')
  const [error, setError] = useState('')

  const unidad = negocio.unidades.find(u => u.id === unidadId)
  const prop = negocio.propiedades.find(p => p.id === unidadId)
  const bloqueoDia = bloqueoEn(negocio, unidadId, fecha)
  const franjas = tipo === 'cancha' && unidad ? franjasDelDia(aperturaDe(negocio, fecha), ocupadoDelDia(negocio, reservas, unidad.id, fecha), { paso: negocio.pasoMin, duracion: negocio.duracionMin }) : []
  // Como en el sitio: desde la hora elegida, solo las franjas seguidas que siguen libres; si no, se pisaría otra reserva.
  const maxSeguidas = hora === '' ? negocio.maxFranjas : Math.max(1, consecutivasDesde(franjas, hora, negocio.maxFranjas))
  const seguidas = Math.min(horas, maxSeguidas)
  const bloques = bloquesDe(negocio)
  const libresDelDia = bloquesLibresEn(negocio, reservas, bloques, fecha)
  const paquete = s?.paquetes.find(p => p.id === paqueteId)
  const ocupadas = prop ? rangosOcupados(negocio, reservas, prop.id) : []
  const tomadas = nochesOcupadas(ocupadas)

  // Como en el sitio: cada turno con el ajuste de su franja.
  const total = tipo === 'cancha' && unidad && hora !== '' ? precioBloque(precioTurnosSeguidos(unidad.tarifaHora, negocio.duracionMin, seguidas, diaSemana(fecha), hora, negocio.reglasPrecio).final, negocio.extras, extrasElegidos).total
    : tipo === 'bloque' && s ? precioBloque(paquete?.precio ?? 0, s.extras, extrasElegidos).total
      : tipo === 'estadia' && prop && rango.entrada && rango.salida ? precioEstadia(rango.entrada, rango.salida, prop.tarifa).total : 0
  const sena = senaDe(total, negocio.senaPct)
  const listaExtras = tipo === 'cancha' ? negocio.extras : tipo === 'bloque' ? s?.extras ?? [] : []

  const guardar = () => {
    const cliente: Cliente | undefined = clienteId === 'nuevo' ? { id: idNuevo('ka'), nombre: nuevoNombre.trim(), telefono: nuevoTel.trim() } : clientePorId(clienteId, clientes)
    if (!cliente) { setError('Elegí a quién es la reserva.'); return }
    if (clienteId === 'nuevo' && cliente.nombre.length < 3) { setError('Escribí el nombre del cliente.'); return }
    const base = { id: idNuevo('n'), unidadId, clienteId: cliente.id, creada: HOY, extras: extrasElegidos, total, sena, senaPagada: false, saldoPagado: false, estado: (sena > 0 ? 'pendiente' : 'confirmada') as Reserva['estado'], nota: notas.trim() || undefined }
    if (tipo === 'cancha') {
      if (hora === '') { setError('Elegí un horario.'); return }
      if (!franjas.some(f => f.inicio === hora && f.libre)) { setError('Ese horario ya está tomado. Elegí otro.'); return }
      onReservar({ ...base, fecha, inicio: hora, fin: hora + negocio.duracionMin * seguidas }, cliente)
    } else if (tipo === 'bloque') {
      const b = bloques.find(x => x.id === bloqueId)
      const n = Number(invitados)
      if (!aperturaDe(negocio, fecha).length) { setError('Ese día el salón no abre.'); return }
      if (bloqueoDia) { setError(`Ese día está bloqueado: ${bloqueoDia.motivo}.`); return }
      if (!b) { setError('Elegí un bloque.'); return }
      if (!libresDelDia.some(x => x.id === b.id)) { setError('Ese bloque ya está tomado, o queda pegado a otro evento sin tiempo de limpieza.'); return }
      if (agasajado.trim().length < 2 || !n) { setError('Completá quién cumple y cuántos vienen.'); return }
      if (paquete && n > paquete.hastaInvitados) { setError(`Ese paquete es hasta ${paquete.hastaInvitados} invitados.`); return }
      if (s && n > s.capacidad) { setError(`El salón tiene lugar para ${s.capacidad} personas.`); return }
      onReservar({ ...base, nota: undefined, fecha, inicio: b.inicio, fin: b.fin, bloqueId: b.id, paqueteId, evento: { agasajado: agasajado.trim(), edad: Number(edad) || undefined, invitados: n, notas: notas.trim() || undefined }, deposito: s?.deposito || undefined, depositoRegistrado: false }, cliente)
    } else {
      if (!prop || !rango.entrada || !rango.salida) { setError('Elegí entrada y salida.'); return }
      const motivo = motivoNoReservable(rango.entrada, rango.salida, prop.tarifa, ocupadas)
      if (motivo) { setError(motivo); return }
      onReservar({ ...base, entrada: rango.entrada, salida: rango.salida, huespedes: Number(huespedes) || 1 }, cliente)
    }
  }

  return (
    <Modal titulo={tipo === 'bloque' ? 'Nuevo evento' : 'Nueva reserva'} bajada="Para reservas que llegan por teléfono o en el mostrador." onCerrar={onCerrar} ancho={620}
      pie={<>
        <span className="rv-modal-izq rv-ayuda">{total ? <>Total <b className="rv-num" style={{ color: 'var(--color-text)' }}>{pesos(total)}</b>{sena ? ` · seña ${pesos(sena)}` : ''}</> : ''}</span>
        <button type="button" className="rv-btn" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="rv-btn rv-btn--primario" onClick={guardar}><Check size={15} aria-hidden /> Agendar</button>
      </>}>
      <div className="rv-pila alg-nueva">
        <Selector label={TIPOS[tipo].cliente === 'huésped' ? 'Huésped' : 'Cliente'} valor={clienteId} onChange={setClienteId} opciones={[...clientes.map(c => ({ id: c.id, label: `${c.nombre} · ${c.telefono}` })), { id: 'nuevo', label: '+ Alguien nuevo' }]} />
        {clienteId === 'nuevo' && <div className="rv-dos"><Campo label="Nombre" value={nuevoNombre} onChange={setNuevoNombre} /><Campo label="Celular" value={nuevoTel} onChange={setNuevoTel} inputMode="tel" /></div>}
        {tipo === 'cancha' && (
          <>
            <div className="rv-dos">
              <Selector label="Cancha" valor={unidadId} onChange={v => { setUnidadId(v); setHora('') }} opciones={negocio.unidades.map(u => ({ id: u.id, label: u.nombre }))} />
              <Campo label="Día" type="date" value={fecha} onChange={v => { if (v) { setFecha(v); setHora('') } }} />
            </div>
            <div>
              <div className="rv-rotulo" style={{ marginBottom: 8 }}>Horario</div>
              {bloqueoDia ? <p className="rv-ayuda" style={{ margin: 0 }}>{unidad?.nombre} está bloqueada ese día: {bloqueoDia.motivo}.</p> : (
                <div className="rv-franjas" role="radiogroup" aria-label="Horario">
                  {/* Con dos o tres turnos seguidos se marcan también los que quedan adentro, como en el sitio. */}
                  {franjas.map(f => <button key={f.inicio} type="button" role="radio" aria-checked={hora === f.inicio} data-en-rango={(hora !== '' && f.inicio > hora && f.inicio < hora + negocio.duracionMin * seguidas) || undefined} className="rv-franja" disabled={!f.libre} onClick={() => setHora(f.inicio)}>{hhmm(f.inicio)}</button>)}
                  {franjas.length === 0 && <p className="rv-ayuda">Ese día está cerrado.</p>}
                </div>
              )}
            </div>
            <Selector label="Cuánto tiempo" valor={seguidas} onChange={setHoras} opciones={Array.from({ length: maxSeguidas }, (_, i) => ({ id: i + 1, label: i === 0 ? `Un turno (${duracionTxt(negocio.duracionMin)})` : `${i + 1} turnos seguidos (${duracionTxt(negocio.duracionMin * (i + 1))})` }))} />
          </>
        )}
        {tipo === 'bloque' && s && (
          <>
            <div className="rv-dos">
              <Campo label="Día" type="date" value={fecha} onChange={v => { if (v) { setFecha(v); setBloqueId('') } }} />
              <Selector label="Bloque" valor={bloqueId} onChange={setBloqueId} opciones={[{ id: '', label: 'Elegí uno' }, ...bloques.map(b => ({ id: b.id, label: `${b.nombre} · ${hhmm(b.inicio)}–${hhmm(b.fin)}${libresDelDia.some(x => x.id === b.id) ? '' : ' (no disponible)'}` }))]} />
            </div>
            {bloqueoDia && <Nota tono="aviso">Ese día está bloqueado: {bloqueoDia.motivo}.</Nota>}
            <div className="rv-dos">
              <Campo label="¿Quién cumple?" value={agasajado} onChange={setAgasajado} />
              <Campo label="Edad (opcional)" value={edad} onChange={v => setEdad(v.replace(/\D/g, ''))} inputMode="numeric" maxLength={3} />
            </div>
            <div className="rv-dos">
              <Campo label="Invitados" value={invitados} onChange={v => setInvitados(v.replace(/\D/g, ''))} inputMode="numeric" maxLength={3} ayuda={`El salón tiene lugar para ${s.capacidad}.`} />
              <Selector label="Paquete" valor={paqueteId} onChange={setPaqueteId} opciones={s.paquetes.map(p => ({ id: p.id, label: `${p.nombre} · ${pesos(p.precio)}` }))} />
            </div>
          </>
        )}
        {listaExtras.length > 0 && (
          <div>
            <div className="rv-rotulo" style={{ marginBottom: 8 }}>Extras</div>
            <div className="alg-extras" role="group" aria-label="Extras">
              {listaExtras.map(e => {
                const on = extrasElegidos.includes(e.id)
                return <button key={e.id} type="button" className="rv-chip rv-chip--borde" aria-pressed={on} onClick={() => setExtrasElegidos(on ? extrasElegidos.filter(x => x !== e.id) : [...extrasElegidos, e.id])}>{e.nombre} · {pesos(e.precio)}</button>
              })}
            </div>
          </div>
        )}
        {tipo === 'estadia' && prop && (
          <>
            <div className="rv-dos">
              <Selector label="Propiedad" valor={unidadId} onChange={v => { setUnidadId(v); setRango({ entrada: null, salida: null }) }} opciones={negocio.propiedades.map(p => ({ id: p.id, label: p.nombre }))} />
              <Selector label="Huéspedes" valor={huespedes} onChange={setHuespedes} opciones={Array.from({ length: prop.huespedes }, (_, i) => ({ id: String(i + 1), label: String(i + 1) }))} />
            </div>
            <CalendarioRango mes={mes} onMes={setMes} hoy={HOY} rango={rango} onRango={setRango} minMes={HOY}
              estadoDe={f => ({ deshabilitado: f < HOY, ocupado: tomadas.has(f) })} salidaMaxima={e => salidaMaxima(e, ocupadas)} />
            {rango.entrada && rango.salida && <p className="rv-ayuda" style={{ margin: 0 }}>{rangoTxt(rango.entrada, rango.salida)} · {nochesTxt(nochesEntre(rango.entrada, rango.salida))}</p>}
          </>
        )}
        <Area label={tipo === 'bloque' ? 'Notas del evento (opcional)' : 'Nota (opcional)'} value={notas} onChange={setNotas} maxLength={300} placeholder={tipo === 'bloque' ? 'Temática, alergias, horario de la torta…' : ''} />
        {error && <p className="rv-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      </div>
    </Modal>
  )
}

// ─── Bloquear un día (canchas y salón) ───────────────────────────────────────
// Un feriado, un torneo, mantenimiento o un evento propio: desde ahí ese día
// no se reserva. En canchas, una o todas. Lo que ya estaba reservado sigue en
// pie (se avisa, y se cancela desde la agenda si no se va a poder usar).

function BloquearDia({ negocio, reservas, onCerrar, onBloqueos }: { negocio: NegocioAlquiler; reservas: Reserva[]; onCerrar: () => void; onBloqueos: (b: Bloqueo[]) => void }) {
  const canchas = negocio.tipo === 'cancha'
  const [unidad, setUnidad] = useState(canchas ? 'todas' : 'salon')
  const [dia, setDia] = useState<ISO | null>(null)
  const [mes, setMes] = useState<ISO>(HOY)
  const [motivo, setMotivo] = useState(canchas ? 'Mantenimiento' : 'Cerrado')
  const ids = unidad === 'todas' ? negocio.unidades.map(u => u.id) : [unidad]
  const yaBloqueado = (f: ISO) => ids.every(id => bloqueoEn(negocio, id, f))
  const enPie = dia ? reservas.filter(r => r.estado !== 'cancelada' && r.fecha === dia && ids.includes(r.unidadId)).length : 0
  const que = canchas ? (unidad === 'todas' ? 'todas las canchas' : negocio.unidades.find(u => u.id === unidad)?.nombre ?? '') : 'el salón'
  const bloquear = () => {
    if (!dia) return
    const base = idNuevo('bl')
    onBloqueos(ids.filter(id => !bloqueoEn(negocio, id, dia)).map((id, i) => ({ id: `${base}${i}`, unidadId: id, desde: dia, hasta: sumarDias(dia, 1), motivo: motivo.trim() || 'Bloqueado', origen: 'dueno' as const })))
  }
  return (
    <Modal titulo="Bloquear un día" bajada={canchas ? 'Para mantenimiento, un torneo o un feriado: ese día no se puede reservar.' : 'Para un feriado o un evento propio: ese día nadie puede reservar el salón.'} onCerrar={onCerrar}
      pie={<>
        <button type="button" className="rv-btn" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="rv-btn rv-btn--primario" disabled={!dia} onClick={bloquear}><Ban size={15} aria-hidden /> Bloquear</button>
      </>}>
      <div className="rv-pila">
        {canchas && <Selector label="Qué se bloquea" valor={unidad} onChange={v => { setUnidad(v); setDia(null) }} opciones={[{ id: 'todas', label: 'Todas las canchas' }, ...negocio.unidades.map(u => ({ id: u.id, label: u.nombre }))]} />}
        <Campo label="Motivo" value={motivo} onChange={setMotivo} />
        <CalendarioDia mes={mes} onMes={setMes} hoy={HOY} elegido={dia} onElegir={setDia} minMes={HOY}
          estadoDe={f => {
            const cerrado = f < HOY || !negocio.apertura.dias.includes(diaSemana(f))
            const ya = !cerrado && yaBloqueado(f)
            return { deshabilitado: cerrado || ya, ocupado: ya, aria: ya ? 'ya está bloqueado' : cerrado ? 'cerrado' : undefined }
          }} />
        {enPie > 0 && <Nota tono="aviso">Ese día ya hay {cuenta(enPie, 'reserva', 'reservas')}: {enPie === 1 ? 'sigue en pie. Si no se va a poder usar, cancelala' : 'siguen en pie. Si no se va a poder usar, cancelalas'} desde la agenda.</Nota>}
        <p className="rv-ayuda" style={{ margin: 0 }}>{dia ? `Se bloquea ${que} el ${fechaLarga(dia).toLowerCase()}: desde ahora no se puede reservar.` : 'Elegí el día. Los tachados ya están bloqueados.'}</p>
      </div>
    </Modal>
  )
}

// ─── Bloquear fechas (estadía) ───────────────────────────────────────────────

function Bloquear({ negocio, reservas, onCerrar, onBloqueo }: { negocio: NegocioAlquiler; reservas: Reserva[]; onCerrar: () => void; onBloqueo: (b: Bloqueo) => void }) {
  const [propId, setPropId] = useState(negocio.propiedades[0]?.id ?? '')
  const [rango, setRango] = useState<Rango>({ entrada: null, salida: null })
  const [mes, setMes] = useState<ISO>(HOY)
  const [motivo, setMotivo] = useState('Mantenimiento')
  const ocupadas = rangosOcupados(negocio, reservas, propId)
  const tomadas = nochesOcupadas(ocupadas)
  return (
    <Modal titulo="Bloquear fechas" bajada="Para mantenimiento, uso propio o cuando se alquiló por otro lado." onCerrar={onCerrar}
      pie={<>
        <button type="button" className="rv-btn" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="rv-btn rv-btn--primario" disabled={!rango.entrada || !rango.salida} onClick={() => rango.entrada && rango.salida && onBloqueo({ id: idNuevo('bl'), unidadId: propId, desde: rango.entrada, hasta: rango.salida, motivo: motivo.trim() || 'Bloqueado', origen: 'dueno' })}><Ban size={15} aria-hidden /> Bloquear</button>
      </>}>
      <div className="rv-pila">
        <Selector label="Propiedad" valor={propId} onChange={v => { setPropId(v); setRango({ entrada: null, salida: null }) }} opciones={negocio.propiedades.map(p => ({ id: p.id, label: p.nombre }))} />
        <Campo label="Motivo" value={motivo} onChange={setMotivo} />
        <CalendarioRango mes={mes} onMes={setMes} hoy={HOY} rango={rango} onRango={setRango} minMes={HOY} estadoDe={f => ({ deshabilitado: f < HOY, ocupado: tomadas.has(f) })} salidaMaxima={e => salidaMaxima(e, ocupadas)} />
        {rango.entrada && rango.salida && <p className="rv-ayuda" style={{ margin: 0 }}>Se bloquean las noches del {rangoTxt(rango.entrada, rango.salida)}.</p>}
      </div>
    </Modal>
  )
}
