// src/modules/propuestas/prototipos/Escucha.tsx — Prototipo #15 "Orbi
// Escucha": reseñas de Google, comentarios de Instagram y mensajes de la
// tienda caen en una bandeja en vivo; Orbi los clasifica por tema y
// sentimiento, arma un mapa de burbujas, responde con el tono de la marca,
// alerta cuando un tema negativo se repite y convierte pedidos en acciones.
//
// DEMO INTERNA — autocontenido: sin fetch, sin storage, sin imágenes, sin LLM
// (clasificación y borradores scripteados).

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Ear, Store, Star, Pause, Play, RotateCcw, Check, Send, Bell, Radar, Sparkles, X, MessageSquare, Clock, Flame, AlertTriangle, Zap, Truck, Award, ChevronRight, Search } from 'lucide-react'
import { C, FONT, FONT_DISPLAY, FONT_MONO, Tarjeta, Chip, Boton, Etiqueta, OrbiAvatar } from '../ui'

// ─── Constantes ──────────────────────────────────────────────────────────────

const ACENTO = '#FDA4AF'
const ACENTO_FUERTE = '#FB7185'
const NEGOCIO = 'Casa Ramos · indumentaria'
const LLEGADA_MS = 1200
const CLASIFICAR_MS = 750
const AUTO_MS = 1300
/** Reseñas previas en Google (para que la reputación no dependa solo de la demo). */
const RESENAS_PREVIAS = 120
const REPUTACION_PREVIA = 4.65

const W = 700, H = 430, PAD_L = 62, PAD_R = 40, PAD_T = 64, PAD_B = 64

const TEMAS = ['Atención', 'Precio', 'Demora', 'Producto', 'Local', 'Envíos', 'Stock/Talles'] as const
type Tema = (typeof TEMAS)[number]
const TEMA_COLOR: Record<Tema, string> = {
  Atención: '#60A5FA', Precio: '#FBBF24', Demora: '#F87171', Producto: '#34D399', Local: '#A78BFA', Envíos: '#22D3EE', 'Stock/Talles': '#FB923C',
}

type Fuente = 'google' | 'instagram' | 'tienda'
type Sentimiento = 'positivo' | 'neutral' | 'negativo'
type Tono = 'cercano' | 'formal' | 'divertido'
const TONOS: { id: Tono; nombre: string }[] = [{ id: 'cercano', nombre: 'Cercano' }, { id: 'formal', nombre: 'Formal' }, { id: 'divertido', nombre: 'Divertido' }]
const FUENTE_NOMBRE: Record<Fuente, string> = { google: 'Reseña de Google', instagram: 'Comentario en Instagram', tienda: 'Mensaje en la tienda' }
const SENT: Record<Sentimiento, { nombre: string; color: string }> = {
  positivo: { nombre: 'Positivo', color: C.success }, neutral: { nombre: 'Neutral', color: C.muted }, negativo: { nombre: 'Negativo', color: C.error },
}

const CSS = `
  @keyframes es-llegar { 0% { opacity: 0; transform: translateY(-16px) scale(.97); } 60% { opacity: 1; } 100% { opacity: 1; transform: none; } }
  @keyframes es-barra { 0%, 100% { transform: scaleY(.25); } 50% { transform: scaleY(1); } }
  @keyframes es-nacer { 0% { transform: scale(0); opacity: 0; } 70% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
  @keyframes es-destello { 0% { transform: scale(.7); opacity: .9; } 100% { transform: scale(2.3); opacity: 0; } }
  @keyframes es-toast { 0% { opacity: 0; transform: translate(-50%, -8px); } 10% { opacity: 1; transform: translate(-50%, 0); } 85% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, 0); } }
  @keyframes es-alerta { 0% { opacity: 0; transform: translateY(-10px); max-height: 0; } 100% { opacity: 1; transform: none; max-height: 400px; } }
  @keyframes es-latido { 0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,.55); } 50% { box-shadow: 0 0 0 7px rgba(248,113,113,0); } }
  @keyframes es-tilde { 0% { transform: scale(0) rotate(-30deg); } 70% { transform: scale(1.25); } 100% { transform: scale(1) rotate(0); } }
  @keyframes es-ping-borde { 0% { box-shadow: 0 0 0 0 rgba(248,113,113,.6); } 100% { box-shadow: 0 0 0 10px rgba(248,113,113,0); } }
  .es-item { cursor: pointer; transition: border-color .2s, background .2s, transform .2s, box-shadow .2s; }
  .es-item:hover { background: rgba(30,41,59,.75) !important; transform: translateX(2px); }
  .es-burbuja { cursor: pointer; }
  .es-burbuja:hover .es-nucleo { filter: brightness(1.3); }
  .es-tono { cursor: pointer; border: 1px solid rgba(148,163,184,.25); background: transparent; color: #94A3B8; font: inherit; font-size: 12px; font-weight: 700; padding: 5px 11px; border-radius: 999px; transition: all .15s; }
  .es-tono:hover { color: #F8FAFC; border-color: rgba(148,163,184,.5); }
  .es-tono[data-activo="1"] { background: rgba(253,164,175,.16); border-color: ${ACENTO}; color: ${ACENTO}; }
  .es-area { min-height: 96px; resize: vertical; line-height: 1.5; font-size: 13px; }
  .es-switch { cursor: pointer; border: 0; background: transparent; padding: 0; display: inline-flex; align-items: center; gap: 8px; font: inherit; color: #CBD5E1; font-size: 12.5px; font-weight: 600; }
  .es-switch:hover { color: #F8FAFC; }
  .es-cerrar { cursor: pointer; border: 0; background: transparent; color: #64748B; padding: 4px; border-radius: 8px; display: inline-flex; }
  .es-cerrar:hover { color: #F8FAFC; background: rgba(148,163,184,.15); }
  .es-fila { cursor: pointer; transition: background .15s; border-radius: 10px; }
  .es-fila:hover { background: rgba(148,163,184,.1); }
`

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Item {
  id: string; fuente: Fuente; autor: string; cuando: string; texto: string; estrellas?: number
  tema: Tema; sentimiento: Sentimiento
  /** -1 (muy negativo) a 1 (muy positivo). Posición X en el mapa. */
  puntaje: number
  urgente?: boolean
  accion?: { tipo: 'radar' | 'destacar'; etiqueta: string }
  borradores: Record<Tono, string>
}
interface ItemVivo extends Item {
  clasificado: boolean
  respuesta?: { texto: string; tono: Tono; modo: 'auto' | 'manual' }
  accionHecha: boolean
}

// ─── Datos: lo que dice la gente (en orden de llegada) ───────────────────────

