// Recordatorios y mensajes: lo que el negocio escribe solo por WhatsApp en
// cuatro momentos (confirmación, recordatorio 24 h antes, seña pendiente,
// agradecimiento). Cada uno se prende o se apaga y su texto se edita con
// llaves ({nombre}, {fecha}…) que se reemplazan con los datos de la reserva;
// la vista previa los muestra con una reserva real de la agenda. El envío es
// simulado: "Mandar una prueba" avisa que en la demo no sale nada.
import { useRef, useState } from 'react'
import { CheckCheck, ChevronDown, RotateCcw, Send } from 'lucide-react'
import { fechaCorta, hhmm } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { Chip, EtiquetaDemo, Seccion, Sigla } from '@/design-system/reservas/piezas'
import { HOY, MENSAJES, TIPOS, VARIABLES_MENSAJE, clientePorId, fechaDeReserva, mensajesDeFabrica, rellenarMensaje, unidadPorId, type Cliente, type InfoMensaje, type MensajeAuto, type NegocioAlquiler, type Reserva, type VariableMensaje } from '../../datos'
import { Guardar } from '../piezas'
import { PaginaForm, igual, type Form } from './comun'

const CSS = `
  .alc-msj { overflow: hidden; }
  .alc-msj[data-on='false'] { opacity: 0.75; }
  .alc-msj-cab { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
  .alc-msj-abrir { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; background: none; border: none; padding: 0; text-align: left; font: inherit; color: inherit; cursor: pointer; min-height: 44px; }
  .alc-msj-abrir:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 4px; border-radius: 6px; }
  .alc-msj-abrir > span:first-child { flex: 1; min-width: 0; }
  .alc-msj-titulo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .alc-msj-ayuda { display: block; font-size: 12.5px; color: var(--color-muted); margin-top: 3px; }
  .alc-msj-flecha { flex-shrink: 0; color: var(--color-muted); transition: transform 220ms ease; }
  .alc-msj[data-abierto='true'] .alc-msj-flecha { transform: rotate(180deg); }
  .alc-msj-cuerpo { border-top: 1px solid var(--color-border); padding: 16px; }
  @media (prefers-reduced-motion: reduce) { .alc-msj-flecha { transition: none; } }
`

export default function Mensajes({ negocio, reservas, clientes, onGuardar, onAviso }: Form & { reservas: Reserva[]; clientes: Cliente[]; onAviso: (titulo: string, detalle?: string) => void }) {
  const [lista, setLista] = useState<MensajeAuto[]>(negocio.mensajes)
  const [abierto, setAbierto] = useState<string | null>('recordatorio')
  const cambiado = !igual(lista, negocio.mensajes)
  const editar = (id: string, c: Partial<MensajeAuto>) => setLista(lista.map(m => (m.id === id ? { ...m, ...c } : m)))
  const fabrica = mensajesDeFabrica(negocio.tipo)
  const prendidos = lista.filter(m => m.on).length

  // La reserva de ejemplo: la próxima confirmada de la agenda (o la primera que haya).
  const ejemplo = reservas.filter(r => r.estado === 'confirmada' && fechaDeReserva(r) >= HOY).sort((a, b) => fechaDeReserva(a).localeCompare(fechaDeReserva(b)))[0] ?? reservas[0]
  const cliente = ejemplo ? clientePorId(ejemplo.clienteId, clientes) : undefined
  const unidad = ejemplo ? unidadPorId(negocio, ejemplo.unidadId) : undefined
  const prop = ejemplo ? negocio.propiedades.find(p => p.id === ejemplo.unidadId) : undefined
  const datos: Record<VariableMensaje, string> = {
    nombre: cliente?.nombre.split(' ')[0] ?? 'Sofía',
    negocio: negocio.nombre,
    unidad: unidad?.nombre ?? TIPOS[negocio.tipo].unidad,
    fecha: ejemplo ? fechaCorta(fechaDeReserva(ejemplo)) : fechaCorta(HOY),
    hora: hhmm(ejemplo?.inicio ?? prop?.checkIn ?? 15 * 60),
    total: pesos(ejemplo?.total ?? 45000),
    sena: pesos(ejemplo?.sena ?? 22500),
    saldo: pesos((ejemplo?.total ?? 45000) - (ejemplo?.sena ?? 22500)),
    link: `orbita.site/${negocio.slug}/r/${(ejemplo?.id ?? 'demo').slice(-4).toUpperCase()}`,
  }

  return (
    <PaginaForm rotulo={TIPOS[negocio.tipo].label} titulo="Recordatorios y mensajes" bajada={`Lo que les llega a tus ${TIPOS[negocio.tipo].clientes === 'eventos' ? 'clientes' : TIPOS[negocio.tipo].clientes} por WhatsApp sin que muevas un dedo. ${prendidos} de ${lista.length} prendidos.`} acciones={<EtiquetaDemo>Demo: no se manda nada</EtiquetaDemo>}>
      <style>{CSS}</style>
      <div className="rv-pila">
        {MENSAJES.map(meta => {
          const m = lista.find(x => x.id === meta.id)
          if (!m) return null
          return <Tarjeta key={meta.id} meta={meta} m={m} abierto={abierto === meta.id} onAbrir={() => setAbierto(a => (a === meta.id ? null : meta.id))} onCambio={c => editar(meta.id, c)} original={fabrica.find(f => f.id === meta.id)?.texto ?? m.texto} datos={datos} negocio={negocio} cliente={cliente} onPrueba={() => onAviso('Prueba enviada', `Demo: no se mandó ningún WhatsApp a ${datos.nombre}.`)} />
        })}
        <Seccion titulo="Llaves" bajada="Se escriben entre llaves y se reemplazan con los datos de cada reserva.">
          <div className="rv-lista">
            {VARIABLES_MENSAJE.map(k => (
              <div key={k} className="rv-item" style={{ padding: '8px 0' }}>
                <span className="rv-num" style={{ width: 110, flexShrink: 0, fontSize: 13, color: 'var(--color-text)' }}>{`{${k}}`}</span>
                <span className="rv-item-cuerpo" style={{ fontSize: 13.5, color: 'var(--color-body)' }}>{datos[k]}</span>
              </div>
            ))}
          </div>
        </Seccion>
      </div>
      <Guardar cambiado={cambiado} onDescartar={() => setLista(negocio.mensajes)} onGuardar={() => onGuardar({ mensajes: lista }, 'Mensajes guardados')} />
    </PaginaForm>
  )
}

