import Link from 'next/link'
import { Receipt, ArrowRight } from 'lucide-react'

// Antes esta página mostraba un comprobante armado con datos FIJOS (número
// "OB-2025-004817", $5000, "Aprobado"), sin sesión y sin mirar ningún pago:
// se podía abrir por URL e imprimir como si fuera una prueba de pago real
// (hallazgo comprobante-fijo, auditoría 09/09; cerrado en la auditoría interna
// 10/09, ítem api.onboarding). El comprobante válido del beneficio de
// bienvenida es el que emite Mercado Pago, así que acá solo se indica dónde
// encontrarlo.
export default function PagoComprobante() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-surface)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'inherit',
    }}>
      <div style={{
        width: '100%', maxWidth: 440, padding: 32,
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 16, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, margin: '0 auto 18px', borderRadius: '50%',
          background: 'rgba(37,99,235,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Receipt size={26} color="var(--color-primary)" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
          Tu comprobante lo emite Mercado Pago
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
          Te llegó por email al pagar, y también lo encontrás en tu cuenta de Mercado Pago, en Actividad.
        </p>
        <Link
          href="/admin"
          className="ds-hover"
          style={{
            width: '100%', height: 46, borderRadius: 10,
            background: 'var(--color-primary)', color: 'white',
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          Ir al panel
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
