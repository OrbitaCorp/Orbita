import type { BotChatEstado, BotModo, CanalDeBandeja, ChatMessage, ConversationRow } from '@/lib/api'

// Lógica chica del módulo Mensajes que no depende de la pantalla: a qué canal pertenece una charla, hasta cuándo se
// puede contestar por WhatsApp y cómo se muestran las horas y los días como en WhatsApp.

const HORA_MS = 60 * 60 * 1000
export const VENTANA_WHATSAPP_MS = 24 * HORA_MS

export type CanalDeMensajes = 'sistema' | 'whatsapp'

export const esDeWhatsapp = (c: Pick<ConversationRow, 'lastChannel'>): boolean => c.lastChannel === 'WHATSAPP'

/** La charla vista desde una bandeja: con SU último mensaje y SU "sin leer", sin nada del otro canal. */
function vistaDeLaBandeja(r: ConversationRow, canal: CanalDeBandeja): ConversationRow | null {
  const info = r.canales?.[canal]
  if (!info) return null
  return { ...r, lastMessage: info.lastMessage, lastChannel: canal, isUnread: info.isUnread }
}

/**
 * Reparte las charlas en las dos bandejas SIN mezclarlas: la local (el chat de la tienda) tiene las charlas que tienen
 * mensajes de la tienda, y la de WhatsApp las que tienen mensajes de WhatsApp. Una persona que escribió por los dos
 * canales está en las dos, y en cada una se ve solo lo de ese canal. Las de Instagram no llegan acá: se atienden en
 * Difusión. Con una respuesta sin el detalle por canal (la demo, o una API vieja), se usa el canal del último mensaje.
 */
export function repartirCharlas(rows: ConversationRow[]): { sistema: ConversationRow[]; whatsapp: ConversationRow[] } {
  const sistema: ConversationRow[] = []
  const whatsapp: ConversationRow[] = []
  for (const r of rows) {
    if (!r.canales) {
      ;(esDeWhatsapp(r) ? whatsapp : sistema).push(r)
      continue
    }
    const s = vistaDeLaBandeja(r, 'STOREFRONT')
    const w = vistaDeLaBandeja(r, 'WHATSAPP')
    if (s) sistema.push(s)
    if (w) whatsapp.push(w)
  }
  return { sistema, whatsapp }
}

/** Hasta cuándo se puede contestar por WhatsApp (24 h desde el último mensaje del cliente), o null si ya venció. */
export function puedeResponderHasta(mensajes: Pick<ChatMessage, 'sender' | 'channel' | 'createdAt'>[], ahora: number = Date.now()): Date | null {
  let ultimo = 0
  for (const m of mensajes) {
    if (m.sender === 'CUSTOMER' && m.channel === 'WHATSAPP') ultimo = Math.max(ultimo, new Date(m.createdAt).getTime())
  }
  if (ultimo === 0) return null
  const vence = ultimo + VENTANA_WHATSAPP_MS
  return vence > ahora ? new Date(vence) : null
}

const dos = (n: number) => String(n).padStart(2, '0')
const mismoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** "14:32" */
export const hora = (iso: string | Date): string => {
  const f = typeof iso === 'string' ? new Date(iso) : iso
  return `${dos(f.getHours())}:${dos(f.getMinutes())}`
}

