// Tipo de las sub-vistas del módulo de configuración.
//
// Hasta acá este archivo también tenía el componente <ConfigTabs> — una barra
// de tabs (General | Apariencia | Equipo | Notificaciones) que se mostraba
// arriba de cada pantalla. Se sacó por redundante: el sidebar ya tiene esos
// mismos 4 sub-ítems bajo "Configuración" (ver layouts/components/Sidebar.tsx),
// con exactamente la misma navegación (mismo `vista` en la URL) — tener las
// dos a la vez era duplicar la misma función dos veces en la pantalla.
//
// (2026-08-20) "General" dejó de ser una sola pantalla con 6 tarjetas apiladas
// de a dos columnas — ahora cada tarjeta es su propia sub-vista independiente,
// navegable desde el menú guía de ConfigSidebar.tsx (mismo patrón que
// Apariencia/Equipo/Notificaciones, que ya vivían aparte). `general` se
// mantiene en el tipo solo por compatibilidad de URLs viejas sin `?vista=`
// (ver ConfigGeneral.tsx: sin vista, cae a 'negocio').

export type VistaConfig =
    | 'general' | 'negocio' | 'contacto' | 'pagos' | 'envios' | 'redes' | 'postventa' | 'peligro'
    | 'apariencia' | 'equipo' | 'notificaciones' | 'suscripcion' | 'dominios'
