// Carrito real del storefront — antes cada pantalla que "mostraba el
// carrito" arrancaba de CARRITO_INICIAL (un array hardcodeado en mock.ts), y
// ni el botón "Agregar" de la grilla ni "Agregar al carrito" del detalle de
// producto tocaban ese estado: el primero no tenía handler conectado, el
// segundo solo navegaba a /carrito sin agregar nada. Este contexto es el
// único lugar que junta y persiste lo que el cliente realmente agregó.
//
// Persistencia: localStorage, con la clave scopeada por `slug` — cada tienda
// tiene su propio carrito, así entrar a otra tienda del mismo navegador no
// mezcla productos de negocios distintos.
//
// Stock en vivo: el carrito puede tener semanas — nada lo revalidaba nunca
// contra el backend. `revalidar()` le pregunta a POST /storefront/:slug/cart/
// validate qué sigue siendo comprable, con qué precio real y con qué tope de
// stock, y ajusta el carrito en consecuencia (nunca lo hace a ciegas: si un
// ítem ya no alcanza para lo pedido, se recorta a lo que SÍ hay en vez de
// sacarlo; si cayó del todo, se marca `noDisponible` para que la UI lo tache
// en vez de borrarlo solo — el cliente tiene que verlo y decidir).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { currentSlug } from '@/lib/tenant'
import { useAuth } from '@/lib/auth/AuthContext'
import { validateCart } from './api'
import type { Cupon, ItemCarrito } from './types'

function claveStorage(slug: string) {
  return `orbita-cart:${slug}`
}

// Cupón exclusivo auto-aplicado desde un link compartible (DescuentoExclusivo).
// Clave separada de `claveStorage` para no tocar el formato ya persistido del
// carrito — un cupón sobrevive aunque el carrito se vacíe (el cliente puede
// entrar al link, comprar, volver a comprar con el mismo código).
function claveCupon(slug: string) {
  return `orbita-cart-cupon:${slug}`
}

interface CartContextValue {
  items:      ItemCarrito[]
  cartCount:  number
  subtotal:   number
  // `Omit<ItemCarrito,'qty'>` porque la cantidad la maneja `agregar` — si la
  // variante ya está en el carrito, suma en vez de duplicar la línea.
  // Devuelve cuánto se agregó DE VERDAD (puede ser menos de `qty` si el tope
  // de stock no alcanzaba) — así el que llama puede avisar "solo quedaban 2".
  agregar:        (item: Omit<ItemCarrito, 'qty'>, qty?: number) => number
  actualizarQty:  (variantId: string, delta: number) => void
  quitar:         (variantId: string) => void
  vaciar:         () => void
  // Revalida todo el carrito contra el backend — se dispara sola al
  // hidratar, y las pantallas de carrito la vuelven a llamar al montar.
  revalidar:      () => Promise<void>
  revalidando:    boolean
  // Cupón exclusivo auto-aplicado desde DescuentoExclusivo.tsx (link
  // compartible). CheckoutPago.tsx lo usa para precargar el campo de cupón.
  cuponAplicado:  Cupon | null
  aplicarCupon:   (cupon: Cupon) => void
  quitarCupon:    () => void
  // Descuento automático (RBT-613) de alcance TICKET (toda la compra, no un
  // producto puntual) — viene de la última revalidación. Los descuentos por
  // producto ya vienen aplicados en `precio`/`precioAnt` de cada ítem, esto
  // es aparte porque no tiene una sola línea donde "esconderse".
  descuentoTicket: { nombre: string; monto: number; esPorcentaje: boolean; valor: number } | null
  // Motivo por el que `cuponAplicado` NO está descontando nada en este
  // carrito (código vencido, no matchea los productos, monto mínimo no
  // alcanzado, etc.) — se recalcula en cada `revalidar()`, así que el
  // cliente lo ve apenas aplica el código, no recién al confirmar la compra.
  // `null` si no hay cupón aplicado o si el que hay sí está descontando.
  cuponError: string | null
}

const CartContext = createContext<CartContextValue | null>(null)

// Techo de una línea cuando todavía no se revalidó contra el backend (recién
// agregado desde una pantalla que ya trae `maxQty` real, o un carrito viejo
// que nunca se revalidó) — nunca "sin límite": mismo criterio de no confiar
// ciegamente en un número que puede estar desactualizado.
const TOPE_SIN_REVALIDAR = 20

