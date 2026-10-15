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
    /* Tarjetas: en escritorio siempre abiertas; en el celular se pliegan y el
       título pasa a ser un botón (ver SecCard en Controles.tsx). */
    .ap-barra-movil { display: none; }
    .ap-solo-movil { display: none; }
    .ap-sec-toggle { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px; padding: 0; background: none; border: none; font: inherit; color: inherit; text-align: left; cursor: pointer; }
    .ap-sec-toggle:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 8px; }
    .ap-sec-chevron { transition: transform 160ms ease; }
    .ap-sec-card[data-abierta="true"] .ap-sec-chevron { transform: rotate(180deg); }
    .ap-barra-descartar { height: 36px; padding: 0 4px; background: none; border: none; font: inherit; font-size: 13px; font-weight: 500; color: var(--color-muted); text-decoration: underline; cursor: pointer; }
    .ap-barra-descartar:disabled { opacity: 0.5; cursor: not-allowed; }
    @media (prefers-reduced-motion: reduce) { .ap-sec-chevron { transition: none; } }
    /* Mobile: la vista previa en vivo no entra al lado (ni siquiera apilada,
       a 70vh, deja lugar para el editor) — se saca del todo. En su lugar hay
       una barra fija abajo con "Ver mi tienda", que la abre a pantalla
       completa (VistaPreviaCompleta con movil), en la parte que se estaba
       editando. Las tarjetas se pliegan para no hacer scroll infinito. */
    @media (max-width: 768px) {
        .ap-page { padding: 16px 14px 168px !important; }
        .ap-preview { display: none !important; }
        .ap-split { gap: 16px; }
        .ap-save-header { display: none !important; }
        .ap-solo-escritorio { display: none !important; }
        .ap-solo-movil { display: inline; }
        .ap-barra-movil { display: flex; flex-direction: column; gap: 8px; position: fixed; left: 0; right: 0; bottom: 0; z-index: 80; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); background: var(--color-bg); border-top: 1px solid var(--color-border); }
        .ap-controles { gap: 10px !important; }
        .ap-sec-card { padding: 0 !important; }
        .ap-sec-head { padding: 0 16px; min-height: 56px; }
        .ap-sec-card[data-abierta="true"] .ap-sec-head { margin-bottom: 4px !important; }
        .ap-sec-body { padding: 0 16px 18px; }
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
