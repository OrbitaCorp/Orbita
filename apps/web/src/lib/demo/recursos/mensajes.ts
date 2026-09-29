// ─── Mensajes de la demo: un mismo chat entre la tienda y el panel ──────────
//
// El cliente Invitado (tienda → Mi cuenta → Mensajes) y el dueño (panel →
// Mensajes) hablan por el MISMO hilo, y todo vive en el localStorage del
// visitante: lo que escribe como cliente le llega a la bandeja del panel
// como mensaje sin leer, y lo que contesta como dueño aparece en el chat de
// la tienda. La tienda y el panel de la demo comparten origen, así que el
// sondeo de cada pantalla (cada ~2,5 s) ve lo que dejó la otra, también entre
// pestañas. Nada de esto toca los datos sembrados.
//
// Dos recursos en el almacén (ver lib/demo/almacen.ts):
//
//   "mensajes"       → los mensajes nuevos, de ambos lados, cada uno con la
//                      conversación a la que pertenece.
//   "conversaciones" → parches sobre las sembradas (leída / archivada / último
//                      movimiento) y, si el Invitado todavía no tenía hilo, la
//                      conversación que nace con su primer mensaje — igual que
//                      en la API real, que nunca crea un hilo vacío.
//
// El panel puede contestar también las conversaciones sembradas de otros
// clientes: quedan guardadas y se ven en la bandeja, pero solo el hilo del
// Invitado se ve del lado de la tienda (es el único cliente que hay ahí).
import type { ChatMessage, ConversationRow, MeConversation, MeProfile } from '@/lib/api'
import { apiReal, json, leerJson, registrar } from '../interceptor'
import { aplicarALista, crear, editar, esIdLocal, leerCapa, nuevoId } from '../almacen'

const MENSAJES = 'mensajes'
const CONVERSACIONES = 'conversaciones'
/** Hilo del Invitado cuando la API todavía no tiene ninguno (la id de una real la reemplaza). */
const CONV_INVITADO = 'demo-conversacion-invitado'
const MAX_TEXTO = 5000 // mismo tope que la API (SendMessageDto / CustomerMessageDto)

type MensajeLocal = ChatMessage & { conversationId: string }

const enOrden = (a: ChatMessage, b: ChatMessage) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

function sinConversacion({ conversationId: _c, ...mensaje }: MensajeLocal): ChatMessage {
  return mensaje
}

function mensajesLocales(): MensajeLocal[] {
  return leerCapa<MensajeLocal>(MENSAJES).creados
}

/** Lo que trajo la API más lo que se escribió en esta demo, en orden. */
function fusionar(reales: ChatMessage[], conversationId: string): ChatMessage[] {
  const propios = mensajesLocales().filter((m) => m.conversationId === conversationId).map(sinConversacion)
  return propios.length === 0 ? reales : [...reales, ...propios].sort(enOrden)
}

function textoDe(body: unknown): string | null {
  const t = typeof (body as { text?: unknown } | null)?.text === 'string' ? (body as { text: string }).text.trim() : ''
  return t && t.length <= MAX_TEXTO ? t : null
}

function mensajeNuevo(conversationId: string, sender: ChatMessage['sender'], text: string, orderId: string | null = null): MensajeLocal {
  return { id: nuevoId(), conversationId, sender, text, orderId, createdAt: new Date().toISOString() }
}

