import { useEffect, useState } from 'react'
import { ReactNode } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import SubscriptionStatusBanner from './components/SubscriptionStatusBanner'
import EmailVerificationBanner from './components/EmailVerificationBanner'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { OrbiPanel } from '@/components/orbi/OrbiPanel'
import { OrbiWelcomeSeeder } from '@/components/orbi/OrbiWelcomeSeeder'
import { useOrbiKeyboardShortcut } from '@/components/orbi/useOrbiKeyboardShortcut'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'
import TutorialHost from '@/modules/ventas/panel/tutoriales/TutorialHost'
import { SidebarModeProvider } from './SidebarModeContext'
import { EscenaEspacial } from '@/modules/landing/components/v2/EscenaEspacial'

// Todo el panel exige sesión de dueño (member). El guard va acá, en el layout,
// y no en cada page: así ninguna pantalla del panel se monta —ni dispara sus
// queries— antes de que la sesión esté resuelta.
//
// Antes las pages se montaban de entrada y pedían datos sin token todavía en
// memoria, lo que provocaba dos refresh simultáneos (el del AuthProvider y el
// del 401 de esa query) sobre un refresh token de un solo uso: el segundo lo
// encontraba consumido y la sesión moría. Ver el comentario de `tryRefresh()`
// en lib/auth/authClient.ts.
//
// Efecto secundario buscado: si la sesión venció de verdad, RequireAuth
// redirige al login en vez de dejar el panel a medio dibujar con un
// "Token requerido" colgado en el medio.
export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <RequireAuth type="member">
            <SidebarModeProvider>
                <AdminShell>{children}</AdminShell>
            </SidebarModeProvider>
        </RequireAuth>
    )
}

function AdminShell({ children }: { children: ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    useOrbiKeyboardShortcut()

    // Bloquea el scroll del body/html mientras se esté en el panel admin.
    // Esto elimina el doble scroll en Y (ventana vs .admin-main) y evita
    // que el Navbar suba o baile cuando el usuario arrastra la pantalla en celular.
    // Al desmontarse (ir al storefront o landing), se desbloquea para no afectar
    // el scroll nativo de la tienda.
    useEffect(() => {
        window.scrollTo(0, 0)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
        document.documentElement.classList.add('admin-locked')
        document.body.classList.add('admin-locked')
        return () => {
            document.documentElement.classList.remove('admin-locked')
            document.body.classList.remove('admin-locked')
        }
    }, [])

    // Salir del panel (a la tienda, al login, a la landing) desmonta Orbi pero
    // la navegación de Next no cierra la conexión del stream: sin cortarla, la
    // API sigue gastando modelo en una respuesta que nadie va a ver. Entre
    // secciones del panel no se desmonta (es una sola ruta catch-all).
    useEffect(() => () => useOrbiStore.getState().abortar(), [])

    return (
        <div
            className="flex overflow-hidden admin-shell"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                height: '100dvh',
                maxHeight: '100dvh',
                width: '100%',
                maxWidth: '100vw',
            }}
        >
            <style>{`
                @media (min-width: 769px) {
                    .admin-backdrop { display: none !important; }
                }
                /* El cielo del alta, detrás del contenido. Solo en oscuro: en
                   claro el panel sigue con su fondo plano de siempre. */
                .admin-cielo { display: none; position: absolute; inset: 0; z-index: -1; pointer-events: none; background: #05080F; }
                .dark .admin-cielo { display: block; }
                .dark .admin-main { background: transparent !important; }
            `}</style>

            <div className="admin-cielo" aria-hidden>
                <EscenaEspacial planeta={false} />
            </div>

            {/* Overlay mobile */}
            <div
                className="admin-backdrop"
                onClick={() => setSidebarOpen(false)}
                style={{
                    display: sidebarOpen ? 'block' : 'none',
                    position: 'fixed', inset: 0, zIndex: 40,
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(2px)',
                    WebkitBackdropFilter: 'blur(2px)',
                }}
            />

            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex flex-col flex-1 overflow-hidden" style={{ minWidth: 0, height: '100%' }}>
                <Header onMenuClick={() => setSidebarOpen(o => !o)} />
                <SubscriptionStatusBanner />
                <EmailVerificationBanner />
                {/* El fondo vive en .admin-main (globals.css): en claro es el
                    surface plano de siempre; en oscuro suma un resplandor
                    ambiental sutil de marca — ver "Modo oscuro premium". */}
                <main
                    className="admin-main flex-1 overflow-auto"
                    style={{
                        overscrollBehaviorY: 'contain',
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    {children}
                </main>
            </div>

            <OrbiPanel />
            <OrbiWelcomeSeeder />

            {/* Tutorial de primeros pasos: arranca solo para todo negocio que
                nunca lo tocó y vive en la base (businesses.tutorial) hasta que
                se termina o se oculta (ver modules/ventas/panel/tutoriales/estado.ts). */}
            <TutorialHost />
        </div>
    )
}