const ITEMS: Item[] = [
  {
    id: 'i1', fuente: 'google', autor: 'Valeria Núñez', cuando: 'hace 1 min', estrellas: 5, texto: 'Excelente atención de Mica, volví por segunda vez y me asesoró igual de bien. Se nota que le gusta lo que hace.',
    tema: 'Atención', sentimiento: 'positivo', puntaje: 1, accion: { tipo: 'destacar', etiqueta: 'Mica' },
    borradores: {
      cercano: '¡Gracias, Valeria! Le pasamos tu mensaje a Mica, se va a poner re contenta. Te esperamos para la tercera.',
      formal: 'Muchas gracias por su reseña, Valeria. Le transmitimos sus palabras a Micaela. Será un gusto recibirla nuevamente.',
      divertido: '¡Valeria! Mica ya está enmarcando tu reseña. La tercera visita viene con abrazo incluido.',
    },
  },
  {
    id: 'i2', fuente: 'instagram', autor: '@agus.ferreyra', cuando: 'hace 2 min', texto: '¿Tienen el buzo oversize en talle L? 🙏',
    tema: 'Stock/Talles', sentimiento: 'neutral', puntaje: 0, accion: { tipo: 'radar', etiqueta: 'Buzo oversize talle L' },
    borradores: {
      cercano: 'Hola Agus, el oversize en L nos entra el martes. ¿Te avisamos por acá cuando llegue?',
      formal: 'Hola Agustina, el buzo oversize en talle L ingresa el martes. Si lo desea, le avisamos apenas esté disponible.',
      divertido: '¡Agus! El L viene en camino, llega el martes. Te reservamos uno con tu nombre, ¿va?',
    },
  },
  {
    id: 'i3', fuente: 'tienda', autor: 'Rodrigo Paz', cuando: 'hace 4 min', texto: 'Tardaron 9 días en mandarme el pedido y nadie me avisó nada. Pedido #4098 a Córdoba.',
    tema: 'Demora', sentimiento: 'negativo', puntaje: -0.9, urgente: true,
    borradores: {
      cercano: 'Tenés razón, Rodrigo, ese pedido salió tarde y encima no te avisamos. Te mando un 15% para la próxima y ya cambiamos la logística al interior.',
      formal: 'Rodrigo, tiene razón: su pedido salió con demora y no fue informado. Le pedimos disculpas, le enviamos un 15% de descuento para su próxima compra y ya modificamos la logística al interior.',
      divertido: 'Rodrigo, no hay excusa: 9 días es un montón y encima silencio de radio. Te va un 15% para la próxima y ya cambiamos el correo al interior.',
    },
  },
  {
    id: 'i4', fuente: 'google', autor: 'Camila Sosa', cuando: 'hace 6 min', estrellas: 5, texto: 'El jean mom me quedó perfecto ⭐⭐⭐⭐⭐ Primera vez que compro sin probarme y acierto.',
    tema: 'Producto', sentimiento: 'positivo', puntaje: 1,
    borradores: {
      cercano: '¡Gracias, Cami! Nos alegra que te haya quedado bien. Cuando quieras, pasá a ver los colores nuevos.',
      formal: 'Muchas gracias por su reseña, Camila. Nos alegra que el jean le haya quedado bien. La esperamos cuando guste.',
      divertido: '¡Cami! Un jean que queda perfecto a la primera es un pequeño milagro. Entraron colores nuevos, avisamos nomás.',
    },
  },
  {
    id: 'i5', fuente: 'instagram', autor: '@tomi.gimenez', cuando: 'hace 8 min', texto: 'Caro para lo que es',
    tema: 'Precio', sentimiento: 'negativo', puntaje: -0.9,
    borradores: {
      cercano: 'Hola Tomi, gracias por decirlo. Trabajamos con talleres de acá y telas nacionales, por eso el precio. Igual mirá la sección Outlet, hay cosas a mitad de precio.',
      formal: 'Hola Tomás, gracias por su comentario. Nuestras prendas se confeccionan en talleres locales con telas nacionales, lo que explica el precio. Lo invitamos a ver la sección Outlet.',
      divertido: 'Tomi, te entendemos: la inflación nos pega a todos. Talleres de acá y tela nacional, no hay magia. Pero el Outlet está a mitad de precio, pasá.',
    },
  },
  {
    id: 'i6', fuente: 'google', autor: 'Florencia Díaz', cuando: 'hace 11 min', estrellas: 4, texto: 'Hermoso el local nuevo de Caballito, re luminoso. Solo le falta un probador más grande.',
    tema: 'Local', sentimiento: 'positivo', puntaje: 0.8,
    borradores: {
      cercano: '¡Gracias, Flor! Nos costó mucho pero quedó como queríamos. Lo del probador lo anotamos. Te esperamos cuando quieras.',
      formal: 'Muchas gracias, Florencia. Nos alegra que le haya gustado el nuevo local. Tomamos nota de su sugerencia sobre el probador.',
      divertido: '¡Flor! Pintamos hasta las 3 de la mañana y valió la pena. El probador grande va en la lista de deseos, prometido.',
    },
  },
  {
    id: 'i7', fuente: 'tienda', autor: 'Lucas Ferreyra', cuando: 'hace 13 min', texto: 'Hacen envíos a Zona Sur? Estoy en Lanús',
    tema: 'Envíos', sentimiento: 'neutral', puntaje: 0.1, accion: { tipo: 'radar', etiqueta: 'Envíos a Zona Sur' },
    borradores: {
      cercano: 'Sí, Lucas, llegamos a toda Zona Sur por Correo Argentino en 2 a 4 días. El costo te lo muestra el carrito antes de pagar.',
      formal: 'Sí, Lucas. Realizamos envíos a toda Zona Sur mediante Correo Argentino, con entrega en 2 a 4 días hábiles. El costo se calcula en el carrito.',
      divertido: '¡Sí, Lucas! Zona Sur es casa. Correo Argentino, 2 a 4 días, y el costo te lo canta el carrito antes de pagar.',
    },
  },
  {
    id: 'i8', fuente: 'google', autor: 'Mariano Ledesma', cuando: 'hace 15 min', estrellas: 2, texto: 'Compré el 20 y recién llegó el 29 a Rosario. Una lástima porque la ropa es linda.',
    tema: 'Demora', sentimiento: 'negativo', puntaje: -0.6,
    borradores: {
      cercano: 'Mariano, tenés razón y te pedimos perdón: ese pedido salió el 22 y tardó mucho más de lo prometido. Te mando un 15% para la próxima y ya cambiamos el correo al interior.',
      formal: 'Mariano, tiene razón: su pedido salió el 22 y demoró más de lo prometido. Le pedimos disculpas, le enviamos un 15% de descuento y ya modificamos la logística al interior.',
      divertido: 'Mariano, 9 días es una eternidad y lo sabemos. Gracias por bancar la ropa igual. Te va un 15% y ya cambiamos el correo al interior, de verdad.',
    },
  },
  {
    id: 'i9', fuente: 'instagram', autor: '@belu.cordoba', cuando: 'hace 18 min', texto: 'Nadie contesta el Instagram, mandé 3 mensajes 😤',
    tema: 'Atención', sentimiento: 'negativo', puntaje: -0.8, urgente: true,
    borradores: {
      cercano: 'Belu, perdón, se nos pasaron tus mensajes y no está bien. Ya te respondimos por privado. ¿En qué te podemos ayudar?',
      formal: 'Belén, le pedimos disculpas: sus mensajes no fueron respondidos a tiempo. Ya le escribimos por mensaje privado. Quedamos a su disposición.',
      divertido: 'Belu, tres mensajes y silencio: no hay defensa. Ya te escribimos por privado y prometemos que no se repite.',
    },
  },
  {
    id: 'i10', fuente: 'tienda', autor: 'Julieta Bravo', cuando: 'hace 21 min', texto: 'La remera negra se destiñó al primer lavado, la lavé en frío como dice la etiqueta.',
    tema: 'Producto', sentimiento: 'negativo', puntaje: -0.7,
    borradores: {
      cercano: 'Julieta, eso no tendría que pasar. Te la cambiamos sin costo: pasá por el local o te mandamos una nueva, vos elegís.',
      formal: 'Julieta, lamentamos lo ocurrido: no es la calidad que ofrecemos. Le cambiamos la prenda sin costo, en el local o con envío a domicilio.',
      divertido: 'Julieta, una remera que se destiñe es una remera que falló. Te la cambiamos ya: local o envío, lo que te quede más cómodo.',
    },
  },
  {
    id: 'i11', fuente: 'instagram', autor: '@paula.herrera', cuando: 'hace 24 min', texto: 'Me encantó cómo me asesoró Mica por mensaje, compré dos remeras 😍',
    tema: 'Atención', sentimiento: 'positivo', puntaje: 0.9, accion: { tipo: 'destacar', etiqueta: 'Mica' },
    borradores: {
      cercano: '¡Gracias, Pau! Mica es una genia asesorando. Contanos cómo te quedaron las remeras.',
      formal: 'Muchas gracias, Paula. Le transmitimos sus palabras a Micaela. Esperamos que disfrute las remeras.',
      divertido: '¡Pau! Mica tiene un radar para saber qué te queda bien. Mandanos foto con las remeras, queremos verlas.',
    },
  },
  {
    id: 'i12', fuente: 'tienda', autor: 'Nico Bravo', cuando: 'hace 27 min', texto: 'Pedido #4127 sigue “en preparación” hace una semana, ¿qué pasa? Va a Mendoza.',
    tema: 'Demora', sentimiento: 'negativo', puntaje: -0.8, urgente: true,
    borradores: {
      cercano: 'Nico, tenés razón, el #4127 se trabó en preparación por un problema nuestro. Sale hoy con envío prioritario y te mando el seguimiento por acá.',
      formal: 'Nicolás, tiene razón: el pedido #4127 quedó demorado por un inconveniente interno. Sale hoy con envío prioritario y le enviamos el seguimiento por este medio.',
      divertido: 'Nico, el #4127 se quedó dormido en el depósito y ya lo despertamos. Sale hoy con prioridad y te paso el seguimiento por acá.',
    },
  },
  {
    id: 'i13', fuente: 'google', autor: 'Gonzalo Aguirre', cuando: 'hace 31 min', estrellas: 3, texto: 'Buena calidad pero los precios subieron un montón desde marzo.',
    tema: 'Precio', sentimiento: 'neutral', puntaje: -0.3,
    borradores: {
      cercano: 'Gracias por la sinceridad, Gonzalo. Subieron las telas y tuvimos que trasladar parte. Estamos armando precios de temporada para compensar.',
      formal: 'Gracias por su comentario, Gonzalo. El aumento responde al costo de las telas. Estamos preparando precios de temporada para compensarlo.',
      divertido: 'Gonzalo, te lo firmamos: subió todo, hasta el hilo. Estamos armando precios de temporada para que no duela tanto.',
    },
  },
  {
    id: 'i14', fuente: 'instagram', autor: '@meli.ruiz', cuando: 'hace 35 min', texto: 'Hace un mes que espero que repongan la puffer en M 😩',
    tema: 'Stock/Talles', sentimiento: 'neutral', puntaje: -0.4, accion: { tipo: 'radar', etiqueta: 'Campera puffer talle M' },
    borradores: {
      cercano: 'Meli, la puffer en M nos entra la semana que viene. Te aviso apenas llegue, ¿dale?',
      formal: 'Melina, la campera puffer en talle M ingresa la semana próxima. Le avisamos apenas esté disponible.',
      divertido: 'Meli, la puffer M está en camino, llega la semana que viene. Te la guardamos calentita.',
    },
  },
]

