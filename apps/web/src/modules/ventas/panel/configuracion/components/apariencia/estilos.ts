// El CSS de la pantalla de Apariencia: lo que no se puede expresar con
// estilos en línea (media queries, la animación de la barra de guardado).

export const ESTILOS_APARIENCIA = `
    .ap-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 28px; align-items: start; }
    .ap-preview { position: sticky; top: 24px; }
    @media (max-width: 1100px) {
        .ap-split { grid-template-columns: minmax(0,1fr); }
        .ap-preview { position: static; }
        .ap-preview > div { height: 70vh !important; }
    }
    /* Editando la plantilla activa (soloContenido) no usa
       .ap-split — es un formulario de una sola columna con
       pestañas (ver TABS_PLANTILLA), sin vista previa al lado. */
    .ap-tabs-plantilla { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--color-border); overflow-x: auto; }
    .ap-tab-plantilla { padding: 12px 4px; min-height: 44px; margin-right: 20px; border: none; background: transparent; cursor: pointer; font-family: inherit; font-size: 13.5px; margin-bottom: -1px; white-space: nowrap; border-bottom: 2px solid transparent; transition: color 150ms, border-color 150ms; }
    /* Mobile: la vista previa en vivo no entra al lado (ni
       siquiera apilada, a 70vh, deja lugar para el editor) — se
       saca del todo. Sigue disponible con el botón "Vista
       previa" de arriba (abre el modal a pantalla completa,
       fullPreview), no se pierde la función, solo el inline. */
    @media (max-width: 768px) {
        .ap-page { padding: 16px 14px 96px !important; }
        .ap-preview { display: none !important; }
        .ap-split { gap: 16px; }
        .ap-save-header { display: none !important; }
        .ap-sec-card { padding: 16px !important; }
        /* El valor de la estadistica son 2-3 caracteres ("+500"):
           100px de ancho fijo le robaban lugar a la etiqueta. */
        .ap-stat-val { width: 76px !important; }
    }
    /* "¿Qué ven tus clientes?": 2 columnas le queda bien a la
       preview de escritorio, pero en mobile deja ~120px por
       columna — labels como "Redes sociales en el footer" no
       entran ahí sin romperse. A 1 columna. */
    @media (max-width: 640px) {
        .ap-toggle-grid { grid-template-columns: minmax(0,1fr) !important; }
    }
    @keyframes apStickyBarIn {
        from { opacity: 0; transform: translate(-50%, 10px); }
        to   { opacity: 1; transform: translate(-50%, 0); }
    }
`
