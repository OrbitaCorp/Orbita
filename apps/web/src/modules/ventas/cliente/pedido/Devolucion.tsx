import { useState } from 'react'
import { useRouter } from 'next/router'
import { RotateCcw, ChevronLeft, AlertTriangle, MessageCircle } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { Thumb } from '@/components/storefront/Thumb'
import { TIENDA, CARRITO_INICIAL, PEDIDO_MOCK } from '@/lib/storefront/mock'
import { openWpp } from '@/lib/storefront/utils'

const MOTIVOS = ['Talle incorrecto', 'No era lo que esperaba', 'Producto defectuoso', 'Me arrepentí', 'Otro']

export default function InicioDevolucion() {
  const router = useRouter()
  const { slug, id } = router.query as { slug: string; id: string }
  const base = `/tienda/${slug}`


  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [motivos,       setMotivos]       = useState<Record<string, string>>({})
  const [notas,         setNotas]         = useState<Record<string, string>>({})
  const [reembolso,     setReembolso]     = useState<'credito' | 'cuenta'>('credito')

  const toggleItem = (itemId: string) => {
    setSeleccionados(prev =>
      prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId]
    )
    setMotivos(prev => prev[itemId] ? prev : { ...prev, [itemId]: MOTIVOS[0] })
  }

  const setMotivo = (itemId: string, m: string) => setMotivos(prev => ({ ...prev, [itemId]: m }))
  const setNota   = (itemId: string, n: string) => setNotas(prev =>  ({ ...prev, [itemId]: n  }))

  const itemsSeleccionados = CARRITO_INICIAL.filter(i => seleccionados.includes(i.id))

  const msg = itemsSeleccionados.length === 0
    ? `Hola! Quiero solicitar una devolución del pedido #${PEDIDO_MOCK.id}.`
    : `Hola! Quiero solicitar la devolución del pedido #${PEDIDO_MOCK.id}.\n\n` +
      itemsSeleccionados.map(it =>
        `• ${it.nombre} (${it.variante}): ${motivos[it.id] ?? MOTIVOS[0]}${notas[it.id] ? ` — ${notas[it.id]}` : ''}`
      ).join('\n') +
      `\n\nMétodo: ${reembolso === 'credito' ? 'Nota de crédito' : 'Reembolso a cuenta original'}.`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 768px) {
          .sf-dev-wrap     { padding: 20px 16px 48px !important; }
          .sf-dev-funciona { grid-template-columns: 1fr !important; }
          .sf-dev-motivos  { margin-left: 0 !important; }
        }
      `}</style>
      <StorefrontHeader tienda={TIENDA} carrito={CARRITO_INICIAL} />

      <div className="sf-dev-wrap" style={{ maxWidth: 760, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Breadcrumb items={[
          { label: 'Inicio', href: base },
          { label: 'Mi cuenta' },
          { label: `Pedido #${PEDIDO_MOCK.id}`, href: `${base}/pedido/${id}` },
          { label: 'Devolución' },
        ]} />

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', color: '#B45309', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <RotateCcw size={22} strokeWidth={1.5} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Solicitar devolución</h1>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>
              Tenés hasta 30 días desde la compra para iniciar una devolución.
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
          {CARRITO_INICIAL.map(it => {
            const active = seleccionados.includes(it.id)
            return (
              <div key={it.id} style={{ marginBottom: 6 }}>
                <label style={{
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
                  <Thumb hue={it.hue} size={64} radius={8} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{it.nombre}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{it.variante} · x{it.qty}</div>
                  </div>
                </label>

                {active && (
                  <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16, margin: '6px 0 10px', marginLeft: 38 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>Motivo</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {MOTIVOS.map(m => (
                        <button key={m} onClick={() => setMotivo(it.id, m)} style={{
                          height: 32, padding: '0 12px', borderRadius: 999,
                          background: (motivos[it.id] ?? MOTIVOS[0]) === m ? 'var(--color-text)' : 'var(--color-bg)',
                          color: (motivos[it.id] ?? MOTIVOS[0]) === m ? 'var(--color-bg)' : 'var(--color-body)',
                          border: `1px solid ${(motivos[it.id] ?? MOTIVOS[0]) === m ? 'var(--color-text)' : 'var(--color-border)'}`,
                          fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        }}>{m}</button>
                      ))}
                    </div>
                    <textarea
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

        {/* Método de reembolso */}
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Método de reembolso</div>
          {[
            { id: 'credito' as const, titulo: 'Nota de crédito',                desc: 'Para usar en tu próxima compra',  badge: 'Más rápido' },
            { id: 'cuenta' as const,  titulo: 'Reembolso a la cuenta original', desc: '5–10 días hábiles' },
          ].map(opt => {
            const active = reembolso === opt.id
            return (
              <label key={opt.id} style={{
                display: 'flex', gap: 12, alignItems: 'center',
                padding: 12, marginBottom: 8, borderRadius: 8, cursor: 'pointer',
                background: active ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}>
                <input type="radio" name="reembolso" checked={active} onChange={() => setReembolso(opt.id)} style={{ accentColor: 'var(--color-primary)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{opt.titulo}</span>
                    {opt.badge && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '2px 8px', borderRadius: 999 }}>{opt.badge}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{opt.desc}</div>
                </div>
              </label>
            )
          })}
        </div>

        {/* Cómo funciona */}
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 14 }}>¿Cómo funciona?</div>
          <div className="sf-dev-funciona" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {['Enviá la solicitud por WhatsApp.', 'Coordinamos el retiro del producto.', 'Procesamos el reembolso elegido.'].map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.5, paddingTop: 3 }}>{p}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => openWpp(TIENDA.wpp, msg)}
          disabled={seleccionados.length === 0}
          style={{
            width: '100%', height: 52, borderRadius: 10,
            background: seleccionados.length === 0 ? 'var(--color-border)' : '#25D366',
            color: seleccionados.length === 0 ? 'var(--color-muted)' : '#fff',
            fontSize: 15, fontWeight: 700, border: 'none',
            cursor: seleccionados.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: seleccionados.length === 0 ? 'none' : '0 4px 16px rgba(37,211,102,0.30)',
            transition: 'all 200ms',
          }}
        >
          <MessageCircle size={18} strokeWidth={1.5} />
          {seleccionados.length === 0
            ? 'Seleccioná al menos un producto'
            : `Enviar solicitud${seleccionados.length > 1 ? ` (${seleccionados.length} productos)` : ''} por WhatsApp`}
        </button>

        <button onClick={() => router.push(`${base}/pedido/${id}`)} style={{
          marginTop: 16, fontSize: 13, color: 'var(--color-primary)', fontWeight: 500,
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <ChevronLeft size={14} /> Volver al seguimiento
        </button>
      </div>

      <StorefrontFooter tienda={TIENDA} slug={slug} />
    </div>
  )
}
