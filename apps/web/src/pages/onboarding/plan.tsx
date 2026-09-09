import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { Check, Shield, Zap, HeadphonesIcon, Globe, Percent, FileText, Printer, ArrowRight } from 'lucide-react'
import { completeOnboarding, publishBusiness, uploadLogo, dataUrlToBlob, startPendingCheckout, previewDiscountCode, ApiError, type PlanKey } from '@/lib/api'
import { track, trackPaso, flush as flushAnalitica } from '@/lib/analytics/wizardTracker'
import { useOnboardingStore, useOnboardingHidratado } from '@/modules/onboarding/useOnboardingStore'
import { BarraPasos, pasosOnboarding, labelPasoRubro } from '@/modules/onboarding/BarraPasos'
import { useAuth } from '@/hooks/useAuth'
import { tenantUrl } from '@/lib/tenant'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'

interface DetalleItem { titulo: string; texto: string }

// Lo que ya incluye la tarjeta Base — mismos textos que Cierre.tsx (home) y
// Modulos.tsx, adaptados al estilo propio de esta pantalla (no se importa
// nada de la landing: es un sistema visual distinto). Si cambian de un lado,
// cambian del otro.
const DETALLE_BASE: DetalleItem[] = [
  { titulo: 'Panel de administración completo', texto: 'Catálogo, pedidos, stock, clientes y reportes en un solo lugar.' },
  { titulo: 'Subdominio .orbita.site incluido', texto: 'Tu tienda publicada de una, o conectá tu propio dominio cuando quieras.' },
  { titulo: 'Sin comisiones por venta o turno', texto: 'Cobrás vos, en tu propia cuenta de Mercado Pago.' },
  { titulo: 'Soporte prioritario por WhatsApp', texto: 'Te respondemos directo, sin tickets ni esperas largas.' },
  { titulo: 'Orbi, tu asistente con IA', texto: 'Te responde sobre tus ventas, tu stock, tus pedidos y más.' },
  { titulo: 'Descuentos y cupones', texto: 'Con sus límites y vencimientos, aplicados solos en el carrito.' },
]

// Las 6 features del paquete Avanzado + fotos sin fondo (gateada por el mismo
// addon aunque no es una de las 6 de marketing) — mismos textos que
// Avanzado.tsx en la home. El "Aviso de salida" (viejo exit-intent) queda
// afuera a propósito: se va a dar de baja (decisión del dueño, 2026-09).
const DETALLE_AVANZADO: DetalleItem[] = [
  ...DETALLE_BASE,
  { titulo: 'Plantillas de portada', texto: 'Veinte diseños distintos para la portada de tu tienda.' },
  { titulo: 'Modales de anuncios', texto: 'Promos y avisos que aparecen en el momento justo de la visita.' },
  { titulo: 'Juegos con premio', texto: 'Mini-juegos donde tu cliente se gana un descuento, que se crea solo.' },
  { titulo: 'Prueba social', texto: 'Avisos de "alguien acaba de comprar esto" con pedidos reales.' },
  { titulo: '2x1 y 3x2', texto: 'Promo "llevá X, pagá Y" que se aplica sola en el carrito, sin código.' },
  { titulo: 'Oferta relámpago', texto: 'Un descuento que dura poco, con un reloj en tu tienda que muestra el tiempo que falta.' },
  { titulo: 'Fotos sin fondo automáticas', texto: 'Sacale el fondo a la foto de tu producto con un clic.' },
]

interface CardPlan {
  key: PlanKey
  nombre: string
  /** Precio mensual regular de ESTA tarjeta — se muestra tachado, como ancla. */
  precioRecurrente: number
  /** Lo que se cobra ACÁ, en este paso, por 3 meses (beneficio de bienvenida). */
  precioBienvenida: number
  incluye: string[]
  masDetalles: DetalleItem[]
  destacado?: boolean
}

// Dos tarjetas nomás (antes 3 planes + un monto de bienvenida fijo que no
// dependía de cuál elegías — ahí estaba la raíz de la queja de "checkout
// confuso"). Elegir una tarjeta determina DIRECTAMENTE cuánto se cobra hoy Y
// qué se activa después. Mismos montos que subscriptions.service.ts
// (BIENVENIDA_TIERS/PLANES) y la home (Cierre.tsx) — si cambian de un lado,
// cambian del otro.
const CARDS: CardPlan[] = [
  {
    key: 'mensual', nombre: 'Base',
    precioRecurrente: 16500, precioBienvenida: 5500,
    incluye: DETALLE_BASE.map(d => d.titulo), masDetalles: DETALLE_BASE,
  },
  {
    key: 'mensualAvanzado', nombre: 'Base + Avanzado',
    precioRecurrente: 21700, precioBienvenida: 10900,
    incluye: [...DETALLE_BASE.map(d => d.titulo), 'Paquete Avanzado incluido'], masDetalles: DETALLE_AVANZADO,
    destacado: true,
  },
]

