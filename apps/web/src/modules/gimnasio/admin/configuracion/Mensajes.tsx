// Recordatorios y mensajes: lo que les llega a los alumnos por WhatsApp en
// cuatro momentos (reserva confirmada, recordatorio, lugar liberado desde la
// lista de espera, plan por vencer). Cada plantilla se prende, se edita con
// variables entre llaves y se ve en una pantalla de chat con los datos de un
// alumno y una clase del negocio. El envío es simulado: no hay backend.
import { useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { BellRing, CalendarCheck, CheckCheck, ChevronDown, Hourglass, RotateCcw, Send, Tag } from 'lucide-react'
import { fechaLarga, hhmm, sumarDias } from '@/lib/reservas/fechas'
import { HOY, MOMENTOS, VARIABLES_MENSAJE, clasesDelDia, estadoPlanDe, mensajesDe, planDe, rubroPorKey, type Momento, type NegocioGym, type Plantilla, type Socio } from '../../datos'
import { Campo, Chip, Encabezado, FilaSwitch, Seccion, Selector, Switch } from '@/design-system/reservas/piezas'
import { BarraGuardar, useBorrador, type PropsConfig } from '../piezas'

interface Meta { titulo: string; ayuda: string; Icon: LucideIcon; cuando?: { id: number; label: string }[] }
const METAS: Record<Momento, Meta> = {
  confirmada: { titulo: 'Reserva confirmada', ayuda: 'Apenas reservan: la clase, la hora y el link para cancelar a tiempo.', Icon: CalendarCheck },
  recordatorio: { titulo: 'Recordatorio de clase', ayuda: 'El que más ausencias evita. Con el link para liberar el lugar si no llega.', Icon: BellRing, cuando: [{ id: 24, label: '24 h antes' }, { id: 12, label: '12 h antes' }, { id: 3, label: '3 h antes' }] },
  lugar: { titulo: 'Se liberó un lugar', ayuda: 'Para quien estaba en lista de espera y pasó a reservado.', Icon: Hourglass },
  vence: { titulo: 'Plan por vencer', ayuda: 'Para que renueve antes de quedarse sin clases.', Icon: Tag, cuando: [{ id: 7, label: '7 días antes' }, { id: 3, label: '3 días antes' }, { id: 1, label: 'El día anterior' }] },
}

const CSS = `
  .gms-msj { overflow: hidden; }
  .gms-msj[data-on='false'] { opacity: 0.75; }
  .gms-cab { display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
  .gms-ico { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-surface-alt); color: var(--color-muted); }
  .gms-msj[data-on='true'] .gms-ico { background: var(--color-primary-bg); color: var(--color-primary); }
  .gms-abrir { flex: 1; min-width: 0; min-height: 44px; display: flex; align-items: center; gap: 8px; padding: 0; border: none; background: none; text-align: left; font: inherit; color: inherit; cursor: pointer; }
  .gms-abrir:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 4px; border-radius: 6px; }
  .gms-titulo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .gms-ayuda { display: block; margin-top: 2px; font-size: 12.5px; color: var(--color-muted); }
  .gms-flecha { color: var(--color-muted); flex-shrink: 0; transition: transform 220ms ease; }
  .gms-abrir[aria-expanded='true'] .gms-flecha { transform: rotate(180deg); }
  .gms-cuerpo { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; padding: 16px; border-top: 1px solid var(--color-border); }
  .gms-vars { display: flex; flex-wrap: wrap; gap: 6px; }
  .gms-vars > button { font-family: var(--rv-mono); font-weight: 500; }
  /* La pantalla de chat: colores de WhatsApp (claro y oscuro), no los del panel: tiene que parecerse a lo que llega al teléfono. */
  .gms-wa { align-self: start; min-width: 0; overflow: hidden; border-radius: 14px; border: 1px solid var(--color-border); }
  .gms-wa-cab { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #F0F2F5; color: #111B21; }
  .gms-wa-cab b { display: block; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gms-wa-cab small { display: block; font-size: 11px; opacity: 0.75; }
  /* El azul 700 (y no --color-primary): con la sigla blanca encima llega a AA. */
  .gms-wa-sigla { width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; background: #1D4ED8; color: #fff; font-size: 11.5px; font-weight: 700; }
  .gms-wa-fondo { min-height: 150px; padding: 16px 12px 18px; background: #EFEAE2; }
  .gms-wa-burbuja { position: relative; max-width: 92%; margin-left: auto; padding: 7px 9px 18px 10px; border-radius: 10px 0 10px 10px; background: #D9FDD3; color: #111B21; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
  .gms-wa-burbuja b { font-weight: 600; }
  .gms-wa-falta { color: #B42318; font-weight: 600; }
  .gms-wa-firma { display: block; margin-top: 6px; font-size: 12px; opacity: 0.7; }
  .gms-wa-hora { position: absolute; right: 8px; bottom: 3px; display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; opacity: 0.65; }
  .dark .gms-wa-cab { background: #202C33; color: #E9EDEF; }
  .dark .gms-wa-fondo { background: #0B141A; }
  .dark .gms-wa-burbuja { background: #005C4B; color: #E9EDEF; }
  .dark .gms-wa-falta { color: #FCA5A5; }
  @media (max-width: 760px) { .gms-cuerpo { grid-template-columns: minmax(0, 1fr); } }
  @media (prefers-reduced-motion: reduce) { .gms-flecha { transition: none; } }
`

/** Los datos con los que se arma la vista previa: un alumno del negocio y una clase de la grilla. */
function ejemploDe(negocio: NegocioGym, socios: Socio[]): Record<string, string> {
  const r = rubroPorKey(negocio.rubro)
  const socio = socios.find(s => estadoPlanDe(s) === 'por-vencer') ?? socios[0]
  // La primera clase del próximo día que abre.
  let fecha = sumarDias(HOY, 1)
  for (let k = 0; k < 7 && clasesDelDia(negocio, fecha).length === 0; k++) fecha = sumarDias(fecha, 1)
  const clase = clasesDelDia(negocio, fecha)[0]
  const plan = socio ? planDe(negocio, socio.planId) : null
  return {
    nombre: socio?.nombre.split(' ')[0] ?? 'Sofía', clase: clase?.actividad?.nombre ?? 'la clase', fecha: fechaLarga(fecha).toLowerCase(), hora: clase ? hhmm(clase.inicio) : '08:30',
    profe: clase?.profe?.nombre ?? r.profe.toLowerCase(), sala: clase?.sala ?? negocio.salas[0] ?? 'la sala', negocio: negocio.nombre,
    plan: plan?.nombre ?? 'tu plan', vence: socio?.vence ? fechaLarga(socio.vence).toLowerCase() : fechaLarga(sumarDias(HOY, 3)).toLowerCase(), link: `${negocio.slug}.orbita.site/mis-clases`,
  }
}

export default function Mensajes({ negocio, socios, onGuardar, onAvisar }: PropsConfig & { socios: Socio[]; onAvisar: (titulo: string, detalle?: string) => void }) {
  const r = rubroPorKey(negocio.rubro)
  const b = useBorrador(negocio.mensajes)
  const v = b.v
  const [abierto, setAbierto] = useState<Momento | null>('recordatorio')
  const setPl = (m: Momento, c: Partial<Plantilla>) => b.set('plantillas', { ...v.plantillas, [m]: { ...v.plantillas[m], ...c } })
  const ejemplo = useMemo(() => ejemploDe(negocio, socios), [negocio, socios])
  const sugeridos = mensajesDe(negocio.telefono).plantillas
  const prendidos = MOMENTOS.filter(m => v.plantillas[m].on).length
  return (
    <div className="rv-pagina rv-pagina--form">
      <style>{CSS}</style>
      <Encabezado rotulo="Reservas" titulo="Recordatorios y mensajes" bajada={`Lo que les llega a tus ${r.socios.toLowerCase()} por WhatsApp sin que muevas un dedo. El recordatorio es el que más ausencias evita.`} />
      <div className="rv-pila">
        <Seccion titulo="Desde dónde salen" bajada="El número de WhatsApp del negocio. Los mensajes se firman con el nombre para que sepan de quién son." acciones={<Chip tono="ok"><CheckCheck size={12} aria-hidden /> Verificado</Chip>}>
          <div className="rv-pila">
            <Campo label="Número de WhatsApp" value={v.numero} onChange={x => b.set('numero', x)} inputMode="tel" />
            <FilaSwitch titulo={`Firmar como ${negocio.nombre}`} ayuda="Al final de cada mensaje." on={v.firma} onChange={x => b.set('firma', x)} />
          </div>
        </Seccion>
        <div className="rv-entre" style={{ marginTop: 6 }}>
          <h2 className="rv-h2">Mensajes automáticos</h2>
          <Chip tono="primario">{prendidos} de {MOMENTOS.length} prendidos</Chip>
        </div>
        {MOMENTOS.map(m => (
          <TarjetaMensaje key={m} id={m} meta={METAS[m]} pl={v.plantillas[m]} abierto={abierto === m} onAbrir={() => setAbierto(a => (a === m ? null : m))}
            onCambio={c => setPl(m, c)} ejemplo={ejemplo} negocio={negocio.nombre} firma={v.firma} sugerido={sugeridos[m].texto}
            onProbar={() => onAvisar('Mensaje de prueba enviado a tu WhatsApp', 'Demo: no se mandó nada.')} />
        ))}
      </div>
      <BarraGuardar cambiado={b.cambiado} onGuardar={() => onGuardar({ mensajes: v }, 'Mensajes guardados', 'Demo: no se envía nada.')} onDescartar={b.descartar} />
    </div>
  )
}

function TarjetaMensaje({ id, meta, pl, abierto, onAbrir, onCambio, ejemplo, negocio, firma, sugerido, onProbar }: {
  id: Momento; meta: Meta; pl: Plantilla; abierto: boolean; onAbrir: () => void; onCambio: (c: Partial<Plantilla>) => void
  ejemplo: Record<string, string>; negocio: string; firma: boolean; sugerido: string; onProbar: () => void
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  const idPanel = `gms-${id}`
  const cuandoLabel = meta.cuando?.find(c => c.id === pl.cuando)?.label
  // Inserta la variable donde está el cursor (o al final) y deja el cursor después.
  const insertar = (nombre: string) => {
    const el = area.current
    const token = `{${nombre}}`
    const ini = el?.selectionStart ?? pl.texto.length
    const fin = el?.selectionEnd ?? pl.texto.length
    onCambio({ texto: pl.texto.slice(0, ini) + token + pl.texto.slice(fin) })
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(ini + token.length, ini + token.length) })
  }
  return (
    <section className="rv-card gms-msj" data-on={pl.on} aria-label={meta.titulo}>
      <div className="gms-cab">
        <span className="gms-ico" aria-hidden><meta.Icon size={17} strokeWidth={1.7} /></span>
        <button type="button" className="gms-abrir" onClick={onAbrir} aria-expanded={abierto} aria-controls={idPanel}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="gms-titulo">{meta.titulo}{cuandoLabel && <Chip tono="gris">{cuandoLabel}</Chip>}</span>
            <span className="gms-ayuda">{meta.ayuda}</span>
          </span>
          <ChevronDown size={16} aria-hidden className="gms-flecha" />
        </button>
        <Switch on={pl.on} onChange={x => onCambio({ on: x })} label={`Enviar ${meta.titulo.toLowerCase()}`} />
      </div>
      {abierto && (
        <div id={idPanel} className="gms-cuerpo">
          <div className="rv-pila" style={{ gap: 12 }}>
            {meta.cuando && <Selector label="Cuándo" valor={pl.cuando} onChange={x => onCambio({ cuando: x })} opciones={meta.cuando} />}
            <div className="rv-campo">
              <label htmlFor={`${idPanel}-tx`}>Mensaje</label>
              <textarea id={`${idPanel}-tx`} ref={area} className="rv-textarea" value={pl.texto} onChange={e => onCambio({ texto: e.target.value })} rows={5} maxLength={600} />
              <span className="rv-ayuda">Tocá una variable para sumarla donde está el cursor.</span>
            </div>
            <div className="gms-vars" role="group" aria-label="Variables">
              {VARIABLES_MENSAJE.map(n => <button key={n} type="button" className="rv-chip rv-chip--borde" onClick={() => insertar(n)} aria-label={`Insertar ${n}`}>{`{${n}}`}</button>)}
            </div>
            <div className="rv-fila" style={{ gap: 8 }}>
              <button type="button" className="rv-btn rv-btn--sm" onClick={onProbar}><Send size={14} aria-hidden /> Enviarme una prueba</button>
              {pl.texto !== sugerido && <button type="button" className="rv-btn rv-btn--sm rv-btn--fantasma" onClick={() => onCambio({ texto: sugerido })}><RotateCcw size={13} aria-hidden /> Volver al texto sugerido</button>}
            </div>
          </div>
          <VistaWhatsApp texto={pl.texto} ejemplo={ejemplo} negocio={negocio} firma={firma} />
        </div>
      )}
    </section>
  )
}

