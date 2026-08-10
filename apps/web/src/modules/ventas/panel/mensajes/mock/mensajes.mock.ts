export type CategoriaPlantilla = 'pedido' | 'retiro' | 'envio' | 'postventa' | 'otro'
export type FiltroBandeja = 'todos' | 'sin_leer' | 'archivados'

export interface Conversacion {
  id:         string
  customerId: string
  cliente:    string
  email:      string
  preview:    string
  tiempo:     string
  unread:     boolean
  archivado:  boolean
  pedido:     string | null
}

// Resuelve el nombre del cliente de una conversación por id.
// Usado por el header global para mostrar "← <nombre>" en la vista de chat mobile.
export function nombreConversacion(id: string): string | undefined {
  return CONVERSACIONES.find((cv) => cv.id === id)?.cliente
}

// Ya no alimenta la bandeja real (Bandeja.tsx/ChatPanel.tsx usan la API) —
// queda solo para nombreConversacion(), que resuelve el nombre del cliente
// en el breadcrumb móvil del header global. Con una conversación real (id
// que no está en esta lista) el breadcrumb cae a "Mensajes" sin el nombre,
// nunca rompe.
export const CONVERSACIONES: Conversacion[] = [
  { id: 'cv1', customerId: 'c1', cliente: 'María Fernández',  email: 'maria.f@gmail.com',      preview: 'Perfecto, gracias! ¿Cuándo llegaría?',      tiempo: '14:26', unread: true,  archivado: false, pedido: '1284' },
  { id: 'cv2', customerId: 'c2', cliente: 'Joaquín Pérez',    email: 'joaq.perez@hotmail.com', preview: 'Quería consultar por talles disponibles',   tiempo: '13:10', unread: true,  archivado: false, pedido: '1283' },
  { id: 'cv3', customerId: 'c3', cliente: 'Camila Rodríguez', email: 'cami.rod@gmail.com',     preview: 'Muchas gracias por todo!',                  tiempo: '11:50', unread: true,  archivado: false, pedido: '1282' },
  { id: 'cv4', customerId: 'c4', cliente: 'Lucas Giménez',    email: 'lucas.g@gmail.com',      preview: 'Ya recibí el pedido, todo perfecto',        tiempo: 'Ayer',  unread: false, archivado: false, pedido: '1281' },
  { id: 'cv5', customerId: 'c5', cliente: 'Sofía Martínez',   email: 'sofi.m@yahoo.com',       preview: 'Hola! Tienen el vestido en azul?',          tiempo: 'Ayer',  unread: false, archivado: false, pedido: null   },
  { id: 'cv6', customerId: 'c6', cliente: 'Diego Torres',     email: 'diego.t@gmail.com',      preview: 'Excelente la atención, muchas gracias!',    tiempo: 'Lun',   unread: false, archivado: true,  pedido: '1278' },
]

export interface ChatMsg {
  from: 'cli' | 'me'
  txt:  string
  hora: string
}

export const CHAT_MSGS_BY_CV: Record<string, ChatMsg[]> = {
  cv1: [
    { from: 'cli', txt: 'Hola, quería saber si el pedido #1284 ya fue enviado', hora: '14:20' },
    { from: 'me',  txt: 'Hola María! Sí, tu pedido ya está en camino. El código de seguimiento es AR3489573', hora: '14:25' },
    { from: 'cli', txt: 'Perfecto, gracias! ¿Cuándo llegaría aproximadamente?', hora: '14:26' },
    { from: 'me',  txt: 'Estimamos entrega para mañana o pasado. Te avisamos cuando llegue 😊', hora: '14:28' },
  ],
  cv2: [
    { from: 'cli', txt: 'Hola! Quería consultar por talles disponibles del buzo oversize', hora: '13:05' },
    { from: 'me',  txt: 'Hola Joaquín! Tenemos en S, M y L. ¿Cuál necesitás?', hora: '13:08' },
    { from: 'cli', txt: 'Quería consultar por talles disponibles', hora: '13:10' },
  ],
  cv3: [
    { from: 'me',  txt: 'Hola Camila! Tu pedido #1282 fue confirmado y ya está en preparación', hora: '10:30' },
    { from: 'cli', txt: 'Muchas gracias por todo!', hora: '11:50' },
  ],
  cv4: [
    { from: 'me',  txt: 'Hola Lucas! Tu pedido #1281 fue entregado. Esperamos que todo haya llegado bien', hora: '09:00' },
    { from: 'cli', txt: 'Ya recibí el pedido, todo perfecto. Gracias!', hora: '09:15' },
  ],
  cv5: [
    { from: 'cli', txt: 'Hola! Tienen el vestido floral en azul?', hora: 'Ayer 16:30' },
  ],
  cv6: [
    { from: 'me',  txt: 'Hola Diego! Tu pedido #1278 fue entregado. ¿Todo bien?', hora: 'Lun 10:00' },
    { from: 'cli', txt: 'Excelente la atención, muchas gracias!', hora: 'Lun 11:00' },
  ],
}