/** Cruce con ventas que muestra Orbi al abrir una alerta. */
const INVESTIGACION: Partial<Record<Tema, { cruce: string; sugerencia: string; boton: string; hecho: string }>> = {
  Demora: {
    cruce: 'Crucé las 3 quejas con Pedidos: los tres salieron el 22, el día que faltó Mica, y los tres van al interior por Correo Argentino. Los 4 pedidos del 22 a CABA llegaron bien.',
    sugerencia: 'Avisarles a los 4 clientes que todavía esperan un pedido del 22, y pasar los envíos al interior a Andreani (llega en 3 días en vez de 8).',
    boton: 'Hacer las dos cosas',
    hecho: 'Avisé a los 4 clientes con el seguimiento y dejé configurado Andreani para el interior desde mañana.',
  },
}
const INVESTIGACION_GENERICA = {
  cruce: 'Crucé las quejas con Ventas: se concentran entre las 19 y las 21, cuando atiende una sola persona.',
  sugerencia: 'Sumar un refuerzo de 19 a 21 los jueves y viernes.',
  boton: 'Crear la tarea',
  hecho: 'Creé la tarea para el refuerzo de 19 a 21.',
}
/** Pedidos por día (del 20 al 25): salidos a tiempo vs. tarde. */
const PEDIDOS_DIAS = [
  { dia: 20, ok: 6, tarde: 0 }, { dia: 21, ok: 5, tarde: 0 }, { dia: 22, ok: 4, tarde: 3 }, { dia: 23, ok: 7, tarde: 0 }, { dia: 24, ok: 6, tarde: 0 }, { dia: 25, ok: 3, tarde: 0 },
]

// ─── Resúmenes de Orbi (determinísticos) ─────────────────────────────────────

const plural = (n: number, s: string, p: string) => (n === 1 ? s : p)

function resumenTema(tema: Tema, its: ItemVivo[]): string {
  const pos = its.filter(i => i.sentimiento === 'positivo').length
  const neg = its.filter(i => i.sentimiento === 'negativo').length
  const n = its.length
  if (n === 0) return `Todavía nadie habló de ${tema.toLowerCase()}. Si aparece, lo vas a ver crecer acá.`
  switch (tema) {
    case 'Demora':
      return neg >= 3
        ? `${neg} quejas, todas de pedidos con envío al interior que salieron entre el 20 y el 25. No es casualidad: mirá la alerta de arriba.`
        : `${neg} ${plural(neg, 'queja', 'quejas')} por demora, de ${plural(neg, 'un envío', 'envíos')} al interior. Si llega una tercera, te aviso.`
    case 'Atención': {
      const mica = its.filter(i => i.accion?.tipo === 'destacar').length
      const a = pos > 0 ? `${pos} ${plural(pos, 'elogio', 'elogios')}${mica > 0 ? ` (${mica} ${plural(mica, 'nombra', 'nombran')} a Mica)` : ''}` : ''
      const b = neg > 0 ? `${neg} ${plural(neg, 'queja', 'quejas')} por mensajes de Instagram sin responder` : ''
      return `${[a, b].filter(Boolean).join(' y ')}. ${neg > 0 ? 'La atención en el local es tu fuerte; la de Instagram, no.' : 'Es tu tema más fuerte: la gente vuelve por cómo la atienden.'}`
    }
    case 'Precio':
      return `${n} ${plural(n, 'comentario', 'comentarios')}: sienten que subió desde marzo. No dicen que sea malo, dicen que es caro para lo que es. Un Outlet visible ayuda.`
    case 'Producto':
      return neg > 0
        ? `${pos} ${plural(pos, 'elogio', 'elogios')} al calce y ${neg} ${plural(neg, 'queja', 'quejas')} por una remera negra que se destiñó. Vale revisar ese lote con el taller.`
        : `${pos} ${plural(pos, 'elogio', 'elogios')} al calce del jean mom. Es un producto para empujar en la portada.`
    case 'Local':
      return 'Al local nuevo de Caballito lo elogian: luminoso y bien ubicado. Un pedido concreto: probador más grande.'
    case 'Envíos':
      return `${n} ${plural(n, 'consulta', 'consultas')} por envíos a Zona Sur. No es queja, es demanda: va al Radar de Deseos.`
    case 'Stock/Talles':
      return `${n} ${plural(n, 'pedido', 'pedidos')} de talles que hoy no tenés (L y M). Es demanda, no queja: mandalos al Radar y avisales cuando entren.`
  }
}

// ─── Piezas chicas ───────────────────────────────────────────────────────────

function NumeroAnimado({ valor, formato = (n: number) => String(n), style }: { valor: number; formato?: (n: number) => string; style?: CSSProperties }) {
  const [mostrado, setMostrado] = useState(valor)
  const previo = useRef(valor)
  useEffect(() => {
    const desde = previo.current
    const hasta = valor
    if (desde === hasta) return
    const inicio = performance.now()
    let raf = 0
    const paso = (ahora: number) => {
      const u = Math.min(1, (ahora - inicio) / 550)
      const e = 1 - Math.pow(1 - u, 3)
      setMostrado(Math.round((desde + (hasta - desde) * e) * 10) / 10)
      if (u < 1) raf = requestAnimationFrame(paso)
      else previo.current = hasta
    }
    raf = requestAnimationFrame(paso)
    return () => { cancelAnimationFrame(raf); previo.current = hasta }
  }, [valor])
  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{formato(mostrado)}</span>
}

