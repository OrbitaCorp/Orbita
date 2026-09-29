// Pago "con Mercado Pago" de la tienda demo: en una tienda real acá el
// comprador sale a Mercado Pago. En la demo nunca se cobra nada — esta
// pantalla aprueba el pago en el navegador y vuelve a la confirmación igual
// que la vuelta de MP (ver lib/demo/recursos/checkout.ts).
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { fmt } from '@/lib/storefront/utils'
import { aplicarARegistro, editar } from '@/lib/demo/almacen'
import { PEDIDOS_TIENDA, baseTiendaDemo, type PedidoTiendaDemo } from '@/lib/demo/recursos/checkout'

export default function PagoSimulado() {
  const router = useRouter()
  const pedidoId = typeof router.query.pedido === 'string' ? router.query.pedido : null
  const [pedido, setPedido] = useState<PedidoTiendaDemo | null | undefined>(undefined)
  const [pagando, setPagando] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    setPedido(pedidoId ? aplicarARegistro<PedidoTiendaDemo>(PEDIDOS_TIENDA, pedidoId, null) : null)
  }, [router.isReady, pedidoId])

  function volver(pagado: boolean) {
    if (!pedido) return
    const base = `${baseTiendaDemo()}/checkout/confirmacion?pedido=${encodeURIComponent(pedido.id)}&metodo=MERCADOPAGO`
    window.location.href = pagado ? `${base}&payment_id=demo` : base
  }

  function aprobar() {
    if (!pedido || pagando) return
    setPagando(true)
    const ahora = new Date().toISOString()
    editar<PedidoTiendaDemo>(PEDIDOS_TIENDA, pedido.id, {
      status: 'CONFIRMED',
      payments: [{ method: 'MERCADOPAGO', status: 'APPROVED' }],
      statusHistory: [...pedido.statusHistory, { status: 'CONFIRMED', createdAt: ahora }],
    })
    // Un respiro, como el de una pasarela real: sin esto el salto se siente roto.
    setTimeout(() => volver(true), 700)
  }

  const boton: React.CSSProperties = {
    height: 46, width: '100%', borderRadius: 10, fontSize: 15, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'grid', placeItems: 'center', padding: '32px 16px' }}>
      <main style={{ width: '100%', maxWidth: 420 }}>
        <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 8px' }}>Pago simulado · Demo de Órbita</p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 12px', lineHeight: 1.3 }}>
          Acá tu cliente pagaría con Mercado Pago
        </h1>
        <p style={{ fontSize: 15, color: 'var(--color-muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
          En una tienda real se abre Mercado Pago y el pedido se confirma solo cuando el pago se aprueba. En la demo no se cobra nada: elegí cómo sigue.
        </p>

        {pedido === undefined ? null : !pedido ? (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, fontSize: 15, color: 'var(--color-text)' }}>
            No encontramos este pedido en este navegador.
            <button className="ds-hover" onClick={() => { window.location.href = baseTiendaDemo() || '/' }} style={{ ...boton, marginTop: 16, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
              Volver a la tienda
            </button>
          </div>
        ) : (
          <>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--color-muted)', marginBottom: 6 }}>
                <span>Pedido #{pedido.orderNumber}</span>
                <span>{pedido.items.reduce((a, i) => a + i.quantity, 0)} producto(s)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 15, color: 'var(--color-text)' }}>Total a pagar</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>{fmt(pedido.total)}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <button className="ds-hover" onClick={aprobar} disabled={pagando} aria-busy={pagando}
                style={{ ...boton, background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: pagando ? 0.7 : 1, cursor: pagando ? 'default' : 'pointer' }}>
                {pagando ? 'Aprobando pago…' : 'Aprobar el pago'}
              </button>
              <button className="ds-hover" onClick={() => volver(false)} disabled={pagando}
                style={{ ...boton, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                Volver sin pagar
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
