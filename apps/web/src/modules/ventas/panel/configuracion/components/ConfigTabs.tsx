// Tipo de las sub-vistas del módulo de configuración.
//
// Hasta acá este archivo también tenía el componente <ConfigTabs> — una barra
// de tabs (General | Apariencia | Equipo | Notificaciones) que se mostraba
// arriba de cada pantalla. Se sacó por redundante: el sidebar ya tiene esos
// mismos 4 sub-ítems bajo "Configuración" (ver layouts/components/Sidebar.tsx),
// con exactamente la misma navegación (mismo `vista` en la URL) — tener las
// dos a la vez era duplicar la misma función dos veces en la pantalla.

export type VistaConfig = 'general' | 'apariencia' | 'equipo' | 'notificaciones'
