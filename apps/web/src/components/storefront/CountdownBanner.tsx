// Sección "Oferta termina en..." (paquete Avanzado → Countdown). Vive en el
// home (Inicio.tsx), después del hero — mismo criterio de ubicación que
// PromoModal/Juegos: cosas de Avanzado, en el home.
//
// A propósito NO tiene contenido para redactar: `getActiveCountdown` ya
// resuelve el descuento más urgente con "link compartible" activado en
// Descuentos (ver CountdownService en el backend) — acá solo se arma el
// reloj y el link a /oferta/:id que esa misma pantalla ya sabe mostrar.

import { useEffect, useState } from 'react'
import { Timer, ArrowRight } from 'lucide-react'
import { getActiveCountdown, type StorefrontActiveCountdown } from '@/lib/storefront/api'

type Props = { slug: string }

function etiquetaDescuento(d: StorefrontActiveCountdown): string {
  const esPorcentaje = d.type.startsWith('PERCENT')
  return esPorcentaje ? `${d.value}% OFF` : `$ ${d.value.toLocaleString('es-AR')} OFF`
}

function restante(endDate: string): { dias: number; horas: number; min: number; seg: number; vencido: boolean } {
  const ms = new Date(endDate).getTime() - Date.now()
  if (ms <= 0) return { dias: 0, horas: 0, min: 0, seg: 0, vencido: true }
  const seg = Math.floor(ms / 1000)
  return {
    dias: Math.floor(seg / 86400),
    horas: Math.floor((seg % 86400) / 3600),
    min: Math.floor((seg % 3600) / 60),
    seg: seg % 60,
    vencido: false,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function CountdownBanner({ slug }: Props) {
  const [oferta, setOferta] = useState<StorefrontActiveCountdown | null>(null)
  const [tick, setTick] = useState(0) // fuerza recálculo de `restante()` cada segundo

  useEffect(() => {
    let cancelado = false
    getActiveCountdown(slug).then(o => { if (!cancelado) setOferta(o) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])

  useEffect(() => {
    if (!oferta) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [oferta])

  if (!oferta) return null
  const t = restante(oferta.endDate)
  if (t.vencido) return null

  return (
    <div className="sf-w" style={{ marginTop: 20 }} data-tick={tick}>
      <a
        href={`/tienda/${slug}/oferta/${oferta.id}`}
        className="ds-hover"
        style={{
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          padding: '16px 22px', borderRadius: 14,
          background: 'linear-gradient(90deg, var(--color-primary-h), var(--color-primary))',
          color: '#fff', textDecoration: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Timer size={18} strokeWidth={1.8} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
              {etiquetaDescuento(oferta)} · {oferta.name}
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 1 }}>La oferta termina pronto</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: '"Geist Mono", monospace' }}>
          {t.dias > 0 && <Digito valor={t.dias} label="d" />}
          <Digito valor={t.horas} label="h" />
          <span style={{ opacity: 0.6 }}>:</span>
          <Digito valor={t.min} label="m" />
          <span style={{ opacity: 0.6 }}>:</span>
          <Digito valor={t.seg} label="s" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>
          Ver oferta <ArrowRight size={13} strokeWidth={2.4} />
        </div>
      </a>
    </div>
  )
}

function Digito({ valor, label }: { valor: number; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}>
      <span style={{ fontSize: 16, fontWeight: 700 }}>{pad(valor)}</span>
      <span style={{ fontSize: 10, opacity: 0.75 }}>{label}</span>
    </span>
  )
}
