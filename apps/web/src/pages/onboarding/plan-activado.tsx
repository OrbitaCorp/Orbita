import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { Check, AlertTriangle, ArrowRight } from 'lucide-react'
import { confirmPlanActivation } from '@/lib/api'
import { tenantUrl, sesionViajaASubdominios } from '@/lib/tenant'

// Pantalla a la que MercadoPago devuelve al dueño después de autorizar la
// preapproval de SU plan (mensual/semestral/anual) — se llega acá desde
// "Activá tu plan" en Configuración → Suscripción del panel (fin del
// beneficio de bienvenida, o un cambio de plan), NUNCA desde el alta nueva
// (esa vuelve a /onboarding/pago-retorno, que confirma un PendingSignup que
// acá no existe — el negocio ya existe).
//
// Igual que pago-retorno.tsx: la URL trae un preapproval_id, pero NO se toma
// como prueba de autorización — se le pregunta al backend, que a su vez le
// vuelve a preguntar a MP el estado real (ver
// SubscriptionsService.confirmPlanActivation). A diferencia de
// pago-retorno.tsx, acá no hace falta BFF: el dueño ya tiene sesión (nunca se
// fue de la app, solo autorizó en una pantalla de MP), y el endpoint no
// devuelve nada sensible (ni tokens) que solo un server pueda manejar.

type Estado = 'verificando' | 'ok' | 'pendiente' | 'error'

export default function PlanActivadoPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('verificando')
  const [mensaje, setMensaje] = useState('')
  const [subdominio, setSubdominio] = useState('')
  const [businessId, setBusinessId] = useState('')
  // Mismo guard que pago-retorno.tsx: evita disparar el confirm dos veces
  // para el mismo id si router.query cambia de referencia entre renders.
  const confirmado = useRef<string | null>(null)

  useEffect(() => {
    if (!router.isReady) return

    const q = router.query
    const mpPreapprovalId =
      (q.preapproval_id as string) ?? (q.preapprovalId as string) ?? (q.id as string) ?? ''

    if (!mpPreapprovalId) {
      setEstado('error')
      setMensaje('No recibimos la confirmación de MercadoPago. Si ya autorizaste, escribinos y lo activamos a mano.')
      return
    }
    if (confirmado.current === mpPreapprovalId) return
    confirmado.current = mpPreapprovalId

    ;(async () => {
      try {
        const data = await confirmPlanActivation(mpPreapprovalId)
        if (data.activated) {
          setSubdominio(data.subdomain ?? '')
          setBusinessId(data.businessId ?? '')
          setEstado('ok')
        } else {
          // MP puede tardar en pasar de "pending" a "authorized".
          setEstado('pendiente')
          setMensaje(`MercadoPago todavía no confirmó la autorización (estado: ${data.status}).`)
        }
      } catch {
        setEstado('error')
        setMensaje('No pudimos verificar la autorización.')
      }
    })()
  }, [router.isReady, router.query])

  function irAlPanel() {
    // Mismo criterio que pago-retorno.tsx: el panel vive en el subdominio de
    // la tienda, pero solo se puede entrar ahí si la sesión recién creada
    // viaja hasta ese host (no en dev con ROOT_DOMAIN=localhost). OJO: la
    // entrada por subdominio (pages/panel/index.tsx) hoy solo sabe mandar a
    // /admin/ventas/dashboard — no hay forma de pedirle que abra
    // directamente Configuración, así que ahí se entra al dashboard general
    // (el texto de arriba ya dice dónde encontrar la Suscripción). Por
    // /admin/{id}/... sí se puede pedir la vista exacta.
    if (subdominio && sesionViajaASubdominios()) {
      window.location.href = tenantUrl(subdominio, '/panel')
      return
    }
    window.location.href = businessId
      ? `/admin/${businessId}/ventas/configuracion?vista=suscripcion`
      : '/admin'
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-surface)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'inherit',
    }}>
      <style>{`
        @keyframes paSpin  { to { transform: rotate(360deg) } }
        @keyframes paScale { from { opacity:0;transform:scale(0.5) } to { opacity:1;transform:scale(1) } }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 440, padding: 36,
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 16, textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        {estado === 'verificando' && (
          <>
            <div style={{
              width: 56, height: 56, margin: '0 auto 20px', borderRadius: '50%',
              border: '3px solid rgba(0,158,227,0.15)', borderTopColor: '#009EE3',
              animation: 'paSpin 0.85s linear infinite',
            }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
              Verificando tu plan
            </h1>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
              Estamos confirmando la activación con MercadoPago. No cierres esta ventana.
            </p>
          </>
        )}

        {estado === 'ok' && (
          <>
            <div style={{
              width: 72, height: 72, margin: '0 auto 20px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(16,185,129,0.35)',
              animation: 'paScale 0.55s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <Check size={36} color="white" strokeWidth={2.5} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 8px' }}>
              ¡Tu plan está activo!
            </h1>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 28px', lineHeight: 1.5 }}>
              El débito automático quedó configurado. Podés verlo desde Configuración → Suscripción.
            </p>
            <button
              onClick={irAlPanel}
              className="ds-hover"
              style={{
                width: '100%', height: 50, borderRadius: 12, border: 'none',
                background: 'var(--color-primary)', color: 'white',
                fontSize: 15, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(37,99,235,0.30)',
              }}
            >
              Volver al panel
              <ArrowRight size={16} strokeWidth={2} />
            </button>
          </>
        )}

        {(estado === 'pendiente' || estado === 'error') && (
          <>
            <div style={{
              width: 64, height: 64, margin: '0 auto 20px', borderRadius: '50%',
              background: 'rgba(245,158,11,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={30} color="#D97706" strokeWidth={2} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
              {estado === 'pendiente' ? 'Activación pendiente' : 'No pudimos confirmar la activación'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 28px', lineHeight: 1.5 }}>
              {mensaje}
            </p>
            <button
              onClick={() => router.reload()}
              className="ds-hover"
              style={{
                width: '100%', height: 46, borderRadius: 10,
                border: '1.5px solid var(--color-border)', background: 'var(--color-bg)',
                color: 'var(--color-text)', fontSize: 14, fontWeight: 600,
              }}
            >
              Volver a verificar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
