import { useRef, useEffect, useState, type ReactNode } from 'react'
import { ThumbsUp, ThumbsDown, Check, CircleAlert, CircleHelp, Loader2, RotateCw, X } from 'lucide-react'
import { useOrbiStore } from './useOrbiStore'
import { votarRespuestaOrbi } from '@/lib/analytics/wizardTracker'
import { OrbiIcon } from './OrbiIcon'
import { OrbiPet } from './pet/OrbiPet'
import { OrbiPetSay } from './pet/OrbiPetSay'
import { petModulo, PET_COSQUILLAS } from './pet/petModulos'
import { useEsPanel, useModuloPet } from './pet/useModuloPet'
import { OrbiNavigateButton } from './OrbiNavigateButton'
import { useOrbiChat } from './useOrbiChat'
import type { OrbiAction, OrbiMessage } from './types'
import { esNavegacion, esSeleccionDelWizard, esTarjetaDeAccion, muestraNoLlegueAResponder } from './sesionOrbi'

// El modelo de 20B a veces escribe la sintaxis del tool call como texto plano
// además de llamar la herramienta real (ej: "selectWizardOption({ key: ... })").
// Lo limpiamos en el render para que el usuario no vea código.
function cleanToolLeaks(text: string): string {
  return text
    .replace(/\b[a-z][a-zA-Z]*\(\s*\{[\s\S]*?\}\s*\)/g, '')
    .replace(/```(?:json)?\s*\{[^`]*\}\s*```/g, '')
    .replace(/\{\{[a-zA-Z]+[^}]*\}\}/g, '')
    .replace(/<[a-z][a-zA-Z]*\s[^>]*>[\s\S]*?<\/[a-z][a-zA-Z]*>/gi, '')
    .replace(/<\/?[a-z][a-zA-Z]*(?:[:\s][^>]*)?\/?>/gi, '')
    .replace(/\n?\s*\{[^{}]*"?(?:key|label|field|value|rubro|keywords|businessName)"?[^{}]*\}/g, '')
    .replace(/\[(?:Seleccionar|Elegir|Select)[^\]]*\]/gi, '')
    .replace(/\b(?:selectWizardOption|fillWizardField|suggestBusinessName|suggestDescription)\s*\n(?:[a-z]\w*:\s*[^\n]+\n?)+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Orbi escribe **negrita** en markdown para destacar (nombre sugerido,
// próximo paso, etc.). No sumamos una librería de markdown entera por esto:
// alcanza con reconocer el patrón y devolver <strong> reales.
function renderTextoConNegrita(texto: string): ReactNode {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g)
  if (partes.length === 1) return texto
  return partes.map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**')
      ? <strong key={i}>{parte.slice(2, -2)}</strong>
      : parte
  )
}

function OrbiSelectButton({ optionKey, label }: { optionKey: string; label: string }) {
  const [applied, setApplied] = useState(false)

  return (
    <button
      onClick={() => {
        window.dispatchEvent(new CustomEvent('orbi:select-option', { detail: { key: optionKey } }))
        setApplied(true)
      }}
      disabled={applied}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', marginTop: 4,
        borderRadius: 10,
        border: applied ? '1.5px solid #3B82F6' : '1.5px solid transparent',
        background: applied ? 'rgba(59,130,246,0.10)' : 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
        color: applied ? '#3B82F6' : 'white',
        fontSize: 13, fontWeight: 600,
        cursor: applied ? 'default' : 'pointer',
        transition: 'all 150ms',
      }}
    >
      {applied ? '✓' : '→'} {applied ? `${label} seleccionado` : `Elegir ${label}`}
    </button>
  )
}

/**
 * Botón de confirmar una acción que Orbi propuso pero NO ejecutó.
 *
 * Las herramientas que escriben en la base del negocio — crear un cupón,
 * cambiar el estado de un pedido, tocar la configuración — no corren solas:
 * llegan hasta acá como una propuesta y ocurren cuando el dueño aprieta.
 *
 * No es una molestia de más, es la defensa. El texto que escriben los clientes
 * de la tienda (el nombre en un pedido, el motivo de una cancelación) vuelve al
 * contexto del modelo cuando alguien pregunta "mostrame los pedidos de hoy", y
 * ahí adentro puede venir algo que lo convenza de pedir un cupón del 100%.
 * Puede pedirlo; no puede apretar este botón.
 */
function OrbiConfirmButton({ accion, mensajeId }: { accion: OrbiAction; mensajeId: string }) {
  const { confirmarAccion, rechazarAccion } = useOrbiChat()
  const isStreaming = useOrbiStore(s => s.isStreaming)
  // Entre el clic y la respuesta: evita el doble clic. El estado de verdad
  // (active, complete…) vive en el store y lo cambia useOrbiChat.
  const [ocupado, setOcupado] = useState(false)

  // Confirmar y Cancelar quedan apagados en TODAS las tarjetas mientras Orbi
  // responde: la nota de "confirmó" o "canceló" que escribe el servidor en la
  // conversación caería entre la pregunta y la respuesta en curso.
  const apagado = ocupado || isStreaming

  const ejecutar = async (accionDelBoton: typeof confirmarAccion) => {
    if (apagado || !accion.actionId) return
    setOcupado(true)
    try {
      await accionDelBoton(mensajeId, accion.id, accion.actionId, accion.tool)
    } finally {
      setOcupado(false)
    }
  }

  const estado = accion.status

  return (
    <div style={{
      marginTop: 8, padding: '12px 14px',
      borderRadius: 12,
      border: '1.5px solid var(--color-border)',
      background: 'var(--color-surface)',
      maxWidth: '85%',
    }}>
      <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.45 }}>
        {accion.resumen ?? accion.label}
      </div>

      {/* La línea de estado se anuncia sola al lector de pantalla cuando
          cambia (Aplicando → Listo), sin mover el foco. */}
      <div role="status" aria-live="polite" style={{ marginTop: 8 }}>
        {accion.nota && (
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4 }}>
            {accion.nota}
          </div>
        )}
        <EstadoDeLaTarjeta accion={accion} />
      </div>

      {estado === 'pending' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <BotonTarjeta principal onClick={() => ejecutar(confirmarAccion)} disabled={apagado}>
            Confirmar
          </BotonTarjeta>
          <BotonTarjeta onClick={() => ejecutar(rechazarAccion)} disabled={apagado}>
            Cancelar
          </BotonTarjeta>
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {isStreaming ? 'Esperá a que Orbi termine de responder' : 'No se hizo nada todavía'}
          </span>
        </div>
      )}

      {estado === 'unknown' && (
        <div style={{ marginTop: 10 }}>
          {/* Reintenta el MISMO actionId: confirmar es idempotente en el
              servidor, así que nunca crea la acción dos veces. */}
          <BotonTarjeta onClick={() => ejecutar(confirmarAccion)} disabled={apagado}>
            <RotateCw size={14} strokeWidth={2} aria-hidden />
            Reintentar
          </BotonTarjeta>
        </div>
      )}
    </div>
  )
}

// Qué dice la tarjeta en cada estado (tabla de §3.9 del spec). Ícono y texto
// juntos: el color solo nunca es lo único que cuenta qué pasó.
function EstadoDeLaTarjeta({ accion }: { accion: OrbiAction }) {
  const fila = (icono: ReactNode, titulo: string, color: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color }}>
      {icono}
      {titulo}
    </div>
  )
  const detalle = accion.result ? (
    <div style={{ fontSize: 12, color: 'var(--color-body)', marginTop: 2, lineHeight: 1.45 }}>{accion.result}</div>
  ) : null

  switch (accion.status) {
    case 'pending':
      return null
    case 'active':
      return fila(<Loader2 size={14} strokeWidth={2} aria-hidden className="orbi-girando" />, 'Aplicando…', 'var(--color-muted)')
    case 'complete':
      return <>{fila(<Check size={14} strokeWidth={2.5} aria-hidden />, 'Listo', 'var(--chip-success-fg)')}{detalle}</>
    case 'error':
      return <>{fila(<CircleAlert size={14} strokeWidth={2} aria-hidden />, accion.titulo ?? 'No se pudo', 'var(--chip-error-fg)')}{detalle}</>
    case 'rejected':
      return fila(<X size={14} strokeWidth={2} aria-hidden />, 'Cancelado', 'var(--color-muted)')
    case 'unknown':
      return <>{fila(<CircleHelp size={14} strokeWidth={2} aria-hidden />, 'No sé si se aplicó', 'var(--chip-warning-fg)')}{detalle}</>
  }
}

// Botón de la tarjeta: con texto, 44 px de alto (área táctil) y foco visible
// (.orbi-foco en globals.css). El principal usa el primario del tema.
function BotonTarjeta({ principal, disabled, onClick, children }: {
  principal?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="orbi-foco"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        minHeight: 44, padding: '0 16px', borderRadius: 10,
        font: 'inherit', fontSize: 13, fontWeight: 600,
        border: principal ? '1.5px solid transparent' : '1.5px solid var(--color-border-strong)',
        background: principal ? 'var(--color-primary)' : 'var(--color-bg)',
        color: principal ? 'var(--color-on-primary)' : 'var(--color-text)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'opacity 150ms, background-color 150ms',
      }}
    >
      {children}
    </button>
  )
}

// Solo aparece en el wizard, y solo cuando el backend devolvió el id del turno
// (evento SSE `turn`). Vota poca gente — es normal y está bien: el grueso de la
// medición de calidad son las señales implícitas, esto es la confirmación
// explícita de los casos fuertes, sobre todo los enojados.
function PulgaresOrbi({ msg }: { msg: OrbiMessage }) {
  const setRating = useOrbiStore(s => s.setRating)
  if (!msg.turnId) return null

  const votar = (rating: 1 | -1) => {
    if (msg.rating) return
    setRating(msg.id, rating)
    votarRespuestaOrbi(msg.turnId!, rating)
  }

  const boton = (valor: 1 | -1, Icono: typeof ThumbsUp, titulo: string) => {
    const elegido = msg.rating === valor
    // Una vez votado se apaga el otro pulgar en vez de esconderlo: el usuario
    // ve qué votó, y no queda un hueco que mueva el resto de la conversación.
    const apagado = msg.rating !== undefined && !elegido
    return (
      <button
        onClick={() => votar(valor)}
        disabled={msg.rating !== undefined}
        title={titulo}
        aria-label={titulo}
        aria-pressed={elegido}
        style={{
          display: 'grid', placeItems: 'center', padding: 4,
          background: 'none', border: 'none', borderRadius: 6,
          cursor: msg.rating !== undefined ? 'default' : 'pointer',
          opacity: apagado ? 0.25 : 1,
          color: elegido ? '#3B82F6' : 'var(--color-muted)',
          transition: 'color 150ms, opacity 150ms',
        }}
      >
        <Icono size={13} strokeWidth={2} fill={elegido ? '#3B82F6' : 'none'} />
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2, marginLeft: 4 }}>
      {boton(1, ThumbsUp, 'Esta respuesta me sirvió')}
      {boton(-1, ThumbsDown, 'Esta respuesta no me sirvió')}
    </div>
  )
}

function MessageBubble({ msg, isLastMessage }: { msg: OrbiMessage; isLastMessage: boolean }) {
  const esPanel = useEsPanel()
  const isUser = msg.role === 'user'
  const isStreaming = useOrbiStore(s => s.isStreaming)
  const navigateAction = msg.actions?.find(esNavegacion)
  const selectActions = msg.actions?.filter(esSeleccionDelWizard) ?? []
  // Toda acción con actionId tiene su tarjeta, en cualquier estado: después
  // de confirmar o cancelar la tarjeta queda con lo que pasó.
  const tarjetas = msg.actions?.filter(esTarjetaDeAccion) ?? []
  // El tool_call llega ANTES que el texto explicativo (el modelo llama la tool,
  // el controller la ejecuta y manda action_complete, y DESPUÉS hace un segundo
  // LLM call que genera el texto). Si mostramos el botón de inmediato, el usuario
  // ve "Elegir X" flotando sin contexto durante 1-2 segundos.
  const hideActionsUntilDone = isLastMessage && isStreaming

  const contenido = msg.role === 'assistant' ? cleanToolLeaks(msg.content) : msg.content
  const pensando = msg.role === 'assistant' && isLastMessage && isStreaming
  // Cortada antes de que llegara texto: se dice en la burbuja en vez de
  // dejarla vacía, salvo que ya haya tarjetas o botones (ahí sí respondió).
  const noLlego = muestraNoLlegueAResponder({ ...msg, content: contenido })
  // Sin texto, sin "pensando" y sin aviso, la burbuja sería un globo vacío
  // arriba de la tarjeta: no se dibuja.
  const hayBurbuja = !!contenido || pensando || noLlego

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 2 }}>
      {!isUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {esPanel ? <OrbiPet size={22} disc /> : <OrbiIcon size={22} disc />}
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)' }}>Orbi</span>
        </div>
      )}
      {hayBurbuja && (
        <div style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser ? '#3B82F6' : 'var(--color-surface-alt)',
          color: isUser ? 'white' : 'var(--color-text)',
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {contenido
            ? (msg.role === 'assistant' ? renderTextoConNegrita(contenido) : contenido)
            // Sin texto todavía: mientras Orbi trabaja (último mensaje +
            // streaming) se muestra qué está haciendo.
            : pensando
              ? <OrbiThinking msg={msg} />
              : <span style={{ color: 'var(--color-muted)' }}>No llegué a responder.</span>}
        </div>
      )}

      {/* Respuesta cortada (Detener o cerrar el panel): lo que llegó queda y
          se aclara que no está completa. No es un error de conexión. */}
      {!isUser && msg.detenido && (
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', marginTop: 2 }}>
          Detenido
        </span>
      )}

      {!hideActionsUntilDone && tarjetas.map(a => (
        <OrbiConfirmButton key={a.id} accion={a} mensajeId={msg.id} />
      ))}

      {!hideActionsUntilDone && selectActions.map(a => (
        <OrbiSelectButton
          key={a.id}
          optionKey={a.data!.key as string}
          label={a.data!.label as string}
        />
      ))}

      {!hideActionsUntilDone && navigateAction && (
        <OrbiNavigateButton
          path={navigateAction.data!.path as string}
          label={navigateAction.result ?? 'Ir'}
        />
      )}

      {/* Recién cuando terminó de escribir: votar una respuesta a medio
          streamear no significa nada. */}
      {!isUser && !hideActionsUntilDone && <PulgaresOrbi msg={msg} />}
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--color-muted)', display: 'inline-block',
          animation: `orbi-typing 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes orbi-typing { 0%, 60%, 100% { opacity: 0.3; transform: scale(0.8) } 30% { opacity: 1; transform: scale(1) } }`}</style>
    </div>
  )
}

// Frase por herramienta mientras corre (B). El front sabe qué tool se está
// ejecutando por el `action_start` que ya manda el backend — no hace falta
// ningún evento nuevo.
const FRASE_POR_TOOL: Record<string, string> = {
  selectWizardOption: 'Preparando las opciones',
  suggestBusinessName: 'Buscando nombres con dominio libre',
  suggestDescription: 'Escribiendo una descripción',
  suggestSubdomain: 'Chequeando subdominios disponibles',
  fillWizardField: 'Completando el formulario',
  navigateTo: 'Llevándote ahí',
  listProducts: 'Revisando tu catálogo',
  createProduct: 'Cargando el producto',
  generateDescription: 'Escribiendo la descripción',
  listOrders: 'Buscando en tus pedidos',
  getOrderDetail: 'Abriendo el pedido',
  updateOrderStatus: 'Preparando el cambio de estado',
  listCustomers: 'Buscando en tus clientes',
  getCustomerDetail: 'Abriendo la ficha del cliente',
  listDiscounts: 'Mirando tus descuentos',
  createDiscount: 'Preparando el descuento',
  createCoupon: 'Preparando el cupón',
  updateBusinessInfo: 'Preparando el cambio',
  updatePaymentMethods: 'Preparando el cambio',
  updateShipping: 'Preparando el cambio',
  getSalesReport: 'Sacando los números',
  getProductReport: 'Sacando los números',
  getCustomerReport: 'Sacando los números',
}

// Frases genéricas para el hueco inicial, antes de que haya token o tool (A).
const FRASES_GENERICAS = ['Pensando', 'Armando tu respuesta', 'Un segundo']

// Reemplaza a los tres puntitos pelados: mientras Orbi trabaja muestra una
// frase de qué está haciendo + los puntitos. La frase sale del estado que el
// store ya tiene (qué action está activa), así que es 100% front.
function OrbiThinking({ msg }: { msg: OrbiMessage }) {
  const [genericaIdx, setGenericaIdx] = useState(0)

  // 'active' = una tool corriendo de verdad (consulta a la base, subllamada a
  // Gemini). 'pending' no: es una escritura propuesta y el modelo está
  // redactando la explicación → cae a "Armando la respuesta" como el resto.
  const activa = msg.actions?.find(a => a.status === 'active')
  const huboAction = (msg.actions?.length ?? 0) > 0

  // Solo rota cuando estamos mostrando una frase genérica (sin tool en curso).
  useEffect(() => {
    if (activa || huboAction) return
    const id = setInterval(() => setGenericaIdx(i => (i + 1) % FRASES_GENERICAS.length), 2200)
    return () => clearInterval(id)
  }, [activa, huboAction])

  let frase: string
  if (activa) frase = FRASE_POR_TOOL[activa.tool] ?? 'Trabajando en eso'
  else if (huboAction) frase = 'Armando la respuesta'
  else frase = FRASES_GENERICAS[genericaIdx]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>{frase}</span>
      <TypingDots />
    </div>
  )
}

// Pantalla vacía del panel: el pet grande, con la forma del módulo, diciendo su
// frase. Se le pueden hacer cosquillas. Va sobre un escenario navy porque el
// dibujo es de colores fijos pensados para fondo oscuro.
function EscenarioPet() {
  const m = petModulo(useModuloPet())
  const [cosquillas, setCosquillas] = useState(false)
  return (
    <div style={{
      width: '100%', maxWidth: 300, background: '#0a0e1a', border: '1px solid #1c2440', borderRadius: 16,
      padding: '18px 16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      <OrbiPet modulo={m.id} size={120} onCosquillas={setCosquillas} />
      <OrbiPetSay texto={cosquillas ? PET_COSQUILLAS : m.frase} />
      <div style={{ fontSize: 11, color: '#8a95c2' }}>Tocá a Orbi para hacerle cosquillas</div>
    </div>
  )
}

export function OrbiMessages() {
  const messages = useOrbiStore(s => s.messages)
  const esPanel = useEsPanel()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cuando aparece/desaparece el teclado, el alto del contenedor cambia y el
  // último mensaje se va de vista. Lo volvemos a pegar abajo.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const alFondo = () => { bottomRef.current?.scrollIntoView({ block: 'end' }) }
    vv.addEventListener('resize', alFondo)
    return () => vv.removeEventListener('resize', alFondo)
  }, [])

  if (!messages.length) {
    return (
      <div className="orbi-messages-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        {esPanel ? <EscenarioPet /> : <OrbiIcon size={48} disc />}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Hola, soy Orbi</div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Tu asistente de IA. Preguntame lo que<br />necesites o pedime que haga algo.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="orbi-messages-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {messages.map((msg, i) =>
        msg.role === 'divider' ? (
          <div key={msg.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 0', margin: '4px 0',
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
              {msg.content}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>
        ) : (
          <MessageBubble key={msg.id} msg={msg} isLastMessage={i === messages.length - 1} />
        )
      )}
      <div ref={bottomRef} />
    </div>
  )
}
