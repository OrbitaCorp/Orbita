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
        <>
            <style>{CSS_BOTON}</style>
            <button
                type="button"
                onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_AYUDA))}
                aria-label="Ver el tutorial de esta pantalla"
                title="Tutorial de esta pantalla"
                className="admin-ayuda-btn ds-hover"
            >
                <HelpCircle size={16} strokeWidth={1.6} aria-hidden="true" />
                <span className="admin-ayuda-label">Ver tutorial</span>
            </button>
        </>
    )
}

// Con texto en pantallas anchas. En el celular no va en la barra: ahí está "Ver tutorial" dentro de la página (AyudaEnPagina).
const CSS_BOTON = `
.admin-ayuda-btn {
    flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    height: 36px; padding: 0 12px; border-radius: 8px; cursor: pointer; font-family: inherit;
    font-size: 13px; font-weight: 600; white-space: nowrap;
    background: transparent; border: 1px solid var(--color-border); color: var(--color-text);
}
.admin-ayuda-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
@media (max-width: 639px) {
    .admin-ayuda-btn { display: none; }
}
`
