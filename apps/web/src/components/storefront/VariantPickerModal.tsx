// Selector rápido de variante — se abre desde la card de la grilla (ícono de
// carrito o "Comprar ahora") cuando el producto tiene opciones (talle/color/
// etc.): ahí no hay forma honesta de agregar "la variante" sin preguntar
// cuál, así que en vez de mandar al cliente al detalle completo, se resuelve
// acá mismo con una foto y precio que van cambiando según lo que va
// eligiendo — mismo criterio de tachado/stock que ProductoDetalle.tsx, pero
// en un modal liviano.
import { useMemo, useState } from 'react'
import { X, Minus, Plus, ShoppingCart, Check } from 'lucide-react'
import { ProdImage } from './Thumb'
import { fmt } from '@/lib/storefront/utils'
import { useCart } from '@/lib/storefront/CartContext'
import type { StorefrontProductDetail } from '@/lib/storefront/api'

type Props = {
  producto: StorefrontProductDetail
  hue: number
  // Qué botón de la card abrió el modal — determina el texto/acción del CTA
  // final: "agregar" solo agrega y cierra, "comprar" agrega y además avisa
  // para que la card navegue al checkout.
  modo: 'agregar' | 'comprar'
  onClose: () => void
  // Cuántas unidades se agregaron de verdad (puede ser 0 si ya estaba todo
  // el stock en el carrito) — la card decide qué feedback mostrar con esto.
  onDone: (agregado: number) => void
}

function imagenParaSeleccion(producto: StorefrontProductDetail, seleccion: Record<string, string>): string | undefined {
  const idsSeleccionados = new Set(Object.values(seleccion))
  const conFoto = producto.images.find(i => i.optionValueId && idsSeleccionados.has(i.optionValueId))
  if (conFoto) return conFoto.url
  return (producto.images.find(i => i.isPrimary) ?? producto.images[0])?.url
}

