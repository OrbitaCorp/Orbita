// Notificación "Fulano compró tal producto" (paquete Avanzado → Prueba
// social). Vive en StorefrontFooter.tsx (mismo mount point global que
// ReturnRequestModal) para aparecer en cualquier página, no solo el home.
//
// A propósito NO tiene contenido inventado: `events` sale siempre de
// SocialProofService#getRecentEvents en el backend (pedidos reales de los
// últimos 7 días) — si la tienda no vendió nada recientemente, este
// componente no renderiza nada. Sin login, sin estado en Prisma del lado
// del visitante: solo lee y va rotando.

import { useEffect, useState } from 'react'
import { ShoppingBag, X } from 'lucide-react'
import { getSocialProofFeed, type StorefrontSocialProofEvent } from '@/lib/storefront/api'

type Props = { slug: string }

const MOSTRAR_MS = 6000 // cuánto queda cada notificación en pantalla
const PAUSA_MS = 4000   // aire entre una y la siguiente

function relativo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const hs = Math.floor(min / 60)
  if (hs < 24) return `hace ${hs} ${hs === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(hs / 24)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export function SocialProofToast({ slug }: Props) {
  const [events, setEvents] = useState<StorefrontSocialProofEvent[] | null>(null)
  const [position, setPosition] = useState<'BOTTOM_LEFT' | 'BOTTOM_RIGHT'>('BOTTOM_LEFT')
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [descartado, setDescartado] = useState(false)

  useEffect(() => {
    let cancelado = false
    getSocialProofFeed(slug)
      .then(feed => {
        if (cancelado || !feed || feed.events.length === 0) return
        setPosition(feed.position)
        setEvents(feed.events)
      })
      .catch(() => {}) // si falla, simplemente no se muestra nada — no es contenido crítico
    return () => { cancelado = true }
  }, [slug])

  // Ciclo mostrar/ocultar/avanzar — encadenado con setTimeout (no
  // setInterval) para poder controlar las dos fases (visible/pausa) con
  // tiempos distintos sin que se pisen entre renders.
  useEffect(() => {
    if (!events || events.length === 0 || descartado) return
    const aparecer = setTimeout(() => setVisible(true), 400)
    const desaparecer = setTimeout(() => setVisible(false), 400 + MOSTRAR_MS)
    const avanzar = setTimeout(() => setIndex(i => (i + 1) % events.length), 400 + MOSTRAR_MS + PAUSA_MS)
    return () => { clearTimeout(aparecer); clearTimeout(desaparecer); clearTimeout(avanzar) }
  }, [events, index, descartado])

  if (!events || events.length === 0 || descartado) return null
  const evento = events[index]
  const esIzquierda = position === 'BOTTOM_LEFT'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: esIzquierda ? 24 : 96, // a la derecha deja lugar al botón flotante de WhatsApp
        left: esIzquierda ? 24 : undefined,
        right: esIzquierda ? undefined : 24,
        zIndex: 55,
        maxWidth: 320,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 260ms ease, transform 260ms ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px', borderRadius: 12,
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        boxShadow: '0 10px 30px rgba(15,23,42,0.14)',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: 'var(--color-success-bg)', color: 'var(--color-success)',
          display: 'grid', placeItems: 'center',
        }}>
          <ShoppingBag size={16} strokeWidth={1.8} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, color: 'var(--color-text)', lineHeight: 1.4 }}>
            <strong>{evento.firstName}{evento.lastInitial ? ` ${evento.lastInitial}.` : ''}</strong> compró{' '}
            <span style={{ color: 'var(--color-muted)' }}>{evento.productName}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 3 }}>{relativo(evento.occurredAt)}</div>
        </div>
        <button
          onClick={() => setDescartado(true)}
          aria-label="Cerrar notificación"
          style={{
            width: 20, height: 20, borderRadius: 6, border: 'none', background: 'transparent',
            color: 'var(--color-subtle)', display: 'grid', placeItems: 'center', flexShrink: 0, cursor: 'pointer',
          }}
        >
          <X size={12} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