function Metrica({ icono, etiqueta, valor, sub, color }: { icono: ReactNode; etiqueta: string; valor: ReactNode; sub: ReactNode; color: string }) {
  return (
    <Tarjeta style={{ padding: '12px 14px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        <span style={{ color, display: 'inline-flex' }}>{icono}</span>{etiqueta}
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: C.text, marginTop: 4, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
    </Tarjeta>
  )
}

function IconoFuente({ fuente, size = 32 }: { fuente: Fuente; size?: number }) {
  const base: CSSProperties = { width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
  if (fuente === 'google') {
    return (
      <span style={{ ...base, background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,.35)' }}>
        <svg viewBox="0 0 24 24" style={{ width: size * 0.56, height: size * 0.56 }} aria-hidden>
          <path d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" />
          <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
          <path d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9z" fill="#FBBC05" />
          <path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" fill="#EA4335" />
        </svg>
      </span>
    )
  }
 }

function Estrellas({ n }: { n: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }} aria-label={`${n} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map(i => <Star key={i} size={11} fill={i <= n ? C.warning : 'transparent'} color={i <= n ? C.warning : C.subtle} />)}
    </span>
  )
}

function Leyendo() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.orbiLight, fontWeight: 600 }}>
      <Sparkles size={12} />Orbi leyendo
      <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
        {[0, 1, 2].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: C.orbiLight, animation: `pr-typing 1s ease-in-out ${i * 0.15}s infinite` }} />)}
      </span>
    </span>
  )
}

function Pasos({ paso }: { paso: number }) {
  const items = ['Escuchar', 'Clasificar', 'Responder', 'Actuar']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {items.map((t, i) => {
        const n = i + 1
        const hecho = paso > n, activo = paso === n
        const color = hecho ? C.success : activo ? ACENTO : C.subtle
        return (
          <Fragment key={t}>
            {i > 0 && <span style={{ width: 12, height: 1, background: hecho || activo ? color : C.border }} />}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px 4px 5px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color, background: activo ? `${ACENTO}1F` : 'transparent', border: `1px solid ${activo ? `${ACENTO}66` : C.border}`, transition: 'all .3s' }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, background: hecho ? C.success : activo ? ACENTO : 'transparent', color: hecho || activo ? '#0F172A' : C.subtle, border: hecho || activo ? 'none' : `1px solid ${C.subtle}` }}>{hecho ? <Check size={10} /> : n}</span>
              {t}
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}

function Switch({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="es-switch" onClick={onClick} aria-pressed={activo}>
      <span style={{ width: 34, height: 20, borderRadius: 999, background: activo ? `linear-gradient(135deg, ${C.primary}, ${C.orbi})` : 'rgba(148,163,184,.25)', position: 'relative', transition: 'background .25s', flexShrink: 0, boxShadow: activo ? '0 0 12px rgba(139,92,246,.45)' : 'none' }}>
        <span style={{ position: 'absolute', top: 2, left: activo ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .25s cubic-bezier(.2,.8,.2,1)' }} />
      </span>
      {children}
    </button>
  )
}

function Tilde({ color = C.success, size = 18 }: { color?: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: color, color: '#0F172A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'es-tilde .45s cubic-bezier(.2,.8,.2,1) both' }}>
      <Check size={size * 0.66} strokeWidth={3} />
    </span>
  )
}

function FilaItem({ it, onClick }: { it: ItemVivo; onClick: () => void }) {
  return (
    <div className="es-fila" onClick={onClick} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px' }}>
      <IconoFuente fuente={it.fuente} size={20} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, color: C.body, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.texto}</div>
        <div style={{ fontSize: 11, color: C.subtle }}>{it.autor} · {it.cuando}</div>
      </div>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: SENT[it.sentimiento].color, marginTop: 6, flexShrink: 0 }} title={SENT[it.sentimiento].nombre} />
      {it.respuesta && <Check size={13} color={C.success} style={{ marginTop: 4, flexShrink: 0 }} />}
    </div>
  )
}

// ─── Geometría del mapa ──────────────────────────────────────────────────────

const xDe = (puntaje: number) => PAD_L + ((puntaje + 1) / 2) * (W - PAD_L - PAD_R)
const yDe = (n: number, maxN: number) => H - PAD_B - 26 - (n / maxN) * (H - PAD_B - 26 - PAD_T)
const rDe = (n: number) => (n === 0 ? 11 : 17 + Math.sqrt(n) * 11)
const xMuelle = (idx: number) => PAD_L + ((idx + 0.5) / TEMAS.length) * (W - PAD_L - PAD_R)

// ─── Componente principal ────────────────────────────────────────────────────

export default function Escucha() {
  const [items, setItems] = useState<ItemVivo[]>([])
  const [llegados, setLlegados] = useState(0)
  const [ronda, setRonda] = useState(0)
  const [pausado, setPausado] = useState(false)
  const [auto, setAuto] = useState(true)
  const [tono, setTono] = useState<Tono>('cercano')
  const [sel, setSel] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [temaSel, setTemaSel] = useState<Tema | null>(null)
  const [hoverTema, setHoverTema] = useState<Tema | null>(null)
  const [destello, setDestello] = useState<{ id: number; tema: Tema } | null>(null)
  const [alertaAbierta, setAlertaAbierta] = useState<Tema | null>(null)
  const [alertasResueltas, setAlertasResueltas] = useState<Tema[]>([])
  const [destacada, setDestacada] = useState(false)
  const [toast, setToast] = useState<{ id: number; texto: string; color: string } | null>(null)

  const autoRef = useRef(true)
  const tonoRef = useRef<Tono>('cercano')
  const timers = useRef<Set<number>>(new Set())
  const contador = useRef(0)
  const toastTimer = useRef(0)
  const hoverTimer = useRef(0)

  // Limpieza total al desmontar.
  useEffect(() => {
    const activos = timers.current
    return () => { activos.forEach(id => window.clearTimeout(id)); activos.clear() }
  }, [])

  // Motor de llegada: un item cada LLEGADA_MS mientras no esté pausado.
  useEffect(() => {
    if (pausado || llegados >= ITEMS.length) return
    const activos = timers.current
    const agendar = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => { activos.delete(id); fn() }, ms)
      activos.add(id)
      return id
    }
    const idLlegada = agendar(() => {
      const base = ITEMS[llegados]
      if (!base) return
      setItems(prev => (prev.some(i => i.id === base.id) ? prev : [...prev, { ...base, clasificado: false, accionHecha: false }]))
      setLlegados(llegados + 1)
      agendar(() => {
        setItems(prev => prev.map(i => (i.id === base.id ? { ...i, clasificado: true } : i)))
        contador.current += 1
        const idDestello = contador.current
        setDestello({ id: idDestello, tema: base.tema })
        agendar(() => setDestello(cur => (cur?.id === idDestello ? null : cur)), 1500)
        if (base.sentimiento === 'positivo') {
          agendar(() => {
            if (!autoRef.current) return
            const t = tonoRef.current
            setItems(prev => prev.map(i => (i.id === base.id && !i.respuesta ? { ...i, respuesta: { texto: i.borradores[t], tono: t, modo: 'auto' } } : i)))
          }, AUTO_MS)
        }
      }, CLASIFICAR_MS)
    }, llegados === 0 ? 700 : LLEGADA_MS)
    return () => { window.clearTimeout(idLlegada); activos.delete(idLlegada) }
  }, [pausado, llegados, ronda])

  // ── Timers con limpieza (solo desde handlers) ──
  const luego = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn() }, ms)
    timers.current.add(id)
    return id
  }
  const avisar = (t: string, color = ACENTO) => {
    window.clearTimeout(toastTimer.current)
    timers.current.delete(toastTimer.current)
    contador.current += 1
    setToast({ id: contador.current, texto: t, color })
    toastTimer.current = luego(() => setToast(null), 3600)
  }
  const entrarHover = (t: Tema) => { window.clearTimeout(hoverTimer.current); timers.current.delete(hoverTimer.current); setHoverTema(t) }
  const salirHover = () => { window.clearTimeout(hoverTimer.current); timers.current.delete(hoverTimer.current); hoverTimer.current = luego(() => setHoverTema(null), 220) }

  // ── Handlers ──
  const abrirItem = (id: string) => {
    const it = items.find(i => i.id === id)
    if (!it || !it.clasificado) return
    if (sel === id) { setSel(null); return }
    setSel(id)
    setTemaSel(null)
    setTexto(it.respuesta?.texto ?? it.borradores[tono])
  }
  const cerrarItem = () => setSel(null)
  const elegirTema = (t: Tema) => { setSel(null); setTemaSel(prev => (prev === t ? null : t)) }
  const cambiarTono = (t: Tono) => {
    setTono(t)
    tonoRef.current = t
    const it = sel ? items.find(i => i.id === sel) : undefined
    if (it) setTexto(it.borradores[t])
  }
  const publicar = () => {
    const it = sel ? items.find(i => i.id === sel) : undefined
    if (!it || !texto.trim()) return
    const modo = it.respuesta?.modo ?? 'manual'
    setItems(prev => prev.map(i => (i.id === it.id ? { ...i, respuesta: { texto: texto.trim(), tono, modo: modo === 'auto' ? 'manual' : 'manual' } } : i)))
    avisar(`${it.respuesta ? 'Respuesta actualizada' : 'Respuesta publicada'} en ${it.fuente === 'google' ? 'Google' : it.fuente === 'instagram' ? 'Instagram' : 'la tienda'} · tono ${TONOS.find(x => x.id === tono)?.nombre.toLowerCase()}`, C.success)
    setSel(null)
  }
  const activarAuto = (v: boolean) => {
    autoRef.current = v
    setAuto(v)
    if (v) {
      const t = tonoRef.current
      const pendientes = items.filter(i => i.clasificado && i.sentimiento === 'positivo' && !i.respuesta).length
      setItems(prev => prev.map(i => (i.clasificado && i.sentimiento === 'positivo' && !i.respuesta ? { ...i, respuesta: { texto: i.borradores[t], tono: t, modo: 'auto' } } : i)))
      if (pendientes > 0) avisar(`Orbi respondió ${pendientes} ${plural(pendientes, 'positiva pendiente', 'positivas pendientes')} en automático`, C.orbiLight)
    }
  }
  const mandarRadar = (ids: string[]) => {
    if (ids.length === 0) return
    setItems(prev => prev.map(i => (ids.includes(i.id) ? { ...i, accionHecha: true } : i)))
    avisar(ids.length === 1 ? `“${items.find(i => i.id === ids[0])?.accion?.etiqueta ?? ''}” ya está en el Radar de Deseos` : `${ids.length} pedidos mandados al Radar de Deseos`, ACENTO_FUERTE)
  }
  const destacar = () => {
    setDestacada(true)
    setItems(prev => prev.map(i => (i.accion?.tipo === 'destacar' ? { ...i, accionHecha: true } : i)))
    avisar('Mica ya aparece en la portada de la tienda con dos reseñas', C.warning)
  }
  const resolverAlerta = (t: Tema) => {
    setAlertasResueltas(prev => (prev.includes(t) ? prev : [...prev, t]))
    setAlertaAbierta(null)
    avisar((INVESTIGACION[t] ?? INVESTIGACION_GENERICA).hecho, C.success)
  }
  const reiniciar = () => {
    timers.current.forEach(id => window.clearTimeout(id))
    timers.current.clear()
    contador.current = 0
    autoRef.current = true
    tonoRef.current = 'cercano'
    setItems([]); setLlegados(0); setRonda(r => r + 1); setPausado(false); setAuto(true); setTono('cercano')
    setSel(null); setTexto(''); setTemaSel(null); setHoverTema(null); setDestello(null)
    setAlertaAbierta(null); setAlertasResueltas([]); setDestacada(false); setToast(null)
  }

  // ── Derivados ──
  const clasificados = items.filter(i => i.clasificado)
  const porTema = TEMAS.reduce((acc, t) => { acc[t] = clasificados.filter(i => i.tema === t); return acc }, {} as Record<Tema, ItemVivo[]>)
  const negPorTema = (t: Tema) => porTema[t].filter(i => i.sentimiento === 'negativo').length
  const maxN = Math.max(4, ...TEMAS.map(t => porTema[t].length))
  const burbujas = TEMAS.map((t, idx) => {
    const its = porTema[t]
    const n = its.length
    const puntaje = n === 0 ? 0 : its.reduce((s, i) => s + i.puntaje, 0) / n
    return { tema: t, n, puntaje, x: n === 0 ? xMuelle(idx) : xDe(puntaje), y: n === 0 ? H - PAD_B + 14 : yDe(n, maxN), r: rDe(n), color: TEMA_COLOR[t], its }
  })
  const temaMostrado = temaSel ?? hoverTema
  const ordenadas = [...burbujas].sort((a, b) => (a.tema === temaMostrado ? 1 : 0) - (b.tema === temaMostrado ? 1 : 0))

  const alertas = TEMAS.filter(t => negPorTema(t) >= 3)
  const alertasPendientes = alertas.filter(t => !alertasResueltas.includes(t))
  const respondidas = items.filter(i => i.respuesta).length
  const manuales = items.filter(i => i.respuesta?.modo === 'manual').length
  const google = items.filter(i => i.fuente === 'google' && typeof i.estrellas === 'number')
  const reputacion = (RESENAS_PREVIAS * REPUTACION_PREVIA + google.reduce((s, i) => s + (i.estrellas ?? 0), 0)) / (RESENAS_PREVIAS + google.length)
  const caliente = TEMAS.map(t => ({ t, n: negPorTema(t) })).filter(x => x.n >= 2).sort((a, b) => b.n - a.n)[0]
  const positivos = clasificados.filter(i => i.sentimiento === 'positivo').length
  const negativos = clasificados.filter(i => i.sentimiento === 'negativo').length
  const neutrales = clasificados.length - positivos - negativos
  const pedidos = clasificados.filter(i => i.accion?.tipo === 'radar')
  const pedidosPendientes = pedidos.filter(i => !i.accionHecha)
  const elogios = clasificados.filter(i => i.accion?.tipo === 'destacar')
  const accionesTotal = (pedidos.length > 0 ? 1 : 0) + (elogios.length > 0 ? 1 : 0) + alertas.length
  const accionesHechas = (pedidos.length > 0 && pedidosPendientes.length === 0 ? 1 : 0) + (destacada ? 1 : 0) + alertasResueltas.length
  const itemSel = sel ? items.find(i => i.id === sel) : undefined
  const terminado = llegados >= ITEMS.length

  const paso = accionesHechas > 0 ? 4 : manuales > 0 ? 3 : clasificados.length > 0 ? 2 : 1
  const pista = (() => {
    if (llegados === 0) return 'Orbi se conectó a Google, Instagram y la tienda. Van llegando los mensajes: cada uno se clasifica solo.'
    if (alertasPendientes.length > 0 && !alertaAbierta) return 'Saltó una alerta: un tema negativo se repitió 3 veces. Tocá “Ver qué pasó” para cruzarlo con las ventas.'
    if (itemSel) return itemSel.sentimiento === 'negativo' ? 'Una queja: Orbi propone un borrador empático y concreto. Cambiá el tono, editá y publicá.' : itemSel.accion?.tipo === 'radar' ? 'Es un pedido: Orbi responde con datos reales y lo puede mandar al Radar de Deseos.' : 'Una positiva: si el automático está prendido, Orbi ya la contestó. Podés retocarla igual.'
    if (manuales === 0) return 'Tocá un mensaje de la bandeja para ver el borrador de Orbi, o una burbuja del mapa para leer qué dice la gente de ese tema.'
    if (accionesHechas < accionesTotal) return 'Abajo, Orbi sugiere acciones: mandá los pedidos al Radar de Deseos y destacá a Mica en la tienda.'
    return 'Ciclo completo: escuchó, clasificó, respondió y lo convirtió en acciones. Reiniciá para verlo de nuevo.'
  })()

  const orbiGeneral = clasificados.length === 0
    ? 'Escuchando… apenas llegue el primer mensaje te digo de qué habla.'
    : `Escuché ${clasificados.length} ${plural(clasificados.length, 'mensaje', 'mensajes')} de 3 fuentes: ${positivos} ${plural(positivos, 'elogio', 'elogios')}, ${negativos} ${plural(negativos, 'queja', 'quejas')} y ${neutrales} ${plural(neutrales, 'consulta', 'consultas')}. ${caliente ? `Lo que más se repite en negativo: ${caliente.t.toLowerCase()}.` : 'Por ahora ningún tema se repite en negativo.'}`

  const burbujaDetalle = temaMostrado ? burbujas.find(b => b.tema === temaMostrado) : undefined

  return (
    <div style={{ position: 'relative', padding: 26, minHeight: 600, fontFamily: FONT, color: C.body }}>
      <style>{CSS}</style>

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${ACENTO_FUERTE}, ${C.orbi})`, color: '#fff', boxShadow: `0 8px 24px ${ACENTO_FUERTE}55`, flexShrink: 0 }}><Ear size={19} /></span>
          <div style={{ minWidth: 0 }}>
            <Etiqueta color={ACENTO}>{NEGOCIO} · Orbi Escucha</Etiqueta>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>Todo lo que dice la gente, en un mapa; y Orbi responde con tu voz</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 1.4 }}><Zap size={13} color={C.warning} style={{ flexShrink: 0, marginTop: 2 }} /><span>{pista}</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Pasos paso={paso} />
          <Boton variante="fantasma" tam="sm" onClick={reiniciar}><RotateCcw size={13} />Reiniciar</Boton>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div key={toast.id} style={{ position: 'absolute', top: 18, left: '50%', zIndex: 30, padding: '10px 16px', borderRadius: 12, background: 'rgba(15,23,42,.96)', border: `1px solid ${toast.color}66`, boxShadow: `0 12px 40px rgba(0,0,0,.5), 0 0 0 1px ${toast.color}22`, color: C.text, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, animation: 'es-toast 3.6s ease both', maxWidth: 620, pointerEvents: 'none' }}>
          <Bell size={14} color={toast.color} style={{ flexShrink: 0 }} />{toast.texto}
        </div>
      )}

      {/* Alertas */}
      {alertas.map(t => {
        const resuelta = alertasResueltas.includes(t)
        const abierta = alertaAbierta === t
        const inv = INVESTIGACION[t] ?? INVESTIGACION_GENERICA
        const n = negPorTema(t)
        const color = resuelta ? C.success : C.error
        return (
          <div key={t} style={{ border: `1px solid ${color}66`, background: resuelta ? 'rgba(52,211,153,.07)' : 'rgba(248,113,113,.08)', borderRadius: 14, padding: '11px 14px', marginBottom: 12, animation: 'es-alerta .5s cubic-bezier(.2,.8,.2,1) both', overflow: 'hidden', transition: 'border-color .3s, background .3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${color}22`, color, animation: resuelta ? 'none' : 'es-latido 1.6s ease-in-out infinite', flexShrink: 0 }}>{resuelta ? <Check size={15} /> : <Bell size={14} />}</span>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{resuelta ? `Resuelto: ${t.toLowerCase()}` : `${n} quejas por ${t.toLowerCase()} esta semana`}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{resuelta ? inv.hecho : `Orbi lo detectó al clasificar el mensaje de ${porTema[t].filter(i => i.sentimiento === 'negativo')[n - 1]?.autor ?? ''}. Antes te enterabas cuando bajaba la reputación.`}</div>
              </div>
              {!resuelta && !abierta && <Boton variante="suave" tam="sm" color={C.error} onClick={() => setAlertaAbierta(t)}><Search size={13} />Ver qué pasó</Boton>}
              {!resuelta && abierta && <button type="button" className="es-cerrar" onClick={() => setAlertaAbierta(null)} aria-label="Cerrar"><X size={16} /></button>}
            </div>
            {abierta && !resuelta && (
              <div className="pr-fade-up" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 250px', gap: 16, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <OrbiAvatar size={30} />
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: C.body }}>
                    <div>{inv.cruce}</div>
                    <div style={{ marginTop: 8, color: C.text }}><span style={{ fontWeight: 800, color: C.orbiLight }}>Te propongo: </span>{inv.sugerencia}</div>
                    <div style={{ marginTop: 10 }}><Boton tam="sm" color={C.orbi} onClick={() => resolverAlerta(t)}><Zap size={13} />{inv.boton}</Boton></div>
                  </div>
                </div>
                <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: 'rgba(2,6,23,.4)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Pedidos que salieron · del 20 al 25</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 64 }}>
                    {PEDIDOS_DIAS.map(d => {
                      const tot = d.ok + d.tarde
                      return (
                        <div key={d.dia} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: `${(tot / 8) * 100}%`, borderRadius: 4, overflow: 'hidden', transformOrigin: 'bottom', animation: 'pr-fade-up .5s ease both' }}>
                            {d.tarde > 0 && <div style={{ height: `${(d.tarde / tot) * 100}%`, background: C.error }} />}
                            <div style={{ flex: 1, background: d.tarde > 0 ? `${C.primary}88` : `${C.primary}55` }} />
                          </div>
                          <span style={{ fontSize: 10.5, fontFamily: FONT_MONO, color: d.tarde > 0 ? C.error : C.subtle, fontWeight: d.tarde > 0 ? 800 : 500 }}>{d.dia}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.error, marginRight: 5 }} />3 tarde el 22 · faltó Mica</div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
        <Metrica icono={<Star size={14} />} color={C.warning} etiqueta="Reputación" valor={<NumeroAnimado valor={Math.round(reputacion * 10) / 10} formato={n => n.toFixed(1).replace('.', ',')} />} sub={`${RESENAS_PREVIAS + google.length} reseñas en Google · ${google.length} ${plural(google.length, 'nueva', 'nuevas')} hoy`} />
        <Metrica icono={<MessageSquare size={14} />} color={C.success} etiqueta="Respondidas" valor={<><NumeroAnimado valor={respondidas} /><span style={{ color: C.subtle, fontSize: 16 }}>/{items.length}</span></>} sub={`${respondidas - manuales} solas por Orbi · ${manuales} con tu aprobación`} />
        <Metrica icono={<Clock size={14} />} color={C.primaryLight} etiqueta="Tiempo medio de respuesta" valor={respondidas > 0 ? '4 min' : '—'} sub={<span>antes: <span style={{ textDecoration: 'line-through' }}>2 días</span></span>} />
        <Metrica icono={<Flame size={14} />} color={C.error} etiqueta="Temas calientes" valor={caliente ? <span style={{ color: TEMA_COLOR[caliente.t] }}>{caliente.t}</span> : <span style={{ color: C.subtle }}>ninguno</span>} sub={caliente ? `${caliente.n} quejas · ${alertasResueltas.includes(caliente.t) ? 'ya actuaste' : caliente.n >= 3 ? 'alerta activa' : 'una más y te aviso'}` : 'ningún tema negativo se repite'} />
      </div>

      {/* Dos columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)', gap: 18, alignItems: 'start' }}>
        {/* ── IZQUIERDA: bandeja en vivo ── */}
        <Tarjeta style={{ overflow: 'hidden', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14 }} aria-hidden>
                {[0, 1, 2, 3].map(i => <span key={i} style={{ width: 3, height: 14, borderRadius: 2, background: pausado ? C.subtle : ACENTO, transformOrigin: 'bottom', animation: pausado || terminado ? 'none' : `es-barra ${0.8 + i * 0.13}s ease-in-out ${i * 0.1}s infinite`, transform: pausado || terminado ? 'scaleY(.35)' : undefined }} />)}
              </span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>Bandeja en vivo</div>
                <div style={{ fontSize: 11.5, color: C.muted }}>{items.length} de {ITEMS.length} · Google, Instagram y la tienda</div>
              </div>
            </div>
            <Boton variante="fantasma" tam="sm" onClick={() => setPausado(p => !p)} disabled={terminado}>{pausado ? <><Play size={12} />Reanudar</> : <><Pause size={12} />Pausar</>}</Boton>
          </div>
          <div className="pr-scroll" style={{ maxHeight: 640, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.length === 0 && (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: C.subtle, fontSize: 13 }}>
                <Ear size={26} style={{ opacity: .5, marginBottom: 8 }} />
                <div>Conectando fuentes…</div>
              </div>
            )}
            {[...items].reverse().map(it => {
              const activo = sel === it.id
              const tc = TEMA_COLOR[it.tema]
              return (
                <div
                  key={it.id}
                  className="es-item"
                  onClick={() => abrirItem(it.id)}
                  style={{
                    borderRadius: 14, padding: '11px 12px', border: `1px solid ${activo ? ACENTO : it.urgente && it.clasificado ? 'rgba(248,113,113,.6)' : C.border}`,
                    background: activo ? 'rgba(253,164,175,.08)' : 'rgba(15,23,42,.5)',
                    animation: `es-llegar .6s cubic-bezier(.2,.8,.2,1) both${it.urgente && it.clasificado && !it.respuesta ? ', es-ping-borde 1.6s ease-out .1s 2' : ''}`,
                    boxShadow: activo ? `0 0 0 3px ${ACENTO}22` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                      <IconoFuente fuente={it.fuente} />
                      <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${ACENTO}`, animation: 'pr-ping 1.1s ease-out .05s 2 both', pointerEvents: 'none' }} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.autor}</span>
                        <span style={{ fontSize: 10.5, color: C.subtle, fontFamily: FONT_MONO, whiteSpace: 'nowrap' }}>{it.cuando}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.subtle, marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>{FUENTE_NOMBRE[it.fuente]}{typeof it.estrellas === 'number' && <Estrellas n={it.estrellas} />}</div>
                      <div style={{ fontSize: 13, color: C.body, lineHeight: 1.45, marginTop: 5 }}>{it.texto}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8, minHeight: 24 }}>
                        {it.clasificado ? (
                          <div className="pr-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Chip color={tc} style={{ fontSize: 11, padding: '3px 8px' }}>{it.tema}</Chip>
                            <Chip color={SENT[it.sentimiento].color} style={{ fontSize: 11, padding: '3px 8px' }}>{SENT[it.sentimiento].nombre}</Chip>
                            {it.urgente && <Chip color={C.error} style={{ fontSize: 11, padding: '3px 8px' }}><AlertTriangle size={10} />Urgente</Chip>}
                          </div>
                        ) : <Leyendo />}
                        {it.clasificado && (
                          it.respuesta
                            ? <span className="pr-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: C.success, whiteSpace: 'nowrap' }}><Tilde size={15} />{it.respuesta.modo === 'auto' ? 'Respondida sola' : 'Respondida'}</span>
                            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 700, color: it.sentimiento === 'negativo' ? ACENTO : C.muted, whiteSpace: 'nowrap' }}>{it.sentimiento === 'negativo' ? 'Aprobar respuesta' : 'Responder'}<ChevronRight size={12} /></span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Tarjeta>

        {/* ── DERECHA: mapa de temas + detalle ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ position: 'relative', borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden', background: 'linear-gradient(180deg, rgba(15,23,42,.55), rgba(7,11,22,.35))' }}>
            <div style={{ position: 'absolute', top: 12, left: 14, zIndex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>Mapa de lo que dice la gente</span>
              <span style={{ fontSize: 11.5, color: C.muted }}>· {clasificados.length} {plural(clasificados.length, 'mensaje', 'mensajes')} en {burbujas.filter(b => b.n > 0).length} {plural(burbujas.filter(b => b.n > 0).length, 'tema', 'temas')}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', fontFamily: FONT }} onClick={() => setTemaSel(null)} role="img" aria-label="Mapa de temas por sentimiento y frecuencia">
              <defs>
                {TEMAS.map((t, i) => (
                  <radialGradient key={t} id={`es-g${i}`} cx=".35" cy=".3" r=".85">
                    <stop offset="0" stopColor="#fff" stopOpacity=".95" />
                    <stop offset=".38" stopColor={TEMA_COLOR[t]} />
                    <stop offset="1" stopColor={TEMA_COLOR[t]} stopOpacity=".72" />
                  </radialGradient>
                ))}
                <linearGradient id="es-eje" x1="0" x2="1">
                  <stop offset="0" stopColor={C.error} />
                  <stop offset=".5" stopColor={C.muted} />
                  <stop offset="1" stopColor={C.success} />
                </linearGradient>
                <linearGradient id="es-tinte-neg" x1="0" x2="1"><stop offset="0" stopColor={C.error} stopOpacity=".09" /><stop offset="1" stopColor={C.error} stopOpacity="0" /></linearGradient>
                <linearGradient id="es-tinte-pos" x1="0" x2="1"><stop offset="0" stopColor={C.success} stopOpacity="0" /><stop offset="1" stopColor={C.success} stopOpacity=".09" /></linearGradient>
                <filter id="es-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>

              {/* Tintes y grilla */}
              <rect x={PAD_L} y={PAD_T - 30} width={(W - PAD_L - PAD_R) / 2} height={H - PAD_B - PAD_T + 30} fill="url(#es-tinte-neg)" />
              <rect x={PAD_L + (W - PAD_L - PAD_R) / 2} y={PAD_T - 30} width={(W - PAD_L - PAD_R) / 2} height={H - PAD_B - PAD_T + 30} fill="url(#es-tinte-pos)" />
              {Array.from({ length: maxN }, (_, i) => i + 1).map(n => (
                <g key={n}>
                  <line x1={PAD_L} x2={W - PAD_R} y1={yDe(n, maxN)} y2={yDe(n, maxN)} stroke="rgba(148,163,184,.12)" strokeDasharray="3 6" />
                  <text x={PAD_L - 12} y={yDe(n, maxN) + 4} textAnchor="end" fontSize={10.5} fontFamily={FONT_MONO} fill={C.subtle}>{n}</text>
                </g>
              ))}
              <line x1={xDe(0)} x2={xDe(0)} y1={PAD_T - 30} y2={H - PAD_B} stroke="rgba(148,163,184,.2)" strokeDasharray="2 5" />
              <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="url(#es-eje)" strokeWidth={1.5} opacity={.7} />
              <text x={PAD_L} y={H - 12} fontSize={10.5} fontWeight={800} letterSpacing=".12em" fill={C.error}>SE QUEJAN</text>
              <text x={xDe(0)} y={H - 12} textAnchor="middle" fontSize={10.5} fontWeight={800} letterSpacing=".12em" fill={C.muted}>NEUTRAL</text>
              <text x={W - PAD_R} y={H - 12} textAnchor="end" fontSize={10.5} fontWeight={800} letterSpacing=".12em" fill={C.success}>ELOGIAN</text>
              <text transform={`translate(18 ${(PAD_T + H - PAD_B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={10.5} fontWeight={800} letterSpacing=".12em" fill={C.muted}>CUÁNTOS LO DICEN</text>

              {/* Burbujas */}
              {ordenadas.map(b => {
                const gi = TEMAS.indexOf(b.tema)
                const activa = b.tema === temaMostrado
                const vacia = b.n === 0
                return (
                  <g
                    key={b.tema}
                    className="es-burbuja"
                    style={{ transform: `translate(${b.x}px, ${b.y}px)`, transition: 'transform .9s cubic-bezier(.2,.8,.2,1)' }}
                    onPointerEnter={() => entrarHover(b.tema)}
                    onPointerLeave={salirHover}
                    onClick={e => { e.stopPropagation(); elegirTema(b.tema) }}
                  >
                    {destello?.tema === b.tema && <circle key={destello.id} r={b.r} fill="none" stroke={b.color} strokeWidth={2.5} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'es-destello 1.4s ease-out both' }} />}
                    {!vacia && <circle r={b.r + 8} fill={b.color} opacity={activa ? .22 : .12} style={{ transition: 'r .6s, opacity .2s' }} />}
                    {activa && !vacia && <circle r={b.r + 7} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="4 5" opacity={.8} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'pr-spin 8s linear infinite' }} />}
                    {vacia ? (
                      <circle className="es-nucleo" r={b.r} fill={`${b.color}18`} stroke={b.color} strokeOpacity={.5} strokeWidth={1} strokeDasharray="3 3" style={{ transition: 'r .6s' }} />
                    ) : (
                      <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'es-nacer .7s cubic-bezier(.2,.8,.2,1) both' }}>
                        <circle className="es-nucleo" r={b.r} fill={`url(#es-g${gi})`} stroke={activa ? '#fff' : 'rgba(255,255,255,.45)'} strokeWidth={activa ? 2 : 1} style={{ filter: 'url(#es-glow)', transition: 'r .6s, filter .15s' }} />
                        <text y={5} textAnchor="middle" fontSize={b.r > 24 ? 15 : 12.5} fontWeight={800} fill="#fff" style={{ pointerEvents: 'none' }}>{b.n}</text>
                      </g>
                    )}
                    <text y={b.r + 15} textAnchor="middle" fontSize={vacia ? 10 : 11.5} fontWeight={activa ? 800 : 700} fill={vacia ? C.subtle : activa ? C.text : C.body} style={{ pointerEvents: 'none', transition: 'fill .2s' }}>{b.tema}</text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Detalle: responder / tema / resumen general */}
          <Tarjeta style={{ padding: 14, minHeight: 190 }}>
            {itemSel ? (
              <div className="pr-fade-in" key={itemSel.id}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                    <IconoFuente fuente={itemSel.fuente} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Responder a {itemSel.autor} <span style={{ color: C.subtle, fontWeight: 600 }}>· {FUENTE_NOMBRE[itemSel.fuente].toLowerCase()}</span></div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.4, fontStyle: 'italic' }}>“{itemSel.texto}”</div>
                    </div>
                  </div>
                  <button type="button" className="es-cerrar" onClick={cerrarItem} aria-label="Cerrar"><X size={16} /></button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <OrbiAvatar size={22} />
                    <span style={{ fontSize: 12, color: C.muted }}>
                      {itemSel.respuesta?.modo === 'auto' ? 'La respondí sola porque es positiva. Podés retocarla.' : itemSel.sentimiento === 'negativo' ? 'Es una queja: no publico sin tu aprobación.' : itemSel.accion?.tipo === 'radar' ? 'Es un pedido: respondo con stock y envíos reales.' : 'Borrador con el tono de la marca.'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {TONOS.map(t => <button key={t.id} type="button" className="es-tono" data-activo={tono === t.id ? '1' : '0'} onClick={() => cambiarTono(t.id)}>{t.nombre}</button>)}
                  </div>
                </div>

                <textarea className="pr-input es-area" value={texto} onChange={e => setTexto(e.target.value)} style={{ marginTop: 10 }} aria-label="Respuesta" />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {itemSel.accion?.tipo === 'radar' && (
                      itemSel.accionHecha
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: C.success }}><Check size={13} />En el Radar de Deseos</span>
                        : <Boton variante="suave" tam="sm" color={ACENTO_FUERTE} onClick={() => mandarRadar([itemSel.id])}><Radar size={13} />Mandar al Radar de Deseos</Boton>
                    )}
                    {itemSel.accion?.tipo === 'destacar' && (
                      destacada
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: C.success }}><Check size={13} />Mica destacada en la tienda</span>
                        : <Boton variante="suave" tam="sm" color={C.warning} onClick={destacar}><Award size={13} />Destacar a Mica en la tienda</Boton>
                    )}
                  </div>
                  <Boton tam="sm" color={itemSel.sentimiento === 'negativo' ? C.orbi : C.primary} onClick={publicar} disabled={!texto.trim()}><Send size={13} />{itemSel.respuesta ? 'Actualizar respuesta' : itemSel.sentimiento === 'negativo' ? 'Aprobar y publicar' : 'Publicar respuesta'}</Boton>
                </div>
              </div>
            ) : burbujaDetalle ? (
              <div className="pr-fade-in" key={burbujaDetalle.tema}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: burbujaDetalle.color, boxShadow: `0 0 10px ${burbujaDetalle.color}` }} />
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{burbujaDetalle.tema}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>· {burbujaDetalle.n} {plural(burbujaDetalle.n, 'mensaje', 'mensajes')}</span>
                  </div>
                  {temaSel && <button type="button" className="es-cerrar" onClick={() => setTemaSel(null)} aria-label="Cerrar"><X size={16} /></button>}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'flex-start' }}>
                  <OrbiAvatar size={26} />
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: C.body }}>{resumenTema(burbujaDetalle.tema, burbujaDetalle.its)}</div>
                </div>
                {burbujaDetalle.its.length > 0 && (
                  <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
                    {burbujaDetalle.its.map(it => <FilaItem key={it.id} it={it} onClick={() => abrirItem(it.id)} />)}
                  </div>
                )}
              </div>
            ) : (
              <div className="pr-fade-in" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <OrbiAvatar size={30} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text, marginBottom: 4 }}>Orbi</div>
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: C.body }}>{orbiGeneral}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {burbujas.filter(b => b.n > 0).sort((a, b) => b.n - a.n).map(b => (
                      <button key={b.tema} type="button" className="es-tono" data-activo="0" onClick={() => elegirTema(b.tema)} style={{ color: b.color, borderColor: `${b.color}55` }}>{b.tema} · {b.n}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.subtle, marginTop: 10 }}>Pasá el mouse por una burbuja o tocá un mensaje de la bandeja.</div>
                </div>
              </div>
            )}
          </Tarjeta>
        </div>
      </div>

      {/* Acciones sugeridas */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Etiqueta color={C.orbiLight}>Acciones sugeridas por Orbi</Etiqueta>
          <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT_MONO }}>{accionesHechas}/{accionesTotal} hechas</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {/* 1. Radar de Deseos */}
          <AccionCard
            icono={<Radar size={16} />} color={ACENTO_FUERTE}
            titulo="Mandar los pedidos al Radar de Deseos"
            hecha={pedidos.length > 0 && pedidosPendientes.length === 0}
            visible={pedidos.length > 0}
            vacio="Cuando alguien pida algo que no tenés, aparece acá."
            cuerpo={
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {pedidos.map(p => (
                  <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: p.accionHecha ? `${C.success}1F` : 'rgba(148,163,184,.12)', color: p.accionHecha ? C.success : C.body, border: `1px solid ${p.accionHecha ? `${C.success}44` : C.border}`, transition: 'all .3s' }}>
                    {p.accionHecha && <Check size={10} />}{p.accion?.etiqueta}
                  </span>
                ))}
              </div>
            }
            boton={`Mandar ${pedidosPendientes.length > 1 ? `los ${pedidosPendientes.length}` : 'al Radar'}`}
            onClick={() => mandarRadar(pedidosPendientes.map(p => p.id))}
            listo={`${pedidos.length} ${plural(pedidos.length, 'pedido agrupado', 'pedidos agrupados')} en el Radar`}
          />
          {/* 2. Destacar a Mica */}
          <AccionCard
            icono={<Award size={16} />} color={C.warning}
            titulo="Destacar a Mica en la tienda"
            hecha={destacada}
            visible={elogios.length > 0}
            vacio="Si elogian a alguien del equipo, te sugiero destacarlo."
            cuerpo={<div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{elogios.length} {plural(elogios.length, 'elogio nombra', 'elogios nombran')} a Mica. Orbi arma un bloque “Nuestro equipo” con {plural(elogios.length, 'la reseña', 'las reseñas')} para la portada.</div>}
            boton="Destacar en la tienda"
            onClick={destacar}
            listo="Mica en la portada con sus reseñas"
          />
          {/* 3. Logística al interior */}
          <AccionCard
            icono={<Truck size={16} />} color={C.error}
            titulo="Cambiar la logística al interior"
            hecha={alertasResueltas.includes('Demora')}
            visible={alertas.includes('Demora')}
            vacio="Si un tema negativo se repite, lo cruzo con ventas y te propongo algo."
            cuerpo={<div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>3 pedidos al interior salieron tarde el 22. Pasar a Andreani y avisar a los 4 que esperan.</div>}
            boton="Ver qué pasó y resolver"
            onClick={() => setAlertaAbierta('Demora')}
            listo="Andreani para el interior · 4 clientes avisados"
          />
        </div>
      </div>
    </div>
  )
}

