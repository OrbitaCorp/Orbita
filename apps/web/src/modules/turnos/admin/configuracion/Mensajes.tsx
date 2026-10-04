// Recordatorios y mensajes automáticos. Es lo que más valor le da a un
// negocio de turnos (baja las ausencias), así que cada mensaje se puede
// prender, elegir por dónde sale y editar, con una vista previa tipo WhatsApp
// que reemplaza las variables por datos de ejemplo del rubro.
import { useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { MessageCircle, Mail, CalendarCheck, BellRing, Bell, CalendarX2, HeartHandshake, Hourglass, ChevronDown, CheckCheck, RotateCcw } from 'lucide-react'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { recursosDe, CLIENTES } from '@/modules/turnos/datos'
import { useBorrador, Encabezado, SecCard, Switch, Selector, BarraGuardar, Chip, FilaSwitch, Campo, type PropsTab } from './ui'
import { vozDe, iniciales, subdominioDe, type Voz } from './datos'

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

export default function Mensajes({ rubro, avisar }: PropsTab) {
  const voz = vozDe(rubro)
  const lista = metas(voz).filter(m => m.id !== 'espera' || rubro.modo === 'cupo' || rubro.modo === 'cancha' || rubro.modo === 'profesional')
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
  const v = b.valor
  const [abierto, setAbierto] = useState<string | null>('recordatorio')
  const setMsj = (id: string, m: Partial<Mensaje>) => b.set('mensajes', v.mensajes.map(x => x.id === id ? { ...x, ...m } : x))

  const quien = rubro.modo === 'profesional' ? recursosDe(rubro)[0].nombre : rubro.modo === 'cupo' ? 'Caro' : recursosDe(rubro)[0].nombre
  const ejemplo: Record<string, string> = {
    nombre: CLIENTES[0].nombre.split(' ')[0], servicio: rubro.servicios[0].nombre.toLowerCase(), fecha: 'sábado 27/09', hora: '15:30',
    profesional: quien, negocio: t.nombre, link: `${subdominioDe(t.nombre)}.orbita.site/t/8KQ2`,
  }
  const activos = v.mensajes.filter(m => m.on).length

  return (
    <div className="panel-page panel-page--form">
      <Encabezado rotulo="Tu negocio" titulo="Recordatorios y mensajes" bajada={`Lo que les llega a tus ${voz.clientes} sin que muevas un dedo. Los recordatorios ayudan a que no se olviden del turno.`} />

      <div className="tuc-pila">
        <SecCard titulo="Canales" Icon={MessageCircle} bajada="Por dónde salen los mensajes. Cada mensaje elige después sus canales.">
          <FilaSwitch Icon={MessageCircle} titulo="WhatsApp" ayuda="Desde el número de tu negocio. Es el que más se lee." on={v.wa} onChange={x => b.set('wa', x)}>
            <Campo label="Número que envía" value={v.numero} onChange={x => b.set('numero', x)} prefijo="+54" mono sufijo={<Chip tono="ok">Verificado</Chip>} style={{ marginBottom: 0, maxWidth: 380 }} />
          </FilaSwitch>
          <FilaSwitch Icon={Mail} titulo="Email" ayuda="Con tu logo y los colores de tu sitio. Sirve de respaldo." on={v.email} onChange={x => b.set('email', x)} />
          <FilaSwitch titulo={`Firmar con el nombre de ${t.nombre}`} ayuda="Al final de cada mensaje, para que sepan de quién es." on={v.firma} onChange={x => b.set('firma', x)} />
        </SecCard>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 2px 0' }}>
          <h2 className="tuo-h2" style={{ flex: 1 }}>Mensajes automáticos</h2>
          <Chip tono="primario"><span className="tuo-num">{activos}/{v.mensajes.length}</span> prendidos</Chip>
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

      <BarraGuardar dirty={b.dirty} onDescartar={b.descartar} onGuardar={() => { b.guardar(); avisar('Mensajes guardados', 'Es una demo: no se envía nada.') }} />
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
    <div role="group" aria-label={meta.titulo} className="tuo-card tuc-msj" data-on={msj.on} data-abierto={abierto}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
        <span aria-hidden className="tuc-msj-ico"><meta.Icon size={17} strokeWidth={1.7} /></span>
        <button type="button" onClick={onAbrir} aria-expanded={abierto} aria-controls={idPanel} className="tuc-msj-cab"
          style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
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
        <div id={idPanel} className="tuc-msj-cuerpo" style={{ borderTop: '1px solid var(--color-border)', padding: 16, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 18 }}>
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
                      <button key={c} type="button" aria-pressed={a} onClick={() => toggleCanal(c)} className="tuc-pastilla" style={{ minHeight: 42 }}>
                        <I size={14} aria-hidden />{l}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <label htmlFor={`${idPanel}-tx`} className="tuc-rotulo" style={{ marginBottom: 8 }}>Mensaje</label>
            <textarea id={`${idPanel}-tx`} ref={area} value={msj.texto} onChange={e => onCambio({ texto: e.target.value })} rows={5} maxLength={600} className="tuc-field" />
            <div style={{ fontSize: 12, color: 'var(--color-muted)', margin: '8px 0 6px' }}>Tocá una variable para sumarla donde está el cursor:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {VARIABLES.map(n => (
                <button key={n} type="button" onClick={() => insertar(n)} aria-label={`Insertar ${n}`} className="tuc-pastilla tuc-pastilla--mono">{`{${n}}`}</button>
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

// Pantalla de chat estilo WhatsApp. Sus colores son los de WhatsApp (claro y
// oscuro) y no los del panel: tiene que parecerse a lo que llega al teléfono.
function BurbujaWA({ texto, ejemplo, negocio, firma }: { texto: string; ejemplo: Record<string, string>; negocio: string; firma: boolean }) {
  const partes = texto.split(/(\{[a-z]+\})/g)
  return (
    <div aria-label="Vista previa en WhatsApp" role="img" className="tuc-wa" style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: '0 18px 40px -24px rgba(15,23,42,0.45)', display: 'flex', flexDirection: 'column', minWidth: 0, alignSelf: 'start' }}>
      <div className="tuc-wa-cab" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-on-primary)', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>{iniciales(negocio)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{negocio}</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>Cuenta de empresa</div>
        </div>
      </div>
      <div className="tuc-wa-fondo" style={{ padding: '16px 12px 18px', minHeight: 150 }}>
        <div className="tuc-wa-burbuja" style={{ position: 'relative', maxWidth: '92%', marginLeft: 'auto', padding: '7px 9px 18px 10px', borderRadius: '10px 0 10px 10px', fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', boxShadow: '0 1px 1px rgba(0,0,0,.12)' }}>
          {partes.map((p, i) => {
            const m = /^\{([a-z]+)\}$/.exec(p)
            if (!m) return <span key={i}>{p}</span>
            const val = ejemplo[m[1]]
            return val ? <b key={i} style={{ fontWeight: 600 }}>{val}</b> : <span key={i} style={{ color: '#E11D48' }}>{p}</span>
          })}
          {firma && <span style={{ display: 'block', marginTop: 6, opacity: 0.7, fontSize: 12 }}>— {negocio}</span>}
          <span style={{ position: 'absolute', right: 8, bottom: 3, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, opacity: 0.65 }}>10:02 <CheckCheck size={13} aria-hidden style={{ color: '#53BDEB', opacity: 1 }} /></span>
        </div>
      </div>
    </div>
  )
}

export const CSS_MENSAJES = `
  .tuc-msj { overflow: hidden; transition: border-color 180ms ease, box-shadow 240ms ease, opacity 200ms ease; }
  .tuc-msj[data-on='false'] { opacity: 0.8; }
  .tuc-msj[data-abierto='true'] { border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border)); box-shadow: var(--shadow-card-hover); }
  .tuc-msj-ico { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; flex-shrink: 0; background: var(--color-surface-alt); color: var(--color-subtle); transition: background 200ms ease, color 200ms ease; }
  .tuc-msj[data-on='true'] .tuc-msj-ico { background: var(--tuo-grad-suave); color: var(--color-primary); }
  .tuc-msj-flecha { color: var(--color-muted); flex-shrink: 0; transition: transform 240ms var(--tuo-ease, ease), color 150ms ease; }
  .tuc-msj[data-abierto='true'] .tuc-msj-flecha { transform: rotate(180deg); color: var(--color-primary); }
  .tuc-msj-cab { min-height: 44px; }
  .tuc-msj-cuerpo { animation: tucAbre 280ms var(--tuo-ease, ease) both; }
  @media (hover: hover) {
    .tuc-msj:hover { border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border)); }
    .tuc-msj-cab:hover .tuc-msj-flecha { color: var(--color-text); }
  }
  @media (prefers-reduced-motion: reduce) { .tuc-msj-cuerpo { animation: none; } .tuc-msj-flecha { transition: none; } }
  .tuc-wa-cab { background: #F0F2F5; color: #111B21; }
  .tuc-wa-fondo { background: #EFEAE2; background-image: radial-gradient(rgba(0,0,0,.045) 1px, transparent 1px); background-size: 14px 14px; }
  .tuc-wa-burbuja { background: #D9FDD3; color: #111B21; }
  .dark .tuc-wa-cab { background: #202C33; color: #E9EDEF; }
  .dark .tuc-wa-fondo { background-color: #0B141A; background-image: radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px); }
  .dark .tuc-wa-burbuja { background: #005C4B; color: #E9EDEF; }
  .tuc-msj-cab:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 4px; border-radius: 6px; }
  @media (max-width: 760px) { .tuc-msj-cuerpo { grid-template-columns: minmax(0, 1fr) !important; } }
`
