import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { OrbiPet } from '@/components/orbi/pet/OrbiPet'
import { usePetEstado } from '@/components/orbi/pet/usePetEstado'
import { OrbiAvisoMantenimiento } from '@/components/orbi/OrbiAvisoMantenimiento'
import { useOrbiChat } from '@/components/orbi/useOrbiChat'
import { useOrbiContext } from '@/components/orbi/useOrbiContext'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'
import { PLACEHOLDER_EN_MANTENIMIENTO } from '@/components/orbi/types'
import { useAuth } from '@/hooks/useAuth'
import { esVisitanteDemo } from '@/lib/demo/modo'
import { Caja } from '../piezas/Caja'
import { Encabezado } from '../piezas/Encabezado'
import { BurbujaPersona, MensajeDeOrbi } from '../piezas/Mensaje'
import { useOrbiV2Contexto } from '../piezas/contexto'
import { promptsSugeridos } from '../piezas/promptsSugeridos'
import { claveDeBorrador, tituloProvisorio, useOrbiV2 } from '../estado/useOrbiV2'
import { NOMBRE_DE_SECCION } from '../estado/actividad'
import { nuevaSesion } from '../estado/sesiones'
import s from '../orbi.module.css'

const CERCA_DEL_FINAL_PX = 80
/** Tocar a la mascota le hace cosquillas; no hay nada más que avisar. */
const sinAviso = () => {}

