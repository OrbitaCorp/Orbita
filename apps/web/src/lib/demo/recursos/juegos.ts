// ─── Juegos con premio en la tienda demo ────────────────────────────────────
//
// En la demo el Invitado juega de verdad (la mecánica corre en el navegador,
// igual que en cualquier tienda), pero la API no le deja crear sesiones ni
// cupones (DemoGuard): acá se simulan. El premio queda como un cupón LOCAL
// (recurso "premios-juegos") que el carrito y el checkout simulado aceptan
// como si fuera uno real.
import type { CartValidationResponse, ActiveGame, GameStartResponse, GameFinishResponse } from '@/lib/storefront/api'
import { apiReal, json, leerJson, registrar } from '../interceptor'
import { crear, leerCapa, nuevoId } from '../almacen'

export const PREMIOS_JUEGOS = 'premios-juegos'

type PremioJuego = { id: string; code: string; discountPercent: number; nombre: string; sesionId: string }
type SesionJuego = { tipo: string; nombre: string; percentPerWin: number; maxPercent: number; maxAttempts: number }

// Viven lo que dura la pestaña: una partida no sobrevive a un recargo, igual
// que en la tienda real (el modal arranca de cero).
const sesiones = new Map<string, SesionJuego>()

async function juegoActivo(slug: string, tipo: string): Promise<ActiveGame | null> {
  const res = await apiReal(`/storefront/${slug}/games/active`).catch(() => null)
  const juegos = res ? await leerJson<ActiveGame[]>(res) : null
  return juegos?.find((j) => j.type === tipo) ?? null
}

registrar({
  metodo: 'POST',
  ruta: /^\/storefront\/([^/]+)\/games\/([^/]+)\/start$/,
  lado: 'tienda',
  responder: async (_p, m) => {
    const juego = await juegoActivo(m[1], m[2])
    if (!juego) return json({ message: 'Este juego no está disponible' }, 404)
    // /games/active no trae el % por acierto ni el tiempo por tiro: el seed de
    // la demo (apps/api/prisma/demo/avanzado.ts) arma cada juego con
    // maxPercent = % por acierto × tiros, y 4 segundos por tiro.
    const sesion: SesionJuego = {
      tipo: juego.type,
      nombre: juego.name ?? 'juego',
      percentPerWin: juego.maxPercent / juego.maxAttempts,
      maxPercent: juego.maxPercent,
      maxAttempts: juego.maxAttempts,
    }
    const sessionId = nuevoId()
    sesiones.set(sessionId, sesion)
    const respuesta: GameStartResponse = {
      sessionId,
      gameName: juego.name,
      percentPerWin: sesion.percentPerWin,
      maxPercent: sesion.maxPercent,
      timeLimitMs: 4000,
      maxAttempts: sesion.maxAttempts,
    }
    return respuesta
  },
})

registrar({
  metodo: 'POST',
  ruta: /^\/storefront\/[^/]+\/games\/finish$/,
  lado: 'tienda',
  responder: async (p) => {
    const { sessionId, hits } = p.body as { sessionId: string; hits: number }
    const sesion = sesiones.get(sessionId)
    if (!sesion) return json({ message: 'Sesión no encontrada' }, 404)
    sesiones.delete(sessionId)
    const aciertos = Math.max(0, Math.min(Math.floor(hits) || 0, sesion.maxAttempts))
    const percent = Math.min(aciertos * sesion.percentPerWin, sesion.maxPercent)
    if (percent <= 0) {
      const perdio: GameFinishResponse = { status: 'LOST', discountPercent: null, code: null, expiresAt: null }
      return perdio
    }
    // El Invitado siempre tiene sesión de cliente: se reclama de una, como
    // en una tienda real con el cliente logueado.
    const premio = crear<PremioJuego>(PREMIOS_JUEGOS, {
      id: nuevoId(),
      code: `PREMIO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      discountPercent: percent,
      nombre: `Premio: ${sesion.nombre}`,
      sesionId: sessionId,
    })
    const gano: GameFinishResponse = { status: 'CLAIMED', discountPercent: percent, code: premio.code, expiresAt: null }
    return gano
  },
})

registrar({
  metodo: 'POST',
  ruta: /^\/storefront\/[^/]+\/games\/claim$/,
  lado: 'tienda',
  responder: async (p) => {
    const { sessionId } = p.body as { sessionId: string }
    const premio = leerCapa<PremioJuego>(PREMIOS_JUEGOS).creados.find((x) => x.sesionId === sessionId)
    if (!premio) return json({ message: 'Esta sesión no tiene ningún premio para reclamar' }, 400)
    return { code: premio.code, discountPercent: premio.discountPercent, expiresAt: null }
  },
})

function premioPorCodigo(codigo: string | undefined): PremioJuego | null {
  const buscado = codigo?.trim().toUpperCase()
  if (!buscado) return null
  return leerCapa<PremioJuego>(PREMIOS_JUEGOS).creados.find((x) => x.code === buscado) ?? null
}

/**
 * cart/validate con los cupones de premio de la demo: si el código es un
 * premio local, se valida el carrito sin cupón y el descuento se suma acá
 * (mismo cálculo que un PERCENT_TICKET: % sobre el subtotal ya con promos).
 * El checkout simulado lo usa también, para cobrar lo mismo que mostró.
 */
export async function validarCarritoDemo(
  slug: string,
  body: { items: unknown; couponCode?: string },
  headers?: HeadersInit,
): Promise<CartValidationResponse | null> {
  const premio = premioPorCodigo(body.couponCode)
  const res = await apiReal(`/storefront/${slug}/cart/validate`, {
    method: 'POST',
    headers: { ...(headers as Record<string, string> | undefined), 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: body.items, couponCode: premio ? undefined : body.couponCode }),
  }).catch(() => null)
  const validacion = res ? await leerJson<CartValidationResponse>(res) : null
  if (!validacion || !premio) return validacion

  const cantidades = new Map((body.items as { variantId: string; quantity: number }[]).map((i) => [i.variantId, i.quantity]))
  const subtotal = validacion.items.reduce((a, i) => a + (i.precio ?? 0) * (cantidades.get(i.variantId) ?? 1), 0)
  const monto = Math.round(subtotal * premio.discountPercent) / 100
  // Mejor descuento gana, como en resolverDescuentosParaOrden del backend.
  const ticketDiscount = validacion.ticketDiscount && validacion.ticketDiscount.monto >= monto
    ? validacion.ticketDiscount
    : { nombre: premio.nombre, monto, esPorcentaje: true, valor: premio.discountPercent }
  return { ...validacion, ticketDiscount, coupon: { ok: true, code: premio.code, name: premio.nombre } }
}

registrar({
  metodo: 'POST',
  ruta: /^\/storefront\/([^/]+)\/cart\/validate$/,
  lado: 'tienda',
  responder: async (p, m) => {
    const body = p.body as { items: unknown; couponCode?: string }
    if (!premioPorCodigo(body.couponCode)) return p.real()
    const validacion = await validarCarritoDemo(m[1], body, p.headers)
    return validacion ?? json({ message: 'No se pudo validar el carrito. Probá de nuevo.' }, 503)
  },
})
