import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Minus, Plus, ShoppingCart, Check, Lock, Truck, RotateCcw } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { ProductCard } from '@/components/storefront/ProductCard'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { ProdImage } from '@/components/storefront/Thumb'
import type { Producto, TiendaConfig } from '@/lib/storefront/types'
import { fmt, descuento } from '@/lib/storefront/utils'
import { useCart } from '@/lib/storefront/CartContext'
import { useAuth } from '@/hooks/useAuth'
import {
  getStorefrontConfig, getStorefrontProduct, getStorefrontProducts, getProductReviews,
  toTiendaConfig, toProducto,
  type StorefrontConfigResponse, type StorefrontProductDetail, type StorefrontProductReview,
} from '@/lib/storefront/api'
import { reviewEligibility, createReview, ApiError, type ReviewEligibility } from '@/lib/api'

// Sin modelo real detrás (características técnicas libres) — queda mock a
// propósito, ver PENDIENTES.md. El resto de la página (galería, precio,
// variantes, stock, reseñas) sale de datos reales.
const CARACT = [
  { label: 'Material', value: '100% gabardina de algodón' },
  { label: 'Forro',    value: 'Acolchado 80g' },
  { label: 'Cierre',   value: 'YKK' },
  { label: 'Origen',   value: 'Hecho en Argentina' },
]

