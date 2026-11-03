// Resumen del día: lo primero que ve el dueño al entrar al panel de Turnos,
// con la forma del Dashboard de Tienda: el saludo con lo que hay que saber
// hoy, los números del día (contra el mismo día de la semana pasada), lo que
// está pasando ahora, los turnos que vienen, la ocupación y los huecos para
// ofrecer.
//
// Cada hueco es un botón: abre "Nuevo turno" con esa hora y esa agenda ya
// elegidas. "Compartir" arma el mensaje con los horarios libres para WhatsApp,
// y el aviso de los turnos sin confirmar abre el primero para confirmarlo o
// recordárselo.
//
// Los huecos y la ocupación se miden contra el horario de cada agenda (su
// mañana y su tarde): el corte del mediodía no es un hueco para ofrecer.
// Quien entra con un rol del equipo ve este mismo resumen con lo suyo: sus
// turnos, y sin los ingresos si su rol no ve los números.
import { useState } from 'react'
import { CalendarCheck, Clock3, UserX, Wallet, ArrowRight, Plus, Send, BellRing, CalendarDays } from 'lucide-react'
import { Avatar } from '@/design-system/components/Avatar'
import { Encabezado, Kpi } from '@/design-system/reservas/piezas'
import { DIAS, horaTxt, type Turno, type Cliente, type Recurso, type RubroTurnos } from '@/modules/turnos/datos'
import { AHORA_DEMO, FECHA_DEMO, HOY_SEMANA, minutosAbiertos, type Tramo } from '@/modules/turnos/horario'
import { Barra } from './piezasPanel'
import TurnosLista from './TurnosLista'
import { SLOT, horariosLibres, huecosDe, type MensajeWA, type NuevoTurnoPre } from '../datos/agenda'
import { plata } from '../datos/equipo'

