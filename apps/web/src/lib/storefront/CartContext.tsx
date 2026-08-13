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
import { validateCart } from './api'
import type { ItemCarrito } from './types'

function claveStorage(slug: string) {
  return `orbita-cart:${slug}`
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

  const [items, setItems] = useState<ItemCarrito[]>([])
  // Evita que el efecto de "guardar" pise el localStorage con [] antes de
  // que el efecto de "cargar" haya terminado de leerlo.
  const [hidratado, setHidratado] = useState(false)
  const [revalidando, setRevalidando] = useState(false)

  useEffect(() => {
    setHidratado(false)
    if (!slug) { setItems([]); setHidratado(true); return }
    try {
      const guardado = localStorage.getItem(claveStorage(slug))
      setItems(guardado ? JSON.parse(guardado) : [])
    } catch {
      setItems([])
    }
    setHidratado(true)
  }, [slug])

  useEffect(() => {
    if (!slug || !hidratado) return
    try { localStorage.setItem(claveStorage(slug), JSON.stringify(items)) } catch { /* localStorage lleno/bloqueado: el carrito sigue andando en memoria */ }
  }, [slug, hidratado, items])

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

  const vaciar = useCallback(() => setItems([]), [])

  const revalidar = useCallback(async () => {
    if (!slug || items.length === 0) return
    setRevalidando(true)
    try {
      const resultados = await validateCart(slug, items.map(it => ({ variantId: it.id, quantity: it.qty })))
      const porId = new Map(resultados.map(r => [r.variantId, r]))
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
        }
      }))
    } catch {
      // Sin conexión / backend caído: el carrito se queda con lo último que
      // sabía en vez de romper la pantalla.
    } finally {
      setRevalidando(false)
    }
  }, [slug, items])

  // Al hidratar (carga inicial o cambio de tienda) — un carrito puede tener
  // semanas, así que se revalida solo apenas hay algo para revisar.
  useEffect(() => {
    if (hidratado) revalidar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado, slug])

  const cartCount = useMemo(() => items.reduce((s, i) => s + (i.noDisponible ? 0 : i.qty), 0), [items])
  const subtotal  = useMemo(() => items.reduce((s, i) => s + (i.noDisponible ? 0 : i.precio * i.qty), 0), [items])

  const value = useMemo<CartContextValue>(
    () => ({ items, cartCount, subtotal, agregar, actualizarQty, quitar, vaciar, revalidar, revalidando }),
    [items, cartCount, subtotal, agregar, actualizarQty, quitar, vaciar, revalidar, revalidando],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart() tiene que usarse dentro de <CartProvider>')
  return ctx
}
