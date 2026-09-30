import { beforeEach, describe, expect, it } from 'vitest'
import { useOrbiStore } from './useOrbiStore'
import {
  conversationIdParaEnviar,
  debeDescartar,
  esAborto,
  filtrarPorSesion,
  idDeConversacionDelEvento,
} from './sesionOrbi'
import { leerStreamSse, type EventoSse, type LectorDeBytes } from './sseParser'

// El store de zustand se puede usar sin React (getState/setState), así que
// la lógica de reset, abort y contador de sesión se prueba en node, sin DOM.

const estadoInicial = useOrbiStore.getState()

beforeEach(() => {
  useOrbiStore.setState(estadoInicial, true)
})

function mensaje(id: string, role: 'user' | 'assistant' = 'user') {
  return { id, role, content: 'hola', timestamp: 0 }
}

describe('reset()', () => {
  it('vacía mensajes y conversationId y limpia welcomeGreetedStep', () => {
    const s = useOrbiStore.getState()
    s.addMessage(mensaje('m1'))
    s.setConversationId('conv-1')
    s.setWelcomeGreetedStep('panel')

    useOrbiStore.getState().reset()

    const d = useOrbiStore.getState()
    expect(d.messages).toEqual([])
    expect(d.conversationId).toBeNull()
    // Sin esto el saludo no reaparece en la conversación nueva.
    expect(d.welcomeGreetedStep).toBeNull()
    expect(d.isStreaming).toBe(false)
  })

  it('aborta el stream en curso', () => {
    const c = new AbortController()
    useOrbiStore.getState().setAbort(c)

    useOrbiStore.getState().reset()

    expect(c.signal.aborted).toBe(true)
  })

  it('incrementa el contador de sesión', () => {
    const antes = useOrbiStore.getState().sesion
    useOrbiStore.getState().reset()
    useOrbiStore.getState().reset()
    expect(useOrbiStore.getState().sesion).toBe(antes + 2)
  })
})

describe('abortar()', () => {
  it('aborta el controller guardado y lo suelta', () => {
    const c = new AbortController()
    useOrbiStore.getState().setAbort(c)

    useOrbiStore.getState().abortar()

    expect(c.signal.aborted).toBe(true)
    expect(useOrbiStore.getState().abortEnCurso).toBeNull()
  })

  it('sin nada en curso no hace nada ni cambia la sesión', () => {
    const antes = useOrbiStore.getState().sesion
    expect(() => useOrbiStore.getState().abortar()).not.toThrow()
    expect(useOrbiStore.getState().sesion).toBe(antes)
  })

  it('no borra la conversación: Detener corta la respuesta, no el hilo', () => {
    useOrbiStore.getState().addMessage(mensaje('m1'))
    useOrbiStore.getState().setConversationId('conv-1')
    useOrbiStore.getState().setAbort(new AbortController())

    useOrbiStore.getState().abortar()

    expect(useOrbiStore.getState().messages).toHaveLength(1)
    expect(useOrbiStore.getState().conversationId).toBe('conv-1')
  })
})

describe('cerrar el panel', () => {
  it('close() aborta el stream en curso', () => {
    const c = new AbortController()
    useOrbiStore.getState().open()
    useOrbiStore.getState().setAbort(c)

    useOrbiStore.getState().close()

    expect(c.signal.aborted).toBe(true)
    expect(useOrbiStore.getState().isOpen).toBe(false)
  })

  it('toggle() que cierra aborta; toggle() que abre no', () => {
    const c1 = new AbortController()
    useOrbiStore.getState().setAbort(c1)
    useOrbiStore.getState().toggle() // abre
    expect(c1.signal.aborted).toBe(false)

    useOrbiStore.getState().toggle() // cierra
    expect(c1.signal.aborted).toBe(true)
  })
})

describe('marcarDetenido()', () => {
  it('marca el mensaje y conserva lo que ya había llegado', () => {
    useOrbiStore.getState().addMessage(mensaje('a1', 'assistant'))
    useOrbiStore.getState().marcarDetenido('a1')
    const m = useOrbiStore.getState().messages[0]
    expect(m.detenido).toBe(true)
    expect(m.content).toBe('hola')
  })
})

describe('debeDescartar()', () => {
  it('descarta si la sesión cambió desde el envío', () => {
    expect(debeDescartar(3, 4)).toBe(true)
  })
  it('no descarta si la sesión es la misma', () => {
    expect(debeDescartar(3, 3)).toBe(false)
  })
})

