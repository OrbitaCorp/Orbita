import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ComprobanteBase } from '@/components/shared/ComprobanteBase'
import { ProdImage } from '@/components/storefront/Thumb'
import { getStorefrontConfig, toTiendaConfig, type StorefrontConfigResponse } from '@/lib/storefront/api'
import { meGetOrder, ApiError, type MeOrderDetail } from '@/lib/api'

function hueDeItem(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

// Estado de pago inferido del estado del pedido: no hay ninguna columna que
// diga "el pago se acreditó" (documentado en Jira RBT-619 — el método de
// pago elegido tampoco tiene columna propia, hoy vive en `notes`). Mientras
// esté PENDING el negocio todavía no lo confirmó; de ahí en más, sí.
function estadoBadgeDe(status: string) {
  if (status === 'PENDING') return 'Pendiente de confirmación'
  if (status === 'CANCELLED') return 'Pedido cancelado'
  return 'Aprobado'
}

export default function Comprobante() {
  const router = useRouter()
  const { slug, id } = router.query as { slug: string; id: string }
  const base = `/tienda/${slug}`

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])
  const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  const [pedido, setPedido]         = useState<MeOrderDetail | null>(null)
  const [cargando, setCargando]     = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  useEffect(() => {
    if (!id) return
    let cancelado = false
    meGetOrder(id)
      .then(p => { if (!cancelado) setPedido(p) })
      .catch(err => { if (!cancelado) setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar el pedido') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [id])

  if (cargando) {
    return <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }} />
  }

  if (errorCarga || !pedido) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'grid', placeItems: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No pudimos mostrar este comprobante</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>{errorCarga || 'Pedido no encontrado.'}</div>
          <button onClick={() => router.push(base)} style={{ height: 44, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Volver a la tienda
          </button>
        </div>
      </div>
    )
  }

  const direccion = pedido.onlineOrderDetails?.shippingAddress
  const direccionTexto = direccion
    ? `${direccion.street}${direccion.floor ? `, Piso ${direccion.floor}` : ''}${direccion.depto ? ` ${direccion.depto}` : ''} — ${direccion.city}${direccion.provincia ? `, ${direccion.provincia}` : ''}`
    : undefined

  return (
    <ComprobanteBase
      numero={`#${pedido.orderNumber}`}
      fecha={new Date(pedido.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
      hora={new Date(pedido.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
      emisor={{ tipo: 'tienda', nombre: tienda.nombre, subtitulo: tienda.dominio, logoUrl: config?.appearance?.logoUrl }}
      headerGradient="linear-gradient(135deg, #1D4ED8, #2563EB)"
      estadoBadge={estadoBadgeDe(pedido.status)}
      metadatos={pedido.notes ? [['Notas', pedido.notes]] : []}
      compradorDatos={pedido.onlineOrderDetails ? {
        Nombre:   pedido.onlineOrderDetails.buyerName,
        ...(pedido.onlineOrderDetails.buyerEmail ? { Email: pedido.onlineOrderDetails.buyerEmail } : {}),
        ...(pedido.onlineOrderDetails.buyerPhone ? { Teléfono: pedido.onlineOrderDetails.buyerPhone } : {}),
        ...(direccionTexto ? { Dirección: direccionTexto } : {}),
      } : undefined}
      items={pedido.items.map(it => ({
        descripcion: it.productName,
        subtitulo:   it.variantLabel ?? undefined,
        qty:         it.quantity,
        subtotal:    it.unitPrice * it.quantity,
        thumb:       <ProdImage hue={hueDeItem(it.id)} imgUrl={it.imgUrl} height={44} radius={6} style={{ width: 44, flexShrink: 0 }} />,
      }))}
      totales={[
        { label: 'Subtotal', valor: pedido.subtotal, tipo: 'normal' },
        ...(pedido.discountTotal > 0 ? [{ label: 'Descuentos', valor: pedido.discountTotal, tipo: 'descuento' as const }] : []),
        { label: 'Total', valor: pedido.total, tipo: 'total' },
      ]}
      textoFooter={`Este documento acredita la compra realizada en ${tienda.nombre}.`}
      onBack={() => router.push(`${base}/pedido/${id}`)}
      backLabel="Volver al pedido"
    />
  )
}