/** Lo de adentro del chat: lo mismo en las cuatro vistas. */
export function OrbiChat({ onExpandir, onSalir, onPestana, onCerrar, onAbrirManual, onUsoDelEquipo, conSelector = true }: {
  onExpandir?: () => void
  /** En la página de Orbi: volver a la pantalla de antes, con Orbi al costado. */
  onSalir?: () => void
  onPestana?: () => void
  onCerrar?: () => void
  onAbrirManual?: () => void
  /** En la página de Orbi angosta: "Uso del equipo" en el selector (dueño o administrador). */
  onUsoDelEquipo?: () => void
  conSelector?: boolean
}) {
  const { vista, anunciar } = useOrbiV2Contexto()
  const messages = useOrbiStore(st => st.messages)
  const isStreaming = useOrbiStore(st => st.isStreaming)
  const conversationId = useOrbiStore(st => st.conversationId)
  const mantenimiento = useOrbiStore(st => st.mantenimiento)
  const abortar = useOrbiStore(st => st.abortar)
  const estadoPet = usePetEstado()
  const { send } = useOrbiChat()
  const contexto = useOrbiContext()
  const { user } = useAuth()
  const rol = user?.type === 'member' ? user.role : undefined

  const clave = claveDeBorrador(conversationId)
  const borrador = useOrbiV2(st => st.borradores[clave] ?? '')
  const setBorrador = useOrbiV2(st => st.setBorrador)
  const titulo = useOrbiV2(st => st.titulo)
  const setTitulo = useOrbiV2(st => st.setTitulo)
  // La pantalla donde la persona sacó el chip de contexto: al cambiar de
  // pantalla vuelve solo (el chip dice dónde estás ahora).
  const [sinContextoEn, setSinContextoEn] = useState<string | undefined | null>(null)
  const conContexto = sinContextoEn !== contexto.section

  const pantalla = contexto.section
  const nombrePantalla = pantalla && pantalla !== 'orbi' ? NOMBRE_DE_SECCION[pantalla] : undefined
  const sugerencias = useMemo(() => promptsSugeridos(pantalla, rol, contexto.permissions), [pantalla, rol, contexto.permissions])

  const enviar = useCallback((texto: string) => {
    if (!titulo && !messages.length) setTitulo(tituloProvisorio(texto))
    setBorrador(clave, '')
    const ctx = conContexto && nombrePantalla ? contexto : { ...contexto, section: undefined }
    void send(texto, ctx)
  }, [titulo, messages.length, setTitulo, setBorrador, clave, conContexto, nombrePantalla, contexto, send])

  const reintentar = useCallback(() => {
    const ultimaPregunta = [...messages].reverse().find(m => m.role === 'user')
    if (ultimaPregunta) enviar(ultimaPregunta.content)
  }, [messages, enviar])

  // ── Scroll: pegado al final mientras la persona está ahí; si subió a leer, no se la mueve.
  // `lejosEn`: la sesión en la que la persona subió a leer. Otra sesión
  // arranca pegada al final sin tener que resetear nada.
  const historial = useRef<HTMLDivElement>(null)
  const [lejosEn, setLejosEn] = useState<string | null>(null)
  const cerca = lejosEn !== clave
  const alScroll = () => {
    const el = historial.current
    if (!el) return
    const lejos = el.scrollHeight - el.scrollTop - el.clientHeight >= CERCA_DEL_FINAL_PX
    setLejosEn(lejos ? clave : null)
  }
  const alFinal = useCallback((suave: boolean) => {
    const el = historial.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: suave ? 'smooth' : 'auto' })
  }, [])
  useLayoutEffect(() => { if (cerca) alFinal(false) }, [messages, cerca, alFinal])

  // ── Lector de pantalla: estados, no tokens.
  const antes = useRef({ streaming: false, pendientes: 0 })
  const pendientes = messages.reduce((n, m) => n + (m.actions?.filter(a => a.status === 'pending' && a.actionId).length ?? 0), 0)
  useEffect(() => {
    if (isStreaming && !antes.current.streaming) anunciar('Orbi está respondiendo')
    if (!isStreaming && antes.current.streaming) {
      const ultimo = messages[messages.length - 1]
      anunciar(ultimo?.detenido ? 'Se detuvo' : 'Respuesta lista')
    }
    if (pendientes > antes.current.pendientes) anunciar('Orbi necesita tu aprobación')
    antes.current = { streaming: isStreaming, pendientes }
  }, [isStreaming, pendientes, messages, anunciar])

  const visibles = messages.filter(m => m.role !== 'divider')

  return (
    <>
      <Encabezado
        onNueva={() => { nuevaSesion(); anunciar('Conversación nueva') }}
        onExpandir={onExpandir}
        onSalir={onSalir}
        onPestana={onPestana}
        onCerrar={onCerrar}
        onUsoDelEquipo={onUsoDelEquipo}
        conSelector={conSelector}
      />

      {visibles.length === 0 ? (
        <div className={s.vacio}>
          <OrbiPet size={72} estado={estadoPet} onCosquillas={sinAviso} />
          <h2>Hola, soy Orbi</h2>
          <p>Preguntame cómo se hace algo en el panel o pedime datos de tu tienda. Si te propongo un cambio, no pasa nada hasta que lo confirmes.</p>
          {!mantenimiento && sugerencias.length > 0 && (
            <div className={s.sugerencias} role="list" aria-label="Sugerencias">
              {sugerencias.map(t => (
                <button key={t} type="button" role="listitem" className={`${s.sugerencia} ${s.foco}`} onClick={() => setBorrador(clave, t)}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div ref={historial} className={s.historial} onScroll={alScroll} role="log" aria-label="Conversación con Orbi">
          <div className={s.lectura}>
            {visibles.map((m, i) => m.role === 'user'
              ? <BurbujaPersona key={m.id} texto={m.content} />
              : <MensajeDeOrbi key={m.id} msg={m} enVivo={isStreaming && i === visibles.length - 1} onReintentar={i === visibles.length - 1 ? reintentar : undefined} />)}
          </div>
        </div>
      )}

      {!cerca && visibles.length > 0 && (
        <button type="button" className={`${s.alFinal} ${s.foco}`} onClick={() => { setLejosEn(null); alFinal(true) }}>
          <ArrowDown aria-hidden />{isStreaming ? 'Orbi sigue escribiendo' : 'Ir al final'}
        </button>
      )}

      <div className={s.pie}>
        <div className={s.pieLectura}>
          {mantenimiento && <OrbiAvisoMantenimiento mensaje={mantenimiento} onAbrirManual={onAbrirManual} />}
          <Caja
            texto={borrador}
            onTexto={t => setBorrador(clave, t)}
            onEnviar={enviar}
            onDetener={abortar}
            enVivo={isStreaming}
            deshabilitado={mantenimiento !== null}
            placeholder={mantenimiento ? PLACEHOLDER_EN_MANTENIMIENTO : undefined}
            contexto={conContexto ? nombrePantalla : undefined}
            onQuitarContexto={() => setSinContextoEn(contexto.section)}
            enfocar={vista !== 'hoja'}
            // En la demo las conversaciones no se guardan: la línea sería falsa.
            conAviso={!esVisitanteDemo()}
          />
        </div>
      </div>
    </>
  )
}
