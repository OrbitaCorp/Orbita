import { useEffect } from 'react'
import { ArrowLeft, Check, Printer } from 'lucide-react'

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export type ComprobanteItem = {
  descripcion: string
  subtitulo?: string
  qty: number
  subtotal: number
  thumb?: React.ReactNode
}

export type ComprobanteTotal = {
  label: string
  valor: number
  tipo: 'normal' | 'descuento' | 'total'
}

export type ComprobanteEmisor =
  | { tipo: 'orbita' }
  | { tipo: 'tienda'; nombre: string; subtitulo: string }

export interface ComprobanteBaseProps {
  numero: string
  fecha: string
  hora?: string
  emisor: ComprobanteEmisor
  headerGradient?: string
  estadoBadge?: string
  metadatos?: [string, string][]
  compradorDatos?: Record<string, string>
  items: ComprobanteItem[]
  totales: ComprobanteTotal[]
  textoFooter?: string
  onBack?: () => void
  backLabel?: string
  autoPrint?: boolean
  // 'page' (por defecto): la página completa que ve el cliente en la tienda,
  // con su propia barra de acciones (Volver + Imprimir) pegada arriba.
  // 'embedded': solo la tarjeta del comprobante, sin barra ni fondo de
  // página — para cuando el que la contiene (por ejemplo un Modal) ya pone
  // su propio encabezado/botones alrededor.
  variant?: 'page' | 'embedded'
}

// ─── Logos de emisor ────────────────────────────────────────────────────────

