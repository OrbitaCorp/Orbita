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
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { currentSlug } from '@/lib/tenant'
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
  agregar:        (item: Omit<ItemCarrito, 'qty'>, qty?: number) => void
  actualizarQty:  (variantId: string, delta: number) => void
  quitar:         (variantId: string) => void
  vaciar:         () => void
}

const CartContext = createContext<CartContextValue | null>(null)

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

  const agregar = useCallback((item: Omit<ItemCarrito, 'qty'>, qty = 1) => {
    setItems(prev => {
      const i = prev.findIndex(x => x.id === item.id)
      if (i >= 0) {
        const next = [...prev]
        next[i] = { ...next[i], qty: next[i].qty + qty }
        return next
      }
      return [...prev, { ...item, qty }]
    })
  }, [])

  // Mismo criterio que ya tenía el drawer del header: bajar de 1 saca la
  // línea, no la deja en 0.
  const actualizarQty = useCallback((variantId: string, delta: number) => {
    setItems(prev => prev
      .map(x => x.id === variantId ? { ...x, qty: x.qty + delta } : x)
      .filter(x => x.qty > 0))
  }, [])

  const quitar = useCallback((variantId: string) => {
    setItems(prev => prev.filter(x => x.id !== variantId))
  }, [])

  const vaciar = useCallback(() => setItems([]), [])

  const cartCount = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items])
  const subtotal  = useMemo(() => items.reduce((s, i) => s + i.precio * i.qty, 0), [items])

  const value = useMemo<CartContextValue>(
    () => ({ items, cartCount, subtotal, agregar, actualizarQty, quitar, vaciar }),
    [items, cartCount, subtotal, agregar, actualizarQty, quitar, vaciar],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart() tiene que usarse dentro de <CartProvider>')
  return ctx
}