// Lector de mentira: entrega los pedazos de a uno y, antes de cada lectura,
// corre lo que se le pida (así se simula un reset en medio del stream).
function lectorCon(pedazos: string[], antesDeLeer: (i: number) => void = () => {}): LectorDeBytes {
  const enc = new TextEncoder()
  let i = 0
  return {
    async read() {
      antesDeLeer(i)
      if (i >= pedazos.length) return { done: true }
      return { done: false, value: enc.encode(pedazos[i++]) }
    },
    async cancel() {},
  }
}

describe('stream con sesión vieja', () => {
  // Mismo consumo que useOrbiChat: el id de la conversación se guarda con
  // setConversationId y el texto va a la última burbuja de Orbi.
  function consumir(e: EventoSse) {
    const s = useOrbiStore.getState()
    const data = (e.data ?? {}) as { id?: string; chunk?: string }
    if (e.event === 'conversation') {
      const id = idDeConversacionDelEvento('panel', data)
      if (id) s.setConversationId(id)
    } else if (e.event === 'text') {
      s.appendToLastAssistant(data.chunk ?? '')
    }
  }

  it('si hubo reset en el medio no escribe nada, ni siquiera el conversation', async () => {
    const sesionAlEnviar = useOrbiStore.getState().sesion
    const lector = lectorCon(
      [
        'event: conversation\ndata: {"id":"conv-vieja"}\n\n',
        'event: text\ndata: {"chunk":"respuesta para otra persona"}\n\n',
      ],
      (i) => {
        // Antes de la primera lectura otra persona toca "Nueva conversación"
        // (o se loguea otro) y arranca su propio chat.
        if (i === 0) {
          useOrbiStore.getState().reset()
          useOrbiStore.getState().addMessage({ ...mensaje('nuevo', 'assistant'), content: '' })
        }
      },
    )

    await leerStreamSse(lector, filtrarPorSesion(sesionAlEnviar, () => useOrbiStore.getState().sesion, consumir))

    const s = useOrbiStore.getState()
    expect(s.conversationId).toBeNull()
    expect(s.messages[0].content).toBe('')
  })

  it('sin reset los eventos se procesan normalmente', async () => {
    useOrbiStore.getState().addMessage({ ...mensaje('a1', 'assistant'), content: '' })
    const sesionAlEnviar = useOrbiStore.getState().sesion
    const lector = lectorCon([
      'event: conversation\ndata: {"id":"conv-1"}\n\n',
      'event: text\ndata: {"chunk":"listo"}\n\n',
    ])

    await leerStreamSse(lector, filtrarPorSesion(sesionAlEnviar, () => useOrbiStore.getState().sesion, consumir))

    expect(useOrbiStore.getState().conversationId).toBe('conv-1')
    expect(useOrbiStore.getState().messages[0].content).toBe('listo')
  })
})

describe('conversación solo en el panel', () => {
  it('el id del evento conversation se toma solo en el panel', () => {
    expect(idDeConversacionDelEvento('panel', { id: 'conv-1' })).toBe('conv-1')
    expect(idDeConversacionDelEvento('wizard', { id: 'conv-1' })).toBeNull()
  })

  it('un id que no es string se ignora', () => {
    expect(idDeConversacionDelEvento('panel', { id: 42 })).toBeNull()
    expect(idDeConversacionDelEvento('panel', null)).toBeNull()
  })

  it('el conversationId viaja en el body solo desde el panel', () => {
    expect(conversationIdParaEnviar('panel', 'conv-1')).toBe('conv-1')
    expect(conversationIdParaEnviar('panel', null)).toBeUndefined()
    expect(conversationIdParaEnviar('wizard', 'conv-1')).toBeUndefined()
  })
})

describe('esAborto()', () => {
  it('reconoce el AbortError de fetch/lector', () => {
    const c = new AbortController()
    c.abort()
    expect(esAborto(c.signal.reason)).toBe(true)
    expect(esAborto(new DOMException('cortado', 'AbortError'))).toBe(true)
  })

  it('un error de red no es un aborto', () => {
    expect(esAborto(new TypeError('Failed to fetch'))).toBe(false)
    expect(esAborto(null)).toBe(false)
  })
})