/** Como en la lista de WhatsApp: la hora si es de hoy, "Ayer", o la fecha "12/10/2026". */
export function marcaDeLaLista(iso: string, ahora: Date = new Date()): string {
  const f = new Date(iso)
  if (mismoDia(f, ahora)) return hora(f)
  if (mismoDia(f, new Date(ahora.getTime() - 24 * HORA_MS))) return 'Ayer'
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()}`
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** El separador entre días del chat: "HOY", "AYER", el día de la semana si fue esta semana, o la fecha completa. */
export function separadorDeDia(iso: string, ahora: Date = new Date()): string {
  const f = new Date(iso)
  if (mismoDia(f, ahora)) return 'HOY'
  if (mismoDia(f, new Date(ahora.getTime() - 24 * HORA_MS))) return 'AYER'
  if (ahora.getTime() - f.getTime() < 6 * 24 * HORA_MS) return DIAS[f.getDay()].toUpperCase()
  return `${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`
}

/** Hasta dos letras para el avatar: "Ana Paz" → "AP". */
export function iniciales(nombre: string): string {
  const letras = nombre.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0))
  return (letras.join('') || '?').toUpperCase()
}

// Los avatares sin foto de WhatsApp tienen un color según la persona: siempre el mismo para la misma.
const COLORES = ['#6a7175', '#5e8aa8', '#a06cc4', '#c2745c', '#4f9d8a', '#b8860b', '#7a8f3f', '#c25b87']
export function colorDeAvatar(nombre: string): string {
  let h = 0
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORES[h % COLORES.length]
}

export type EstadoDeEntrega = 'enviado' | 'entregado' | 'leido' | 'fallo' | null

/** De `deliveryStatus` de la API al estado que muestran los tildes. Solo los mensajes salientes tienen. */
export function estadoDeEntrega(m: Pick<ChatMessage, 'sender' | 'deliveryStatus'>): EstadoDeEntrega {
  if (m.sender !== 'STORE') return null
  switch (m.deliveryStatus) {
    case 'delivered': return 'entregado'
    case 'read': return 'leido'
    case 'failed': return 'fallo'
    case 'sent': return 'enviado'
    default: return 'enviado'
  }
}

/** La foto de un mensaje, si la tiene (solo se muestran imágenes; lo demás llega como etiqueta). */
export function fotoDelMensaje(m: Pick<ChatMessage, 'attachments'>): string | null {
  return m.attachments?.find((a) => a.tipo === 'image' && a.url)?.url ?? null
}

/** El texto que acompaña a la foto: el pie de foto, o nada si el texto es solo la etiqueta "[Imagen]". */
export function pieDeFoto(m: Pick<ChatMessage, 'text' | 'attachments'>): string {
  if (!fotoDelMensaje(m)) return m.text
  return m.text.trim() === '[Imagen]' ? '' : m.text
}

/** Lo que dice la lista de chats debajo del nombre: las fotos se anuncian como "Foto" (o con su pie de foto). */
export function vistaPreviaDeLaLista(m: Pick<ChatMessage, 'text' | 'attachments'> | null): string {
  if (!m) return ''
  if (!fotoDelMensaje(m)) return m.text
  const pie = pieDeFoto(m)
  return pie ? `📷 ${pie}` : '📷 Foto'
}

export const TIPOS_DE_FOTO = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_BYTES_FOTO = 10 * 1024 * 1024

/** Revisa la foto elegida antes de subirla: devuelve el motivo si no sirve, o null si está bien. */
export function errorDeFoto(f: Pick<File, 'type' | 'size'>): string | null {
  if (!TIPOS_DE_FOTO.includes(f.type)) return 'Elegí una foto JPG, PNG o WebP.'
  if (f.size > MAX_BYTES_FOTO) return 'La foto pesa más de 10 MB.'
  return null
}

/**
 * ¿Orbi contesta en este chat? Mismo criterio que la API: con el interruptor general apagado, nunca; ON y OFF son del
 * dueño; DEFAULT sigue el modo general (solo atiende en "todos"); PAUSADO y DERIVADO lo callan hasta que el dueño lo reactive.
 */
export function orbiAtiende(config: { enabled: boolean; modo: BotModo } | null, estado: BotChatEstado | undefined): boolean {
  if (!config?.enabled) return false
  const e = estado ?? 'DEFAULT'
  if (e === 'ON') return true
  if (e === 'DEFAULT') return config.modo === 'TODOS'
  return false
}

/** Lo que se marca en la lista de chats: "atencion" si Orbi pidió que lo vea una persona, "orbi" si lo atiende Orbi. */
export function marcaDeBot(config: { enabled: boolean; modo: BotModo } | null, bot: ConversationRow['bot']): 'atencion' | 'orbi' | null {
  if (bot?.estado === 'DERIVADO') return 'atencion'
  return orbiAtiende(config, bot?.estado) ? 'orbi' : null
}

export interface FilaDelChat {
  mensaje: ChatMessage
  /** Separador de día que va antes de este mensaje (el primero de cada día). */
  dia: string | null
  /** Primer mensaje de una racha de la misma persona: es el que lleva la "colita" de la burbuja. */
  primeroDeRacha: boolean
}

export function armarFilas(mensajes: ChatMessage[], ahora: Date = new Date()): FilaDelChat[] {
  return mensajes.map((m, i) => {
    const anterior = mensajes[i - 1]
    const nuevoDia = !anterior || !mismoDia(new Date(anterior.createdAt), new Date(m.createdAt))
    return {
      mensaje: m,
      dia: nuevoDia ? separadorDeDia(m.createdAt, ahora) : null,
      primeroDeRacha: nuevoDia || anterior.sender !== m.sender,
    }
  })
}