// Resumen de alto nivel, NO una re-lista de los pasos granulares del wizard
// (esos ya se mostraron en SetupUnificado.tsx, incluyendo "Pago" como último
// ítem desde el principio — ver PENDIENTES.md). Acá solo queda un paso real:
// confirmar el pago.
const PASOS = ['Configuración', 'Pago']

const N_COMPROBANTE = 'OB-2025-004817'
const FECHA_HOY = new Date().toLocaleDateString('es-AR', {
  day: '2-digit', month: 'long', year: 'numeric',
})

// ─── Logos ──────────────────────────────────────────────────────────────────
// El de Órbita viene del design-system (el orbital animado oficial).

function MercadoPagoLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#009EE3"/>
      <path d="M8 24c0-8.837 7.163-16 16-16 4.418 0 8.418 1.791 11.314 4.686L24 24H8z" fill="white" opacity=".9"/>
      <path d="M24 24l11.314-11.314A15.96 15.96 0 0 1 40 24c0 8.837-7.163 16-16 16-4.418 0-8.418-1.791-11.314-4.686L24 24z" fill="white" opacity=".6"/>
    </svg>
  )
}

// ─── Header con stepper (compartido) ────────────────────────────────────────

function Header() {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', height: 56, padding: '0 28px',
      background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
    }}>
      <a href="/" className="ds-hover" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', borderRadius: 8 }}>
        <OrbitaLogo size={24} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Órbita</span>
      </a>
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {PASOS.map((paso, i) => {
          const done    = i < 1
          const current = i === 1
          return (
            <div key={paso} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: done ? '#10B981' : current ? '#2563EB' : 'var(--color-surface-alt)',
                  color: (done || current) ? 'white' : 'var(--color-subtle)',
                }}>
                  {done ? <Check size={11} strokeWidth={3} /> : i + 1}
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: current ? 'var(--color-text)' : done ? '#10B981' : 'var(--color-subtle)',
                }}>
                  {paso}
                </span>
              </div>
              {i < PASOS.length - 1 && (
                <div style={{ width: 24, height: 1, background: done ? '#10B981' : 'var(--color-border)' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Pantalla 1: Selección de plan ──────────────────────────────────────────

// Atajo para entrar al panel sin pasar por el cobro. Solo se muestra si la
// variable de entorno lo habilita, así en producción no queda una vía para
// saltearse el pago (ver PENDIENTES.md).
const PERMITE_OMITIR_PAGO = process.env.NEXT_PUBLIC_ALLOW_SKIP_PAYMENT === 'true'

interface DescuentoAplicado { code: string; percentOff: number; amountBase: number; amountFinal: number }

function fmtPesos(n: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

// Campo para canjear un código de descuento de Órbita. Valida contra el
// backend ANTES de mandar a pagar, así el dueño ve el precio final acá y no se
// entera recién en Mercado Pago.
function CampoDescuento({ descuento, onAplicar, onQuitar }: {
  descuento: DescuentoAplicado | null
  onAplicar: (code: string) => Promise<void>
  onQuitar: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [validando, setValidando] = useState(false)

  if (descuento) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
        padding: '11px 14px', borderRadius: 12,
        background: 'var(--color-success-bg)', border: '1px solid var(--color-success)',
      }}>
        <Check size={16} strokeWidth={2.5} color="var(--color-success)" />
        <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text)' }}>
          Código <strong style={{ fontFamily: '"Geist Mono", monospace' }}>{descuento.code}</strong> aplicado:{' '}
          {descuento.amountFinal === 0 ? 'el plan te queda gratis' : `${descuento.percentOff}% menos`}
        </span>
        <button
          type="button"
          onClick={() => { onQuitar(); setCode('') }}
          className="ds-link"
          style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Quitar
        </button>
      </div>
    )
  }

  async function aplicar() {
    if (!code.trim()) return
    setValidando(true)
    setError('')
    try {
      await onAplicar(code.trim())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos validar el código.')
    } finally {
      setValidando(false)
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Visible de entrada, sin link intermedio: el codigo se lo damos
          nosotros al negocio y hay que poder cargarlo sin buscarlo. */}
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-body)', marginBottom: 7 }}>
        ¿Tenés un código de descuento?
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void aplicar() } }}
          placeholder="Tu código"
          className="ds-field"
          style={{
            flex: 1, height: 44, padding: '0 13px', borderRadius: 10,
            border: '1px solid var(--color-border)', background: 'var(--color-bg)',
            color: 'var(--color-text)', fontSize: 14, fontFamily: '"Geist Mono", monospace',
            letterSpacing: '0.05em', outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void aplicar()}
          disabled={validando || !code.trim()}
          className="ds-hover"
          style={{
            height: 44, padding: '0 18px', borderRadius: 10, border: '1px solid var(--color-border)',
            background: 'var(--color-bg)', color: 'var(--color-body)',
            fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            opacity: validando || !code.trim() ? 0.55 : 1,
          }}
        >
          {validando ? 'Validando…' : 'Aplicar'}
        </button>
      </div>
      {error && (
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>
      )}
    </div>
  )
}

