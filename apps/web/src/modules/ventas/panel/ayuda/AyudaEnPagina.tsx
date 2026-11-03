// ─── "Ver tutorial" dentro de la página, para el celular ──────────────────────
//
// En el celular la barra de arriba no tiene lugar para un botón con texto, así que
// el botón vive en la propia pantalla: una fila arriba del contenido, a la altura de
// la primera tarjeta ("Información básica", la lista…). En la compu no se ve: ahí está
// el botón de la barra (AyudaBoton). Solo aparece en pantallas que tienen recorrido.

import { ChevronRight, HelpCircle } from 'lucide-react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/auth/AuthContext'
import { EVENTO_ABRIR_AYUDA } from './AyudaBoton'
import { claveDeAyuda, recorridoDe } from './recorridos'

export default function AyudaEnPagina() {
    const router = useRouter()
    const { user } = useAuth()
    if (user?.type !== 'member') return null

    const segmentos = router.asPath.split(/[?#]/)[0].split('/').filter(Boolean)
    const seccion = segmentos[segmentos.length - 1] ?? ''
    const vista = typeof router.query.vista === 'string' ? router.query.vista : undefined
    // Una pantalla de Orbi o del manual no la necesita; sin recorrido no hay botón.
    if (!recorridoDe(claveDeAyuda(seccion, vista))) return null

    return (
        <div className="ayu-enpagina">
            <style>{CSS_EN_PAGINA}</style>
            <button type="button" onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_AYUDA))}>
                <HelpCircle size={18} strokeWidth={1.7} aria-hidden="true" />
                <span>Ver tutorial</span>
                <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className="ayu-enpagina-flecha" />
            </button>
        </div>
    )
}

// Solo en pantallas angostas. Fila a todo el ancho de la página, con el mismo margen que las tarjetas.
const CSS_EN_PAGINA = `
.ayu-enpagina { display: none; padding: 12px 16px 0; }
@media (max-width: 639px) { .ayu-enpagina { display: block; } }
.ayu-enpagina button {
    width: 100%; min-height: 46px; padding: 0 14px; display: flex; align-items: center; gap: 10px;
    border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-bg); color: var(--color-text);
    font-family: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer; text-align: left;
    transition: background-color 150ms ease, border-color 150ms ease;
}
.ayu-enpagina button:hover { background: var(--color-surface-alt); border-color: var(--color-border-strong); }
.ayu-enpagina button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.ayu-enpagina button > svg:first-child { color: var(--color-primary); flex-shrink: 0; }
.ayu-enpagina button > span { flex: 1; }
.ayu-enpagina-flecha { color: var(--color-muted); flex-shrink: 0; }
`
