import { memo, useState } from 'react'
import { ArrowRight, Ban, Check, ChevronDown, ChevronRight, CircleCheck, CircleHelp, CircleX, Clock, Copy, LoaderCircle, RotateCw } from 'lucide-react'
import { OrbiPet } from '@/components/orbi/pet/OrbiPet'
import { cleanToolLeaks, esTarjetaDeAccion, muestraNoLlegueAResponder } from '@/components/orbi/sesionOrbi'
import { useOrbiChat } from '@/components/orbi/useOrbiChat'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'
import type { OrbiAction, OrbiMessage } from '@/components/orbi/types'
import { Markdown } from '../markdown/Markdown'
import { destinosDe, duracion, esConsulta, filaDe, resumenPlegado, vistaDeTarjeta, type TonoDeTarjeta } from '../estado/actividad'
import { useAhora, useOrbiV2Contexto } from './contexto'
import s from '../orbi.module.css'

export function BurbujaPersona({ texto }: { texto: string }) {
  return <div className={s.burbujaPersona}>{texto}</div>
}

function FilaActividad({ accion, ahora }: { accion: OrbiAction; ahora: number }) {
  const f = filaDe(accion, ahora)
  const Icono = f.estado === 'en_curso' ? LoaderCircle : f.estado === 'ok' ? CircleCheck : CircleX
  return (
    <div className={s.actividad} data-estado={f.estado}>
      <span className={s.actividadIcono} data-estado={f.estado} aria-hidden><Icono size={16} strokeWidth={1.75} /></span>
      <div className={s.actividadTexto}>
        <b>{f.etiqueta}</b>
        {f.estado === 'en_curso' ? <i>…</i> : f.resumen ? <i> · {f.resumen}</i> : null}
      </div>
      {f.ms !== undefined && <span className={s.actividadTiempo}>{duracion(f.ms)}</span>}
    </div>
  )
}

const ICONO_DEL_TONO: Record<TonoDeTarjeta, typeof Check> = { espera: Clock, ok: Check, neutro: Ban, error: CircleX, duda: CircleHelp }

/**
 * La tarjeta de aprobación (A3·3). Nada cambia hasta que la persona confirma;
 * confirmar y cancelar usan el mismo camino que el chat de hoy (useOrbiChat).
 */
function TarjetaDeAprobacion({ accion, mensajeId, ahora }: { accion: OrbiAction; mensajeId: string; ahora: number }) {
  const { confirmarAccion, rechazarAccion } = useOrbiChat()
  const isStreaming = useOrbiStore(st => st.isStreaming)
  const [ocupado, setOcupado] = useState(false)
  const v = vistaDeTarjeta(accion, ahora)
  // Mientras Orbi responde no se confirma nada: la nota de "confirmó" que
  // escribe el servidor caería en el medio de la respuesta en curso.
  const apagado = ocupado || isStreaming
  const Icono = v.chip === 'Venció' ? Clock : ICONO_DEL_TONO[v.tono]

  const ejecutar = async (accionDelBoton: typeof confirmarAccion) => {
    if (apagado || !accion.actionId) return
    setOcupado(true)
    try { await accionDelBoton(mensajeId, accion.id, accion.actionId, accion.tool) } finally { setOcupado(false) }
  }

  return (
    <div className={s.tarjeta} data-atenuada={v.atenuada}>
      <div className={s.tarjetaCuerpo}>
        <div className={s.tarjetaArriba}>
          <span className={s.chip} data-tono={v.tono} role="status">
            {accion.status === 'active' ? <LoaderCircle aria-hidden className={s.actividadIcono} data-estado="en_curso" /> : <Icono aria-hidden strokeWidth={2.25} />}
            {v.chip}
          </span>
          {v.hora && <span className={s.hora}>{v.hora}</span>}
        </div>
        <div className={s.tarjetaResumen}>{accion.resumen ?? accion.label}</div>
        {accion.nota && <div className={s.tarjetaNota}>{accion.nota}</div>}
      </div>
      {v.confirmable && (
        <div className={s.tarjetaBotones}>
          <button type="button" className={`${s.boton} ${s.botonPrincipal} ${s.foco}`} disabled={apagado} onClick={() => ejecutar(confirmarAccion)}>
            <Check aria-hidden strokeWidth={2.25} />Confirmar
          </button>
          <button type="button" className={`${s.boton} ${s.botonSecundario} ${s.foco}`} disabled={apagado} onClick={() => ejecutar(rechazarAccion)}>
            Cancelar
          </button>
        </div>
      )}
      {v.reintentable && (
        <div className={s.tarjetaBotones}>
          <button type="button" className={`${s.boton} ${s.botonSecundario} ${s.foco}`} disabled={apagado} onClick={() => ejecutar(confirmarAccion)}>
            <RotateCw aria-hidden />Reintentar
          </button>
        </div>
      )}
      {v.pie && !v.confirmable && <div className={s.tarjetaPie}><span>{v.pie}</span></div>}
      {v.confirmable && isStreaming && <div className={s.tarjetaPie}><span>Esperá a que Orbi termine de responder</span></div>}
    </div>
  )
}

