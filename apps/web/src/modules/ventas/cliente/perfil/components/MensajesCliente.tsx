// Chat del cliente con la tienda — hilo único, no por pedido.
// El cliente puede mencionar (#<número de pedido>) cualquier pedido de su
// historial dentro de la misma conversación.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { MessageCircle, Package, Send } from 'lucide-react'
import { fmt } from '@/lib/storefront/utils'
import {
  meGetConversation, meSendConversationMessage, meListOrders,
  type ChatMessage, type MeOrderRow,
} from '@/lib/api'
import { getStorefrontConfig, toTiendaConfig } from '@/lib/storefront/api'
import { Skeleton } from '@/design-system/components/Skeleton'

const MONO = '"Geist Mono", "Fira Code", monospace'

// Mismo criterio de color que Perfil.tsx (ESTADO_PEDIDO/ESTADO_STYLE) — acá
// solo hace falta el color del chip, no la traducción de estado completa.
const ESTADO_COLOR: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: '#FEF9C3', color: '#CA8A04' },
  CONFIRMED: { bg: 'var(--color-surface)', color: 'var(--color-muted)' },
  PREPARING: { bg: '#FEF9C3', color: '#CA8A04' },
  SHIPPED:   { bg: 'var(--color-surface)', color: 'var(--color-muted)' },
  DELIVERED: { bg: '#DCFCE7', color: '#16A34A' },
  COMPLETED: { bg: '#DCFCE7', color: '#16A34A' },
  CANCELLED: { bg: '#FEE2E2', color: '#DC2626' },
}

// Cada 2-3s mientras el chat está montado (el cliente lo tiene abierto) —
// nunca en segundo plano, deja de sondear apenas se desmonta.
const POLL_MS = 2500