function AccionCard({ icono, color, titulo, hecha, visible, vacio, cuerpo, boton, onClick, listo }: { icono: ReactNode; color: string; titulo: string; hecha: boolean; visible: boolean; vacio: string; cuerpo: ReactNode; boton: string; onClick: () => void; listo: string }) {
  const c = hecha ? C.success : color
  return (
    <Tarjeta style={{ padding: '12px 14px', minWidth: 0, borderColor: visible ? `${c}55` : C.border, opacity: visible ? 1 : .55, transition: 'border-color .3s, opacity .3s', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 128 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${c}22`, color: c, flexShrink: 0, transition: 'all .3s' }}>{hecha ? <Check size={15} strokeWidth={3} /> : icono}</span>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: visible ? C.text : C.muted, lineHeight: 1.25 }}>{titulo}</div>
      </div>
      <div style={{ flex: 1 }}>
        {!visible ? <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.45 }}>{vacio}</div> : hecha ? <div className="pr-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.success, fontWeight: 700 }}><Tilde size={16} />{listo}</div> : cuerpo}
      </div>
      {visible && !hecha && <div><Boton variante="suave" tam="sm" color={color} onClick={onClick}>{boton}<ChevronRight size={13} /></Boton></div>}
    </Tarjeta>
  )
}
