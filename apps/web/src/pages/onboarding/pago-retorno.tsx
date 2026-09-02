import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { Check, AlertTriangle, ArrowRight } from 'lucide-react'
import { tenantUrl, sesionViajaASubdominios } from '@/lib/tenant'
import { conTutorialInicial } from '@/modules/ventas/panel/tutoriales/estado'

// Pantalla a la que MercadoPago devuelve al dueño después de autorizar (o no)
// el débito automático de la suscripción.
//
// La URL trae un preapproval_id, pero NO se toma como prueba de pago: se manda
// al BFF /api/onboarding/confirm-payment, que llama al backend server-a-server
// — el backend le pregunta a MP el estado real y, recién si es "authorized",
// crea la cuenta (Business+Member) y publica el negocio (ver
// SubscriptionsService.confirmAndCreate). Pasa por un BFF (no por lib/api.ts
// directo) porque en este punto todavía no existe ninguna sesión: el backend
// devuelve un refreshToken nuevo que solo un server puede convertir en cookie
// httpOnly — el mismo patrón que /api/auth/google/exchange.

type Estado = 'verificando' | 'ok' | 'pendiente' | 'error'

export default function PagoRetornoPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('verificando')
  const [mensaje, setMensaje] = useState('')
  const [subdominio, setSubdominio] = useState('')
  const [gratis, setGratis] = useState(false)
  const [businessId, setBusinessId] = useState('')
  // La confirmación borra el PendingSignup al consumirlo — un segundo llamado
  // con el mismo preapprovalId ya no encuentra nada que confirmar y devuelve
  // "no activado", que se vería como que el pago "no se confirma nunca". Este
  // guard evita disparar el fetch dos veces para el mismo id (p. ej. si
  // router.query cambia de referencia entre renders sin cambiar de valor).
  const confirmado = useRef<string | null>(null)

  useEffect(() => {
    if (!router.isReady) return

    // MP no es consistente con el nombre del parámetro según el flujo.
    const q = router.query
    const preapprovalId =
      (q.preapproval_id as string) ?? (q.preapprovalId as string) ?? (q.id as string) ?? ''

    if (!preapprovalId) {
      setEstado('error')
      setMensaje('No recibimos la confirmación de MercadoPago. Si ya pagaste, escribinos y lo activamos a mano.')
      return
    }
    if (confirmado.current === preapprovalId) return
    confirmado.current = preapprovalId

    ;(async () => {
      try {
        const res = await fetch('/api/onboarding/confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preapprovalId }),
        })
        const data = (await res.json().catch(() => null)) as
          | { activated: boolean; subdomain?: string; businessId?: string; status?: string; free?: boolean }
          | { error: string; message?: string }
          | null

        if (!res.ok || !data) {
          setEstado('error')
          setMensaje('No pudimos verificar el pago.')
          return
        }
        if ('error' in data) {
          setEstado('error')
          setMensaje(data.message ?? 'No pudimos verificar el pago.')
          return
        }
        if (data.activated) {
          setSubdominio(data.subdomain ?? '')
          setBusinessId(data.businessId ?? '')
          // Un alta con código del 100% no configura ningún débito: contarlo
          // como si lo hubiera hecho confunde y suena a que va a llegar un cobro.
          setGratis(!!data.free)
          setEstado('ok')
        } else {
          // MP puede tardar en pasar de "pending" a "authorized".
          setEstado('pendiente')
          setMensaje(`MercadoPago todavía no confirmó la suscripción (estado: ${data.status}).`)
        }
      } catch {
        setEstado('error')
        setMensaje('No pudimos verificar el pago.')
      }
    })()
  }, [router.isReady, router.query])

  function irAlPanel() {
    // El panel vive en el subdominio de la tienda, pero solo se puede entrar
    // ahi si la sesion recien creada viaja hasta ese host. Donde no viaja (dev
    // con ROOT_DOMAIN=localhost) se usa la ruta legacy por id, en el mismo
    // host: mandarlo al subdominio ahi terminaba en la pantalla de login,
    // justo despues de haberse registrado.
    // Cuenta recién creada: el panel arranca con el tutorial de primeros
    // pasos (ver modules/ventas/panel/tutoriales/estado.ts).
    if (subdominio && sesionViajaASubdominios()) {
      window.location.href = conTutorialInicial(tenantUrl(subdominio, '/panel'))
      return
    }
    window.location.href = conTutorialInicial(businessId ? `/admin/${businessId}/ventas/dashboard` : '/admin')
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-surface)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'inherit',
    }}>
      <style>{`
        @keyframes prSpin  { to { transform: rotate(360deg) } }
        @keyframes prScale { from { opacity:0;transform:scale(0.5) } to { opacity:1;transform:scale(1) } }
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
              animation: 'prSpin 0.85s linear infinite',
            }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
              Verificando tu pago
            </h1>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
              Estamos confirmando la suscripción con MercadoPago. No cierres esta ventana.
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
              animation: 'prScale 0.55s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <Check size={36} color="white" strokeWidth={2.5} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 8px' }}>
              {gratis ? '¡Tu espacio está listo!' : '¡Suscripción activa!'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 28px', lineHeight: 1.5 }}>
              {gratis
                ? 'Ya está publicado. Con tu código no se cobra nada, así que no hay ningún débito agendado.'
                : 'Tu espacio ya está publicado y el débito automático quedó configurado.'}
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
              Continuar al panel
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
              {estado === 'pendiente' ? 'Pago pendiente' : 'No pudimos confirmar el pago'}
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
