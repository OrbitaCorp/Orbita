// Resumen del día: lo primero que ve el dueño al entrar al panel de Turnos.
// Arriba, el día en órbita (el dial con todos los turnos y el satélite en
// "ahora") junto a lo que está pasando en este momento. Abajo, los números
// del día, lo que viene, la ocupación y los huecos para ofrecer.
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
import { DIAS, horaTxt, type Turno, type Cliente, type Recurso, type RubroTurnos } from '@/modules/turnos/datos'
import { AHORA_DEMO, FECHA_DEMO, HOY_SEMANA, minutosAbiertos, type Tramo } from '@/modules/turnos/horario'
import { OrbitaDia, Anillo } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { Indicador } from '@/modules/turnos/_shared/orbita/piezas'
import TurnosLista from './TurnosLista'
import { SLOT, horariosLibres, huecosDe, type MensajeWA, type NuevoTurnoPre } from '../datos/agenda'
import { plata } from '../datos/equipo'

const saludo = (min: number) => (min < 12 * 60 ? 'Buen día' : min < 20 * 60 ? 'Buenas tardes' : 'Buenas noches')
const faltan = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`)

interface Props {
  negocio: string
  /** A quién se saluda: el negocio o, si entra alguien del equipo, su nombre. */
  saludo: string
  rubro: RubroTurnos
  turnos: Turno[]
  /** Los turnos de otro día, contado desde hoy (-7 = el mismo día de la semana pasada): de ahí salen la variación y la tendencia. */
  turnosDelDia: (dia: number) => Turno[]
  clientes: Cliente[]
  recursos: Recurso[]
  /** En qué tramos atiende hoy cada agenda. */
  jornada: (recursoId: string) => Tramo[]
  /** Cuánto dura cada servicio que se puede dar (los del panel): el más corto define qué hueco se puede ofrecer. */
  duraciones: number[]
  /** De la primera apertura al último cierre de hoy: lo que abarca el dial. */
  rango: Tramo
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

export default function ResumenDia({ negocio, saludo: aQuien, rubro, turnos, turnosDelDia, clientes, recursos, jornada, duraciones, rango, puedeAgendar, verNumeros, onAbrir, onIr, onNuevo, onCompartir }: Props) {
  const [desplegados, setDesplegados] = useState<string[]>([])
  const nombre = (id: string) => clientes.find(c => c.id === id)?.nombre ?? '—'
  const activos = turnos.filter(t => t.estado !== 'cancelado')
  const ausentes = turnos.filter(t => t.estado === 'ausente').length
  const ingresos = activos.filter(t => t.estado !== 'ausente').reduce((s, t) => s + t.precio, 0)
  // La variación y la tendencia salen de la agenda (los días anteriores los arma el panel), no de
  // números escritos a mano: un negocio que hoy no atiende ve 0, sin "+12,5%" ni una línea inventada.
  // Las ausencias no: los días pasados de la demo no las guardan, así que no hay con qué comparar.
  const delDia = (lista: Turno[]) => {
    const a = lista.filter(t => t.estado !== 'cancelado')
    return { turnos: a.length, ingresos: a.filter(t => t.estado !== 'ausente').reduce((s, t) => s + t.precio, 0) }
  }
  const semana = [...Array.from({ length: 6 }, (_, k) => delDia(turnosDelDia(k - 6))), { turnos: activos.length, ingresos }]
  const pasado = delDia(turnosDelDia(-7))
  const contraDia = `vs. ${DIAS[HOY_SEMANA].toLowerCase()} pasado`
  /** "+12,5%" o "−20%" contra el mismo día de la semana pasada; si ese día no hubo nada, no hay variación. */
  const variacion = (hoy: number, antes: number) => {
    if (antes <= 0) return undefined
    const v = Math.round(((hoy - antes) / antes) * 1000) / 10
    return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
  }
  const tendencia = (serie: number[]) => (serie.some(x => x > 0) ? serie : undefined)
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
    <div className="panel-page">
      <style>{`
        .tu-res-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 400px); gap: 28px; align-items: center; padding: 30px 32px; border-radius: 24px; border: 1px solid rgba(147,197,253,0.16); margin-bottom: 18px; }
        .tu-res-ahora { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 24px; }
        .tu-res-mini { padding: 14px; border-radius: 14px; border: 1px solid rgba(147,197,253,0.14); background: rgba(255,255,255,0.035); text-align: left; font-family: inherit; color: inherit; cursor: pointer; transition: border-color 180ms ease, background 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1); }
        @media (hover: hover) { .tu-res-mini:hover { border-color: rgba(147,197,253,0.42); background: rgba(96,165,250,0.08); transform: translateY(-2px); } }
        .tu-res-mini:focus-visible { outline: 2px solid #93C5FD; outline-offset: 2px; }
        .tu-res-kpis { display: grid; grid-template-columns: repeat(var(--tu-kpis, 4), minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
        .tu-res-cols { display: grid; grid-template-columns: minmax(0, 2fr) minmax(290px, 1fr); gap: 18px; align-items: start; }
        .tu-res-aviso { transition: border-color 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1); }
        .tu-res-aviso svg:last-child { transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1); }
        @media (hover: hover) {
          .tu-res-aviso:hover { transform: translateY(-1px); }
          .tu-res-aviso:hover svg:last-child { transform: translateX(4px); }
        }
        .tu-res-aviso:focus-visible { outline: 2px solid var(--color-warning); outline-offset: 2px; }
        .tu-res-barra { transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1); }
        @media (max-width: 1180px) { .tu-res-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 1024px) {
          .tu-res-hero { grid-template-columns: minmax(0, 1fr); padding: 24px 20px; }
          .tu-res-dial { max-width: 340px; margin: 0 auto; }
          .tu-res-cols { grid-template-columns: minmax(0, 1fr); }
        }
        .tu-res-huecos { display: flex; flex-wrap: wrap; gap: 6px; }
        @media (max-width: 768px) {
          /* En celular cada hueco es un botón de 44 px en una grilla pareja, con 8 px entre uno y otro:
             agrandar solo el área de toque hacía que los de dos filas se pisaran. */
          .tu-res-huecos { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; }
          .tu-res-huecos > .tuo-chip { height: 44px; justify-content: center; border-radius: 12px; font-size: 14px; }
          .tuo-btn.tu-res-toque { height: 44px; }
        }
        @media (max-width: 560px) {
          .tu-res-ahora { grid-template-columns: minmax(0, 1fr); }
          .tu-res-kpis { gap: 10px; }
          .tu-res-kpis .tuo-ind { padding: 14px; gap: 10px; }
          .tu-res-kpis .tuo-ind-valor { font-size: 23px !important; }
          .tu-res-kpis .tuo-ind-chispa { display: none; }
          /* Dos tarjetas por fila: el rótulo largo ("Ingresos estimados") baja de renglón en vez de cortarse. */
          .tu-res-kpis .tuo-ind .tuo-rotulo { white-space: normal !important; letter-spacing: 0.06em; line-height: 1.25; }
        }
        @media (prefers-reduced-motion: reduce) { .tu-res-mini, .tu-res-aviso, .tu-res-aviso svg:last-child, .tu-res-barra { transition: none; transform: none; } }
      `}</style>

      {/* El día en órbita */}
      <section className="tuo-espacio tu-res-hero tuo-entra" aria-label="El día de hoy">
        <div style={{ minWidth: 0 }}>
          <div className="tuo-eyebrow">{FECHA_DEMO}</div>
          <h1 className="tuo-h1" style={{ fontSize: 'clamp(25px, 3vw, 34px)', marginTop: 12 }}>{saludo(AHORA_DEMO)}, {aQuien}</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--color-body)', margin: '10px 0 0', maxWidth: '52ch' }}>
            Hoy tenés <b style={{ color: 'var(--color-text)' }}>{activos.length} turnos</b>. Quedan <b style={{ color: 'var(--color-text)' }}>{proximos.length} por delante</b>
            {sigue ? <> y el próximo arranca en <b style={{ color: 'var(--color-text)' }}>{faltan(sigue.inicio - AHORA_DEMO)}</b>.</> : '.'}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            {puedeAgendar && <button onClick={() => onNuevo()} className="tuo-btn tuo-btn--primario"><Plus size={16} /> Nuevo turno</button>}
            <button className={puedeAgendar ? 'tuo-btn' : 'tuo-btn tuo-btn--primario'} onClick={() => onIr('agenda')} style={puedeAgendar ? { background: 'rgba(255,255,255,0.05)' } : undefined}><CalendarDays size={16} /> Ver agenda</button>
          </div>

          <div className="tu-res-ahora">
            {enCurso && (
              <button className="tu-res-mini" onClick={() => onAbrir(enCurso)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span className="tuo-late" aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#60A5FA' }} />
                  <span className="tuo-rotulo" style={{ color: '#93C5FD' }}>En curso</span>
                  <span className="tuo-num" style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--color-muted)' }}>hasta {horaTxt(enCurso.inicio + enCurso.duracion)}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <Avatar name={nombre(enCurso.clienteId)} size={34} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre(enCurso.clienteId)}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{enCurso.servicio}</span>
                  </span>
                </span>
                <span role="progressbar" aria-label="Avance del turno" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance * 100)} style={{ display: 'block', height: 4, borderRadius: 999, background: 'rgba(147,197,253,0.16)', marginTop: 12, overflow: 'hidden' }}>
                  <span className="tu-res-barra" style={{ display: 'block', width: `${avance * 100}%`, height: '100%', borderRadius: 999, background: 'var(--color-primary)' }} />
                </span>
              </button>
            )}
            {sigue && (
              <button className="tu-res-mini" onClick={() => onAbrir(sigue)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span className="tuo-rotulo">Sigue</span>
                  <span className="tuo-num" style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--color-muted)' }}>en {faltan(sigue.inicio - AHORA_DEMO)}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <span className="tuo-num" style={{ width: 54, height: 34, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 600, color: '#BFDBFE', background: 'rgba(96,165,250,0.14)', border: '1px solid rgba(147,197,253,0.2)' }}>{horaTxt(sigue.inicio)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre(sigue.clienteId)}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sigue.servicio} · {recursos.find(r => r.id === sigue.recursoId)?.nombre}</span>
                  </span>
                </span>
                <span style={{ display: 'block', height: 4, marginTop: 12 }} />
              </button>
            )}
          </div>
        </div>

        <div className="tu-res-dial" style={{ width: '100%', minWidth: 0 }}>
          <OrbitaDia recursos={recursos} turnos={turnos} ahora={AHORA_DEMO} apertura={rango[0]} cierre={rango[1]} nombreCliente={nombre} onAbrir={onAbrir} pie={`${proximos.length} turnos por venir`} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: -14 }}>
            {recursos.map(r => (
              <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-body)' }}>
                <span aria-hidden style={{ width: 14, height: 5, borderRadius: 999, background: r.color }} />{r.nombre}
              </span>
            ))}
          </div>
        </div>
      </section>

      {sinConfirmar > 0 && (
        <button type="button" onClick={() => onAbrir(pendientes[0])} className="tu-res-aviso tuo-entra" style={{ ['--i' as string]: 1, display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginBottom: 18, padding: '13px 16px', borderRadius: 14, border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)', background: 'var(--color-warning-bg)', color: 'var(--chip-warning-fg)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <BellRing size={17} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            Tenés <b>{sinConfirmar} turno{sinConfirmar === 1 ? '' : 's'} sin confirmar</b> para hoy{sinConfirmar === 1 ? ':' : '. El primero:'} {nombre(pendientes[0].clienteId).split(' ')[0]} a las <span className="tuo-num">{horaTxt(pendientes[0].inicio)}</span>. {puedeAgendar ? 'Tocá para confirmarlo o mandarle un recordatorio.' : 'Tocá para verlo.'}
          </span>
          <ArrowRight size={16} style={{ flexShrink: 0 }} />
        </button>
      )}

      <div className="tu-res-kpis" style={{ ['--tu-kpis' as string]: verNumeros ? 4 : 3 }}>
        <Indicador i={1} label="Turnos hoy" valor={activos.length} Icon={CalendarCheck} cambio={variacion(activos.length, pasado.turnos)} nota={pasado.turnos > 0 ? contraDia : undefined} tendencia={tendencia(semana.map(d => d.turnos))} />
        <Indicador i={2} label="Huecos libres" valor={`${(totalLibres * SLOT / 60).toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`} Icon={Clock3} nota="de acá al cierre" />
        <Indicador i={3} label="Ausencias" valor={ausentes} Icon={UserX} nota="en lo que va del día" />
        {verNumeros && <Indicador i={4} label="Ingresos estimados" valor={plata(ingresos)} Icon={Wallet} cambio={variacion(ingresos, pasado.ingresos)} nota="si vienen todos" tendencia={tendencia(semana.map(d => d.ingresos))} />}
      </div>

      <div className="tu-res-cols">
        <section className="tuo-entra" style={{ ['--i' as string]: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <h2 className="tuo-h2" style={{ flex: 1 }}>Próximos turnos</h2>
            <button onClick={() => onIr('agenda')} className="tuo-btn tuo-btn--fantasma tuo-btn--sm" style={{ color: 'var(--color-primary)' }}>Ver agenda <ArrowRight size={14} /></button>
          </div>
          <TurnosLista turnos={proximos} clientes={clientes} recursos={recursos} onAbrir={onAbrir} etiquetaRecurso={etiquetaRecurso} />
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <section className="tuo-card tuo-card--pad tuo-entra" style={{ ['--i' as string]: 4 }}>
            <h2 className="tuo-h2">Ocupación de hoy</h2>
            <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: '3px 0 16px' }}>Tiempo tomado sobre el horario de atención de cada uno.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {recursos.map(r => {
                const lista = activos.filter(t => t.recursoId === r.id)
                const min = lista.reduce((s, t) => s + t.duracion, 0)
                const abierto = minutosAbiertos(jornada(r.id))
                const pct = abierto ? Math.min(1, min / abierto) : 0
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Anillo valor={pct} color={r.color} size={50} grosor={5} label={`Ocupación de ${r.nombre}: ${Math.round(pct * 100)}%`} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{abierto ? <>{lista.length} turno{lista.length === 1 ? '' : 's'} · {faltan(min)} de {faltan(abierto)}</> : rubro.modo === 'profesional' ? 'Hoy no atiende' : 'Hoy no se usa'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="tuo-card tuo-card--pad tuo-entra" style={{ ['--i' as string]: 5 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="tuo-h2">Huecos para ofrecer</h2>
                <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: '3px 0 0', lineHeight: 1.5 }}>{puedeAgendar ? 'Compartilos por WhatsApp o en redes para llenar el día.' : 'Los horarios que quedan libres de acá al cierre.'}</p>
              </div>
              {puedeAgendar && <button onClick={compartir} disabled={totalOfrecibles === 0} className="tuo-btn tuo-btn--sm tu-res-toque" aria-label="Compartir los huecos libres"><Send size={14} /> Compartir</button>}
            </div>
            {ofrecibles.map(({ r, libres }) => {
              const todos = desplegados.includes(r.id)
              return (
              <div key={r.id} style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--color-body)', marginBottom: 7 }}>
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: r.color }} />{r.nombre}
                </div>
                <div className="tu-res-huecos">
                  {libres.length === 0
                    ? <span className="tuo-chip">Completo</span>
                    : libres.slice(0, todos ? libres.length : A_LA_VISTA).map(m => puedeAgendar
                      ? <button key={m} onClick={() => onNuevo({ recursoId: r.id, inicio: m, dia: 0 })} className="tuo-chip tuo-chip--primario tuo-chip--hora" aria-label={`Agendar a las ${horaTxt(m)} con ${r.nombre}`}>{horaTxt(m)}</button>
                      : <span key={m} className="tuo-chip tuo-chip--primario tuo-chip--hora">{horaTxt(m)}</span>)}
                  {libres.length > A_LA_VISTA && (
                    <button onClick={() => setDesplegados(d => (todos ? d.filter(x => x !== r.id) : [...d, r.id]))} aria-expanded={todos} aria-label={todos ? `Ver menos horarios de ${r.nombre}` : `Ver los ${libres.length - A_LA_VISTA} horarios que faltan de ${r.nombre}`} className="tuo-chip tuo-chip--borde tuo-num">
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