const FALLA_PASAJERA = /^(Orbi tuvo un problema para responder|Error de conexión|No pude responder ahora)/

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      className={`${s.accionChica} ${s.foco}`}
      onClick={() => {
        void navigator.clipboard?.writeText(texto).then(() => {
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1500)
        }).catch(() => undefined)
      }}
    >
      {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}{copiado ? 'Copiado' : 'Copiar'}
    </button>
  )
}

/**
 * Un mensaje de Orbi por partes (A3): actividad, tarjetas, respuesta y los
 * botones de ir a otra pantalla. Mientras trabaja se ve todo en vivo; al
 * terminar, la actividad se pliega en "Revisó N cosas".
 */
export const MensajeDeOrbi = memo(function MensajeDeOrbi({ msg, enVivo, onReintentar }: { msg: OrbiMessage; enVivo: boolean; onReintentar?: () => void }) {
  const { navegar } = useOrbiV2Contexto()
  const [abierto, setAbierto] = useState(false)
  const acciones = msg.actions ?? []
  const consultas = acciones.filter(esConsulta)
  const tarjetas = acciones.filter(esTarjetaDeAccion)
  const enCurso = consultas.some(a => a.status === 'active')
  const porVencer = tarjetas.some(a => a.status === 'pending')
  const ahora = useAhora(enCurso ? 200 : 30_000, enCurso || porVencer)
  const contenido = cleanToolLeaks(msg.content)
  const plegado = resumenPlegado(acciones)
  const destinos = destinosDe(acciones)
  const fallaPasajera = !enVivo && FALLA_PASAJERA.test(contenido)
  // Mientras trabaja, la actividad se ve abierta; al terminar se pliega sola.
  const verActividad = enVivo || abierto

  return (
    <article className={`${s.mensajeOrbi}`} aria-label="Respuesta de Orbi">
      <div className={s.autor}><OrbiPet size={28} animated={false} />Orbi</div>

      {consultas.length > 0 && !enVivo && plegado && (
        <button type="button" className={`${s.plegado} ${s.foco}`} aria-expanded={abierto} onClick={() => setAbierto(a => !a)}>
          {abierto ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
          {plegado.texto}{plegado.tiempo && <> · <span className={s.mono} style={{ fontSize: 12 }}>{plegado.tiempo}</span></>}
        </button>
      )}
      {consultas.length > 0 && verActividad && (
        <div className={enVivo ? undefined : s.desplegado} style={enVivo ? { display: 'flex', flexDirection: 'column', gap: 8 } : undefined}>
          {consultas.map(a => <FilaActividad key={a.id} accion={a} ahora={ahora} />)}
        </div>
      )}
      {enVivo && !contenido && !enCurso && (
        <div className={s.pensamiento}>{consultas.length ? 'Armando la respuesta' : 'Pensando'}<span className={s.cursorFino} aria-hidden /></div>
      )}

      {tarjetas.map(a => <TarjetaDeAprobacion key={a.id} accion={a} mensajeId={msg.id} ahora={ahora} />)}

      {contenido && <Markdown texto={contenido} enVivo={enVivo} onLink={navegar} />}
      {!enVivo && !contenido && muestraNoLlegueAResponder({ ...msg, content: contenido }) && (
        <div className={s.pensamiento}>No llegué a responder.</div>
      )}
      {msg.detenido && <span className={s.avisoChico}>Detenido</span>}

      {!enVivo && destinos.length > 0 && (
        <div className={s.destinos}>
          {destinos.map(d => (
            <button key={d.id} type="button" className={`${s.irA} ${s.foco}`} onClick={() => navegar(d.path)}>
              {d.label}<ArrowRight aria-hidden />
            </button>
          ))}
        </div>
      )}

      {!enVivo && (contenido || fallaPasajera) && (
        <div className={s.accionesMensaje} data-siempre={fallaPasajera || undefined}>
          {fallaPasajera && onReintentar
            ? <button type="button" className={`${s.accionChica} ${s.foco}`} onClick={onReintentar}><RotateCw aria-hidden />Reintentar</button>
            : <BotonCopiar texto={contenido} />}
        </div>
      )}
    </article>
  )
})
