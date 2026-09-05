import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Minus, Plus, ShoppingCart, Check, Lock, Truck, RotateCcw, MessageCircle, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { StorefrontChrome } from '@/components/storefront/StorefrontChrome'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { ProductCard } from '@/components/storefront/ProductCard'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { ProdImage } from '@/components/storefront/Thumb'
import { Skeleton, SkeletonText, SkeletonChip } from '@/design-system/components/Skeleton'
import type { Producto, TiendaConfig } from '@/lib/storefront/types'
import { fmt, descuento, quedanPocas, imagenParaVariante, variantePrincipal, openWpp } from '@/lib/storefront/utils'
import { useCart } from '@/lib/storefront/CartContext'
import { useAuth } from '@/hooks/useAuth'
import {
  getStorefrontConfig, getStorefrontProduct, getStorefrontProducts, getProductReviews,
  toTiendaConfig, toProducto,
  type StorefrontConfigResponse, type StorefrontProductDetail, type StorefrontProductReview,
} from '@/lib/storefront/api'
import { reviewEligibility, createReview, ApiError, type ReviewEligibility } from '@/lib/api'

function fechaResenia(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function hueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

// Envíos/cambios/pago — vive en dos lugares posibles según si el producto
// tiene ficha técnica (ver el componente principal): pegada a los botones
// de compra (su lugar de siempre) o abajo de la foto (solo cuando no hay
// specs, para no dejar un hueco vacío en esa columna). Mismo contenido,
// mismo componente — solo cambia el margen según dónde se use.
function CajaEnvios({ className, marginLeft = 0, marginBottom = 0 }: { className?: string; marginLeft?: number; marginBottom?: number }) {
  return (
    <div className={className} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginLeft, marginBottom }}>
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
  )
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
  // Swatch de variante visual (Color) bajo el mouse — sin click, preview
  // temporal nomás. Ver `valorMostrado` más abajo.
  const [hoverValorId, setHoverValorId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const { agregar, items: itemsCarrito } = useCart()
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

  // Reseñas públicas — no necesitan sesión, cualquiera que entre a la página
  // las ve. En vidriera digital el backend las bloquea (FullModeOnly, ver
  // product-reviews.controller.ts) — ni se pide, la sección entera se saca
  // más abajo.
  useEffect(() => {
    if (!id || config?.business?.mode === 'SHOWCASE') return
    let cancelado = false
    getProductReviews(id).then(rows => { if (!cancelado) setResenas(rows) }).catch(() => {})
    return () => { cancelado = true }
  }, [id, config?.business?.mode])

  // ¿Puede ESTE cliente dejar una reseña de este producto ahora mismo? Solo
  // tiene sentido preguntarlo si hay sesión de cliente — un visitante
  // anónimo ve el candado sin necesidad de pedirle nada al backend.
  useEffect(() => {
    if (!id || authStatus !== 'authenticated' || !cliente || config?.business?.mode === 'SHOWCASE') { setElegibilidad({ eligible: false, orderId: null }); return }
    let cancelado = false
    reviewEligibility(id).then(r => { if (!cancelado) setElegibilidad(r) }).catch(() => {})
    return () => { cancelado = true }
  }, [id, authStatus, cliente, config?.business?.mode])

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
    if (producto.options.length === 0) return variantePrincipal(producto.variants) ?? null
    return producto.variants.find(v => {
      const idsVariante = v.optionValues.map(ov => ov.optionValueId)
      return idsSeleccionados.length === idsVariante.length && idsSeleccionados.every(i => idsVariante.includes(i))
    }) ?? null
  }, [producto, seleccion])

  // La cantidad se resetea a 1 cada vez que cambia la variante elegida — antes
  // se quedaba en lo que el cliente había tocado antes (ej. 9 en un talle que
  // tenía de sobra) y podía saltar a una variante con solo 1 unidad sin que
  // el stepper se diera cuenta.
  useEffect(() => { setQty(1) }, [varianteSeleccionada?.id])

  // Al elegir (click, no hover) otro valor de la variante visual, la
  // navegación de fotos salta directo a la foto de ESE color dentro de la
  // galería completa (si tiene una) — mismo criterio que la vista previa del
  // panel (ProductoNuevo.tsx → PreviewProducto). Antes esto solo reseteaba a
  // 0 porque la galería se FILTRABA a las fotos del color activo (ver
  // `imagenes` más abajo); con un color que tiene una sola foto tagueada
  // (el caso más común) eso significaba que nunca había nada para navegar,
  // aunque el producto tuviera más fotos en otros colores.
  const valorVisualElegido = producto?.options.find(o => o.isVisual)?.id
  const valorVisualSeleccionId = valorVisualElegido ? seleccion[valorVisualElegido] : undefined
  useEffect(() => {
    if (!valorVisualSeleccionId) { setImgIdx(0); return }
    const idx = producto?.images.findIndex(im => im.optionValueId === valorVisualSeleccionId) ?? -1
    setImgIdx(idx >= 0 ? idx : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- producto.images no cambia con la selección, solo se lee acá
  }, [valorVisualSeleccionId])

  // ¿Un VALOR de opción puntual (ej. "Rojo") tiene alguna combinación con
  // stock manteniendo el resto de la selección actual? Se usa para tachar los
  // botones de talle/color — el dato ya viene del backend (variants[].inStock
  // + optionValues), no hace falta pedir nada nuevo. Si ninguna variante
  // coincide con esa combinación (no ofrecida, isActive:false ya filtrado por
  // el backend) también cuenta como no disponible: al cliente le da lo mismo
  // "no existe" que "existe pero sin stock", en los dos casos no se puede
  // comprar.
  function valorDisponible(optionId: string, valueId: string): boolean {
    if (!producto) return true
    const hipotetica = { ...seleccion, [optionId]: valueId }
    const idsHipoteticos = Object.values(hipotetica)
    const v = producto.variants.find(variant => {
      const idsVariante = variant.optionValues.map(ov => ov.optionValueId)
      return idsHipoteticos.length === idsVariante.length && idsHipoteticos.every(i => idsVariante.includes(i))
    })
    return v ? v.inStock : false
  }

  // Cuánto de ESTA variante ya hay en el carrito — para "ya tenés todo lo
  // disponible" y para topear el stepper por lo que realmente queda.
  const enCarrito = varianteSeleccionada ? (itemsCarrito.find(i => i.id === varianteSeleccionada.id)?.qty ?? 0) : 0
  const restante = varianteSeleccionada ? Math.max(0, varianteSeleccionada.maxQty - enCarrito) : 0

  if (cargando) {
    return (
      <StorefrontChrome tienda={tienda} config={config}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 64px' }} aria-hidden="true">
          <SkeletonText width={220} height={12} style={{ marginBottom: 24 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 460px', gap: 56 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <Skeleton width="100%" height={560} radius={14} />
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SkeletonText width={110} height={12} />
                {[1, 2, 3, 4].map(i => <SkeletonText key={i} width={`${70 - i * 6}%`} height={11} delay={i * 60} />)}
              </div>
            </div>
            <div>
              <SkeletonChip width={90} delay={40} style={{ marginBottom: 14 }} />
              <SkeletonText width="85%" height={26} delay={70} style={{ marginBottom: 10, borderRadius: 6 }} />
              <SkeletonText width="60%" height={12} delay={100} style={{ marginBottom: 20 }} />
              <SkeletonText width={140} height={30} delay={130} style={{ marginBottom: 24, borderRadius: 6 }} />
              <SkeletonText width={70} height={11} delay={160} style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {[1, 2, 3, 4].map(i => <Skeleton key={i} width={48} height={40} radius={8} delay={160 + i * 40} />)}
              </div>
              <Skeleton width="100%" height={52} radius={10} delay={280} />
            </div>
          </div>
        </div>
      </StorefrontChrome>
    )
  }

  if (notFound || !producto) {
    return (
      <StorefrontChrome tienda={tienda} config={config}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 32px', textAlign: 'center', color: 'var(--color-muted)' }}>
          Este producto no existe o ya no está disponible.
        </div>
        <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
      </StorefrontChrome>
    )
  }

  const precio = varianteSeleccionada ? varianteSeleccionada.price : producto.price
  const precioAnt = varianteSeleccionada ? varianteSeleccionada.comparePrice : producto.comparePrice
  const desc = precioAnt ? descuento(precio, precioAnt) : 0
  const ahorro = precioAnt ? precioAnt - precio : 0
  // RBT-691 — el precio que ya carga el comercio (`precio`) sigue siendo el
  // final que cobra: acá solo se DESGLOSA el IVA de ese valor (no se
  // recalcula ni se suma nada), para la leyenda informativa.
  const ivaRate = config?.payment?.ivaRate
  const precioSinIva = ivaRate != null ? precio / (1 + ivaRate / 100) : null
  // RBT-693 — un renglón por cada medio de pago con descuento cargado y
  // activo, ordenado de mayor a menor. Se calcula sobre `precio` (ya con
  // IVA), nunca sobre precioSinIva — mismo criterio que RBT-692.
  const metodosConDescuento: { key: string; label: string; pct: number }[] = [
    { key: 'transfer', label: 'transferencia', pct: config?.payment?.transferDiscountPercent, activo: config?.payment?.acceptsTransfer },
    { key: 'cash', label: 'efectivo', pct: config?.payment?.cashDiscountPercent, activo: config?.payment?.acceptsCash },
    { key: 'mp', label: 'Mercado Pago', pct: config?.payment?.mercadopagoDiscountPercent, activo: config?.payment?.acceptsMercadopago },
  ]
    .filter(m => !!m.activo && !!m.pct && m.pct > 0)
    .map(m => ({ key: m.key, label: m.label, pct: m.pct as number }))
    .sort((a, b) => b.pct - a.pct)
  const enStock = varianteSeleccionada ? varianteSeleccionada.inStock : producto.variants.some(v => v.inStock)
  // "Negro · Talle L" a partir de la selección real — mismo criterio que ya
  // usa agregarAlCarrito() más abajo, pero acá arriba para que lo pueda usar
  // también el mensaje de WhatsApp sin duplicar el cálculo.
  const varianteLabel = producto.options
    .map(o => o.values.find(v => v.id === seleccion[o.id])?.value)
    .filter((v): v is string => !!v)
    .join(' · ')
  // Vidriera digital: no hay carrito ni checkout — consultar por WhatsApp
  // es la ÚNICA forma de comprar. En tienda completa, es una opción más
  // al lado de "Agregar al carrito"/"Comprar ahora".
  const esVidriera = config?.business?.mode === 'SHOWCASE'
  // El número exacto SOLO se ve cuando queda poco (maxQty acotado del lado
  // del backend, ver storefront.service.ts) — gateado además por el toggle
  // "Insignia de stock bajo" de Apariencia: sin él, se ve "Disponible" a
  // secas aunque quede poco. Para la variante seleccionada, "queda poco" es
  // EN VIVO (quedanPocas, ver utils.ts): reacciona a `restante` bajando por
  // lo que el cliente ya tiene en su propio carrito, no solo al flag que
  // trajo el fetch inicial — sin esto, agregar 18 de 20 dejaba la variante
  // mostrando "Disponible" como si sobrara.
  const bajoStock = (config?.appearance?.showLowStock ?? true)
    && (varianteSeleccionada ? quedanPocas(restante, varianteSeleccionada.lowStock) : producto.variants.some(v => v.lowStock))
  // Ya tiene en el carrito TODO lo que hay disponible — distinto de "sin
  // stock": acá sí hay, pero ya está todo reservado en su propio carrito.
  const todoEnCarrito = enStock && varianteSeleccionada != null && restante === 0

  // La opción "visual" (ej. Color) es la única con fotos por valor — mismo
  // campo que ya carga el panel (isVisual), acá recién se empieza a leer.
  const opcionVisual = producto.options.find(o => o.isVisual)
  // Al pasar el mouse por un swatch (sin hacer click todavía) se previsualiza
  // esa variante — la galería y la etiqueta de arriba reaccionan, pero
  // `seleccion` (lo que de verdad se va a comprar) no cambia hasta el click.
  const valorMostrado = opcionVisual ? (hoverValorId ?? seleccion[opcionVisual.id] ?? null) : null

  // Galería: TODAS las fotos del producto (generales + las de cada color),
  // una sola lista navegable con su tira de miniaturas al costado — antes se
  // FILTRABA a solo las fotos del color activo, así que con un color que
  // tiene una única foto tagueada (el caso más común, ver el flujo del
  // panel) nunca aparecía nada para desplazar, aunque el producto tuviera
  // más fotos en otros colores. Elegir un color salta el índice a SU foto
  // (ver el useEffect de más arriba); pasar el mouse (hover, sin click)
  // solo la PREVISUALIZA en la imagen grande y la miniatura activa, sin
  // tocar `imgIdx` de verdad — mismo criterio que la vista previa del panel.
  const imagenes = producto.images.length > 0 ? producto.images : null
  const idxHover = hoverValorId ? (imagenes?.findIndex(im => im.optionValueId === hoverValorId) ?? -1) : -1
  const idxMostrado = idxHover >= 0 ? idxHover : imgIdx
  const hue = hueFromId(producto.id)
  // La tira de miniaturas (76px + 12px de gap) solo ocupa lugar cuando hay
  // 2+ fotos — si no, la imagen principal arranca pegada al borde y todo lo
  // de abajo (ficha técnica, envíos/cambios/pago) tiene que alinearse ahí
  // también, no quedarse angosto contando un espacio de miniaturas que no
  // existe.
  const hayMiniaturas = !!imagenes && imagenes.length > 1
  const anchoMiniaturas = hayMiniaturas ? 88 : 0

  // Etiqueta de la variante elegida a partir de la selección real ("Negro ·
  // Talle L"), no un texto genérico — así se ve igual en el carrito/drawer
  // del header que en esta pantalla.
  function agregarAlCarrito() {
    // TS no arrastra el narrowing de `if (notFound || !producto) return` de
    // más arriba adentro de esta función anidada — pero acá abajo (ya
    // pasado ese return) `producto` siempre está resuelto.
    if (!producto || !varianteSeleccionada || !enStock) return
    agregar({
      id: varianteSeleccionada.id,
      productId: producto.id,
      nombre: producto.name,
      variante: varianteLabel,
      precio: varianteSeleccionada.price,
      precioAnt: varianteSeleccionada.comparePrice,
      hue,
      imgUrl: imagenParaVariante(producto.images, varianteSeleccionada.optionValues.map(ov => ov.optionValueId)),
      maxQty: varianteSeleccionada.maxQty,
    }, qty)
  }

  // Mensaje armado con lo que el vendedor necesita para responder rápido:
  // nombre del producto, la variante elegida (si hay) y el precio vigente
  // (ya con el de la variante si corresponde) — el cliente no tiene que
  // escribir nada de eso a mano.
  function consultarPorWpp() {
    if (!producto || !tienda.wpp) return
    const partes = [`Hola! Quería consultar sobre "${producto.name}"`]
    if (varianteLabel) partes.push(`(${varianteLabel})`)
    const msg = `${partes.join(' ')}, ${fmt(precio)}. ¿Está disponible?`
    openWpp(tienda.wpp, msg)
  }

  return (
    <StorefrontChrome tienda={tienda} config={config}>
      <style>{`
        @media (max-width: 768px) {
          .sf-pd-wrap     { padding: 16px 16px 48px !important; overflow-x: hidden; }
          .sf-pd-main     { grid-template-columns: minmax(0,1fr) !important; gap: 32px !important; }
          /* align-items:flex-start viene del inline de .sf-pd-gallery
             (pensado para la fila de escritorio, donde el cross-axis es
             vertical) — en columna el cross-axis pasa a ser horizontal, así
             que ese flex-start deja de "estirar" a los hijos y cada uno
             pasa a medir su ancho de CONTENIDO en vez de ocupar todo el
             ancho disponible. La foto principal (.sf-pd-img-main, un
             div con width:100% adentro) queda sin un ancho real contra el
             que resolver ese 100% y termina invisible (bug real, reportado
             con captura: "no se ve la foto del detalle producto" en
             responsive). stretch la vuelve a poner a ancho completo, que es
             lo que ya pasaba en escritorio con flex-direction:row. */
          .sf-pd-gallery  { flex-direction: column-reverse !important; align-items: stretch !important; gap: 10px !important; }
          .sf-pd-thumbs   { flex-direction: row !important; overflow-x: auto; gap: 6px !important; flex-shrink: 1 !important; }
          .sf-pd-thumbs button { width: 56px !important; min-width: 56px; }
          .sf-pd-img-main > div { height: 300px !important; }
          .sf-pd-belowimg { margin-left: 0 !important; }
          .sf-pd-reviews  { grid-template-columns: minmax(0,1fr) !important; }
          .sf-pd-related  { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .sf-pd-related  { grid-template-columns: minmax(0,1fr) !important; }
          .sf-pd-img-main > div { height: 260px !important; }
        }
      `}</style>
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
                      className="ds-hover"
                      onClick={() => setImgIdx(i)}
                      style={{
                        width: 76, padding: 0, borderRadius: 10, overflow: 'hidden',
                        border: `2px solid ${i === idxMostrado ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: 'transparent',
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
                <ProdImage hue={hue} imgUrl={imagenes?.[idxMostrado]?.url} height={560} radius={14}>
                  {/* "2x1"/"3x2" (RBT-675) gana sobre "Oferta·-X%" — es más
                      específico, mismo criterio de prioridad que el badge
                      del catálogo (toProducto()). */}
                  {(producto.promoLabel || desc > 0) && (
                    <div style={{ position: 'absolute', top: 16, left: 16 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {producto.promoLabel ? producto.promoLabel : `Oferta · -${desc}%`}
                      </span>
                    </div>
                  )}
                  {/* Navegación entre la foto principal y las de variante —
                      antes solo se podía cambiar de foto clickeando un
                      thumbnail (y ninguno se mostraba con una sola foto). */}
                  {imagenes && imagenes.length > 1 && (
                    <>
                      <button
                        className="ds-hover"
                        onClick={() => setImgIdx(i => (i - 1 + imagenes.length) % imagenes.length)}
                        title="Foto anterior"
                        style={{ position: 'absolute', top: '50%', left: 14, transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.92)', color: 'var(--color-text)', display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                      ><ChevronLeft size={18} /></button>
                      <button
                        className="ds-hover"
                        onClick={() => setImgIdx(i => (i + 1) % imagenes.length)}
                        title="Foto siguiente"
                        style={{ position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.92)', color: 'var(--color-text)', display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                      ><ChevronRight size={18} /></button>
                    </>
                  )}
                </ProdImage>
              </div>
            </div>

            {/* Ficha técnica: la carga el vendedor (a mano o con Orbi) al crear
                el producto — si no cargó ninguna, la tabla entera no se
                muestra (no hay nada genérico/mock que rellenar acá). */}
            {producto.specs.length > 0 && (
              <div className="sf-pd-belowimg" style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', marginLeft: anchoMiniaturas }}>
                <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', background: 'var(--color-surface)' }}>
                  Características
                </div>
                <div style={{ padding: '4px 0' }}>
                  {producto.specs.map((c, i) => (
                    <div key={`${c.label}-${i}`} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, padding: '10px 16px', borderBottom: i < producto.specs.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</span>
                      <span style={{ fontSize: 13, color: 'var(--color-body)' }}>{c.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Envíos/cambios/pago — su lugar "de siempre" es la columna
                derecha, pegado a los botones de compra (ver más abajo). Pero
                sin ficha técnica (la mayoría de los productos no son
                electrónica) la columna izquierda quedaba mucho más corta que
                la derecha y se veía un hueco vacío grande debajo de la foto
                — así que acá SOLO aparece cuando no hay specs, para llenar
                ese hueco. Con specs, ya hay algo abajo de la foto y esto
                vuelve a su lugar de siempre. */}
            {producto.specs.length === 0 && <CajaEnvios className="sf-pd-belowimg" marginLeft={anchoMiniaturas} />}
          </div>

          {/* ── Panel de info ── */}
          <div>
            {producto.categoryName && (
              <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                {producto.categoryName}
              </span>
            )}

            {/* "A qué corresponde" el 2x1/3x2 (RBT-675) — con varias promos
                activas a la vez, el cartel solo ("2x1") no alcanza para
                saber si aplica a este producto puntual o a toda una
                categoría. Mismo patrón visual (ícono Info + texto muted)
                que ya usa TwoForOneConfig.tsx en el panel. */}
            {producto.promoLabel && producto.promoScope && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 12 }}>
                <Info size={13} strokeWidth={1.8} color="var(--color-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>{producto.promoScope}</span>
              </div>
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
            {ahorro > 0 && <div style={{ fontSize: 13, color: 'var(--color-success)', fontWeight: 600, marginBottom: 4 }}>Ahorrás {fmt(ahorro)}</div>}

            {/* RBT-691 — informativo: el precio de arriba YA es el final que
                cobra el negocio, acá solo se desglosa cuánto de eso es IVA. */}
            {ivaRate != null && precioSinIva != null && (
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: metodosConDescuento.length ? 4 : 20 }}>
                Precio final, incluye IVA ({ivaRate}%) · sin impuestos: {fmt(precioSinIva)}
              </div>
            )}

            {/* RBT-693 — un renglón por medio de pago con descuento activo,
                de mayor a menor. Si no hay ninguno, no se renderiza nada. */}
            {metodosConDescuento.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {metodosConDescuento.map(m => (
                  <div key={m.key} style={{ fontSize: 13, color: 'var(--color-success)', fontWeight: 600, marginTop: 2 }}>
                    {fmt(precio * (1 - m.pct / 100))} pagando {m.key === 'cash' ? 'en' : 'con'} {m.label} ({m.pct}% off)
                  </div>
                ))}
              </div>
            )}

            {/* Opciones (talle/color/etc — genéricas, según lo que definió el dueño) */}
            {producto.options.map(o => (
              <div key={o.id} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>
                  {o.name}: <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>
                    {/* La opción visual (Color) muestra la que está en hover
                        si hay una — mismo criterio que Mercado Libre: pasar
                        el mouse por el swatch previsualiza sin elegir. */}
                    {(o.isVisual ? o.values.find(v => v.id === valorMostrado) : o.values.find(v => v.id === seleccion[o.id]))?.value ?? ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {o.values.map(v => {
                    const activo = seleccion[o.id] === v.id
                    const disponible = valorDisponible(o.id, v.id)
                    if (o.isVisual) {
                      const fotoSwatch = producto.images.find(im => im.optionValueId === v.id)?.url
                      return (
                        <button
                          key={v.id}
                          className="ds-hover"
                          onClick={() => { setSeleccion(s => ({ ...s, [o.id]: v.id })); setHoverValorId(null) }}
                          onMouseEnter={() => setHoverValorId(v.id)}
                          onMouseLeave={() => setHoverValorId(null)}
                          title={v.value + (disponible ? '' : ' (sin stock en esta combinación)')}
                          style={{
                            width: 42, height: 42, borderRadius: '50%', padding: 0, overflow: 'hidden',
                            border: `2px solid ${(hoverValorId ?? seleccion[o.id]) === v.id ? 'var(--color-text)' : 'var(--color-border)'}`,
                            background: 'none', flexShrink: 0,
                            opacity: disponible ? 1 : 0.45,
                            transition: 'border-color 120ms ease',
                          }}
                        >
                          {fotoSwatch
                            ? <img src={fotoSwatch} alt={v.value} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            : <div style={{
                                width: '100%', height: '100%',
                                background: `repeating-linear-gradient(135deg, oklch(0.84 0.06 ${hueFromId(v.id)}) 0px 8px, oklch(0.80 0.06 ${hueFromId(v.id)}) 8px 16px)`,
                              }} />}
                        </button>
                      )
                    }
                    return (
                      <button
                        key={v.id}
                        className="ds-hover"
                        onClick={() => setSeleccion(s => ({ ...s, [o.id]: v.id }))}
                        title={disponible ? undefined : 'Sin stock en esta combinación'}
                        style={{
                          position: 'relative', minWidth: 48, height: 40, padding: '0 12px',
                          background: activo ? 'var(--color-text)' : 'var(--color-bg)',
                          color: !disponible ? 'var(--color-subtle)' : activo ? 'var(--color-bg)' : 'var(--color-text)',
                          border: `1px solid ${activo ? 'var(--color-text)' : 'var(--color-border)'}`,
                          borderRadius: 8, fontSize: 13, fontWeight: 600,
                          textDecoration: disponible ? 'none' : 'line-through',
                          opacity: disponible ? 1 : 0.55,
                          transition: 'border-color 120ms, background 120ms',
                        }}
                      >
                        {v.value}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Stock — orden de prioridad: sin stock > ya está todo en tu
                carrito > queda poco (con número, si showLowStock) > disponible. */}
            {!varianteSeleccionada && producto.options.length > 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-error)', fontWeight: 600, marginBottom: 20 }}>
                Esa combinación no está disponible
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: !enStock ? 'var(--color-error)' : todoEnCarrito ? 'var(--color-muted)' : bajoStock ? '#D97706' : 'var(--color-success)', fontWeight: 600, marginBottom: 20 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: !enStock ? 'var(--color-error)' : todoEnCarrito ? 'var(--color-muted)' : bajoStock ? '#D97706' : 'var(--color-success)', flexShrink: 0 }} />
                {!enStock
                  ? 'Sin stock'
                  : todoEnCarrito
                    ? `Ya tenés las ${varianteSeleccionada!.maxQty} unidades disponibles en tu carrito`
                    : bajoStock
                      ? `¡Quedan ${restante} unidades!`
                      : 'Stock disponible'}
              </div>
            )}

            {/* Vidriera digital: no hay carrito ni checkout — se saca el
                stepper y los botones de compra entera, WhatsApp queda como
                única forma de avanzar (botón de abajo). */}
            {!esVidriera && (
              <>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 8, height: 48, flexShrink: 0, overflow: 'hidden' }}>
                    <button className="ds-hover" onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 40, height: 48, background: 'none', border: 'none', color: 'var(--color-text)', display: 'grid', placeItems: 'center' }}><Minus size={14} /></button>
                    <span style={{ width: 36, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{qty}</span>
                    <button
                      className="ds-hover"
                      onClick={() => setQty(q => Math.min(q + 1, restante || 1))}
                      disabled={qty >= restante}
                      style={{ width: 40, height: 48, background: 'none', border: 'none', cursor: qty >= restante ? 'not-allowed' : 'pointer', color: qty >= restante ? 'var(--color-subtle)' : 'var(--color-text)', display: 'grid', placeItems: 'center' }}
                    ><Plus size={14} /></button>
                  </div>
                  <button
                    className="ds-hover"
                    disabled={!varianteSeleccionada || !enStock || restante === 0}
                    onClick={() => { agregarAlCarrito(); setAgregado(true); setTimeout(() => setAgregado(false), 1400) }}
                    style={{ flex: 1, height: 48, borderRadius: 8, background: agregado ? 'var(--color-success)' : 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: (!varianteSeleccionada || !enStock || restante === 0) ? 'not-allowed' : 'pointer', opacity: (!varianteSeleccionada || !enStock || restante === 0) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(59,130,246,0.25)', transition: 'background 150ms, filter 120ms' }}
                  >
                    {agregado ? <><Check size={16} strokeWidth={2} /> Agregado</> : <><ShoppingCart size={16} strokeWidth={1.5} /> Agregar al carrito</>}
                  </button>
                </div>

                <button
                  className="ds-hover"
                  disabled={!varianteSeleccionada || !enStock || restante === 0}
                  onClick={() => { agregarAlCarrito(); router.push(`${base}/checkout/datos`) }}
                  style={{ width: '100%', height: 48, borderRadius: 8, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600, cursor: (!varianteSeleccionada || !enStock || restante === 0) ? 'not-allowed' : 'pointer', opacity: (!varianteSeleccionada || !enStock || restante === 0) ? 0.5 : 1, marginBottom: 12, transition: 'background 120ms, border-color 120ms' }}
                >
                  Comprar ahora
                </button>
              </>
            )}

            {/* Consultar por WhatsApp — en tienda completa es una tercera
                opción (por si el cliente prefiere preguntar antes de
                comprar); en vidriera digital es la ÚNICA forma de avanzar,
                así que pasa a ser el botón principal. */}
            {tienda.wpp && (
              <button
                className="ds-hover"
                onClick={consultarPorWpp}
                style={{
                  width: '100%', height: 48, borderRadius: 8, marginBottom: 20,
                  fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 150ms, opacity 150ms',
                  ...(esVidriera
                    ? { background: '#25D366', color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(37,211,102,0.25)' }
                    : { background: 'transparent', color: '#25D366', border: '1px solid #25D366' }),
                }}
              >
                <MessageCircle size={16} strokeWidth={1.5} /> Consultar por WhatsApp
              </button>
            )}

            {/* Con ficha técnica, la columna izquierda ya tiene contenido de
                sobra debajo de la foto — acá es donde esta caja vive
                siempre (ver el comentario en la columna izquierda). */}
            {producto.specs.length > 0 && <CajaEnvios marginBottom={24} />}
          </div>
        </div>

        {/* ══ RESEÑAS ══ — se sacan enteras en vidriera digital, el backend
            las bloquea (FullModeOnly). */}
        {!esVidriera && (config?.appearance?.showReviews ?? true) && (
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
                className="ds-field"
                value={textoResenia}
                onChange={e => setTextoResenia(e.target.value)}
                placeholder="Contanos tu experiencia con este producto..."
                style={{ width: '100%', boxSizing: 'border-box', height: 88, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', fontSize: 13, resize: 'vertical', color: 'var(--color-text)', outline: 'none', fontFamily: 'inherit' }}
              />
              {errorResenia && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-error)' }}>{errorResenia}</div>
              )}
              <button
                className="ds-hover"
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
                      <a href={`${base}/login`} className="ds-link" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Iniciá sesión</a> y comprá este producto para poder dejar una reseña.
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
              {relacionados.map(p => <ProductCard key={p.id} producto={p} mode={esVidriera ? 'SHOWCASE' : 'FULL'} transferPct={config?.payment?.acceptsTransfer ? config?.payment?.transferDiscountPercent : null} />)}
            </div>
          </div>
        )}
      </div>
      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
    </StorefrontChrome>
  )
}