export const CHAT_MSGS = CHAT_MSGS_BY_CV.cv1

export interface Plantilla {
  id:        string
  nombre:    string
  texto:     string
  categoria: CategoriaPlantilla
}

export const PLANTILLAS: Plantilla[] = [
  { id: 'p1', nombre: 'Pedido confirmado',     categoria: 'pedido',    texto: 'Hola {nombre}! Tu pedido #{id} fue confirmado. Estamos preparando todo para vos 😊' },
  { id: 'p2', nombre: 'Listo para retirar',    categoria: 'retiro',    texto: 'Hola {nombre}! Tu pedido #{id} está listo para retirar en nuestra tienda.' },
  { id: 'p3', nombre: 'Código de seguimiento', categoria: 'envio',     texto: 'Hola {nombre}! Te enviamos el código de seguimiento de tu pedido: {tracking}' },
  { id: 'p4', nombre: 'Gracias por tu compra', categoria: 'postventa', texto: 'Hola {nombre}! Gracias por confiar en {tienda}. Esperamos verte pronto 🙏' },
  { id: 'p5', nombre: 'Pedido en camino',       categoria: 'envio',     texto: 'Hola {nombre}! Tu pedido #{id} ya está en camino. Llegará en 1-3 días hábiles.' },
  { id: 'p6', nombre: 'Solicitar reseña',       categoria: 'postventa', texto: 'Hola {nombre}! ¿Cómo quedaste con tu compra? Nos ayudaría mucho si dejás una reseña 🙌' },
]

export const CATEGORIAS_PLANTILLA: { id: CategoriaPlantilla; label: string }[] = [
  { id: 'pedido',    label: 'Pedido'    },
  { id: 'retiro',    label: 'Retiro'    },
  { id: 'envio',     label: 'Envío'     },
  { id: 'postventa', label: 'Postventa' },
  { id: 'otro',      label: 'Otro'      },
]

export const VARIABLES_DISPONIBLES = ['{nombre}', '{id}', '{tracking}', '{tienda}']

export interface PedidoResumen {
  id:     string
  fecha:  string
  // String ancho (no el union original de 4 valores): los pedidos reales
  // tienen más estados (Pendiente, En preparación) que el mock nunca modeló.
  // ESTADO_PEDIDO ya tiene un fallback gris para cualquier clave que no
  // reconozca, así que ensanchar esto no rompe nada.
  estado: string
  total:  number
}

export const PEDIDOS_POR_CLIENTE: Record<string, PedidoResumen[]> = {
  cv1: [
    { id: '1284', fecha: '15/06/2026', estado: 'Enviado',    total: 45800 },
    { id: '1201', fecha: '02/05/2026', estado: 'Entregado',  total: 23400 },
    { id: '1150', fecha: '18/03/2026', estado: 'Entregado',  total: 12900 },
  ],
  cv2: [{ id: '1283', fecha: '14/06/2026', estado: 'Confirmado', total: 31200 }],
  cv3: [{ id: '1282', fecha: '13/06/2026', estado: 'Confirmado', total: 18500 }],
  cv4: [{ id: '1281', fecha: '12/06/2026', estado: 'Entregado',  total: 9800  }],
  cv5: [],
  cv6: [{ id: '1278', fecha: '08/06/2026', estado: 'Entregado',  total: 22100 }],
}

export const ESTADO_PEDIDO: Record<string, { color: string; bg: string }> = {
  Pendiente:      { color: 'var(--color-warning)',    bg: 'var(--color-warning-bg)'    },
  Confirmado:     { color: 'var(--color-warning)',    bg: 'var(--color-warning-bg)'    },
  'En preparación': { color: 'var(--color-warning)',  bg: 'var(--color-warning-bg)'    },
  Enviado:        { color: 'var(--color-primary)',    bg: 'var(--color-primary-bg)'    },
  Entregado:      { color: 'var(--color-success)',    bg: 'var(--color-success-bg)'    },
  Completado:     { color: 'var(--color-success)',    bg: 'var(--color-success-bg)'    },
  Cancelado:      { color: 'var(--color-error)',      bg: 'var(--color-error-bg)'      },
}

export const DATOS_EJEMPLO: Record<string, string> = {
  nombre: 'María', id: '1284', tracking: 'AR3489573', tienda: 'Rama Indumentaria',
}

export function resolverVariables(texto: string, cv?: Conversacion | null): string {
  const datos: Record<string, string> = {
    nombre:   cv?.cliente.split(' ')[0] ?? 'cliente',
    id:       cv?.pedido ?? '0000',
    tracking: 'AR3489573',
    tienda:   'Rama Indumentaria',
  }
  return texto.replace(/\{([^}]+)\}/g, (_, k) => datos[k] ?? `{${k}}`)
}