export function VariantPickerModal({ producto, hue, modo, onClose, onDone }: Props) {
  const { agregar, items: itemsCarrito } = useCart()
  const [seleccion, setSeleccion] = useState<Record<string, string>>(
    Object.fromEntries(producto.options.map(o => [o.id, o.values[0]?.id]).filter(([, v]) => v)),
  )
  const [qty, setQty] = useState(1)

  const varianteSeleccionada = useMemo(() => {
    const idsSeleccionados = Object.values(seleccion)
    return producto.variants.find(v => {
      const idsVariante = v.optionValues.map(ov => ov.optionValueId)
      return idsSeleccionados.length === idsVariante.length && idsSeleccionados.every(i => idsVariante.includes(i))
    }) ?? null
  }, [producto, seleccion])

  function valorDisponible(optionId: string, valueId: string): boolean {
    const hipotetica = { ...seleccion, [optionId]: valueId }
    const idsHipoteticos = Object.values(hipotetica)
    const v = producto.variants.find(variant => {
      const idsVariante = variant.optionValues.map(ov => ov.optionValueId)
      return idsHipoteticos.length === idsVariante.length && idsHipoteticos.every(i => idsVariante.includes(i))
    })
    return v ? v.inStock : false
  }

  const enCarrito = varianteSeleccionada ? (itemsCarrito.find(i => i.id === varianteSeleccionada.id)?.qty ?? 0) : 0
  const restante = varianteSeleccionada ? Math.max(0, varianteSeleccionada.maxQty - enCarrito) : 0
  const enStock = varianteSeleccionada?.inStock ?? false
  const todoEnCarrito = enStock && restante === 0
  const precio = varianteSeleccionada?.price ?? producto.price
  const precioAnt = varianteSeleccionada?.comparePrice ?? producto.comparePrice
  const imagen = imagenParaSeleccion(producto, seleccion)

  function confirmar() {
    if (!varianteSeleccionada || !enStock || restante === 0) return
    const varianteLabel = producto.options
      .map(o => o.values.find(v => v.id === seleccion[o.id])?.value)
      .filter((v): v is string => !!v)
      .join(' · ')
    const agregadas = agregar({
      id: varianteSeleccionada.id,
      productId: producto.id,
      nombre: producto.name,
      variante: varianteLabel,
      precio: varianteSeleccionada.price,
      precioAnt: varianteSeleccionada.comparePrice,
      hue,
      maxQty: varianteSeleccionada.maxQty,
    }, qty)
    onDone(agregadas)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', background: 'var(--color-bg)', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 0' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3, paddingRight: 12 }}>{producto.name}</div>
          <button onClick={onClose} style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-body)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <ProdImage hue={hue} imgUrl={imagen} height={220} radius={10} />

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(precio)}</span>
            {precioAnt && <span style={{ fontSize: 13, color: 'var(--color-subtle)', textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace' }}>{fmt(precioAnt)}</span>}
          </div>

          {producto.options.map(o => (
            <div key={o.id}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                {o.name}: <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>{o.values.find(v => v.id === seleccion[o.id])?.value ?? ''}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {o.values.map(v => {
                  const activo = seleccion[o.id] === v.id
                  const disponible = valorDisponible(o.id, v.id)
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSeleccion(s => ({ ...s, [o.id]: v.id }))}
                      title={disponible ? undefined : 'Sin stock en esta combinación'}
                      style={{
                        position: 'relative', minWidth: 44, height: 38, padding: '0 12px',
                        background: activo ? 'var(--color-text)' : 'var(--color-bg)',
                        color: !disponible ? 'var(--color-subtle)' : activo ? 'var(--color-bg)' : 'var(--color-text)',
                        border: `1px solid ${activo ? 'var(--color-text)' : 'var(--color-border)'}`,
                        borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        textDecoration: disponible ? 'none' : 'line-through',
                        opacity: disponible ? 1 : 0.55,
                      }}
                    >
                      {v.value}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {!varianteSeleccionada ? (
            <div style={{ fontSize: 13, color: 'var(--color-error)', fontWeight: 600 }}>Esa combinación no está disponible</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: !enStock ? 'var(--color-error)' : todoEnCarrito ? 'var(--color-muted)' : varianteSeleccionada.lowStock ? '#D97706' : 'var(--color-success)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
              {!enStock
                ? 'Sin stock'
                : todoEnCarrito
                  ? `Ya tenés las ${varianteSeleccionada.maxQty} unidades disponibles en tu carrito`
                  : varianteSeleccionada.lowStock
                    ? `¡Últimas ${varianteSeleccionada.maxQty} unidades!`
                    : 'Stock disponible'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 8, height: 42, flexShrink: 0 }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 42, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', display: 'grid', placeItems: 'center' }}><Minus size={13} /></button>
              <span style={{ width: 32, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{qty}</span>
              <button
                onClick={() => setQty(q => Math.min(q + 1, restante || 1))}
                disabled={qty >= restante}
                style={{ width: 36, height: 42, background: 'none', border: 'none', cursor: qty >= restante ? 'not-allowed' : 'pointer', color: qty >= restante ? 'var(--color-subtle)' : 'var(--color-text)', display: 'grid', placeItems: 'center' }}
              ><Plus size={13} /></button>
            </div>
            <button
              disabled={!varianteSeleccionada || !enStock || restante === 0}
              onClick={confirmar}
              style={{
                flex: 1, height: 42, borderRadius: 8, background: 'var(--color-primary)', color: '#fff',
                fontSize: 13, fontWeight: 700, border: 'none',
                cursor: (!varianteSeleccionada || !enStock || restante === 0) ? 'not-allowed' : 'pointer',
                opacity: (!varianteSeleccionada || !enStock || restante === 0) ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {modo === 'comprar' ? <><Check size={15} strokeWidth={2} /> Comprar ahora</> : <><ShoppingCart size={15} strokeWidth={2} /> Agregar al carrito</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