/** Renderiza texto con chips clickeables para menciones #<orderNumber> */
function Burbuja({ txt, me, pedidos, onGoPedido }: { txt: string; me: boolean; pedidos: MeOrderRow[]; onGoPedido: (id: string) => void }) {
  const partes = txt.split(/(#\d+)/g)
  return (
    <>
      {partes.map((p, i) => {
        const m = /^#(\d+)$/.exec(p)
        if (!m) return <span key={i}>{p}</span>
        const numero = Number(m[1])
        const pedido = pedidos.find(h => h.orderNumber === numero)
        return (
          <span
            key={i}
            className={pedido ? 'ds-hover' : undefined}
            onClick={pedido ? () => onGoPedido(pedido.id) : undefined}
            title={pedido ? 'Ver pedido' : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 7px', borderRadius: 9999,
              background: me ? 'rgba(255,255,255,.22)' : 'var(--color-primary-bg)',
              color: me ? '#fff' : 'var(--color-primary)',
              fontSize: 12, fontWeight: 700, fontFamily: MONO,
              cursor: pedido ? 'pointer' : 'default', verticalAlign: 'middle',
              border: me ? '1px solid rgba(255,255,255,.3)' : '1px solid var(--color-primary)',
            }}
          >
            <Package size={9} />#{numero}
          </span>
        )
      })}
    </>
  )
}

function PedidoMencionPopover({ query, pedidos, onSelect, onClose }: { query: string; pedidos: MeOrderRow[]; onSelect: (numero: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  const filtrados = pedidos.filter(p => query === '' || String(p.orderNumber).includes(query))

  return (
    <div ref={ref} style={{
      position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, width: 340, zIndex: 20,
      background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10,
      boxShadow: '0 6px 24px rgba(0,0,0,.14)', overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--color-border)', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Mencionar un pedido
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {filtrados.length === 0 ? (
          <div style={{ padding: '18px 14px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>No se encontraron pedidos</div>
        ) : filtrados.map(p => {
          const st = ESTADO_COLOR[p.status] ?? ESTADO_COLOR.CONFIRMED
          return (
            <button
              key={p.id}
              className="ds-hover"
              onClick={() => { onSelect(p.orderNumber); onClose() }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--color-border)', background: 'transparent', fontFamily: 'inherit', textAlign: 'left' }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--color-surface)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Package size={14} color="var(--color-muted)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: MONO }}>#{p.orderNumber}</div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>{new Date(p.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</div>
              </div>
              <span style={{ flexShrink: 0, height: 20, padding: '0 8px', borderRadius: 999, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>{p.status}</span>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text)', fontFamily: MONO, minWidth: 64, textAlign: 'right' }}>{fmt(p.total)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function MensajesCliente() {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`

  const [nombreTienda, setNombreTienda] = useState('')
  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setNombreTienda(toTiendaConfig(cfg).nombre) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])

  const [pedidos, setPedidos] = useState<MeOrderRow[]>([])
  useEffect(() => {
    meListOrders().then(r => setPedidos(r.data)).catch(() => {})
  }, [])

  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [cargando, setCargando] = useState(true)
  const [draft, setDraft] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [hashTrigger, setHashTrigger] = useState<{ idx: number; query: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Carga inicial + polling cada ~2.5s SOLO mientras este componente está
  // montado (el cliente tiene la pestaña "Mensajes" abierta) — se corta solo
  // al desmontar, nunca sigue sondeando en segundo plano.
  useEffect(() => {
    let cancelado = false
    const cargar = () => meGetConversation().then(c => { if (!cancelado) setMsgs(c.messages) }).catch(() => {}).finally(() => { if (!cancelado) setCargando(false) })
    cargar()
    const interval = setInterval(cargar, POLL_MS)
    // El navegador "throttlea" los timers en pestañas que no están en foco
    // (Chrome los baja a ~1 vez por minuto) — sin esto, volver a esta pestaña
    // después de un rato en otra (ej. viendo el panel) mostraba la conversación
    // vieja hasta el próximo tick real del interval, en la práctica como si
    // hiciera falta recargar para "ver los mensajes en vivo". Al recuperar el
    // foco, se fuerza una carga inmediata en vez de esperar al interval.
    const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      cancelado = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [msgs])

  const irAPedido = (id: string) => router.push(`${base}/pedido/${id}`)

  const enviar = async () => {
    const m = draft.trim()
    if (!m || enviando) return
    setEnviando(true)
    setDraft('')
    setHashTrigger(null)
    try {
      const nuevo = await meSendConversationMessage(m)
      setMsgs(prev => [...prev, nuevo])
    } catch {
      setDraft(m) // no se perdió lo que escribió — se restaura para reintentar
    } finally {
      setEnviando(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDraft(val)
    const m = val.match(/#(\d*)$/)
    setHashTrigger(m ? { idx: val.length - m[0].length, query: m[1] } : null)
  }

  const handleSelectPedido = (numero: number) => {
    if (hashTrigger === null) return
    const before = draft.slice(0, hashTrigger.idx)
    const after = draft.slice(hashTrigger.idx + 1 + hashTrigger.query.length)
    setDraft(`${before}#${numero} ${after}`)
    setHashTrigger(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div className="sf-msg-cliente" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 600 }}>
      <style>{`
        @media (max-width: 768px) {
          .sf-msg-cliente { height: calc(100vh - 260px) !important; min-height: 420px; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <MessageCircle size={18} color="#fff" strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{nombreTienda || 'la tienda'}</div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>Consultá sobre cualquiera de tus pedidos en este mismo chat</div>
        </div>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--color-surface)', minHeight: 0 }}>
        {cargando && (
          <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { w: 180, me: false }, { w: 130, me: true }, { w: 210, me: false }, { w: 100, me: true },
            ].map((b, i) => (
              <Skeleton key={i} width={b.w} height={36} radius={12} delay={i * 70} style={{ alignSelf: b.me ? 'flex-end' : 'flex-start' }} />
            ))}
          </div>
        )}
        {!cargando && msgs.map(m => {
          const me = m.sender === 'CUSTOMER'
          const hora = new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={m.id} style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '76%' }}>
              <div style={{
                padding: '10px 13px', borderRadius: 12,
                background: me ? 'var(--color-primary)' : 'var(--color-bg)',
                border: me ? 'none' : '1px solid var(--color-border)',
                color: me ? '#fff' : 'var(--color-text)',
                fontSize: 13.5, lineHeight: 1.6,
                borderBottomRightRadius: me ? 4 : 12,
                borderBottomLeftRadius: me ? 12 : 4,
              }}>
                <Burbuja txt={m.text} me={me} pedidos={pedidos} onGoPedido={irAPedido} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', fontFamily: MONO, marginTop: 3, textAlign: me ? 'right' : 'left' }}>{hora}</div>
            </div>
          )
        })}
        {!cargando && msgs.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
            Escribile a {nombreTienda || 'la tienda'} por cualquier consulta
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{ position: 'relative', padding: '10px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {hashTrigger !== null && (
          <PedidoMencionPopover query={hashTrigger.query} pedidos={pedidos} onSelect={handleSelectPedido} onClose={() => setHashTrigger(null)} />
        )}
        <input
          ref={inputRef}
          className="ds-field"
          value={draft}
          onChange={handleChange}
          onKeyDown={e => {
            if (e.key === 'Escape') setHashTrigger(null)
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
          }}
          placeholder="Escribí un mensaje… (usá # para mencionar un pedido)"
          style={{ flex: 1, height: 42, padding: '0 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13.5, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none' }}
        />
        <button
          className="ds-hover"
          onClick={enviar}
          disabled={!draft.trim() || enviando}
          title="Enviar"
          style={{
            width: 42, height: 42, borderRadius: 10, border: 'none', flexShrink: 0,
            background: draft.trim() ? 'var(--color-primary)' : 'var(--color-surface)',
            color: draft.trim() ? '#fff' : 'var(--color-subtle)',
            cursor: draft.trim() ? 'pointer' : 'default',
            display: 'grid', placeItems: 'center', transition: 'background 150ms ease',
          }}
        >
          <Send size={17} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}
