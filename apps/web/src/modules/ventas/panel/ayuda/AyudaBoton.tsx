// ─── Botón "?" de la barra de arriba: el tutorial de esta pantalla, siempre ───
//
// El aviso "¿Querés ver cómo funciona…?" aparece una sola vez por módulo en cada
// dispositivo. Este botón es la forma de volver a verlo cuando quieras: aparece
// solo en pantallas que tienen recorrido y le avisa al AyudaHost (montado en
// AdminLayout) que lo abra.

import { HelpCircle } from 'lucide-react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth/AuthContext'
import { claveDeAyuda, recorridoDe } from './recorridos'

export const EVENTO_ABRIR_AYUDA = 'orbita:abrir-ayuda'

export default function AyudaBoton() {
    const router = useRouter()
    const { user } = useAuth()
    if (user?.type !== 'member') return null

    const segmentos = router.asPath.split(/[?#]/)[0].split('/').filter(Boolean)
    const seccion = segmentos[segmentos.length - 1] ?? ''
    const vista = typeof router.query.vista === 'string' ? router.query.vista : undefined
    if (!recorridoDe(claveDeAyuda(seccion, vista))) return null

    return (
        <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_AYUDA))}
            aria-label="Ver el tutorial de esta pantalla"
            title="Tutorial de esta pantalla"
            className="admin-ayuda-btn ds-hover grid place-items-center rounded-lg"
            style={{ width: 36, height: 36, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-body)', flexShrink: 0, cursor: 'pointer' }}
        >
            <HelpCircle size={17} strokeWidth={1.5} />
        </button>
    )
}
