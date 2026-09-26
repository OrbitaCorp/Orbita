// src/layouts/components/EmailVerificationBanner.tsx
//
// Banner persistente tipo "cartelera" arriba del panel para recordar al dueño
// que debe verificar su correo desde "Mi perfil" antes de que venza el plazo.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Mail, AlertTriangle } from 'lucide-react'
import { panelEstadoVerificacionEmail, type EstadoVerificacionEmail } from '@/lib/api'
import { useAuth } from '@/lib/auth/AuthContext'
import { adminPath, currentSlug } from '@/lib/tenant'

export default function EmailVerificationBanner() {
    const router = useRouter()
    const { user } = useAuth()
    const [estado, setEstado] = useState<EstadoVerificacionEmail | null>(null)

    useEffect(() => {
        if (user?.type !== 'member') return

        let cancelado = false
        const cargar = () => {
            panelEstadoVerificacionEmail()
                .then(e => { if (!cancelado) setEstado(e) })
                .catch(() => { /* silencioso: si la API no responde, el panel sigue andando */ })
        }

        cargar()
        const timer = setInterval(cargar, 30_000)
        window.addEventListener('focus', cargar)

        return () => {
            cancelado = true
            clearInterval(timer)
            window.removeEventListener('focus', cargar)
        }
    }, [user?.type])

    if (user?.type !== 'member') return null
    if (!estado || estado.emailVerified) return null

    // No mostrar el banner si ya está dentro de "Mi perfil" (allí ya se encuentra el formulario de verificación)
    const enMiPerfil = router.pathname.endsWith('/ventas/perfil') || router.query.vista === 'perfil'
    if (enMiPerfil) return null

    const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? user.business.id
    const urlPerfil = adminPath(negocioId, 'ventas', 'perfil')

    const dias = estado.diasRestantes
    const vencido = dias !== null && dias < 0

    const mensaje = vencido
        ? `Tu plazo de verificación de correo finalizó hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}. Confirmalo para mantener tu cuenta protegida.`
        : dias !== null
            ? `Tenés pendiente confirmar tu correo (${estado.email}). Te quedan ${dias} ${dias === 1 ? 'día' : 'días'} de plazo para asegurar tu cuenta.`
            : `Tenés pendiente confirmar tu correo electrónico (${estado.email}).`

    const colorAcento = vencido ? 'var(--color-error)' : '#d97706'
    const fondoAcento = vencido ? 'var(--color-error-bg)' : 'rgba(245, 158, 11, 0.12)'
    const bordeAcento = vencido ? 'var(--color-error)' : 'rgba(245, 158, 11, 0.35)'

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => router.push(urlPerfil)}
            onKeyDown={e => { if (e.key === 'Enter') router.push(urlPerfil) }}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                padding: '9px 18px',
                cursor: 'pointer',
                background: fondoAcento,
                borderBottom: `1px solid ${bordeAcento}`,
                fontSize: 12.5,
                transition: 'background 0.15s ease',
            }}
        >
            {vencido ? (
                <AlertTriangle size={15} strokeWidth={2} color={colorAcento} style={{ flexShrink: 0 }} />
            ) : (
                <Mail size={15} strokeWidth={2} color={colorAcento} style={{ flexShrink: 0 }} />
            )}
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                <strong>Confirmá tu email:</strong> {mensaje}
            </span>
            <span style={{ marginLeft: 'auto', fontWeight: 700, color: colorAcento, whiteSpace: 'nowrap' }}>
                Verificar en Mi perfil →
            </span>
        </div>
    )
}
