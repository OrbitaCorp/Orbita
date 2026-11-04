// Recordatorios y mensajes automáticos. Es lo que más valor le da a un
// negocio de turnos (baja las ausencias), así que arriba se ve cómo vino la
// confirmación de hoy (sale de la agenda), y después cada mensaje se puede
// prender, elegir por dónde sale y editar, con una vista previa del chat que
// reemplaza las variables por datos de ejemplo del rubro.
import { useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { MessageCircle, Mail, CalendarCheck, BellRing, Bell, CalendarX2, HeartHandshake, Hourglass, ChevronDown, CheckCheck, RotateCcw, ArrowRight, Sun } from 'lucide-react'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { recursosDe, CLIENTES, horaTxt, type Turno } from '@/modules/turnos/datos'
import { Encabezado, SecCard, Switch, Selector, Chip, FilaSwitch, Campo, BotonBorde, type PropsTab } from './ui'
import { BarraGuardar, useBorrador } from '@/design-system/reservas/piezas'
import { vozDe, iniciales, subdominioDe, cap, type Voz } from './datos'

type Canal = 'wa' | 'email'
interface Mensaje { id: string; on: boolean; canales: Canal[]; cuando: string; texto: string }
interface Meta { id: string; titulo: string; ayuda: string; Icon: LucideIcon; cuando?: { id: string; label: string }[] }

const VARIABLES = ['nombre', 'servicio', 'fecha', 'hora', 'profesional', 'negocio', 'link'] as const

function metas(voz: Voz): Meta[] {
  return [
    { id: 'confirmacion', titulo: 'Confirmación de reserva', ayuda: `Apenas reservan. Con el link para cancelar o cambiar el ${voz.turno}.`, Icon: CalendarCheck },
    { id: 'recordatorio', titulo: 'Recordatorio', ayuda: 'El que más ausencias evita. Con botón para confirmar asistencia.', Icon: BellRing, cuando: [{ id: '24', label: '24 h antes' }, { id: '48', label: '48 h antes' }, { id: '12', label: '12 h antes' }] },
    { id: 'recordatorio2', titulo: 'Último aviso', ayuda: 'Un recordatorio corto el mismo día.', Icon: Bell, cuando: [{ id: '2', label: '2 h antes' }, { id: '1', label: '1 h antes' }, { id: '3', label: '3 h antes' }] },
    { id: 'cancelacion', titulo: 'Aviso de cancelación', ayuda: `Cuando se cancela un ${voz.turno}, de cualquiera de los dos lados.`, Icon: CalendarX2 },
    { id: 'espera', titulo: 'Se liberó un lugar', ayuda: 'Para el primero de la lista de espera.', Icon: Hourglass },
    { id: 'extranamos', titulo: 'Te extrañamos', ayuda: `Para ${voz.clientes} que hace mucho no vuelven.`, Icon: HeartHandshake, cuando: [{ id: '30', label: 'A los 30 días' }, { id: '45', label: 'A los 45 días' }, { id: '60', label: 'A los 60 días' }, { id: '90', label: 'A los 90 días' }] },
  ]
}

function textos(voz: Voz): Record<string, string> {
  return {
    confirmacion: `¡Hola {nombre}! Tu ${voz.turno} de {servicio} quedó confirmado para el {fecha} a las {hora} con {profesional}. Si necesitás cambiarlo: {link}`,
    recordatorio: `Hola {nombre}, te recordamos tu ${voz.turno} de mañana {fecha} a las {hora} en {negocio}. ¿Venís? Respondé SÍ para confirmar o cambialo acá: {link}`,
    recordatorio2: `{nombre}, te esperamos hoy a las {hora} para {servicio}. ¡Nos vemos!`,
    cancelacion: `Hola {nombre}, tu ${voz.turno} del {fecha} a las {hora} quedó cancelado. Cuando quieras, reservá de nuevo: {link}`,
    espera: `¡{nombre}, se liberó un lugar! {servicio}, {fecha} a las {hora}. Tenés 30 min para tomarlo: {link}`,
    extranamos: `¡Hola {nombre}! Hace rato que no te vemos por {negocio}. Tenemos horarios libres esta semana: {link}`,
  }
}

const CSS = `
  .tuc-msj { overflow: hidden; }
  .tuc-msj[data-on='false'] { opacity: 0.8; }
  .tuc-msj[data-abierto='true'] { border-color: var(--color-border-strong); }
  .tuc-msj-ico { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; background: var(--color-surface-alt); color: var(--color-subtle); }
  .tuc-msj[data-on='true'] .tuc-msj-ico { background: var(--color-primary-bg); color: var(--color-primary); }
  .tuc-msj-flecha { color: var(--color-muted); flex-shrink: 0; }
  .tuc-msj[data-abierto='true'] .tuc-msj-flecha { transform: rotate(180deg); }
  .tuc-msj-cab { flex: 1; min-width: 0; min-height: 44px; text-align: left; background: none; border: none; padding: 0; cursor: pointer; font: inherit; display: flex; align-items: center; gap: 8px; }
  .tuc-msj-cab:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 4px; border-radius: 6px; }
  .tuc-msj-cuerpo { border-top: 1px solid var(--color-border); padding: 16px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; }
  /* La vista previa del chat: con los colores del panel (un solo acento), no los de WhatsApp. */
  .tuc-wa { border-radius: var(--rv-r); overflow: hidden; border: 1px solid var(--color-border); display: flex; flex-direction: column; min-width: 0; align-self: start; }
  .tuc-wa-cab { background: var(--color-surface); color: var(--color-text); border-bottom: 1px solid var(--color-border); display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
  .tuc-wa-fondo { background: var(--color-surface-alt); background-image: radial-gradient(var(--color-border) 1px, transparent 1px); background-size: 14px 14px; padding: 16px 12px 18px; min-height: 150px; }
  .tuc-wa-burbuja { background: var(--color-primary-bg); color: var(--color-text); position: relative; max-width: 92%; margin-left: auto; padding: 7px 9px 18px 10px; border-radius: 10px 0 10px 10px; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
  /* Cómo vino la confirmación de hoy: tres números y el primero que falta confirmar. */
  .tuc-hoy { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
  .tuc-hoy-tile { padding: 11px 12px; border-radius: var(--rv-r-sm); background: var(--color-surface); border: 1px solid var(--color-border); min-width: 0; }
  .tuc-hoy-tile > small { display: block; font-size: 11px; color: var(--color-muted); margin-bottom: 3px; }
  .tuc-hoy-tile > b { display: block; font-family: var(--rv-mono); font-size: 20px; font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }
  .tuc-hoy-tile[data-tono='aviso'] > b { color: var(--chip-warning-fg); }
  .tuc-hoy-pie { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 13px; line-height: 1.5; color: var(--color-body); }
  @media (max-width: 760px) { .tuc-msj-cuerpo { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 480px) { .tuc-hoy { grid-template-columns: minmax(0, 1fr); } }
  /* Los canales van a la par del selector de "Cuándo": 42 px como el campo, 46 en celular (también el campo crece). */
  .rv-chip.tuc-canal { min-height: 42px; }
  @media (max-width: 768px) { .rv-chip.tuc-canal { min-height: 46px; } }
`

interface Props extends PropsTab {
  /** Los turnos de hoy: de ahí sale cómo vino la confirmación. */
  turnosHoy: Turno[]
  nombreDe: (clienteId: string) => string
  onAbrir: (t: Turno) => void
}

export default function Mensajes({ rubro, avisar, turnosHoy, nombreDe, onAbrir }: Props) {
  const voz = vozDe(rubro)
  const lista = metas(voz).filter(m => m.id !== 'espera' || rubro.modo === 'profesional')
  const t = temaDe(rubro)
  const b = useBorrador(() => {
    const tx = textos(voz)
    return {
      wa: true, email: true, numero: t.telefono, firma: true,
      mensajes: lista.map((m): Mensaje => ({
        id: m.id, on: m.id !== 'extranamos', canales: m.id === 'extranamos' ? ['wa'] : ['wa', 'email'],
        cuando: m.cuando?.[0].id ?? '', texto: tx[m.id],
      })),
    }
  })
  const v = b.v
  const [abierto, setAbierto] = useState<string | null>('recordatorio')
  const setMsj = (id: string, m: Partial<Mensaje>) => b.set('mensajes', v.mensajes.map(x => x.id === id ? { ...x, ...m } : x))

  const quien = recursosDe(rubro)[0].nombre
  const ejemplo: Record<string, string> = {
    nombre: CLIENTES[0].nombre.split(' ')[0], servicio: rubro.servicios[0].nombre.toLowerCase(), fecha: 'sábado 27/09', hora: '15:30',
    profesional: quien, negocio: t.nombre, link: `${subdominioDe(t.nombre)}.orbita.site/t/8KQ2`,
  }
  const activos = v.mensajes.filter(m => m.on).length

  // Cómo vino hoy: los turnos del día (sin los cancelados), cuántos confirmaron y el primero que falta.
  const deHoy = turnosHoy.filter(t => t.estado !== 'cancelado')
  const sinConfirmar = deHoy.filter(t => t.estado === 'pendiente').sort((a, b) => a.inicio - b.inicio)
  const primero = sinConfirmar[0]
  const recordatorioOn = v.wa && !!v.mensajes.find(m => m.id === 'recordatorio')?.on

  return (
    <div className="rv-pagina rv-pagina--form">
      <style>{CSS}</style>
      <Encabezado rotulo="Reservas" titulo="Recordatorios y mensajes" bajada={`Lo que les llega a tus ${voz.clientes} sin que muevas un dedo. Los recordatorios ayudan a que no se olviden del turno.`} />

      <div className="rv-pila">
        <SecCard titulo="Hoy" Icon={Sun} badge={recordatorioOn ? <Chip tono="ok"><CheckCheck size={12} aria-hidden />Recordatorio prendido</Chip> : <Chip tono="aviso">Sin recordatorio</Chip>}
          bajada={`Cómo vino la confirmación de los ${voz.turnos} de hoy. ${recordatorioOn ? 'El recordatorio salió ayer a cada uno.' : 'Sin recordatorio, cada uno tiene que acordarse solo.'}`}>
          <div className="tuc-hoy">
            <div className="tuc-hoy-tile"><small>{cap(voz.turnos)} de hoy</small><b>{deHoy.length}</b></div>
            <div className="tuc-hoy-tile"><small>Confirmaron</small><b>{deHoy.length - sinConfirmar.length}</b></div>
            <div className="tuc-hoy-tile" data-tono={sinConfirmar.length ? 'aviso' : undefined}><small>Sin confirmar</small><b>{sinConfirmar.length}</b></div>
          </div>
          <div className="tuc-hoy-pie">
            <span>{primero
              ? <>{nombreDe(primero.clienteId)} todavía no confirmó su {voz.turno} de las <span className="rv-num">{horaTxt(primero.inicio)}</span>{sinConfirmar.length > 1 ? ` y ${sinConfirmar.length - 1} más tampoco` : ''}. Desde el turno le mandás un recordatorio.</>
              : deHoy.length ? 'Todos confirmaron: no hay a quién escribirle.' : 'Hoy no hay turnos.'}</span>
            {primero && <BotonBorde Icon={ArrowRight} onClick={() => onAbrir(primero)}>Ver el turno</BotonBorde>}
          </div>
        </SecCard>

        <SecCard titulo="Canales" Icon={MessageCircle} bajada="Por dónde salen los mensajes. Cada mensaje elige después sus canales.">
          <FilaSwitch Icon={MessageCircle} titulo="WhatsApp" ayuda="Desde el número de tu negocio. Es el que más se lee." on={v.wa} onChange={x => b.set('wa', x)}>
            <Campo label="Número que envía" value={v.numero} onChange={x => b.set('numero', x)} prefijo="+54" mono sufijo={<Chip tono="ok">Verificado</Chip>} style={{ marginBottom: 0, maxWidth: 380 }} />
          </FilaSwitch>
          <FilaSwitch Icon={Mail} titulo="Email" ayuda="Con tu logo y los colores de tu sitio. Sirve de respaldo." on={v.email} onChange={x => b.set('email', x)} />
          <FilaSwitch titulo={`Firmar con el nombre de ${t.nombre}`} ayuda="Al final de cada mensaje, para que sepan de quién es." on={v.firma} onChange={x => b.set('firma', x)} />
        </SecCard>

        <div className="rv-entre" style={{ margin: '8px 2px 0' }}>
          <h2 className="rv-h2">Mensajes automáticos</h2>
          <Chip tono="primario"><span className="rv-num">{activos}/{v.mensajes.length}</span> prendidos</Chip>
        </div>

        {lista.map(m => {
          const msj = v.mensajes.find(x => x.id === m.id)
          if (!msj) return null
          return (
            <TarjetaMensaje key={m.id} meta={m} msj={msj} abierto={abierto === m.id} onAbrir={() => setAbierto(a => a === m.id ? null : m.id)}
              onCambio={x => setMsj(m.id, x)} ejemplo={ejemplo} negocio={t.nombre} firma={v.firma} canalesOn={{ wa: v.wa, email: v.email }}
              original={textos(voz)[m.id]} />
          )
        })}
      </div>

      <BarraGuardar cambiado={b.cambiado} onDescartar={b.descartar} onGuardar={() => { b.guardar(); avisar('Mensajes guardados', 'Es una demo: no se envía nada.') }} />
    </div>
  )
}

function TarjetaMensaje({ meta, msj, abierto, onAbrir, onCambio, ejemplo, negocio, firma, canalesOn, original }: {
  meta: Meta; msj: Mensaje; abierto: boolean; onAbrir: () => void; onCambio: (m: Partial<Mensaje>) => void
  ejemplo: Record<string, string>; negocio: string; firma: boolean; canalesOn: Record<Canal, boolean>; original: string
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  const idPanel = `tuc-msj-${meta.id}`
  const cuandoLabel = meta.cuando?.find(c => c.id === msj.cuando)?.label

  // Inserta la variable donde está el cursor (o al final) y deja el cursor después.
  const insertar = (nombre: string) => {
    const el = area.current
    const token = `{${nombre}}`
    const ini = el?.selectionStart ?? msj.texto.length
    const fin = el?.selectionEnd ?? msj.texto.length
    onCambio({ texto: msj.texto.slice(0, ini) + token + msj.texto.slice(fin) })
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(ini + token.length, ini + token.length) })
  }
  const toggleCanal = (c: Canal) => onCambio({ canales: msj.canales.includes(c) ? msj.canales.filter(x => x !== c) : [...msj.canales, c] })

  return (
    <div role="group" aria-label={meta.titulo} className="rv-card tuc-msj" data-on={msj.on} data-abierto={abierto}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
        <span aria-hidden className="tuc-msj-ico"><meta.Icon size={16} strokeWidth={1.7} /></span>
        <button type="button" onClick={onAbrir} aria-expanded={abierto} aria-controls={idPanel} className="tuc-msj-cab">
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{meta.titulo}</span>
              {cuandoLabel && <Chip>{cuandoLabel}</Chip>}
              {msj.on && msj.canales.includes('wa') && canalesOn.wa && <Chip tono="ok"><MessageCircle size={11} aria-hidden />WhatsApp</Chip>}
              {msj.on && msj.canales.includes('email') && canalesOn.email && <Chip><Mail size={11} aria-hidden />Email</Chip>}
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-muted)', marginTop: 3 }}>{meta.ayuda}</span>
          </span>
          <ChevronDown size={16} aria-hidden className="tuc-msj-flecha" />
        </button>
        <Switch on={msj.on} onChange={x => onCambio({ on: x })} label={`Enviar ${meta.titulo.toLowerCase()}`} />
      </div>

      {abierto && (
        <div id={idPanel} className="tuc-msj-cuerpo">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
              {meta.cuando && (
                <Selector label="Cuándo" valor={msj.cuando} opciones={meta.cuando} onChange={x => onCambio({ cuando: x })} style={{ flex: '1 1 150px', marginBottom: 0 }} />
              )}
              <div>
                <div className="tuc-rotulo" style={{ marginBottom: 8 }}>Por dónde</div>
                <div role="group" aria-label="Canales de este mensaje" style={{ display: 'flex', gap: 6 }}>
                  {([['wa', 'WhatsApp', MessageCircle], ['email', 'Email', Mail]] as [Canal, string, LucideIcon][]).map(([c, l, I]) => {
                    const a = msj.canales.includes(c)
                    return (
                      <button key={c} type="button" aria-pressed={a} onClick={() => toggleCanal(c)} className="rv-chip rv-chip--borde tuc-canal">
                        <I size={14} aria-hidden />{l}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="rv-campo">
              <label htmlFor={`${idPanel}-tx`}>Mensaje</label>
              <textarea id={`${idPanel}-tx`} ref={area} value={msj.texto} onChange={e => onCambio({ texto: e.target.value })} rows={5} maxLength={600} className="rv-textarea" />
            </div>
            <div className="tuc-ayuda" style={{ margin: '8px 0 6px' }}>Tocá una variable para sumarla donde está el cursor:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {VARIABLES.map(n => (
                <button key={n} type="button" onClick={() => insertar(n)} aria-label={`Insertar ${n}`} className="rv-chip rv-chip--borde rv-num">{`{${n}}`}</button>
              ))}
            </div>
            {msj.texto !== original && (
              <button type="button" onClick={() => onCambio({ texto: original })} className="tuc-link" style={{ marginTop: 10 }}>
                <RotateCcw size={12} aria-hidden /> Volver al texto sugerido
              </button>
            )}
          </div>
          <BurbujaWA texto={msj.texto} ejemplo={ejemplo} negocio={negocio} firma={firma} />
        </div>
      )}
    </div>
  )
}

// Pantalla de chat: la forma de un mensaje de WhatsApp (burbuja, hora, tildes)
// con los colores del panel, para que el acento siga siendo uno solo.
function BurbujaWA({ texto, ejemplo, negocio, firma }: { texto: string; ejemplo: Record<string, string>; negocio: string; firma: boolean }) {
  const partes = texto.split(/(\{[a-z]+\})/g)
  return (
    <div aria-label="Vista previa en WhatsApp" role="img" className="tuc-wa">
      <div className="tuc-wa-cab">
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-primary-bg)', color: 'var(--chip-primary-fg)', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>{iniciales(negocio)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{negocio}</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>Cuenta de empresa</div>
        </div>
      </div>
      <div className="tuc-wa-fondo">
        <div className="tuc-wa-burbuja">
          {partes.map((p, i) => {
            const m = /^\{([a-z]+)\}$/.exec(p)
            if (!m) return <span key={i}>{p}</span>
            const val = ejemplo[m[1]]
            return val ? <b key={i} style={{ fontWeight: 600 }}>{val}</b> : <span key={i} style={{ color: 'var(--color-error)' }}>{p}</span>
          })}
          {firma && <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--color-body)' }}>— {negocio}</span>}
          <span className="rv-num" style={{ position: 'absolute', right: 8, bottom: 3, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--color-body)' }}>10:02 <CheckCheck size={13} aria-hidden style={{ color: 'var(--chip-primary-fg)' }} /></span>
        </div>
      </div>
    </div>
  )
}