function PlanScreen({ onPagar, onOmitir, error, descuento, faltaPassword, onVolver, onAplicarDescuento, onQuitarDescuento, rubro, plan, onCambiarPlan }: {
  onPagar: () => void
  onOmitir: () => void
  error?: string
  descuento: DescuentoAplicado | null
  faltaPassword: boolean
  onVolver: () => void
  onAplicarDescuento: (code: string) => Promise<void>
  onQuitarDescuento: () => void
  /** Rubro elegido — para el label del paso 2 de la barra única. */
  rubro: string
  /** Plan que se activa cuando termine el beneficio de bienvenida. */
  plan: PlanKey
  onCambiarPlan: (p: PlanKey) => void
}) {
  // Un código del 100% deja el plan en cero: no hay nada que cobrar, así que la
  // pantalla no puede seguir prometiendo un pago. Cambia el precio, el botón y
  // la línea de seguridad — mandarlo a "Pagar con MercadoPago" para terminar en
  // una pantalla de $0 sería confuso y encima MP la rechaza.
  const esGratis = !!descuento && descuento.amountFinal === 0
  const cardActual = CARDS.find(c => c.key === plan) ?? CARDS[0]
  const [detalle, setDetalle] = useState<PlanKey | null>(null)
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', fontFamily: 'inherit' }}>
      <Header />
      {/* La barra única del onboarding, con todo tildado menos el pago: el
          mismo recorrido que vio en el rubro y el setup, cerrando el círculo. */}
      <BarraPasos pasos={pasosOnboarding(labelPasoRubro(rubro))} actual={5} />
      <div style={{
        maxWidth: 520, margin: '0 auto',
        padding: '52px 24px 80px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', marginBottom: 20,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563EB 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
        }}>
          <OrbitaLogo size={36} />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 8px', textAlign: 'center' }}>
          Activá tu cuenta
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 36px', textAlign: 'center', lineHeight: 1.5 }}>
          Tu negocio está configurado. Elegí el plan de inicio para publicar tu espacio en Órbita.
        </p>

        {error && (
          <div style={{
            width: '100%', marginBottom: 20, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            fontSize: 12.5, color: 'var(--color-error)', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <div style={{
          width: '100%',
          background: 'var(--color-bg)',
          border: '2px solid var(--color-primary)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(37,99,235,0.12)',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563EB 100%)',
            padding: '24px 28px 20px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)',
              borderRadius: 999, padding: '4px 12px',
              fontSize: 11, fontWeight: 700, color: 'white',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
              ✦ BENEFICIO DE BIENVENIDA
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
              Tus primeros 3 meses
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textDecoration: 'line-through', lineHeight: 1, paddingBottom: 4 }}>
                {fmtPesos(descuento ? descuento.amountBase : cardActual.precioRecurrente)}
              </span>
              <span style={{ fontSize: 42, fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {esGratis ? 'Gratis' : descuento ? fmtPesos(descuento.amountFinal) : fmtPesos(cardActual.precioBienvenida)}
              </span>
              {!esGratis && (
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', paddingBottom: 6 }}>
                  por 3 meses
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              {esGratis
                ? `Con el código ${descuento!.code} no pagás nada`
                : descuento
                  ? `Con el código ${descuento.code}: ${descuento.percentOff}% menos`
                  : `Después, ${fmtPesos(cardActual.precioRecurrente)}/mes`}
            </div>
          </div>

          <div style={{ padding: '20px 28px 24px' }}>
            {/* Elegir la tarjeta determina DIRECTAMENTE el monto de arriba
                (antes era fijo, sea cual sea el plan — ahí estaba la raíz de
                la queja de "checkout confuso") Y qué plan se activa cuando
                termine el beneficio. Se puede cambiar después desde el panel
                (Configuración → Suscripción). */}
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-body)', marginBottom: 9 }}>
              Elegí tu plan
            </div>
            <style>{`
              .oc-wizard-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
              @media (max-width: 460px) { .oc-wizard-cards { grid-template-columns: 1fr; } }
            `}</style>
            <div className="oc-wizard-cards" style={{ marginBottom: 18 }}>
              {CARDS.map(c => {
                const activo = c.key === plan
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => onCambiarPlan(c.key)}
                    className="ds-hover"
                    style={{
                      position: 'relative', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      padding: '14px 14px 12px', borderRadius: 14,
                      border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: activo ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                    }}
                  >
                    {c.destacado && (
                      <span style={{
                        position: 'absolute', top: -9, right: 10,
                        fontSize: 9.5, fontWeight: 700, color: 'white',
                        background: 'var(--color-primary)', borderRadius: 999,
                        padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        Más elegido
                      </span>
                    )}
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}>{c.nombre}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-subtle)', textDecoration: 'line-through' }}>
                        {fmtPesos(c.precioRecurrente)}
                      </span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)' }}>
                        {fmtPesos(c.precioBienvenida)}
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--color-subtle)', marginTop: 1 }}>
                      por 3 meses · después {fmtPesos(c.precioRecurrente)}/mes
                    </div>
                    <ul style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {c.incluye.slice(0, 3).map(t => (
                        <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-body)' }}>
                          <Check size={11} strokeWidth={2.5} color="#10B981" style={{ flexShrink: 0 }} />
                          {t}
                        </li>
                      ))}
                    </ul>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); setDetalle(c.key) }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setDetalle(c.key) } }}
                      style={{
                        marginTop: 9, display: 'inline-block', fontSize: 10.5, fontWeight: 600,
                        color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer',
                      }}
                    >
                      Más detalles
                    </span>
                  </button>
                )
              })}
            </div>

            <CampoDescuento
              descuento={descuento}
              onAplicar={onAplicarDescuento}
              onQuitar={onQuitarDescuento}
            />

            {/* Sin renovación automática: refleja el flujo real (mail + botón
                "Activar mi plan" en el panel, activatePlan/confirmPlanActivation
                — no hay ningún cobro diferido automatizado). */}
            <p style={{ fontSize: 11.5, color: 'var(--color-subtle)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Sin renovación automática: al terminar los 3 meses te avisamos por mail
              y vos activás el siguiente período desde el panel.
            </p>

            {/* Sin la contraseña en memoria (pasa al recargar esta pantalla: no
                se persiste a proposito) el pago no puede arrancar. Antes el
                boton de MercadoPago seguia ahi, azul y clickeable, y al tocarlo
                no pasaba NADA: parecia que el pago estaba roto. Ahora en su
                lugar va la accion que si resuelve el problema. */}
            {faltaPassword ? (
              <button
                onClick={onVolver}
                className="ds-hover"
                style={{
                  width: '100%', height: 52, borderRadius: 12, border: 'none',
                  background: 'var(--color-primary)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Volver a poner la contraseña
                <ArrowRight size={16} strokeWidth={2.5} />
              </button>
            ) : (
            <button
              onClick={onPagar}
              style={{
                width: '100%', height: 52, borderRadius: 12, border: 'none',
                background: esGratis ? '#10B981' : '#009EE3', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: esGratis ? '0 4px 16px rgba(16,185,129,0.40)' : '0 4px 16px rgba(0,158,227,0.40)',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = esGratis ? '#0E9F6E' : '#0085C1'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = esGratis ? '#10B981' : '#009EE3'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {esGratis ? <Check size={18} strokeWidth={3} /> : <MercadoPagoLogo />}
              {esGratis ? 'Crear mi espacio gratis' : 'Pagar con MercadoPago'}
            </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 }}>
              <Shield size={11} strokeWidth={2} color="var(--color-subtle)" />
              <span style={{ fontSize: 11, color: 'var(--color-subtle)' }}>
                {esGratis
                  ? 'No te vamos a pedir ninguna tarjeta'
                  : 'Pago 100% seguro · Encriptado por MercadoPago'}
              </span>
            </div>
          </div>
        </div>

        {PERMITE_OMITIR_PAGO && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', margin: '24px 0 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              <span style={{ fontSize: 12, color: 'var(--color-subtle)', whiteSpace: 'nowrap' }}>o si preferís</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            </div>

            <button
              onClick={onOmitir}
              style={{
                marginTop: 16, background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--color-muted)', fontWeight: 500,
                textDecoration: 'underline', textUnderlineOffset: 3,
                transition: 'color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)' }}
            >
              Omitir pago y entrar al panel
            </button>

            <p style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 8, textAlign: 'center' }}>
              Atajo de desarrollo — no disponible en producción
            </p>
          </>
        )}
      </div>

      {detalle && (
        <DetallesModal
          card={CARDS.find(c => c.key === detalle)!}
          onCerrar={() => setDetalle(null)}
        />
      )}
    </div>
  )
}

