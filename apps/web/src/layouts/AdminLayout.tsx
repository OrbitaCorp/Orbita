import { useState } from 'react'
import { ReactNode } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { OrbiPanel } from '@/components/orbi/OrbiPanel'
import { useOrbiKeyboardShortcut } from '@/components/orbi/useOrbiKeyboardShortcut'
import TutorialHost from '@/modules/ventas/panel/tutoriales/TutorialHost'

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
            <AdminShell>{children}</AdminShell>
        </RequireAuth>
    )
}

function AdminShell({ children }: { children: ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    useOrbiKeyboardShortcut()

    return (
        <div className="flex h-screen overflow-hidden">
            <style>{`
                @media (min-width: 769px) {
                    .admin-backdrop { display: none !important; }
                }
            `}</style>

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

            <div className="flex flex-col flex-1 overflow-hidden">
                <Header onMenuClick={() => setSidebarOpen(o => !o)} />
                {/* El fondo vive en .admin-main (globals.css): en claro es el
                    surface plano de siempre; en oscuro suma un resplandor
                    ambiental sutil de marca — ver "Modo oscuro premium". */}
                <main className="admin-main flex-1 overflow-auto">
                    {children}
                </main>
            </div>

            <OrbiPanel />

            {/* Tutorial de primeros pasos: arranca solo para todo negocio que
                nunca lo tocó y vive en la base (businesses.tutorial) hasta que
                se termina o se oculta (ver modules/ventas/panel/tutoriales/estado.ts). */}
            <TutorialHost />
        </div>
    )
}