function Tarjeta({ meta, m, abierto, onAbrir, onCambio, original, datos, negocio, cliente, onPrueba }: {
  meta: InfoMensaje; m: MensajeAuto; abierto: boolean; onAbrir: () => void; onCambio: (c: Partial<MensajeAuto>) => void
  original: string; datos: Record<VariableMensaje, string>; negocio: NegocioAlquiler; cliente?: Cliente; onPrueba: () => void
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  const idPanel = `alc-msj-${meta.id}`
  // Inserta la llave donde está el cursor (o al final) y deja el cursor después.
  const insertar = (k: string) => {
    const el = area.current
    const token = `{${k}}`
    const ini = el?.selectionStart ?? m.texto.length
    const fin = el?.selectionEnd ?? m.texto.length
    onCambio({ texto: m.texto.slice(0, ini) + token + m.texto.slice(fin) })
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(ini + token.length, ini + token.length) })
  }
  return (
    <div role="group" aria-label={meta.titulo} className="rv-card alc-msj" data-on={m.on} data-abierto={abierto}>
      <div className="alc-msj-cab">
        <button type="button" className="alc-msj-abrir" onClick={onAbrir} aria-expanded={abierto} aria-controls={idPanel}>
          <span>
            <span className="alc-msj-titulo">{meta.titulo} <Chip tono="gris">{meta.cuando}</Chip></span>
            <span className="alc-msj-ayuda">{meta.ayuda}</span>
          </span>
          <ChevronDown size={16} aria-hidden className="alc-msj-flecha" />
        </button>
        <button type="button" role="switch" aria-checked={m.on} aria-label={`Mandar ${meta.titulo.toLowerCase()}`} className="rv-switch" onClick={() => onCambio({ on: !m.on })} />
      </div>
      {abierto && (
        <div id={idPanel} className="alc-msj-cuerpo">
          <div className="alc-mensaje">
            <div className="rv-pila" style={{ gap: 10 }}>
              <div className="rv-campo">
                <label htmlFor={`${idPanel}-tx`}>Mensaje</label>
                <textarea id={`${idPanel}-tx`} ref={area} className="rv-textarea" value={m.texto} onChange={e => onCambio({ texto: e.target.value })} rows={5} maxLength={600} />
                <span className="rv-ayuda">Tocá una llave para sumarla donde está el cursor.</span>
              </div>
              <div className="alc-llaves" role="group" aria-label="Llaves">
                {VARIABLES_MENSAJE.map(k => <button key={k} type="button" className="rv-chip rv-chip--borde" onClick={() => insertar(k)} aria-label={`Insertar ${k}`}>{`{${k}}`}</button>)}
              </div>
              <div className="rv-fila" style={{ gap: 8 }}>
                <button type="button" className="rv-btn rv-btn--sm" onClick={onPrueba}><Send size={14} aria-hidden /> Mandar una prueba</button>
                {m.texto !== original && <button type="button" className="rv-btn rv-btn--sm rv-btn--fantasma" onClick={() => onCambio({ texto: original })}><RotateCcw size={13} aria-hidden /> Volver al texto sugerido</button>}
              </div>
            </div>
            <Vista texto={m.texto} datos={datos} negocio={negocio.nombre} cliente={cliente?.nombre ?? 'Sofía Ramírez'} />
          </div>
        </div>
      )}
    </div>
  )
}

/** Cómo le llega al cliente: una pantalla de chat neutra con los colores del panel. */
function Vista({ texto, datos, negocio, cliente }: { texto: string; datos: Record<VariableMensaje, string>; negocio: string; cliente: string }) {
  const partes = texto.split(/(\{[a-z]+\})/g)
  return (
    <div className="alc-chat" role="img" aria-label={`Vista previa: ${rellenarMensaje(texto, datos)}`}>
      <div className="alc-chat-cab">
        <Sigla nombre={cliente} size={30} />
        <div style={{ minWidth: 0 }}><b>{cliente}</b><small>Así le llega, de parte de {negocio}</small></div>
      </div>
      <div className="alc-chat-fondo">
        <div className="alc-burbuja" aria-hidden>
          {partes.map((p, i) => {
            const k = /^\{([a-z]+)\}$/.exec(p)
            if (!k) return <span key={i}>{p}</span>
            const v = (datos as Record<string, string>)[k[1]]
            return v ? <b key={i}>{v}</b> : <span key={i} style={{ color: 'var(--color-error)' }}>{p}</span>
          })}
          <span>10:02 <CheckCheck size={13} aria-hidden /></span>
        </div>
      </div>
    </div>
  )
}