/** Cómo llega al teléfono: las variables con los datos del ejemplo; una que no existe queda marcada. */
function VistaWhatsApp({ texto, ejemplo, negocio, firma }: { texto: string; ejemplo: Record<string, string>; negocio: string; firma: boolean }) {
  const partes = texto.split(/(\{[a-z]+\})/g)
  const sigla = negocio.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
  return (
    <div className="gms-wa" role="img" aria-label={`Vista previa en WhatsApp: ${texto.replace(/\{([a-z]+)\}/g, (_, k: string) => ejemplo[k] ?? `{${k}}`)}`}>
      <div className="gms-wa-cab">
        <span className="gms-wa-sigla" aria-hidden>{sigla}</span>
        <div style={{ minWidth: 0 }}><b>{negocio}</b><small>Cuenta de empresa</small></div>
      </div>
      <div className="gms-wa-fondo">
        <div className="gms-wa-burbuja">
          {partes.map((p, i) => {
            const m = /^\{([a-z]+)\}$/.exec(p)
            if (!m) return <span key={i}>{p}</span>
            const val = ejemplo[m[1]]
            return val ? <b key={i}>{val}</b> : <span key={i} className="gms-wa-falta">{p}</span>
          })}
          {firma && <span className="gms-wa-firma">— {negocio}</span>}
          <span className="gms-wa-hora" aria-hidden>10:40 <CheckCheck size={13} style={{ color: '#53BDEB' }} /></span>
        </div>
      </div>
    </div>
  )
}
