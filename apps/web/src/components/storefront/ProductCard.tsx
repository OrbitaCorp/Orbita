import { useState } from 'react'
import { ArrowRight, Check, ShoppingCart } from 'lucide-react'
import { useRouter } from 'next/router'
import { ProdImage } from './Thumb'
import { VariantPickerModal } from './VariantPickerModal'
import { fmt, thumbGradientAlt, imagenParaVariante } from '@/lib/storefront/utils'
import { useCart } from '@/lib/storefront/CartContext'
import { getStorefrontProduct, type StorefrontProductDetail } from '@/lib/storefront/api'
import type { Producto } from '@/lib/storefront/types'

type Props = {
  producto: Producto
  height?:  number
  rank?:    number   // #1, #2… overlay (Más vendidos)
}

function badgeColor(badge: string): { bg: string; color: string } {
  if (badge.startsWith('−') || badge.startsWith('-') || badge.includes('%'))
    return { bg: '#DC2626', color: '#fff' }
  if (badge.toLowerCase() === 'nuevo')
    return { bg: '#059669', color: '#fff' }
  return { bg: '#2563EB', color: '#fff' }
}

export function ProductCard({ producto, height = 240, rank }: Props) {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const [hov, setHov] = useState(false)
  const { agregar } = useCart()
  // Cuál de las dos acciones está en vuelo (ambas piden el detalle al backend
  // antes de poder hacer nada) — bloquea las dos, para que un doble click no
  // agregue dos veces ni dispare las dos cosas a la vez.
  const [ocupado, setOcupado] = useState<'agregar' | 'comprar' | null>(null)
  const [agregado, setAgregado] = useState(false)
  // Se tocó "Agregar"/"Comprar ahora" pero ya no quedaba nada más para sumar
  // (el carrito ya tenía TODO el stock disponible de esta variante) — mismo
  // criterio de "avisar, no fallar en silencio" del resto del carrito.
  const [sinMas, setSinMas] = useState(false)
  // Producto con opciones (talle/color/etc.) recién pedido al backend — se
  // abre el selector rápido en vez de agregar cualquiera, porque desde la
  // grilla no hay forma honesta de adivinar cuál variante quiere el cliente.
  // `modo` decide el CTA final del modal: "agregar" se queda en la grilla,
  // "comprar" sigue al checkout apenas confirma.
  const [picker, setPicker] = useState<{ detalle: StorefrontProductDetail; modo: 'agregar' | 'comprar' } | null>(null)

  // Producto SIN opciones (una sola variante): agrega directo, sin pasar por
  // el selector. Pide el detalle real recién al tocar el botón (la grilla no
  // trae variantes, solo precio/stock a nivel producto).
  async function agregarVarianteUnica(detalle: StorefrontProductDetail, modo: 'agregar' | 'comprar') {
    const variante = detalle.variants[0]
    if (!variante || !variante.inStock) return
    const agregadas = agregar({
      id: variante.id,
      productId: detalle.id,
      nombre: detalle.name,
      variante: '',
      precio: variante.price,
      precioAnt: variante.comparePrice,
      hue: producto.hue,
      imgUrl: imagenParaVariante(detalle.images, variante.optionValues.map(ov => ov.optionValueId)),
      maxQty: variante.maxQty,
    })
    aplicarResultado(agregadas, modo)
  }

  // Feedback compartido entre el agregado directo (sin opciones) y el que
  // vuelve del selector rápido (con opciones): si no se pudo sumar nada
  // avisa "ya tenés todo", si sí, checkmark o sigue al checkout según el CTA
  // que se tocó.
  function aplicarResultado(agregadas: number, modo: 'agregar' | 'comprar') {
    if (agregadas === 0) {
      setSinMas(true)
      setTimeout(() => setSinMas(false), 1800)
      return
    }
    if (modo === 'agregar') {
      setAgregado(true)
      setTimeout(() => setAgregado(false), 1400)
    } else {
      router.push(`/tienda/${slug}/checkout/datos`)
    }
  }

  async function accionar(modo: 'agregar' | 'comprar', e: React.MouseEvent) {
    e.stopPropagation()
    if (ocupado) return
    setOcupado(modo)
    try {
      const detalle = await getStorefrontProduct(slug, producto.id)
      if (detalle.options.length > 0) {
        setPicker({ detalle, modo })
      } else {
        await agregarVarianteUnica(detalle, modo)
      }
    } catch {
      // Sin conexión/producto ya no existe: no rompe la navegación normal de
      // la card, el cliente puede seguir mirando el catálogo igual.
    } finally {
      setOcupado(null)
    }
  }

  const handleAdd = (e: React.MouseEvent) => accionar('agregar', e)
  // Mismo destino que el "Comprar ahora" del detalle de producto
  // (ProductoDetalle.tsx): agrega y va derecho a cargar los datos de envío.
  // OJO: el checkout cobra TODO el carrito, no solo este producto — es el
  // mismo criterio que ya tenía el detalle, no una regla nueva de la card.
  const handleBuyNow = (e: React.MouseEvent) => accionar('comprar', e)

  return (
    <>
    <div
      onClick={() => router.push(`/tienda/${slug}/producto/${producto.id}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--color-bg)',
        border: `1px solid ${hov ? 'var(--color-border-strong)' : 'var(--color-border)'}`,
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        boxShadow: hov ? '0 10px 28px rgba(15,23,42,0.10)' : '0 1px 3px rgba(15,23,42,0.06)',
        transform: hov ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease',
      }}
    >
      {/* ── Imagen ── */}
      <ProdImage hue={producto.hue} imgUrl={producto.imgUrl} height={height} radius={0}>

        {/* Segunda imagen (hover) — solo para el degradé de fallback, no tiene
            sentido con una foto real (no hay una "segunda foto" garantizada). */}
        {!producto.imgUrl && producto.hue2 !== undefined && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: thumbGradientAlt(producto.hue2),
            opacity: hov ? 1 : 0,
            transition: 'opacity 420ms ease',
          }} />
        )}

        {/* Rank overlay */}
        {rank !== undefined && (
          <span style={{
            position: 'absolute', top: 10, left: 10, zIndex: 3,
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(15,23,42,0.80)', backdropFilter: 'blur(4px)',
            color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'grid', placeItems: 'center',
            fontFamily: '"Geist Mono", monospace',
          }}>
            {rank}
          </span>
        )}

        {/* Badge top-left (solo si no hay rank, o usamos posición diferente) */}
        {producto.badge && rank === undefined && (() => {
          const { bg, color } = badgeColor(producto.badge)
          return (
            <span style={{
              position: 'absolute', top: 10, left: 10, zIndex: 3,
              height: 23, padding: '0 9px', borderRadius: 999,
              background: bg, color,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              display: 'inline-flex', alignItems: 'center',
              fontFamily: producto.badge.startsWith('−') ? '"Geist Mono", monospace' : 'inherit',
            }}>
              {producto.badge}
            </span>
          )
        })()}

        {/* Badge cuando hay rank (arriba a la derecha del rank) */}
        {producto.badge && rank !== undefined && (() => {
          const { bg, color } = badgeColor(producto.badge)
          return (
            <span style={{
              position: 'absolute', top: 10, left: 42, zIndex: 3,
              height: 23, padding: '0 9px', borderRadius: 999,
              background: bg, color,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              display: 'inline-flex', alignItems: 'center',
              fontFamily: producto.badge.startsWith('−') ? '"Geist Mono", monospace' : 'inherit',
            }}>
              {producto.badge}
            </span>
          )
        })()}

        {/* Stock bajo — badge abajo izquierda. Nunca la cantidad exacta (no
            se expone stock real al público, ver storefront.service.ts):
            solo avisa que queda poco, gateado por showLowStock. */}
        {producto.lowStock && (
          <span style={{
            position: 'absolute', bottom: 10, left: 10, zIndex: 3,
            height: 22, padding: '0 8px', borderRadius: 999,
            background: '#D97706',
            color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            ⚡ Últimas unidades
          </span>
        )}

        {/* Ver detalle — flecha top-right */}
        <div
          aria-hidden
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 3,
            width: 30, height: 30, borderRadius: '50%',
            background: hov ? '#2563EB' : 'rgba(255,255,255,0.90)',
            color: hov ? '#fff' : '#2563EB', display: 'grid', placeItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
            transform: hov ? 'translateX(2px)' : 'translateX(0)',
            transition: 'transform 200ms ease, background 200ms ease',
          }}
        >
          <ArrowRight size={13} strokeWidth={2} />
        </div>
      </ProdImage>

      {/* ── Info ── */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
          lineHeight: 1.35, minHeight: 36,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
          marginBottom: 6,
        }}>
          {producto.nombre}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 10 }}>
          <span style={{
            fontSize: 16, fontWeight: 700, color: 'var(--color-text)',
            fontFamily: '"Geist Mono", monospace',
          }}>
            {fmt(producto.precio)}
          </span>
          {producto.precioAnt && (
            <span style={{
              fontSize: 12, color: 'var(--color-muted)',
              textDecoration: 'line-through',
              fontFamily: '"Geist Mono", monospace',
            }}>
              {fmt(producto.precioAnt)}
            </span>
          )}
        </div>

        {/* Carrito como ícono + "Comprar ahora" con el texto: dos botones de
            texto no entran acá (la grilla puede ser de 4 columnas y la tienda
            puede subir la escala tipográfica a 1.15x, ahí "Comprar ahora" se
            corta). Los colores respetan la misma jerarquía que el detalle de
            producto: agregar al carrito es la acción llena, comprar ahora es
            la de contorno. */}
        <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
          {/* Ya tenés todo el stock disponible en el carrito — mismo criterio
              de avisar en vez de fallar en silencio que el resto del carrito. */}
          {sinMas && (
            <span style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0,
              marginBottom: 6, padding: '5px 8px', borderRadius: 6,
              background: 'var(--color-text)', color: 'var(--color-bg)',
              fontSize: 11, fontWeight: 600, textAlign: 'center',
              lineHeight: 1.3,
            }}>
              Ya tenés todo el stock disponible en tu carrito
            </span>
          )}
          <button
            onClick={handleAdd}
            disabled={!!ocupado}
            title="Agregar al carrito"
            aria-label="Agregar al carrito"
            style={{
              width: 44, flexShrink: 0, height: 36, borderRadius: 8,
              background: agregado ? 'var(--color-success)' : 'var(--color-primary)', color: '#fff',
              border: 'none',
              cursor: ocupado ? 'default' : 'pointer', display: 'grid', placeItems: 'center',
              opacity: ocupado ? 0.7 : 1,
              transition: 'opacity 150ms, background 150ms',
            }}
            onMouseEnter={e => { if (!ocupado) e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = ocupado ? '0.7' : '1' }}
          >
            {agregado
              ? <Check size={15} strokeWidth={2.4} />
              : <ShoppingCart size={15} strokeWidth={2} />}
          </button>

          <button
            onClick={handleBuyNow}
            disabled={!!ocupado}
            style={{
              flex: 1, minWidth: 0, height: 36, borderRadius: 8,
              background: 'transparent', color: 'var(--color-text)',
              border: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600,
              cursor: ocupado ? 'default' : 'pointer',
              opacity: ocupado ? 0.7 : 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              transition: 'opacity 150ms, border-color 150ms, color 150ms',
            }}
            onMouseEnter={e => {
              if (ocupado) return
              e.currentTarget.style.borderColor = 'var(--color-primary)'
              e.currentTarget.style.color = 'var(--color-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
              e.currentTarget.style.color = 'var(--color-text)'
            }}
          >
            Comprar ahora
          </button>
        </div>
      </div>
    </div>

    {picker && (
      <VariantPickerModal
        producto={picker.detalle}
        hue={producto.hue}
        modo={picker.modo}
        onClose={() => setPicker(null)}
        onDone={agregadas => { const modo = picker.modo; setPicker(null); aplicarResultado(agregadas, modo) }}
      />
    )}
    </>
  )
}