const saludo = (min: number) => (min < 12 * 60 ? 'Buen día' : min < 20 * 60 ? 'Buenas tardes' : 'Buenas noches')
const faltan = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`)

const CSS = `
  .tu-res-aviso { width: 100%; align-items: center; margin-bottom: 16px; text-align: left; font: inherit; font-size: 13.5px; cursor: pointer; }
  .tu-res-aviso > span { flex: 1; min-width: 0; }
  .tu-res-aviso:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tu-res-ahora { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
  .tu-res-mini { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; }
  .tu-res-mini-cab { display: flex; align-items: center; gap: 8px; }
  .tu-res-mini-cab > .rv-num { margin-left: auto; font-size: 12px; color: var(--color-muted); }
  .tu-res-mini-quien { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .tu-res-mini-quien > span { min-width: 0; }
  .tu-res-mini-quien b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-res-mini-quien small { display: block; font-size: 12.5px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-res-hora { width: 54px; height: 34px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center; font-size: 13px; font-weight: 600; color: var(--chip-primary-fg); background: var(--color-primary-bg); }
  .tu-res-cols { display: grid; grid-template-columns: minmax(0, 2fr) minmax(290px, 1fr); gap: 16px; align-items: start; margin-top: 16px; }
  .tu-res-ocup { display: flex; flex-direction: column; gap: 14px; }
  .tu-res-ocup > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; align-items: baseline; font-size: 13.5px; }
  .tu-res-ocup b { color: var(--color-text); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tu-res-ocup small { font-size: 12.5px; color: var(--color-muted); white-space: nowrap; }
  .tu-res-ocup .tu-barra { grid-column: 1 / -1; }
  .tu-res-huecos { display: flex; flex-wrap: wrap; gap: 6px; }
  .tu-res-agenda { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--color-body); margin: 14px 0 7px; }
  .tu-res-agenda > i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  @media (max-width: 1024px) { .tu-res-cols { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 768px) {
    /* En celular cada hueco es un botón de 44 px en una grilla pareja. */
    .tu-res-huecos { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; }
    .tu-res-huecos > .rv-chip { justify-content: center; }
  }
  @media (max-width: 640px) { .tu-res-ahora { grid-template-columns: minmax(0, 1fr); } }
`

interface Props {
  negocio: string
  /** A quién se saluda: el negocio o, si entra alguien del equipo, su nombre. */
  saludo: string
  rubro: RubroTurnos
  turnos: Turno[]
  /** Los turnos de otro día, contado desde hoy (-7 = el mismo día de la semana pasada): de ahí sale la variación. */
  turnosDelDia: (dia: number) => Turno[]
  clientes: Cliente[]
  recursos: Recurso[]
  /** En qué tramos atiende hoy cada agenda. */
  jornada: (recursoId: string) => Tramo[]
  /** Cuánto dura cada servicio que se puede dar (los activos del panel): el más corto define qué hueco se puede ofrecer. */
  duraciones: number[]
  /** Quien mira puede dar turnos. */
  puedeAgendar: boolean
  /** Quien mira puede ver los ingresos del negocio. */
  verNumeros: boolean
  onAbrir: (t: Turno) => void
  onIr: (vista: string) => void
  onNuevo: (pre?: NuevoTurnoPre) => void
  onCompartir: (m: MensajeWA) => void
}

const A_LA_VISTA = 6

export default function ResumenDia({ negocio, saludo: aQuien, rubro, turnos, turnosDelDia, clientes, recursos, jornada, duraciones, puedeAgendar, verNumeros, onAbrir, onIr, onNuevo, onCompartir }: Props) {
  const [desplegados, setDesplegados] = useState<string[]>([])
  const nombre = (id: string) => clientes.find(c => c.id === id)?.nombre ?? '—'
  const activos = turnos.filter(t => t.estado !== 'cancelado')
  const ausentes = turnos.filter(t => t.estado === 'ausente').length
  const ingresos = activos.filter(t => t.estado !== 'ausente').reduce((s, t) => s + t.precio, 0)
  // La variación sale de la agenda (los días anteriores los arma el panel), no de números escritos a
  // mano: un negocio que hoy no atiende ve 0, sin "+12,5%" inventado. Las ausencias no: los días
  // pasados de la demo no las guardan, así que no hay con qué comparar.
  const delDia = (lista: Turno[]) => {
    const a = lista.filter(t => t.estado !== 'cancelado')
    return { turnos: a.length, ingresos: a.filter(t => t.estado !== 'ausente').reduce((s, t) => s + t.precio, 0) }
  }
  const pasado = delDia(turnosDelDia(-7))
  const contraDia = `vs. ${DIAS[HOY_SEMANA].toLowerCase()} pasado`
  /** Porcentaje contra el mismo día de la semana pasada; si ese día no hubo nada, no hay variación. */
  // La variación contra el mismo día de la semana pasada, para el chip del indicador: sin dato de antes, no hay chip.
  const variacion = (hoy: number, antes: number) => (antes > 0 ? { valor: Math.round(((hoy - antes) / antes) * 1000) / 10 } : undefined)
  const proximos = turnos.filter(t => t.inicio + t.duracion > AHORA_DEMO && t.estado !== 'cancelado').sort((a, b) => a.inicio - b.inicio)
  // El tiempo libre de acá al cierre, en bloques de media hora: es el número de "Huecos libres".
  const libresFuturos = recursos.map(r => ({ r, libres: huecosDe(turnos, jornada(r.id), r.id).filter(m => m >= AHORA_DEMO) }))
  const totalLibres = libresFuturos.reduce((s, x) => s + x.libres.length, 0)
  // Lo que se ofrece son los horarios donde entra al menos el servicio más corto: los mismos que
  // muestra "Nuevo turno". Media hora suelta no sirve si nada dura tan poco (la estética arranca en 40 min).
  const masCorto = duraciones.length ? Math.min(...duraciones) : SLOT
  const ofrecibles = recursos.map(r => ({ r, libres: horariosLibres(turnos, jornada(r.id), r.id, masCorto, 0) }))
  const totalOfrecibles = ofrecibles.reduce((s, x) => s + x.libres.length, 0)
  const pendientes = turnos.filter(t => t.estado === 'pendiente').sort((a, b) => a.inicio - b.inicio)
  const sinConfirmar = pendientes.length
  const etiquetaRecurso = rubro.modo === 'profesional' ? rubro.profesional : 'Espacio'
  const enCurso = turnos.find(t => t.estado === 'en-curso')
  const sigue = proximos.find(t => t.inicio > AHORA_DEMO)
  const avance = enCurso ? Math.min(1, Math.max(0, (AHORA_DEMO - enCurso.inicio) / enCurso.duracion)) : 0

  const compartir = () => {
    const conLugar = ofrecibles.filter(x => x.libres.length > 0)
    const link = `${window.location.origin}/turnos-demo/reserva?rubro=${encodeURIComponent(rubro.key)}`
    onCompartir({
      titulo: 'Compartir los huecos de hoy',
      texto: `¡Hola! Hoy en ${negocio} nos quedan estos horarios libres:\n\n${conLugar.map(({ r, libres }) => `${r.nombre}: ${libres.map(horaTxt).join(', ')}`).join('\n')}\n\nReservá el tuyo acá: ${link}`,
    })
  }

  return (
    <div className="rv-pagina">
      <style>{CSS}</style>

      <Encabezado
        rotulo={FECHA_DEMO}
        titulo={`${saludo(AHORA_DEMO)}, ${aQuien}`}
        bajada={<>Hoy tenés <b style={{ color: 'var(--color-text)' }}>{activos.length} turno{activos.length === 1 ? '' : 's'}</b>. Quedan <b style={{ color: 'var(--color-text)' }}>{proximos.length} por delante</b>{sigue ? <> y el próximo arranca en <b style={{ color: 'var(--color-text)' }}>{faltan(sigue.inicio - AHORA_DEMO)}</b>.</> : '.'}</>}
        acciones={<>
          <button type="button" className="rv-btn" onClick={() => onIr('agenda')}><CalendarDays size={16} /> Ver agenda</button>
          {puedeAgendar && <button type="button" className="rv-btn rv-btn--primario" onClick={() => onNuevo()}><Plus size={16} /> Nuevo turno</button>}
        </>}
      />

      {sinConfirmar > 0 && (
        <button type="button" onClick={() => onAbrir(pendientes[0])} className="rv-nota rv-nota--aviso tu-res-aviso">
          <BellRing size={17} aria-hidden />
          <span>
            Tenés <b>{sinConfirmar} turno{sinConfirmar === 1 ? '' : 's'} sin confirmar</b> para hoy{sinConfirmar === 1 ? ':' : '. El primero:'} {nombre(pendientes[0].clienteId).split(' ')[0]} a las <span className="rv-num">{horaTxt(pendientes[0].inicio)}</span>. {puedeAgendar ? 'Tocá para confirmarlo o mandarle un recordatorio.' : 'Tocá para verlo.'}
          </span>
          <ArrowRight size={16} aria-hidden />
        </button>
      )}

      <div className={`rv-kpis${verNumeros ? '' : ' rv-kpis--3'}`}>
        <Kpi label="Turnos hoy" valor={activos.length} Icon={CalendarCheck} delta={variacion(activos.length, pasado.turnos)} nota={pasado.turnos > 0 ? contraDia : 'en todas las agendas'} />
        <Kpi label="Huecos libres" valor={`${(totalLibres * SLOT / 60).toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`} Icon={Clock3} nota="de acá al cierre" />
        <Kpi label="Ausencias" valor={ausentes} Icon={UserX} nota="en lo que va del día" />
        {verNumeros && <Kpi label="Ingresos estimados" valor={plata(ingresos)} Icon={Wallet} delta={variacion(ingresos, pasado.ingresos)} nota={pasado.ingresos > 0 ? contraDia : 'si vienen todos'} />}
      </div>

      {(enCurso || sigue) && (
        <div className="tu-res-ahora">
          {enCurso && (
            <button type="button" className="rv-card rv-card--accion tu-res-mini" onClick={() => onAbrir(enCurso)}>
              <span className="tu-res-mini-cab"><span className="rv-rotulo" style={{ color: 'var(--chip-primary-fg)' }}>En curso</span><span className="rv-num">hasta {horaTxt(enCurso.inicio + enCurso.duracion)}</span></span>
              <span className="tu-res-mini-quien">
                <Avatar name={nombre(enCurso.clienteId)} size={34} />
                <span><b>{nombre(enCurso.clienteId)}</b><small>{enCurso.servicio}</small></span>
              </span>
              <Barra valor={avance} label="Avance del turno" />
            </button>
          )}
          {sigue && (
            <button type="button" className="rv-card rv-card--accion tu-res-mini" onClick={() => onAbrir(sigue)}>
              <span className="tu-res-mini-cab"><span className="rv-rotulo">Sigue</span><span className="rv-num">en {faltan(sigue.inicio - AHORA_DEMO)}</span></span>
              <span className="tu-res-mini-quien">
                <span className="tu-res-hora rv-num">{horaTxt(sigue.inicio)}</span>
                <span><b>{nombre(sigue.clienteId)}</b><small>{sigue.servicio} · {recursos.find(r => r.id === sigue.recursoId)?.nombre}</small></span>
              </span>
            </button>
          )}
        </div>
      )}

      <div className="tu-res-cols">
        <section style={{ minWidth: 0 }}>
          <div className="rv-entre" style={{ marginBottom: 10 }}>
            <h2 className="rv-h2">Próximos turnos</h2>
            <button type="button" onClick={() => onIr('agenda')} className="rv-btn rv-btn--sm rv-btn--fantasma" style={{ color: 'var(--rv-tinta-link, var(--chip-primary-fg))' }}>Ver agenda <ArrowRight size={14} /></button>
          </div>
          <TurnosLista turnos={proximos} clientes={clientes} recursos={recursos} onAbrir={onAbrir} etiquetaRecurso={etiquetaRecurso} />
        </section>

        <div className="rv-pila" style={{ gap: 16 }}>
          <section className="rv-card rv-card--pad">
            <h2 className="rv-h2">Ocupación de hoy</h2>
            <p className="rv-ayuda" style={{ margin: '3px 0 16px' }}>Tiempo tomado sobre el horario de atención de cada uno.</p>
            <div className="tu-res-ocup">
              {recursos.map(r => {
                const lista = activos.filter(t => t.recursoId === r.id)
                const min = lista.reduce((s, t) => s + t.duracion, 0)
                const abierto = minutosAbiertos(jornada(r.id))
                const pct = abierto ? Math.min(1, min / abierto) : 0
                return (
                  <div key={r.id}>
                    <b>{r.nombre}</b>
                    <small>{abierto ? <>{lista.length} turno{lista.length === 1 ? '' : 's'} · {faltan(min)} de {faltan(abierto)}</> : rubro.modo === 'profesional' ? 'Hoy no atiende' : 'Hoy no se usa'}</small>
                    <Barra valor={pct} color={r.color} label={`Ocupación de ${r.nombre}: ${Math.round(pct * 100)}%`} />
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rv-card rv-card--pad">
            <div className="rv-entre" style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <h2 className="rv-h2">Huecos para ofrecer</h2>
                <p className="rv-ayuda" style={{ margin: '3px 0 0' }}>{puedeAgendar ? 'Compartilos por WhatsApp o en redes para llenar el día.' : 'Los horarios que quedan libres de acá al cierre.'}</p>
              </div>
              {puedeAgendar && <button type="button" onClick={compartir} disabled={totalOfrecibles === 0} className="rv-btn rv-btn--sm" aria-label="Compartir los huecos libres"><Send size={14} /> Compartir</button>}
            </div>
            {ofrecibles.map(({ r, libres }) => {
              const todos = desplegados.includes(r.id)
              return (
                <div key={r.id}>
                  <div className="tu-res-agenda"><i aria-hidden style={{ background: r.color }} />{r.nombre}</div>
                  <div className="tu-res-huecos">
                    {libres.length === 0
                      ? <span className="rv-chip rv-chip--gris">Completo</span>
                      : libres.slice(0, todos ? libres.length : A_LA_VISTA).map(m => puedeAgendar
                        ? <button key={m} type="button" onClick={() => onNuevo({ recursoId: r.id, inicio: m, dia: 0 })} className="rv-chip rv-chip--borde rv-num" aria-label={`Agendar a las ${horaTxt(m)} con ${r.nombre}`}>{horaTxt(m)}</button>
                        : <span key={m} className="rv-chip rv-chip--borde rv-num">{horaTxt(m)}</span>)}
                    {libres.length > A_LA_VISTA && (
                      <button type="button" onClick={() => setDesplegados(d => (todos ? d.filter(x => x !== r.id) : [...d, r.id]))} aria-expanded={todos} aria-label={todos ? `Ver menos horarios de ${r.nombre}` : `Ver los ${libres.length - A_LA_VISTA} horarios que faltan de ${r.nombre}`} className="rv-chip rv-chip--gris rv-num">
                        {todos ? 'Ver menos' : `+${libres.length - A_LA_VISTA}`}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      </div>
    </div>
  )
}