/** La bandeja como la ve el visitante: con los mensajes, lo leído y lo archivado de esta demo. */
function bandejaVista(reales: ConversationRow[]): ConversationRow[] {
  const propios = mensajesLocales()
  return aplicarALista<ConversationRow>(CONVERSACIONES, reales)
    .map((fila) => {
      const ultimo = propios.filter((m) => m.conversationId === fila.id).sort(enOrden).at(-1)
      if (!ultimo || (fila.lastMessage && enOrden(ultimo, fila.lastMessage) <= 0)) return fila
      return { ...fila, lastMessage: sinConversacion(ultimo), updatedAt: ultimo.createdAt }
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

async function bandejaDe(res: Response): Promise<ConversationRow[] | null> {
  const reales = await leerJson<ConversationRow[]>(res)
  return reales ? bandejaVista(reales) : null
}

// ── Panel ───────────────────────────────────────────────────────────────────

registrar({
  metodo: 'GET',
  ruta: /^\/conversations$/,
  lado: 'panel',
  responder: async (p) => {
    const res = await p.real()
    return (await bandejaDe(res.clone())) ?? res
  },
})

// La campana y el menú lateral: el mismo cálculo que la API (cuenta las
// sin leer, archivadas o no), sobre la bandeja ya ajustada.
registrar({
  metodo: 'GET',
  ruta: /^\/conversations\/unread-count$/,
  lado: 'panel',
  responder: async (p) => {
    const lista = await apiReal('/conversations', { headers: p.headers }).catch(() => null)
    const filas = lista ? await bandejaDe(lista) : null
    // Sin la lista de la API no hay nada que ajustar: sigue la llamada original.
    return filas ? { count: filas.filter((f) => f.isUnread).length } : p.real()
  },
})

registrar({
  metodo: 'GET',
  ruta: /^\/conversations\/([^/]+)\/messages$/,
  lado: 'panel',
  responder: async (p, m) => {
    const id = decodeURIComponent(m[1])
    let reales: ChatMessage[] = []
    // Una conversación que nació en esta demo no existe en la API.
    if (!esIdLocal(id)) {
      const res = await p.real()
      const leidos = await leerJson<ChatMessage[]>(res.clone())
      if (!leidos) return res
      reales = leidos
    }
    // Abrirla la marca leída (como la API). Solo se escribe si hace falta:
    // cada escritura avisa a las pantallas abiertas y el chat sondea seguido.
    const capa = leerCapa<ConversationRow>(CONVERSACIONES)
    const propia = capa.creados.find((c) => c.id === id)
    if ((propia ? propia.isUnread : capa.editados[id]?.isUnread) !== false) editar(CONVERSACIONES, id, { isUnread: false })
    return fusionar(reales, id)
  },
})

registrar({
  metodo: 'POST',
  ruta: /^\/conversations\/([^/]+)\/messages$/,
  lado: 'panel',
  responder: async (p, m) => {
    const id = decodeURIComponent(m[1])
    const texto = textoDe(p.body)
    if (!texto) return json({ message: 'El mensaje no puede estar vacío ni pasar de 5000 caracteres.' }, 400)
    const orderId = typeof (p.body as { orderId?: unknown }).orderId === 'string' ? (p.body as { orderId: string }).orderId : null
    const nuevo = mensajeNuevo(id, 'STORE', texto, orderId)
    crear(MENSAJES, nuevo)
    // Contestar la deja al día y la sube al tope (igual que la API).
    editar(CONVERSACIONES, id, { isUnread: false, updatedAt: nuevo.createdAt })
    return sinConversacion(nuevo)
  },
})

registrar({
  metodo: 'PATCH',
  ruta: /^\/conversations\/([^/]+)$/,
  lado: 'panel',
  responder: async (p, m) => {
    const b = (p.body ?? {}) as { isUnread?: unknown; isArchived?: unknown }
    const cambios: Partial<ConversationRow> = {}
    if (typeof b.isUnread === 'boolean') cambios.isUnread = b.isUnread
    if (typeof b.isArchived === 'boolean') cambios.isArchived = b.isArchived
    editar(CONVERSACIONES, decodeURIComponent(m[1]), cambios)
    return { ok: true }
  },
})

// ── Tienda (Mi cuenta → Mensajes) ───────────────────────────────────────────

registrar({
  metodo: 'GET',
  ruta: /^\/me\/conversation$/,
  lado: 'tienda',
  responder: async (p) => {
    const res = await p.real()
    const hilo = await leerJson<MeConversation>(res.clone())
    if (!hilo) return res
    const id = hilo.id ?? CONV_INVITADO
    const mensajes = fusionar(hilo.messages, id)
    return mensajes.length === hilo.messages.length ? hilo : { id, messages: mensajes }
  },
})

registrar({
  metodo: 'POST',
  ruta: /^\/me\/conversation\/messages$/,
  lado: 'tienda',
  responder: async (p) => {
    const texto = textoDe(p.body)
    if (!texto) return json({ message: 'El mensaje no puede estar vacío ni pasar de 5000 caracteres.' }, 400)

    const actual = await apiReal('/me/conversation', { headers: p.headers }).catch(() => null)
    const hilo = actual ? await leerJson<MeConversation>(actual) : null
    const id = hilo?.id ?? CONV_INVITADO
    const ahora = new Date().toISOString()

    if (!hilo?.id && !leerCapa<ConversationRow>(CONVERSACIONES).creados.some((c) => c.id === id)) {
      // El primer mensaje crea la conversación: la bandeja necesita saber de quién es.
      const resPerfil = await apiReal('/me', { headers: p.headers }).catch(() => null)
      const perfil = resPerfil ? await leerJson<MeProfile>(resPerfil) : null
      if (!perfil) return json({ message: 'No se pudo enviar el mensaje.' }, 502)
      crear<ConversationRow>(CONVERSACIONES, {
        id, customerId: perfil.id, customerName: [perfil.firstName, perfil.lastName].filter(Boolean).join(' '),
        customerEmail: perfil.email, customerAvatar: perfil.avatarUrl, isUnread: false, isArchived: false, lastMessage: null, updatedAt: ahora,
      })
    }

    const nuevo = mensajeNuevo(id, 'CUSTOMER', texto)
    crear(MENSAJES, nuevo)
    // Le llega al dueño como sin leer (no la desarchiva: tampoco lo hace la API).
    editar(CONVERSACIONES, id, { isUnread: true, updatedAt: nuevo.createdAt })
    return sinConversacion(nuevo)
  },
})