function fechaResenia(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function hueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

export default function ProductoDetalle() {
  const router = useRouter()
  const { slug, id } = router.query as { slug: string; id: string }
  const base = `/tienda/${slug}`

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  const [producto, setProducto] = useState<StorefrontProductDetail | null>(null)
  const [relacionados, setRelacionados] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [seleccion, setSeleccion] = useState<Record<string, string>>({}) // optionId -> optionValueId
  const [imgIdx, setImgIdx] = useState(0)
  const [qty, setQty] = useState(1)
  const { agregar } = useCart()
  const [agregado, setAgregado] = useState(false)
  const { status: authStatus, user } = useAuth()
  const cliente = user?.type === 'customer' ? user.customer : null

  const [resenas, setResenas] = useState<StorefrontProductReview[]>([])
  const [elegibilidad, setElegibilidad] = useState<ReviewEligibility>({ eligible: false, orderId: null })
  const [textoResenia, setTextoResenia] = useState('')
  const [enviandoResenia, setEnviandoResenia] = useState(false)
  const [errorResenia, setErrorResenia] = useState('')

  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])

  useEffect(() => {
    if (!slug || !id) return
    let cancelado = false
    setCargando(true)
    setNotFound(false)
    getStorefrontProduct(slug, id)
      .then(p => {
        if (cancelado) return
        setProducto(p)
        // Preselecciona el primer valor disponible de cada opción.
        setSeleccion(Object.fromEntries(p.options.map(o => [o.id, o.values[0]?.id]).filter(([, v]) => v)))
        setImgIdx(0)
        setQty(1)
        return getStorefrontProducts(slug, { categoryId: p.categoryId ?? undefined, limit: 5 })
      })
      .then(r => {
        if (cancelado || !r) return
        setRelacionados(r.data.filter(x => x.id !== id).slice(0, 4).map(p => toProducto(p, { showNew: config?.appearance?.showNewBadge, showOffer: config?.appearance?.showOfferBadge, showLowStock: config?.appearance?.showLowStock })))
      })
      .catch(() => { if (!cancelado) setNotFound(true) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [slug, id])

  // Reseñas públicas — no necesitan sesión, cualquiera que entre a la página las ve.
  useEffect(() => {
    if (!id) return
    let cancelado = false
    getProductReviews(id).then(rows => { if (!cancelado) setResenas(rows) }).catch(() => {})
    return () => { cancelado = true }
  }, [id])

  // ¿Puede ESTE cliente dejar una reseña de este producto ahora mismo? Solo
  // tiene sentido preguntarlo si hay sesión de cliente — un visitante
  // anónimo ve el candado sin necesidad de pedirle nada al backend.
  useEffect(() => {
    if (!id || authStatus !== 'authenticated' || !cliente) { setElegibilidad({ eligible: false, orderId: null }); return }
    let cancelado = false
    reviewEligibility(id).then(r => { if (!cancelado) setElegibilidad(r) }).catch(() => {})
    return () => { cancelado = true }
  }, [id, authStatus, cliente])

  async function enviarResenia() {
    if (!id || !elegibilidad.orderId || !textoResenia.trim()) return
    setEnviandoResenia(true)
    setErrorResenia('')
    try {
      const nueva = await createReview({ productId: id, orderId: elegibilidad.orderId, text: textoResenia.trim() })
      setResenas(prev => [nueva, ...prev])
      setTextoResenia('')
      // Esta orden puntual ya se usó — reviso si queda OTRO pedido entregado
      // con este producto todavía sin reseñar (compró el mismo producto más
      // de una vez, cada compra habilita su propia reseña).
      reviewEligibility(id).then(setElegibilidad).catch(() => setElegibilidad({ eligible: false, orderId: null }))
    } catch (err) {
      setErrorResenia(err instanceof ApiError ? err.message : 'No se pudo publicar la reseña. Probá de nuevo.')
    } finally {
      setEnviandoResenia(false)
    }
  }

  const tienda: TiendaConfig = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  // Variante cuya combinación de valores coincide exactamente con la
  // selección actual — puede no existir (combinación "no ofrecida", ver
  // ProductVariant.isActive en el backend).
  const varianteSeleccionada = useMemo(() => {
    if (!producto) return null
    const idsSeleccionados = Object.values(seleccion)
    if (producto.options.length === 0) return producto.variants[0] ?? null
    return producto.variants.find(v => {
      const idsVariante = v.optionValues.map(ov => ov.optionValueId)
      return idsSeleccionados.length === idsVariante.length && idsSeleccionados.every(i => idsVariante.includes(i))
    }) ?? null
  }, [producto, seleccion])

  if (cargando) {
    return <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }} />
  }

  if (notFound || !producto) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 32px', textAlign: 'center', color: 'var(--color-muted)' }}>
          Este producto no existe o ya no está disponible.
        </div>
        <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
      </div>
    )
  }

  const precio = varianteSeleccionada ? varianteSeleccionada.price : producto.price
  const precioAnt = varianteSeleccionada ? varianteSeleccionada.comparePrice : producto.comparePrice
  const desc = precioAnt ? descuento(precio, precioAnt) : 0
  const ahorro = precioAnt ? precioAnt - precio : 0
  const enStock = varianteSeleccionada ? varianteSeleccionada.inStock : producto.variants.some(v => v.inStock)
  // Nunca la cantidad exacta (no se expone stock real al público) — gateado
  // por el toggle "Insignia de stock bajo" de Apariencia.
  const bajoStock = (config?.appearance?.showLowStock ?? true)
    && (varianteSeleccionada ? varianteSeleccionada.lowStock : producto.variants.some(v => v.lowStock))

  const imagenes = producto.images.length > 0 ? producto.images : null
  const hue = hueFromId(producto.id)

  // Etiqueta de la variante elegida a partir de la selección real ("Negro ·
  // Talle L"), no un texto genérico — así se ve igual en el carrito/drawer
  // del header que en esta pantalla.
  function agregarAlCarrito() {
    // TS no arrastra el narrowing de `if (notFound || !producto) return` de
    // más arriba adentro de esta función anidada — pero acá abajo (ya
    // pasado ese return) `producto` siempre está resuelto.
    if (!producto || !varianteSeleccionada || !enStock) return
    const varianteLabel = producto.options
      .map(o => o.values.find(v => v.id === seleccion[o.id])?.value)
      .filter((v): v is string => !!v)
      .join(' · ')
    agregar({
      id: varianteSeleccionada.id,
      productId: producto.id,
      nombre: producto.name,
      variante: varianteLabel,
      precio: varianteSeleccionada.price,
      precioAnt: varianteSeleccionada.comparePrice,
      hue,
    }, qty)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 768px) {
          .sf-pd-wrap     { padding: 16px 16px 48px !important; overflow-x: hidden; }
          .sf-pd-main     { grid-template-columns: 1fr !important; gap: 32px !important; }
          .sf-pd-gallery  { flex-direction: column-reverse !important; gap: 10px !important; }
          .sf-pd-thumbs   { flex-direction: row !important; overflow-x: auto; gap: 6px !important; flex-shrink: 1 !important; }
          .sf-pd-thumbs button { width: 56px !important; min-width: 56px; }
          .sf-pd-img-main > div { height: 300px !important; }
          .sf-pd-reviews  { grid-template-columns: 1fr !important; }
          .sf-pd-related  { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .sf-pd-related  { grid-template-columns: 1fr !important; }
          .sf-pd-img-main > div { height: 260px !important; }
        }
      `}</style>
      <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />
      <div className="sf-pd-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 64px' }}>
        <Breadcrumb items={[
          { label: 'Inicio',   href: base },
          { label: 'Catálogo', href: `${base}/catalogo` },
          ...(producto.categoryName ? [{ label: producto.categoryName }] : []),
          { label: producto.name },
        ]} />

        {/* ══ GRILLA PRINCIPAL ══ */}
        <div className="sf-pd-main" style={{ display: 'grid', gridTemplateColumns: '1fr 460px', gap: 56, marginBottom: 72 }}>

          {/* ── Galería + Características ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            <div className="sf-pd-gallery" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>

              {imagenes && imagenes.length > 1 && (
                <div className="sf-pd-thumbs" style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                  {imagenes.map((img, i) => (
                    <button
                      key={img.url + i}
                      onClick={() => setImgIdx(i)}
                      style={{
                        width: 76, padding: 0, borderRadius: 10, overflow: 'hidden',
                        border: `2px solid ${i === imgIdx ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        cursor: 'pointer', background: 'transparent',
                        transition: 'border-color 150ms',
                        flexShrink: 0,
                      }}
                    >
                      <ProdImage hue={hue} imgUrl={img.url} height={76} radius={0} />
                    </button>
                  ))}
                </div>
              )}

              <div className="sf-pd-img-main" style={{ flex: 1, position: 'relative' }}>
                <ProdImage hue={hue} imgUrl={imagenes?.[imgIdx]?.url} height={560} radius={14}>
                  {desc > 0 && (
                    <div style={{ position: 'absolute', top: 16, left: 16 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Oferta · -{desc}%
                      </span>
                    </div>
                  )}
                </ProdImage>
              </div>
            </div>

            <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', background: 'var(--color-surface)' }}>
                Características
              </div>
              <div style={{ padding: '4px 0' }}>
                {CARACT.map((c, i) => (
                  <div key={c.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, padding: '10px 16px', borderBottom: i < CARACT.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-body)' }}>{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Panel de info ── */}
          <div>
            {producto.categoryName && (
              <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                {producto.categoryName}
              </span>
            )}

            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--color-text)', margin: '0 0 10px', lineHeight: 1.15 }}>
              {producto.name}
            </h1>

            {producto.description && (
              <p style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.65, margin: '0 0 20px', borderBottom: '1px solid var(--color-border)', paddingBottom: 20 }}>
                {producto.description}
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(precio)}</span>
              {precioAnt && <span style={{ fontSize: 16, color: 'var(--color-subtle)', textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace' }}>{fmt(precioAnt)}</span>}
            </div>
            {ahorro > 0 && <div style={{ fontSize: 13, color: 'var(--color-success)', fontWeight: 600, marginBottom: 20 }}>Ahorrás {fmt(ahorro)}</div>}

            {/* Opciones (talle/color/etc — genéricas, según lo que definió el dueño) */}
            {producto.options.map(o => (
              <div key={o.id} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>
                  {o.name}: <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>{o.values.find(v => v.id === seleccion[o.id])?.value ?? ''}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {o.values.map(v => {
                    const activo = seleccion[o.id] === v.id
                    return (
                      <button key={v.id} onClick={() => setSeleccion(s => ({ ...s, [o.id]: v.id }))}
                        style={{ minWidth: 48, height: 40, padding: '0 12px', background: activo ? 'var(--color-text)' : 'var(--color-bg)', color: activo ? 'var(--color-bg)' : 'var(--color-text)', border: `1px solid ${activo ? 'var(--color-text)' : 'var(--color-border)'}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {v.value}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Stock */}
            {!varianteSeleccionada && producto.options.length > 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-error)', fontWeight: 600, marginBottom: 20 }}>
                Esa combinación no está disponible
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: enStock ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600, marginBottom: 20 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: enStock ? 'var(--color-success)' : 'var(--color-error)', flexShrink: 0 }} />
                {enStock ? (bajoStock ? '¡Últimas unidades!' : 'Stock disponible') : 'Sin stock'}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 8, height: 48, flexShrink: 0 }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 40, height: 48, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', display: 'grid', placeItems: 'center' }}><Minus size={14} /></button>
                <span style={{ width: 36, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{qty}</span>
                <button onClick={() => setQty(q => q + 1)} style={{ width: 40, height: 48, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', display: 'grid', placeItems: 'center' }}><Plus size={14} /></button>
              </div>
              <button
                disabled={!varianteSeleccionada || !enStock}
                onClick={() => { agregarAlCarrito(); setAgregado(true); setTimeout(() => setAgregado(false), 1400) }}
                style={{ flex: 1, height: 48, borderRadius: 8, background: agregado ? 'var(--color-success)' : 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: (!varianteSeleccionada || !enStock) ? 'not-allowed' : 'pointer', opacity: (!varianteSeleccionada || !enStock) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(59,130,246,0.25)', transition: 'background 150ms' }}
              >
                {agregado ? <><Check size={16} strokeWidth={2} /> Agregado</> : <><ShoppingCart size={16} strokeWidth={1.5} /> Agregar al carrito</>}
              </button>
            </div>

            <button
              disabled={!varianteSeleccionada || !enStock}
              onClick={() => { agregarAlCarrito(); router.push(`${base}/checkout/datos`) }}
              style={{ width: '100%', height: 48, borderRadius: 8, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600, cursor: (!varianteSeleccionada || !enStock) ? 'not-allowed' : 'pointer', opacity: (!varianteSeleccionada || !enStock) ? 0.5 : 1, marginBottom: 20 }}
            >
              Comprar ahora
            </button>

            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
              {([
                [<Truck key="t" size={16} strokeWidth={1.5} color="var(--color-muted)" />, 'Envíos', '24-72 hs'],
                [<RotateCcw key="r" size={16} strokeWidth={1.5} color="var(--color-muted)" />, 'Cambios', '30 días gratis'],
                [<Lock key="l" size={16} strokeWidth={1.5} color="var(--color-muted)" />, 'Pago', '100% seguro'],
              ] as [React.ReactNode, string, string][]).map(([icon, t1, t2]) => (
                <div key={t1} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {icon}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{t1}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{t2}</div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ══ RESEÑAS ══ */}
        {(config?.appearance?.showReviews ?? true) && (
        <div style={{ marginBottom: 72 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Reseñas de clientes</h2>
          </div>

          {resenas.length > 0 ? (
            <div className="sf-pd-reviews" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
              {resenas.map(r => (
                <div key={r.id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.customerName}
                      {r.isVerified && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '1px 6px', borderRadius: 999 }}>
                          Compra verificada
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-subtle)', flexShrink: 0 }}>{fechaResenia(r.createdAt)}</div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.5 }}>{r.text}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px 0', color: 'var(--color-muted)', fontSize: 13, marginBottom: 24 }}>
              Todavía no hay reseñas de este producto. ¡Sé el primero en dejar la tuya!
            </div>
          )}

          {elegibilidad.eligible ? (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>Escribí tu reseña</div>
              <textarea
                value={textoResenia}
                onChange={e => setTextoResenia(e.target.value)}
                placeholder="Contanos tu experiencia con este producto..."
                style={{ width: '100%', boxSizing: 'border-box', height: 88, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', fontSize: 13, resize: 'vertical', color: 'var(--color-text)', outline: 'none', fontFamily: 'inherit' }}
              />
              {errorResenia && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-error)' }}>{errorResenia}</div>
              )}
              <button
                onClick={enviarResenia}
                disabled={!textoResenia.trim() || enviandoResenia}
                style={{
                  marginTop: 10, height: 38, padding: '0 20px', borderRadius: 8,
                  background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none',
                  cursor: (!textoResenia.trim() || enviandoResenia) ? 'not-allowed' : 'pointer',
                  opacity: (!textoResenia.trim() || enviandoResenia) ? 0.6 : 1,
                }}
              >
                {enviandoResenia ? 'Publicando...' : 'Publicar reseña'}
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: 20, pointerEvents: 'none', userSelect: 'none', filter: 'blur(2px)', opacity: 0.45 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>Escribí tu reseña</div>
                <textarea disabled placeholder="Contanos tu experiencia con este producto..." style={{ width: '100%', boxSizing: 'border-box', height: 88, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', fontSize: 13, resize: 'none', color: 'var(--color-text)', outline: 'none', fontFamily: 'inherit' }} />
                <button disabled style={{ marginTop: 10, height: 38, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'not-allowed' }}>Publicar reseña</button>
              </div>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(var(--color-bg-raw, 255,255,255), 0.72)', backdropFilter: 'blur(4px)' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'grid', placeItems: 'center' }}>
                  <Lock size={20} strokeWidth={1.5} color="var(--color-muted)" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 4px' }}>Solo compradores verificados</p>
                  {authStatus === 'authenticated' ? (
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>Comprá este producto para poder dejar una reseña.</p>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>
                      <a href={`${base}/login`} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Iniciá sesión</a> y comprá este producto para poder dejar una reseña.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* ══ TAMBIÉN TE PUEDE GUSTAR ══ */}
        {relacionados.length > 0 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>También te puede gustar</h2>
            <div className="sf-pd-related" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {relacionados.map(p => <ProductCard key={p.id} producto={p} />)}
            </div>
          </div>
        )}
      </div>
      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
    </div>
  )
}
