// Contexto compartido para el modo de la barra lateral.
//
// Tres modos, misma idea que Supabase / VS Code:
//   • expanded  — ancho completo con etiquetas, buscador y selector
//   • collapsed — riel de íconos fijo
//   • hover     — riel de íconos que se expande como overlay al pasar el mouse
//
// El valor se persiste en localStorage para que sobreviva recarga
// y se lee después de montar (SSR arranca en 'hover' para evitar
// mismatch de hidratación — mismo criterio que los anteriores
// toggles de colapsar).

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type SidebarMode = 'expanded' | 'collapsed' | 'hover'

const STORAGE_KEY = 'orbita-sidebar-mode'

interface SidebarModeValue {
    mode: SidebarMode
    setMode: (m: SidebarMode) => void
}

const SidebarModeContext = createContext<SidebarModeValue>({
    mode: 'hover',
    setMode: () => {},
})

export function SidebarModeProvider({ children }: { children: ReactNode }) {
    const [mode, setModeState] = useState<SidebarMode>('hover')

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY) as SidebarMode | null
            if (saved && ['expanded', 'collapsed', 'hover'].includes(saved)) {
                setModeState(saved)
            }
        } catch { /* sin localStorage: arranca en hover */ }
    }, [])

    const setMode = (m: SidebarMode) => {
        setModeState(m)
        try { localStorage.setItem(STORAGE_KEY, m) } catch { /* no persiste, sigue andando en memoria */ }
    }

    return (
        <SidebarModeContext.Provider value={{ mode, setMode }}>
            {children}
        </SidebarModeContext.Provider>
    )
}

export function useSidebarMode() {
    return useContext(SidebarModeContext)
}
