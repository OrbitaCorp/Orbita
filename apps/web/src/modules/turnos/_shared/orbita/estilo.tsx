// Lenguaje visual del índice de la demo y del dial de Turnos (prefijo tuo-).
//
// El panel ya no lo usa: pinta con el kit de reservas (design-system/reservas),
// que es el estándar del panel de Tienda. Acá queda solo lo que siguen usando
// el índice de /turnos-demo, la landing y el paso de la reserva pública: el
// bloque "espacio" oscuro, los títulos, los botones, las tarjetas y el
// buscador. Pinta SIEMPRE con los tokens --color-* del design system, así el
// modo claro y el oscuro salen solos.
//
// Vive en un <style> y no en globals.css a propósito: es una demo local y no
// tiene que tocar nada de lo que usa Tienda.
export const CSS_TURNOS = `
  .tuo {
    --tuo-fh: 'Geist', 'Inter', system-ui, -apple-system, sans-serif;
    --tuo-mono: "Geist Mono", ui-monospace, monospace;
    --tuo-r: 14px;
    --tuo-r-sm: 10px;
    --tuo-ease: cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* ── Espacio: bloque siempre oscuro, en claro y en oscuro ─────────────────
     Redefine los tokens del design system con la paleta oscura, así lo que se
     monte adentro (chips, botones, texto) se pinta solo. Fondo plano. */
  .tuo-espacio {
    --color-bg: #070B14; --color-surface: #0D1322; --color-surface-alt: #161E31;
    --color-border: rgba(147,197,253,0.14); --color-border-strong: rgba(147,197,253,0.30);
    --color-text: #F1F5FD; --color-body: #B6C2DA; --color-muted: #8794B2; --color-subtle: #5E6A86;
    --color-primary: #60A5FA; --color-primary-h: #93C5FD; --color-primary-bg: rgba(96,165,250,0.14);
    --color-on-primary: #05080F; --chip-primary-fg: #93C5FD;
    --color-success: #34D399; --color-success-bg: rgba(52,211,153,0.14); --chip-success-fg: #34D399;
    --color-warning: #FBBF24; --color-warning-bg: rgba(251,191,36,0.14); --chip-warning-fg: #FBBF24;
    --color-error: #F87171; --color-error-bg: rgba(248,113,113,0.12); --chip-error-fg: #F87171;
    --hover-layer: 0.09; --active-layer: 0.15;
    position: relative; isolation: isolate; overflow: hidden;
    color: var(--color-body);
    background: #070B14;
  }

  /* ── Tipografía ────────────────────────────────────────────────────────── */
  .tuo-h2 { font-family: var(--tuo-fh); font-size: 16px; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text); margin: 0; }
  .tuo-bajada { font-size: 14px; line-height: 1.55; color: var(--color-muted); margin: 6px 0 0; max-width: 68ch; }
  .tuo-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-family: var(--tuo-mono); font-size: 11px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: var(--chip-primary-fg); }
  .tuo-eyebrow::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary); flex-shrink: 0; }
  .tuo-num { font-family: var(--tuo-mono); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .tuo-rotulo { font-family: var(--tuo-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-muted); }

  /* ── Tarjetas: borde, sin sombra ───────────────────────────────────────── */
  .tuo-card { position: relative; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--tuo-r); min-width: 0; }
  .tuo-card--accion { transition: border-color 160ms ease; cursor: pointer; text-align: left; font-family: inherit; color: inherit; }
  @media (hover: hover) {
    .tuo-card--accion:hover { border-color: var(--color-border-strong); }
  }
  .tuo-card--accion:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuo-card--sel { border-color: var(--color-primary) !important; box-shadow: 0 0 0 1px var(--color-primary) !important; }

  /* ── Botones ───────────────────────────────────────────────────────────── */
  .tuo-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 40px; padding: 0 16px; border-radius: var(--tuo-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-family: inherit; font-size: 13.5px; font-weight: 600; white-space: nowrap; cursor: pointer; text-decoration: none; transition: border-color 150ms ease, background 150ms ease; }
  .tuo-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuo-btn:disabled, .tuo-btn[aria-disabled='true'] { opacity: 0.5; cursor: not-allowed; }
  @media (hover: hover) { .tuo-btn:not(:disabled):hover { border-color: var(--color-border-strong); background: var(--color-surface); } }
  .tuo-btn--primario { border-color: transparent; background: var(--color-primary); color: var(--color-on-primary); }
  @media (hover: hover) { .tuo-btn--primario:not(:disabled):hover { background: var(--color-primary-h); border-color: transparent; } }
  .tuo-btn--sm { height: 34px; padding: 0 12px; font-size: 13px; border-radius: 8px; }
  .tuo-btn--lg { height: 48px; padding: 0 22px; font-size: 15px; border-radius: 12px; }

  /* ── Segmentado ────────────────────────────────────────────────────────── */
  .tuo-seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 11px; background: var(--color-surface-alt); border: 1px solid var(--color-border); max-width: 100%; }
  .tuo-seg > button { height: 32px; padding: 0 14px; border-radius: 8px; border: none; background: transparent; color: var(--color-muted); font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: background 160ms ease, color 160ms ease; }
  .tuo-seg > button[aria-pressed='true'], .tuo-seg > button[aria-checked='true'] { background: var(--color-bg); color: var(--color-text); font-weight: 600; box-shadow: 0 0 0 1px var(--color-border); }
  .tuo-seg > button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  @media (hover: hover) { .tuo-seg > button:not([aria-pressed='true']):not([aria-checked='true']):hover { color: var(--color-text); } }

  /* ── Chips ─────────────────────────────────────────────────────────────── */
  .tuo-chip { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; background: var(--color-surface-alt); color: var(--color-body); border: 1px solid transparent; }
  .tuo-chip--borde { background: transparent; border-color: var(--color-border); }

  /* ── Campo de búsqueda ─────────────────────────────────────────────────── */
  .tuo-buscar { position: relative; display: block; width: 100%; max-width: 380px; }
  .tuo-buscar > svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--color-subtle); pointer-events: none; }
  .tuo-buscar > input { width: 100%; height: 40px; padding: 0 14px 0 38px; border-radius: var(--tuo-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-size: 14px; font-family: inherit; outline: none; transition: border-color 150ms ease; }
  .tuo-buscar > input::placeholder { color: var(--color-subtle); }
  .tuo-buscar > input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }

  /* ── Movimiento: entradas cortas y nada que dure para siempre ──────────── */
  @keyframes tuoEntra { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
  @keyframes tuoTraza { from { stroke-dashoffset: var(--largo, 400) } to { stroke-dashoffset: 0 } }
  .tuo-entra { animation: tuoEntra 360ms var(--tuo-ease) both; animation-delay: calc(var(--i, 0) * 40ms); }

  @media (prefers-reduced-motion: reduce) {
    .tuo-entra { animation: none !important; }
    .tuo-card--accion, .tuo-btn { transition: none; }
  }
`

export function EstiloTurnos() {
  return <style>{CSS_TURNOS}</style>
}