function OrbitaIcon() {
  return (
    <svg viewBox="0 0 30 30" fill="none" style={{ width: 26, height: 26 }}>
      <circle cx="15" cy="15" r="13" stroke="rgba(255,255,255,0.55)" strokeWidth="3.2" strokeDasharray="60 22" strokeLinecap="round" />
      <circle cx="25.5" cy="7.5" r="4" fill="rgba(255,255,255,0.85)" />
      <circle cx="15" cy="15" r="4.5" fill="white" />
    </svg>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMonto(n: number) {
  return `$${Math.abs(n).toLocaleString('es-AR')}`
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function ComprobanteBase({
  numero,
  fecha,
  hora,
  emisor,
  headerGradient = 'linear-gradient(135deg, #1D4ED8, #2563EB)',
  estadoBadge = 'Aprobado',
  metadatos = [],
  compradorDatos,
  items,
  totales,
  textoFooter,
  onBack,
  backLabel = 'Volver',
  autoPrint = false,
  variant = 'page',
}: ComprobanteBaseProps) {

  useEffect(() => {
    if (!autoPrint) return
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [autoPrint])

  const emisorNombre   = emisor.tipo === 'orbita' ? 'Órbita'      : emisor.nombre
  const emisorSubtitle = emisor.tipo === 'orbita' ? 'orbita.site' : emisor.subtitulo

  const totalesNormales  = totales.filter(t => t.tipo !== 'total')
  const totalesFinal     = totales.filter(t => t.tipo === 'total')

  // ── La tarjeta del comprobante en sí — igual en 'page' y en 'embedded' ──
  const card = (
    <div
      className="ob-comp-card"
      style={{
        width: '100%', maxWidth: 660,
        background: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: variant === 'embedded' ? 'none' : '0 4px 40px rgba(0,0,0,0.10)',
      }}
    >

      {/* ── Encabezado de color ── */}
      <div style={{ background: headerGradient, padding: variant === 'embedded' ? '20px 24px' : '28px 32px' }}>

        {/* Emisor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: variant === 'embedded' ? 14 : 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'rgba(255,255,255,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {emisor.tipo === 'orbita' ? (
              <OrbitaIcon />
            ) : (
              <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
                {emisorNombre.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              {emisorNombre}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
              {emisorSubtitle}
            </div>
          </div>
        </div>

        {/* Número + badge de estado */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.60)', marginBottom: 4 }}>
              Comprobante de pago
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.01em' }}>
              {numero}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.60)', marginBottom: 6 }}>
              {fecha}{hora ? ` · ${hora}` : ''}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 26, padding: '0 12px', borderRadius: 999,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.28)',
              color: '#fff', fontSize: 12, fontWeight: 700,
            }}>
              <Check size={11} strokeWidth={3} /> {estadoBadge}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cuerpo ── */}
      <div style={{ padding: variant === 'embedded' ? '20px 24px' : '28px 32px' }}>

        {/* Metadatos (método de pago, estado, etc.) */}
        {metadatos.length > 0 && (
          <div
            className="ob-comp-meta"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(metadatos.length, 4)}, 1fr)`,
              gap: 16,
              padding: variant === 'embedded' ? '12px 16px' : '16px 20px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              marginBottom: variant === 'embedded' ? 16 : 24,
            }}
          >
            {metadatos.map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Datos del comprador */}
        {compradorDatos && Object.keys(compradorDatos).length > 0 && (
          <div style={{ marginBottom: variant === 'embedded' ? 16 : 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', marginBottom: variant === 'embedded' ? 10 : 14 }}>
              Datos del comprador
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {Object.entries(compradorDatos).map(([k, v]) => (
                <div key={k} style={{ gridColumn: k === 'Dirección' ? '1 / -1' : 'auto' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ height: 1, background: '#E2E8F0', marginBottom: variant === 'embedded' ? 16 : 24 }} />

        {/* Tabla de ítems */}
        <div style={{ marginBottom: variant === 'embedded' ? 14 : 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', marginBottom: variant === 'embedded' ? 10 : 14 }}>
            Detalle
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
            {/* Cabecera tabla */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px', background: '#F8FAFC', padding: variant === 'embedded' ? '7px 14px' : '10px 14px', borderBottom: '1px solid #E2E8F0' }}>
              {(['Producto / Descripción', 'Cant.', 'Subtotal'] as const).map((h, i) => (
                <span
                  key={h}
                  style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94A3B8', textAlign: i > 0 ? 'right' : 'left' }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Filas */}
            {items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 60px 100px', gap: 12, alignItems: 'center',
                  padding: variant === 'embedded' ? '8px 14px' : '12px 14px',
                  borderBottom: i < items.length - 1 ? '1px solid #F1F5F9' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {it.thumb}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{it.descripcion}</div>
                    {it.subtitulo && (
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{it.subtitulo}</div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#64748B', textAlign: 'right', fontFamily: '"Geist Mono", monospace' }}>
                  x{it.qty}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', textAlign: 'right', fontFamily: '"Geist Mono", monospace' }}>
                  {fmtMonto(it.subtotal)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totales */}
        <div style={{ background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0', padding: variant === 'embedded' ? '10px 16px' : '14px 18px' }}>
          {totalesNormales.map(t => (
            <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', padding: variant === 'embedded' ? '3px 0' : '5px 0', fontSize: 13 }}>
              <span style={{ color: '#64748B' }}>{t.label}</span>
              <span style={{ fontFamily: '"Geist Mono", monospace', color: t.tipo === 'descuento' ? '#16A34A' : '#64748B' }}>
                {t.tipo === 'descuento' ? '−' : ''}{fmtMonto(t.valor)}
              </span>
            </div>
          ))}
          <div style={{ height: 1, background: '#E2E8F0', margin: variant === 'embedded' ? '8px 0' : '10px 0' }} />
          {totalesFinal.map(t => (
            <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{t.label}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', fontFamily: '"Geist Mono", monospace' }}>
                {fmtMonto(t.valor)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: variant === 'embedded' ? '10px 24px' : '14px 32px',
        background: '#F8FAFC', borderTop: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>
          {textoFooter ?? 'Este comprobante acredita el pago realizado.'}
        </span>
        <span style={{ fontSize: 11, color: '#CBD5E1', fontWeight: 600, letterSpacing: '0.04em' }}>
          Powered by Órbita
        </span>
      </div>
    </div>
  )

  // ── 'embedded': solo la tarjeta, sin barra ni fondo de página propio —
  // quien la use (un Modal, por ejemplo) pone su propio encabezado/acciones. ──
  if (variant === 'embedded') {
    return (
      <>
        <style>{`
          @media print {
            .ob-comp-card { box-shadow: none !important; }
          }
        `}</style>
        {card}
      </>
    )
  }

  // ── 'page': la página completa (la que ve el cliente en la tienda) ──
  return (
    <>
      <style>{`
        @media print {
          .ob-comp-bar  { display: none !important; }
          body          { background: #fff !important; }
          .ob-comp-card { box-shadow: none !important; }
        }
        @media (max-width: 640px) {
          .ob-comp-bar  { padding: 0 16px !important; }
          .ob-comp-body { padding: 20px 12px 48px !important; }
          .ob-comp-meta { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* ── Barra de acciones (se oculta al imprimir) ── */}
      <div className="ob-comp-bar" style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 56, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
        padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {onBack ? (
          <button
            onClick={onBack}
            style={{
              fontSize: 13, color: 'var(--color-primary)', fontWeight: 500,
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <ArrowLeft size={14} /> {backLabel}
          </button>
        ) : <span />}

        <button
          onClick={() => window.print()}
          style={{
            height: 36, padding: '0 14px', borderRadius: 8,
            background: 'var(--color-primary)', color: '#fff',
            fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
          }}
        >
          <Printer size={13} strokeWidth={1.5} /> Imprimir
        </button>
      </div>

      {/* ── Página del comprobante ── */}
      <div
        className="ob-comp-body"
        style={{
          minHeight: 'calc(100vh - 56px)',
          background: '#F1F5F9',
          padding: '36px 20px 64px',
          display: 'flex', justifyContent: 'center',
        }}
      >
        {card}
      </div>
    </>
  )
}