export function CartProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  // Mismo criterio que _app.tsx para resolver el slug sin depender de
  // router.isReady (ver forceSSR.ts): currentSlug() lee el host directo
  // (subdominio real), router.query.slug queda de fallback para el modo
  // legado por path.
  const slug = currentSlug() ?? (typeof router.query.slug === 'string' ? router.query.slug : null)
  // Bug encontrado 2026-08-28: un cupón PERSONAL (ej. el premio de un juego,
  // Discount.customerId != null) validaba mal justo después de recargar la
  // página estando logueado. `status` arranca en 'loading' y solo pasa a
  // 'authenticated' después de un round-trip (tryRefresh() + /auth/me) —
  // mientras tanto `tokenStore.get()` devuelve null. El efecto de abajo
  // hidrataba el carrito del localStorage (síncrono) y disparaba
  // `revalidar()` de inmediato, sin esperar ese round-trip: el pedido salía
  // SIN Authorization, el backend no tenía forma de saber quién sos, y
  // resolverCuponElegible() rechazaba el cupón como "de otra cuenta" — un
  // cliente real, con la sesión iniciada, viendo negado SU PROPIO premio.
  // Encima, una vez que el token sí llegaba, nada volvía a pedir la
  // revalidación: el error quedaba pegado en pantalla para siempre, hasta
  // que el cliente sacara y volviera a aplicar el cupón a mano.
  const { status: authStatus } = useAuth()

  const [items, setItems] = useState<ItemCarrito[]>([])
  // Evita que el efecto de "guardar" pise el localStorage con [] antes de
  // que el efecto de "cargar" haya terminado de leerlo.
  const [hidratado, setHidratado] = useState(false)
  const [revalidando, setRevalidando] = useState(false)
  const [cupon, setCupon] = useState<Cupon | null>(null)
  const [descuentoTicket, setDescuentoTicket] = useState<{ nombre: string; monto: number; esPorcentaje: boolean; valor: number } | null>(null)
  const [cuponError, setCuponError] = useState<string | null>(null)

  useEffect(() => {
    setHidratado(false)
    if (!slug) { setItems([]); setCupon(null); setHidratado(true); return }
    try {
      const guardado = localStorage.getItem(claveStorage(slug))
      setItems(guardado ? JSON.parse(guardado) : [])
    } catch {
      setItems([])
    }
    try {
      const cuponGuardado = localStorage.getItem(claveCupon(slug))
      setCupon(cuponGuardado ? JSON.parse(cuponGuardado) : null)
    } catch {
      setCupon(null)
    }
    setHidratado(true)
  }, [slug])

  useEffect(() => {
    if (!slug || !hidratado) return
    try { localStorage.setItem(claveStorage(slug), JSON.stringify(items)) } catch { /* localStorage lleno/bloqueado: el carrito sigue andando en memoria */ }
  }, [slug, hidratado, items])

  useEffect(() => {
    if (!slug || !hidratado) return
    try {
      if (cupon) localStorage.setItem(claveCupon(slug), JSON.stringify(cupon))
      else localStorage.removeItem(claveCupon(slug))
    } catch { /* localStorage lleno/bloqueado: el cupón sigue andando en memoria */ }
  }, [slug, hidratado, cupon])

  const aplicarCupon = useCallback((c: Cupon) => setCupon(c), [])
  const quitarCupon  = useCallback(() => setCupon(null), [])

  const agregar = useCallback((item: Omit<ItemCarrito, 'qty'>, qty = 1): number => {
    let agregado = 0
    setItems(prev => {
      const i = prev.findIndex(x => x.id === item.id)
      const yaTenia = i >= 0 ? prev[i].qty : 0
      // El tope de ESTE agregado: el que trae el ítem si es más reciente que
      // el que ya estaba en el carrito (por si se agrega de nuevo desde una
      // pantalla que acaba de revalidar), si no el que ya había.
      const tope = item.maxQty ?? prev[i]?.maxQty ?? TOPE_SIN_REVALIDAR
      const nuevaQty = Math.min(yaTenia + qty, tope)
      agregado = nuevaQty - yaTenia
      if (agregado <= 0) return prev // ya está en el tope, no hay nada que sumar

      if (i >= 0) {
        const next = [...prev]
        next[i] = { ...next[i], ...item, qty: nuevaQty }
        return next
      }
      return [...prev, { ...item, qty: nuevaQty }]
    })
    return agregado
  }, [])

  // Mismo criterio que ya tenía el drawer del header: bajar de 1 saca la
  // línea, no la deja en 0. Subir topea contra maxQty (sin revalidar todavía,
  // TOPE_SIN_REVALIDAR).
  const actualizarQty = useCallback((variantId: string, delta: number) => {
    setItems(prev => prev
      .map(x => x.id === variantId
        ? { ...x, qty: Math.min(Math.max(0, x.qty + delta), x.maxQty ?? TOPE_SIN_REVALIDAR) }
        : x)
      .filter(x => x.qty > 0))
  }, [])

  const quitar = useCallback((variantId: string) => {
    setItems(prev => prev.filter(x => x.id !== variantId))
  }, [])

  const vaciar = useCallback(() => { setItems([]); setDescuentoTicket(null); setCuponError(null) }, [])

  // Lee `cupon` del closure (no un parámetro): así CUALQUIER cambio del
  // cupón aplicado dispara sola una revalidación fresca — ver el efecto de
  // abajo que la llama cuando cambia `cupon` — y el precio con descuento
  // (o el motivo por el que no aplica) se ve de inmediato, nunca recién al
  // confirmar la compra.
  const revalidar = useCallback(async () => {
    if (!slug || items.length === 0) { setDescuentoTicket(null); setCuponError(null); return }
    setRevalidando(true)
    try {
      const resultado = await validateCart(slug, items.map(it => ({ variantId: it.id, quantity: it.qty })), cupon?.codigo)
      setDescuentoTicket(resultado.ticketDiscount)
      setCuponError(resultado.coupon && !resultado.coupon.ok ? resultado.coupon.reason : null)
      const porId = new Map(resultado.items.map(r => [r.variantId, r]))
      setItems(prev => prev.map(it => {
        const r = porId.get(it.id)
        if (!r) return it // no debería pasar (se pidió por los ids del propio carrito)

        if (!r.ok && r.motivo !== 'STOCK_INSUFICIENTE') {
          // Cayó del todo (borrado/despublicado/desactivado/sin stock) — se
          // tacha, no se saca sola: el cliente tiene que verlo.
          return { ...it, noDisponible: true, motivo: r.motivo, maxQty: r.maxQty }
        }
        // Disponible (con o sin menos stock del pedido): se actualiza
        // precio/tope real y se recorta la cantidad si ya no alcanza.
        return {
          ...it,
          noDisponible: false,
          motivo: r.motivo,
          maxQty: r.maxQty,
          qty: Math.min(it.qty, r.maxQty),
          nombre: r.nombre ?? it.nombre,
          variante: r.variante ?? it.variante,
          precio: r.precio ?? it.precio,
          precioAnt: r.precioAnt,
          imgUrl: r.imgUrl ?? it.imgUrl,
        }
      }))
    } catch {
      // Sin conexión / backend caído: el carrito se queda con lo último que
      // sabía en vez de romper la pantalla.
    } finally {
      setRevalidando(false)
    }
  }, [slug, items, cupon])

  // Al hidratar (carga inicial o cambio de tienda), cada vez que cambia el
  // cupón aplicado, Y cada vez que cambia `authStatus` — un carrito puede
  // tener semanas, así que se revalida solo apenas hay algo para revisar; el
  // cupón se agrega a las dependencias para que aplicar/quitar uno dispare
  // sola una revalidación fresca (ver comentario en revalidar()), en vez de
  // que la pantalla tenga que llamarla a mano después de tocar el cupón.
  //
  // `authStatus` en las dependencias (no solo un guard de "esperar a que
  // esté listo"): así, si `revalidar()` llegó a correr como anónimo (por
  // ejemplo, HTTP fue más rápido que el refresh de sesión — cualquier
  // camino en el que la primera pasada quedó desactualizada), en cuanto la
  // sesión resuelve se vuelve a pedir sola, con el Authorization correcto.
  // Sin esto, un cupón PERSONAL (ej. premio de un juego) podía rechazarse
  // como "de otra cuenta" al recargar la página estando logueado, y quedaba
  // así pegado en pantalla para siempre — ver comentario de authStatus más
  // arriba.
  useEffect(() => {
    if (hidratado && authStatus !== 'loading') revalidar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado, slug, cupon?.codigo, authStatus])

  const cartCount = useMemo(() => items.reduce((s, i) => s + (i.noDisponible ? 0 : i.qty), 0), [items])
  const subtotal  = useMemo(() => items.reduce((s, i) => s + (i.noDisponible ? 0 : i.precio * i.qty), 0), [items])

  const value = useMemo<CartContextValue>(
    () => ({ items, cartCount, subtotal, agregar, actualizarQty, quitar, vaciar, revalidar, revalidando, cuponAplicado: cupon, aplicarCupon, quitarCupon, descuentoTicket, cuponError }),
    [items, cartCount, subtotal, agregar, actualizarQty, quitar, vaciar, revalidar, revalidando, cupon, aplicarCupon, quitarCupon, descuentoTicket, cuponError],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart() tiene que usarse dentro de <CartProvider>')
  return ctx
}