// Modal "más detalles" de una tarjeta — mismo patrón de interacción que la
// home (Cierre.tsx), pero con los colores propios de esta pantalla (no se
// comparte componente: son sistemas visuales distintos).
function DetallesModal({ card, onCerrar }: { card: CardPlan; onCerrar: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', onKey)
    // El bloqueo va en `html`, no en `body`: acá el contenedor de scroll es
    // `html` (ver globals.css, "quien scrollea de verdad es html") — con
    // `overflow:hidden` solo en `body`, el fondo se sigue moviendo. Mismo
    // criterio que el comparador de la home (v2/Cierre.tsx).
    const htmlPrevio = document.documentElement.style.overflow
    const bodyPrevio = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = htmlPrevio
      document.body.style.overflow = bodyPrevio
    }
  }, [onCerrar])

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(15,23,42,0.55)' }}
      onClick={onCerrar}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '80vh', width: '100%', maxWidth: 440, overflowY: 'auto', borderRadius: 16, padding: 26, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
      >
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 16px' }}>
          Todo lo que incluye {card.nombre}
        </h3>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: 0, padding: 0, listStyle: 'none' }}>
          {card.masDetalles.map(d => (
            <li key={d.titulo} style={{ display: 'flex', gap: 9, fontSize: 13 }}>
              <Check size={14} strokeWidth={2.5} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{d.titulo}.</span>{' '}
                <span style={{ color: 'var(--color-muted)' }}>{d.texto}</span>
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onCerrar}
          className="ds-hover"
          style={{ width: '100%', marginTop: 20, padding: '11px 0', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

// ─── Pantalla 2: Procesando ──────────────────────────────────────────────────

// `gratis`: el alta con un código del 100% no pasa por MercadoPago, así que la
// pantalla de espera no puede decir que está cobrando algo.
function ProcesandoScreen({ gratis }: { gratis?: boolean }) {
  const [dots, setDots] = useState(1)

  useEffect(() => {
    const t = setInterval(() => setDots(d => (d % 3) + 1), 500)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 28, padding: 24, fontFamily: 'inherit',
    }}>
      <style>{`
        @keyframes mpSpin    { to { transform: rotate(360deg) } }
        @keyframes mpPulse   { 0%,100%{ opacity:.3;transform:scale(.7) } 50%{ opacity:1;transform:scale(1) } }
        @keyframes mpFadeUp  { from { opacity:0;transform:translateY(12px) } to { opacity:1;transform:translateY(0) } }
      `}</style>

      {/* Spinner + logo MP */}
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: gratis ? '3px solid rgba(16,185,129,0.15)' : '3px solid rgba(0,158,227,0.15)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3px solid transparent',
          borderTopColor: gratis ? '#10B981' : '#009EE3',
          animation: 'mpSpin 0.85s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {gratis ? <OrbitaLogo size={36} /> : <MercadoPagoLogo size={36} />}
        </div>
      </div>

      {/* Texto */}
      <div style={{ textAlign: 'center', animation: 'mpFadeUp 0.5s ease' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
          {gratis ? 'Creando tu espacio' : 'Conectando con MercadoPago'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.6 }}>
          {gratis ? 'Dejando todo listo' : 'Procesando tu pago de forma segura'}{'.'.repeat(dots)}<br />
          <span style={{ fontSize: 12 }}>No cerrés esta ventana.</span>
        </div>
      </div>

      {/* Dots loader */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 8, height: 8, borderRadius: '50%', background: '#009EE3',
              animation: `mpPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Seguridad */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 999,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}>
        <Shield size={12} color="var(--color-subtle)" />
        <span style={{ fontSize: 11, color: 'var(--color-subtle)' }}>
          Pago encriptado · 100% seguro
        </span>
      </div>
    </div>
  )
}

// ─── Pantalla 3: Pago exitoso ────────────────────────────────────────────────

function ExitoScreen({ irAlPanel, cardComprada }: { irAlPanel: () => void; cardComprada: CardPlan }) {
  const DETALLES: [string, string][] = [
    ['Plan', cardComprada.nombre],
    ['Beneficio', `${fmtPesos(cardComprada.precioBienvenida)} · 3 meses`],
    ['Fecha',   FECHA_HOY],
    ['Método',  'MercadoPago'],
    ['N° comp.', N_COMPROBANTE],
  ]

  function verComprobante() {
    window.open(`/onboarding/pago-comprobante`, '_blank')
  }
  function imprimir() {
    const w = window.open(`/onboarding/pago-comprobante?print=1`, '_blank')
    if (w) w.focus()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes exitoScale { from { opacity:0;transform:scale(0.5) } to { opacity:1;transform:scale(1) } }
        @keyframes exitoFade  { from { opacity:0;transform:translateY(16px) } to { opacity:1;transform:translateY(0) } }
      `}</style>

      <Header />

      <div style={{
        maxWidth: 480, margin: '0 auto',
        padding: '52px 24px 80px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>

        {/* Check animado */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(16,185,129,0.40)',
          marginBottom: 20,
          animation: 'exitoScale 0.55s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <Check size={40} color="white" strokeWidth={2.5} />
        </div>

        <div style={{ textAlign: 'center', animation: 'exitoFade 0.5s ease 0.1s both' }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 8px' }}>
            ¡Pago confirmado!
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0, lineHeight: 1.5 }}>
            Tu cuenta de <strong style={{ color: 'var(--color-text)' }}>Órbita</strong> está activa.
          </p>
        </div>

        {/* Card comprobante */}
        <div style={{
          width: '100%', marginTop: 32,
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          animation: 'exitoFade 0.5s ease 0.2s both',
        }}>
          {/* Encabezado verde */}
          <div style={{
            background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                Comprobante de pago
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'white', fontFamily: '"Geist Mono", monospace' }}>
                {N_COMPROBANTE}
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 999, padding: '4px 12px',
            }}>
              <Check size={11} strokeWidth={3} color="white" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>Aprobado</span>
            </div>
          </div>

          {/* Detalle */}
          <div style={{ padding: '4px 0' }}>
            {DETALLES.map(([label, valor], i) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 20px',
                borderBottom: i < DETALLES.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: label === 'N° comp.' || label === 'Monto' ? '"Geist Mono", monospace' : 'inherit' }}>
                  {valor}
                </span>
              </div>
            ))}
          </div>

          {/* Botones comprobante */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 20px 18px' }}>
            <button
              onClick={verComprobante}
              className="ds-hover"
              style={{
                height: 40, borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'var(--color-bg)', color: 'var(--color-text)',
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <FileText size={14} strokeWidth={1.5} /> Ver
            </button>
            <button
              onClick={imprimir}
              className="ds-hover"
              style={{
                height: 40, borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'var(--color-bg)', color: 'var(--color-text)',
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <Printer size={14} strokeWidth={1.5} /> Imprimir
            </button>
          </div>
        </div>

        {/* Separador */}
        <div style={{ height: 1, background: 'var(--color-border)', width: '100%', margin: '28px 0' }} />

        {/* CTA continuar */}
        <button
          onClick={irAlPanel}
          style={{
            width: '100%', height: 52, borderRadius: 12, border: 'none',
            background: 'var(--color-primary)', color: 'white',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 16px rgba(37,99,235,0.30)',
            transition: 'all 150ms',
            animation: 'exitoFade 0.5s ease 0.35s both',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1D4ED8'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          Continuar al panel
          <ArrowRight size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function PlanPage() {
  const router = useRouter()
  const next   = (router.query.next as string) ?? '/admin'
  const wizard      = useOnboardingStore(s => s.wizard)
  const resetWizard = useOnboardingStore(s => s.resetWizard)
  const { login } = useAuth()
  const [estado, setEstado] = useState<'plan' | 'procesando' | 'exito'>('plan')
  const [descuento, setDescuento] = useState<DescuentoAplicado | null>(null)
  const [errorPago, setErrorPago] = useState('')
  const [subdominioListo, setSubdominioListo] = useState('')
  // Tarjeta elegida — determina el monto que se cobra ACÁ y qué plan se
  // activa después (se puede volver a cambiar desde el panel). Default
  // 'mensual' (Base): "destacado" en Base+Avanzado es una recomendación
  // visual, no una preselección — igual criterio que la home (Cierre.tsx),
  // ninguna tarjeta viene marcada de entrada.
  const [plan, setPlan] = useState<PlanKey>('mensual')

  // Si no vino de completar el wizard (no hay rubro/credenciales cargadas),
  // no tiene nada que pagar/guardar — volver al principio. La contraseña NO
  // se persiste en localStorage (seguridad): si el usuario recargó esta
  // página, está vacía y necesita volver a ingresarla en el paso anterior.
  const passwordLost = !wizard.ownerPassword
  // El guard espera a que el wizard se rehidrate desde localStorage: corría
  // contra el estado inicial vacío, así que recargar esta pantalla te mandaba
  // de vuelta al paso 1 y te borraba todo lo cargado, en vez de dejarte acá
  // con el aviso de reingresar la contraseña.
  const hidratado = useOnboardingHidratado()
  // resetWizard() vacía rubro/ownerEmail EN EL MISMO render en el que estamos
  // saliendo hacia MercadoPago (o mostrando el éxito) — sin esta bandera, el
  // guard de abajo veía el wizard vacío y su router.push('/onboarding/rubro')
  // le ganaba a la navegación a MP: tocabas "Pagar" y aterrizabas de vuelta
  // en el onboarding en vez de en el pago.
  const saliendoRef = useRef(false)
  useEffect(() => {
    if (!hidratado || saliendoRef.current) return
    if (!wizard.rubro || !wizard.ownerEmail) router.push('/onboarding/rubro')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado, wizard.rubro, wizard.ownerEmail])

  // El último paso del recorrido (ver BarraPasos). Llegar hasta acá y no pagar
  // es el abandono más caro de todos: hay que poder verlo separado del resto.
  useEffect(() => {
    if (!hidratado || !wizard.rubro) return
    trackPaso(5, 'pago', wizard.rubro)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado])

  // Crea la cuenta, el negocio y la sesión del dueño. El negocio queda SIN
  // publicar: sale al aire recién cuando MercadoPago confirma la suscripción
  // (ver subscriptions.service.ts). Si el usuario abandona en la pantalla de
  // MP, el negocio queda en borrador y no es visible para nadie.
  function activarNegocio() {
    const account = {
      ownerName: wizard.ownerName,
      email: wizard.ownerEmail,
      password: wizard.ownerPassword,
      businessName: wizard.nombre,
    }
    return completeOnboarding(account, wizard)
      .then(() => wizard.logoDataUrl ? uploadLogo(dataUrlToBlob(wizard.logoDataUrl), 'logo.png') : null)
      // El registro de onboarding emite su propio token de un solo uso (sin
      // refresh) — para dejar al dueño con la MISMA sesión que usa el resto
      // del panel (access en memoria + refresh httpOnly cross-subdominio),
      // logueamos acá con las credenciales recién creadas vía el flujo
      // estándar de auth (RBT-285/290), no con el token de onboarding.
      .then(() => login(account.email, account.password))
      .then(user => { if (user.type === 'member') setSubdominioListo(user.business.subdomain) })
  }

  function manejarError(err: unknown) {
    let msg = 'No se pudo procesar tu pago. Intentá de nuevo.'
    if (err instanceof ApiError) {
      if (err.message.includes('password')) msg = 'La contraseña no es válida. Volvé al paso anterior.'
      else if (err.status === 409) msg = 'Este email ya tiene un negocio registrado.'
      else msg = err.message
    }
    setErrorPago(msg)
    setEstado('plan')
  }

  // Manda al dueño a MercadoPago para que autorice el débito automático —
  // TODAVÍA no crea ninguna cuenta ni negocio. Los datos del wizard quedan
  // guardados temporalmente en el backend (PendingSignup) hasta que MP
  // confirme el pago; recién ahí se crea la cuenta real (ver
  // SubscriptionsService.confirmAndCreate, y la vuelta en
  // /onboarding/pago-retorno). Si el usuario abandona en la pantalla de MP,
  // no queda ningún Business/Member creado.
  // El código validado se guarda acá y viaja al checkout. Se valida contra el
  // backend (misma regla que usa el cobro real) para que el precio que ve el
  // dueño sea el que efectivamente se le va a cobrar. `plan` viaja porque cada
  // tarjeta tiene su propio monto de bienvenida (ver previewDiscountCode).
  async function aplicarDescuento(code: string) {
    const d = await previewDiscountCode(code, plan)
    setDescuento({ code: d.code, percentOff: d.percentOff, amountBase: d.amountBase, amountFinal: d.amountFinal })
  }

  // Si cambia de tarjeta con un código ya aplicado, ese código quedó
  // calculado contra la tarjeta VIEJA — se limpia para forzar a reaplicarlo
  // contra la nueva en vez de mostrar/cobrar un monto que no corresponde.
  function cambiarPlan(p: PlanKey) {
    setPlan(p)
    setDescuento(null)
  }

  function pagar() {
    if (passwordLost) {
      setErrorPago('Tu sesión expiró. Volvé al paso anterior para reingresar tu contraseña.')
      return
    }
    setErrorPago('')
    setEstado('procesando')
    const account = {
      ownerName: wizard.ownerName,
      email: wizard.ownerEmail,
      password: wizard.ownerPassword,
      businessName: wizard.nombre,
    }
    track('checkout_start', { step: 5, stepName: 'pago', rubro: wizard.rubro })
    // Se va del sitio a MercadoPago: si la cola no se descarga acá, se pierde.
    flushAnalitica()

    startPendingCheckout(account, wizard, plan, descuento?.code)
      .then(({ initPoint }) => {
        // Ya viaja todo al backend — se limpia antes de salir para que al
        // volver de MP no quede estado viejo dando vueltas. La bandera va
        // primero: el guard de arriba no se mete con la salida.
        saliendoRef.current = true
        resetWizard()
        window.location.href = initPoint
      })
      .catch(manejarError)
  }

  // Atajo de desarrollo: crea la cuenta y publica el negocio sin pasar por el
  // cobro. Solo accesible con NEXT_PUBLIC_ALLOW_SKIP_PAYMENT=true.
  function omitirPago() {
    if (passwordLost) {
      setErrorPago('Tu sesión expiró. Volvé al paso anterior para reingresar tu contraseña.')
      return
    }
    setErrorPago('')
    setEstado('procesando')
    activarNegocio()
      .then(() => publishBusiness())
      .then(() => { saliendoRef.current = true; resetWizard(); setEstado('exito') })
      .catch(manejarError)
  }

  // La contraseña no se persiste (ver useOnboardingStore), asi que al recargar
  // esta pantalla hay que volver al paso "Tu cuenta". `next` dice de que flujo
  // vino (tienda o turnos); si no lo dice, al selector de rubro, que reconstruye
  // el camino sin perder lo ya cargado.
  function volverAPoner() {
    const destino = next.includes('/turnos/')
      ? '/onboarding/turnos/setup?paso=cuenta'
      : next.includes('/tienda/')
        ? '/onboarding/tienda/setup?paso=cuenta'
        : '/onboarding/rubro'
    void router.push(destino)
  }

  function irAlPanel() {
    window.location.href = subdominioListo ? tenantUrl(subdominioListo, '/panel') : next
  }

  if (estado === 'procesando') return <ProcesandoScreen gratis={descuento?.amountFinal === 0} />
  if (estado === 'exito')      return <ExitoScreen irAlPanel={irAlPanel} cardComprada={CARDS.find(c => c.key === plan) ?? CARDS[0]} />
  return (
    <PlanScreen
      rubro={wizard.rubro}
      onPagar={pagar}
      onOmitir={omitirPago}
      error={errorPago || (passwordLost ? 'Tu sesión expiró. Volvé al paso anterior para reingresar tu contraseña.' : '')}
      descuento={descuento}
      faltaPassword={passwordLost}
      onVolver={volverAPoner}
      onAplicarDescuento={aplicarDescuento}
      onQuitarDescuento={() => setDescuento(null)}
      plan={plan}
      onCambiarPlan={cambiarPlan}
    />
  )
}
