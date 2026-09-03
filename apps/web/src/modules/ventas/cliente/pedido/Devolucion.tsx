import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { RotateCcw, ChevronLeft, AlertTriangle, CheckCircle, MessageCircle } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { ProdImage } from '@/components/storefront/Thumb'
import { Skeleton, SkeletonText } from '@/design-system/components/Skeleton'
import { headerCentrado } from '@/modules/ventas/cliente/inicio/plantillaReal'
import { openWpp } from '@/lib/storefront/utils'
import { getStorefrontConfig, toTiendaConfig, type StorefrontConfigResponse } from '@/lib/storefront/api'
import { meGetOrder, meCreateReturn, ApiError, type MeOrderDetail } from '@/lib/api'

const MOTIVOS = ['Talle incorrecto', 'No era lo que esperaba', 'Producto defectuoso', 'Me arrepentí', 'Otro']

function hueDeItem(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

export default function InicioDevolucion() {
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

  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [motivos,       setMotivos]       = useState<Record<string, string>>({})
  const [notas,         setNotas]         = useState<Record<string, string>>({})
  const [enviando,      setEnviando]      = useState(false)
  const [errorEnvio,    setErrorEnvio]    = useState('')
  const [enviado,       setEnviado]       = useState(false)

  // Reembolso a Mercado Pago solo tiene sentido si el pedido se pagó de
  // verdad por esa vía — mismo criterio que ReturnsService.resolveRefundMethod.
  const pagadoConMp = (pedido?.payments ?? []).some(p => p.method === 'MERCADOPAGO' && p.status === 'APPROVED')
  const creditNoteDisponible = config?.payment?.returnsCreditNoteEnabled ?? true
  const mpRefundDisponible = (config?.payment?.returnsMpRefundEnabled ?? false) && pagadoConMp
  // Si el negocio solo tiene un método disponible, no hace falta preguntar —
  // se usa ese directo (el backend lo completaría solo igual, pero mostrar
  // el selector con una sola opción sería ruido).
  const [refundMethod, setRefundMethod] = useState<'CREDIT_NOTE' | 'REFUND' | null>(null)
  useEffect(() => {
    if (creditNoteDisponible && !mpRefundDisponible) setRefundMethod('CREDIT_NOTE')
    else if (!creditNoteDisponible && mpRefundDisponible) setRefundMethod('REFUND')
  }, [creditNoteDisponible, mpRefundDisponible])

  const toggleItem = (itemId: string) => {
    setSeleccionados(prev =>
      prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId]
    )
    setMotivos(prev => prev[itemId] ? prev : { ...prev, [itemId]: MOTIVOS[0] })
  }

  const setMotivo = (itemId: string, m: string) => setMotivos(prev => ({ ...prev, [itemId]: m }))
  const setNota   = (itemId: string, n: string) => setNotas(prev =>  ({ ...prev, [itemId]: n  }))

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} centrado={headerCentrado(config?.appearance?.homeTemplate)} />
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 32px 64px' }} aria-hidden="true">
          <SkeletonText width={220} height={12} style={{ marginBottom: 24 }} />
          <SkeletonText width={260} height={22} style={{ marginBottom: 8, borderRadius: 6 }} />
          <SkeletonText width={340} height={12} style={{ marginBottom: 28 }} />
          {[1, 2].map(i => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: 16, border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 12 }}>
              <Skeleton width={20} height={20} radius={5} delay={i * 70} style={{ flexShrink: 0, marginTop: 2 }} />
              <Skeleton width={64} height={64} radius={8} delay={i * 70 + 20} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SkeletonText width="50%" height={12} delay={i * 70 + 40} />
                <SkeletonText width="25%" height={10} delay={i * 70 + 60} />
              </div>
            </div>
          ))}
          <Skeleton width="100%" height={48} radius={10} delay={200} style={{ marginTop: 20 }} />
        </div>
      </div>
    )
  }

  if (errorCarga || !pedido) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'grid', placeItems: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No pudimos cargar este pedido</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>{errorCarga || 'Pedido no encontrado.'}</div>
          <button className="ds-hover" onClick={() => router.push(base)} style={{ height: 44, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Volver a la tienda
          </button>
        </div>
      </div>
    )
  }

  // Solo se puede devolver lo que ya se entregó — mismo criterio que
  // ReturnsService (DEVOLVIBLES). Antes de eso ni se muestra el formulario.
  if (pedido.status !== 'DELIVERED') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} centrado={headerCentrado(config?.appearance?.homeTemplate)} />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 32px 64px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>Todavía no podés pedir una devolución</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
            Solo se pueden devolver pedidos ya entregados — este está &quot;{pedido.status}&quot;.
          </div>
          <button className="ds-hover" onClick={() => router.push(`${base}/pedido/${id}`)} style={{ height: 44, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Volver al pedido
          </button>
        </div>
        <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      </div>
    )
  }

  // El negocio puede deshabilitar devoluciones por completo desde Configuración.
  if (config && config.payment?.returnsEnabled === false) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} centrado={headerCentrado(config?.appearance?.homeTemplate)} />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 32px 64px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>Esta tienda no acepta devoluciones</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
            Si tenés un problema con tu pedido, escribinos directo por WhatsApp.
          </div>
          <button className="ds-hover" onClick={() => router.push(`${base}/pedido/${id}`)} style={{ height: 44, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Volver al pedido
          </button>
        </div>
        <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      </div>
    )
  }

  if (enviado) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} centrado={headerCentrado(config?.appearance?.homeTemplate)} />
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '64px 32px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={28} strokeWidth={1.5} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>Solicitud enviada</h1>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: 16 }}>
            La tienda va a revisar tu solicitud. <strong style={{ color: 'var(--color-text)' }}>Falta coordinar cómo nos hacés llegar el producto</strong>, escribinos por WhatsApp para eso. {refundMethod === 'REFUND' ? 'El reembolso a Mercado Pago' : 'La nota de crédito'} se emite recién cuando confirmamos que lo recibimos.
          </p>
          {tienda.wpp && (
            <button
              className="ds-hover"
              onClick={() => openWpp(tienda.wpp, `Hola! Quería coordinar la devolución de mi pedido #${pedido.orderNumber}`)}
              style={{
                width: '100%', maxWidth: 320, margin: '0 auto 12px', height: 48, padding: '0 22px', borderRadius: 8,
                background: 'var(--color-success)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <MessageCircle size={16} strokeWidth={1.5} /> Coordinar por WhatsApp
            </button>
          )}
          <button className="ds-hover" onClick={() => router.push(`${base}/pedido/${id}`)} style={{ height: 48, padding: '0 22px', borderRadius: 8, background: tienda.wpp ? 'transparent' : 'var(--color-primary)', color: tienda.wpp ? 'var(--color-primary)' : '#fff', border: tienda.wpp ? '1px solid var(--color-border)' : 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Volver al pedido
          </button>
        </div>
        <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      </div>
    )
  }

  const enviar = async () => {
    if (creditNoteDisponible && mpRefundDisponible && !refundMethod) {
      setErrorEnvio('Elegí cómo preferís que te devolvamos el dinero')
      return
    }
    setEnviando(true)
    setErrorEnvio('')
    try {
      // Una devolución por cada renglón elegido — cada una queda pendiente
      // de revisión en el panel (ReturnsService.createForCustomer).
      for (const itemId of seleccionados) {
        const item = pedido.items.find(i => i.id === itemId)
        if (!item) continue
        const motivo = motivos[itemId] ?? MOTIVOS[0]
        const nota   = notas[itemId]
        await meCreateReturn(id, {
          orderItemId: itemId,
          quantity: item.quantity,
          reason: nota ? `${motivo}: ${nota}` : motivo,
          refundMethod: refundMethod ?? undefined,
        })
      }
      setEnviado(true)
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 768px) {
          .sf-dev-wrap     { padding: 20px 16px 48px !important; }
          .sf-dev-funciona { grid-template-columns: minmax(0,1fr) !important; }
          .sf-dev-motivos  { margin-left: 0 !important; }
        }
      `}</style>
      <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} centrado={headerCentrado(config?.appearance?.homeTemplate)} />

      <div className="sf-dev-wrap" style={{ maxWidth: 760, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Breadcrumb items={[
          { label: 'Inicio', href: base },
          { label: 'Mi cuenta', href: `${base}/perfil` },
          { label: `Pedido #${pedido.orderNumber}`, href: `${base}/pedido/${id}` },
          { label: 'Devolución' },
        ]} />

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', color: '#B45309', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <RotateCcw size={22} strokeWidth={1.5} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Solicitar devolución</h1>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>
              Tenés hasta 30 días desde la entrega para iniciar una devolución.
            </p>
          </div>
        </div>

        {/* Selección de productos */}
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '4px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 8px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)' }}>
              Seleccioná los productos a devolver
            </div>
            {seleccionados.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-bg)', padding: '2px 10px', borderRadius: 999 }}>
                {seleccionados.length} seleccionado{seleccionados.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {pedido.items.map(it => {
            const active = seleccionados.includes(it.id)
            return (
              <div key={it.id} style={{ marginBottom: 6 }}>
                <label className="ds-hover" style={{
                  display: 'grid', gridTemplateColumns: '24px 64px 1fr',
                  gap: 14, alignItems: 'center',
                  padding: '14px 12px', margin: '0 -12px', borderRadius: 8,
                  background: active ? 'var(--color-primary-bg)' : 'transparent',
                  border: `1px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
                  cursor: 'pointer', transition: 'all 150ms',
                }}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleItem(it.id)}
                    style={{ accentColor: 'var(--color-primary)', width: 18, height: 18 }}
                  />
                  <ProdImage hue={hueDeItem(it.id)} imgUrl={it.imgUrl} height={64} radius={8} style={{ width: 64, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{it.productName}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{it.variantLabel ? `${it.variantLabel} · ` : ''}x{it.quantity}</div>
                  </div>
                </label>

                {active && (
                  <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16, margin: '6px 0 10px', marginLeft: 38 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>Motivo</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {MOTIVOS.map(m => (
                        <button key={m} className="ds-hover" onClick={() => setMotivo(it.id, m)} style={{
                          height: 32, padding: '0 12px', borderRadius: 999,
                          background: (motivos[it.id] ?? MOTIVOS[0]) === m ? 'var(--color-text)' : 'var(--color-bg)',
                          color: (motivos[it.id] ?? MOTIVOS[0]) === m ? 'var(--color-bg)' : 'var(--color-body)',
                          border: `1px solid ${(motivos[it.id] ?? MOTIVOS[0]) === m ? 'var(--color-text)' : 'var(--color-border)'}`,
                          fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        }}>{m}</button>
                      ))}
                    </div>
                    <textarea
                      className="ds-field"
                      value={notas[it.id] ?? ''}
                      onChange={e => setNota(it.id, e.target.value)}
                      placeholder="Contanos más detalles..."
                      style={{ width: '100%', minHeight: 68, padding: 10, borderRadius: 8, boxSizing: 'border-box', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
                    />
                    <div style={{ marginTop: 10, padding: 12, background: 'var(--color-warning-bg)', border: '1px solid rgba(245,158,11,0.30)', borderRadius: 8, fontSize: 12, color: 'var(--color-body)', lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <AlertTriangle size={14} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span><strong style={{ color: 'var(--color-text)' }}>Importante:</strong> el producto debe estar sin uso, con etiquetas originales y en su packaging.</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Cómo funciona — el paso 2 (mandar el producto de vuelta) es a
            propósito el más explícito de los cuatro: sin esto, el cliente
            asumía que con enviar el formulario ya estaba todo hecho, sin
            enterarse de que la tienda necesita el producto físico de vuelta
            antes de emitir la nota. */}
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 14 }}>¿Cómo funciona?</div>
          <div className="sf-dev-funciona" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              'Enviás la solicitud desde acá.',
              'Coordinás por WhatsApp cómo hacernos llegar el producto.',
              'Confirmamos que lo recibimos.',
              'Se emite tu nota de crédito.',
            ].map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.5, paddingTop: 3 }}>{p}</div>
              </div>
            ))}
          </div>
        </div>

        {creditNoteDisponible && mpRefundDisponible ? (
          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>
              ¿Cómo preferís que te devolvamos el dinero?
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([['CREDIT_NOTE', 'Nota de crédito'], ['REFUND', 'Reembolso a Mercado Pago']] as const).map(([m, label]) => {
                const active = refundMethod === m
                return (
                  <button
                    key={m} type="button"
                    onClick={() => setRefundMethod(m)}
                    style={{
                      height: 38, padding: '0 16px', borderRadius: 999,
                      border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: active ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                      color: active ? 'var(--color-primary)' : 'var(--color-body)',
                      fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'var(--color-surface)', fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            {mpRefundDisponible
              ? <>El reembolso se emite <strong style={{ color: 'var(--color-text)' }}>a Mercado Pago</strong>, al medio de pago con el que compraste.</>
              : <>El reembolso se emite como <strong style={{ color: 'var(--color-text)' }}>nota de crédito</strong>, para usar en tu próxima compra en esta tienda.</>}
          </div>
        )}

        {errorEnvio && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 13 }}>
            {errorEnvio}
          </div>
        )}

        <button
          className="ds-hover"
          onClick={enviar}
          disabled={seleccionados.length === 0 || enviando}
          style={{
            width: '100%', height: 52, borderRadius: 10,
            background: seleccionados.length === 0 || enviando ? 'var(--color-border)' : 'var(--color-primary)',
            color: seleccionados.length === 0 || enviando ? 'var(--color-muted)' : '#fff',
            fontSize: 15, fontWeight: 700, border: 'none',
            cursor: seleccionados.length === 0 || enviando ? 'not-allowed' : 'pointer',
            transition: 'all 200ms',
          }}
        >
          {enviando
            ? 'Enviando...'
            : seleccionados.length === 0
              ? 'Seleccioná al menos un producto'
              : `Enviar solicitud${seleccionados.length > 1 ? ` (${seleccionados.length} productos)` : ''}`}
        </button>

        <button className="ds-link" onClick={() => router.push(`${base}/pedido/${id}`)} style={{
          marginTop: 16, fontSize: 13, color: 'var(--color-primary)', fontWeight: 500,
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <ChevronLeft size={14} /> Volver al seguimiento
        </button>
      </div>

      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
    </div>
  )
}
