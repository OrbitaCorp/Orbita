// Lenguaje visual de Turnos: "tu día en órbita".
//
// Una sola hoja (prefijo tuo-) para todo el vertical: panel, onboarding, índice
// de la demo y landing. Sale de la identidad de Órbita —el planeta con su
// anillo y el satélite, el espacio profundo de la landing, Sora en los títulos
// y Geist Mono en horas y números— y pinta SIEMPRE con los tokens --color-* del
// design system, así el modo claro y el oscuro salen solos.
//
// Vive en un <style> y no en globals.css a propósito: es una demo local y no
// tiene que tocar nada de lo que usa Tienda.
export const CSS_TURNOS = `
  .tuo {
    --tuo-fh: 'Sora', 'Geist', system-ui, sans-serif;
    --tuo-mono: "Geist Mono", ui-monospace, monospace;
    --tuo-grad: linear-gradient(135deg, #2563EB 0%, #4F46E5 100%);
    --tuo-grad-suave: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 14%, transparent), color-mix(in srgb, #818CF8 10%, transparent));
    --tuo-anillo: color-mix(in srgb, var(--color-primary) 26%, transparent);
    --tuo-r: 16px;
    --tuo-r-sm: 10px;
    --tuo-ease: cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* ── Espacio: bloque siempre oscuro, en claro y en oscuro ─────────────────
     Redefine los tokens del design system con la paleta "espacio profundo",
     así lo que se monte adentro (chips, botones, texto) se pinta solo. */
  .tuo-espacio {
    --color-bg: #05080F; --color-surface: #0B101D; --color-surface-alt: #151D31;
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
    background:
      radial-gradient(900px 420px at 92% -20%, rgba(59,130,246,0.30), transparent 62%),
      radial-gradient(700px 380px at -6% 118%, rgba(99,102,241,0.24), transparent 60%),
      linear-gradient(180deg, #070C1A 0%, #05080F 100%);
  }

  /* ── Tipografía ────────────────────────────────────────────────────────── */
  .tuo-h1 { font-family: var(--tuo-fh); font-size: 28px; line-height: 1.15; font-weight: 700; letter-spacing: -0.03em; color: var(--color-text); margin: 0; text-wrap: balance; }
  .tuo-h2 { font-family: var(--tuo-fh); font-size: 16px; line-height: 1.3; font-weight: 600; letter-spacing: -0.015em; color: var(--color-text); margin: 0; }
  .tuo-bajada { font-size: 14px; line-height: 1.55; color: var(--color-muted); margin: 6px 0 0; max-width: 68ch; }
  .tuo-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-family: var(--tuo-mono); font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--chip-primary-fg); }
  .tuo-eyebrow::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent); flex-shrink: 0; }
  .tuo-num { font-family: var(--tuo-mono); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .tuo-rotulo { font-family: var(--tuo-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-muted); }

  /* ── Tarjetas ──────────────────────────────────────────────────────────── */
  .tuo-card { position: relative; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--tuo-r); box-shadow: var(--shadow-card); min-width: 0; }
  .tuo-card--pad { padding: 20px; }
  /* Filo de luz arriba: la misma idea de las tarjetas oscuras del panel. */
  .tuo-card--luz::before { content: ''; position: absolute; left: 18px; right: 18px; top: -1px; height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary) 60%, transparent), transparent); pointer-events: none; }
  .tuo-card--accion { transition: border-color 160ms ease, box-shadow 220ms ease, transform 220ms var(--tuo-ease); cursor: pointer; text-align: left; font-family: inherit; color: inherit; }
  @media (hover: hover) {
    .tuo-card--accion:hover { border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); box-shadow: var(--shadow-card-hover); transform: translateY(-2px); }
  }
  .tuo-card--accion:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuo-card--sel { border-color: var(--color-primary) !important; box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent) !important; }

  /* ── Botones ───────────────────────────────────────────────────────────── */
  .tuo-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 40px; padding: 0 16px; border-radius: var(--tuo-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-family: inherit; font-size: 13.5px; font-weight: 600; white-space: nowrap; cursor: pointer; text-decoration: none; transition: border-color 150ms ease, background 150ms ease, box-shadow 200ms ease, transform 150ms ease, filter 150ms ease; }
  .tuo-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuo-btn:active { transform: translateY(1px); }
  .tuo-btn:disabled, .tuo-btn[aria-disabled='true'] { opacity: 0.5; cursor: not-allowed; }
  @media (hover: hover) { .tuo-btn:not(:disabled):hover { border-color: var(--color-border-strong); background: var(--color-surface); } }
  .tuo-btn--primario { border-color: transparent; background: var(--tuo-grad); color: #fff; box-shadow: 0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 18px rgba(37,99,235,0.32); }
  @media (hover: hover) { .tuo-btn--primario:not(:disabled):hover { background: var(--tuo-grad); border-color: transparent; filter: brightness(1.1); box-shadow: 0 1px 0 rgba(255,255,255,0.22) inset, 0 10px 26px rgba(37,99,235,0.42); } }
  .tuo-btn--fantasma { border-color: transparent; background: transparent; color: var(--color-body); }
  .tuo-btn--peligro { color: var(--color-error); }
  .tuo-btn--sm { height: 34px; padding: 0 12px; font-size: 13px; border-radius: 8px; }
  .tuo-btn--lg { height: 48px; padding: 0 22px; font-size: 15px; border-radius: 12px; }
  .tuo-btn--icono { width: 40px; padding: 0; color: var(--color-body); }
  .tuo-btn--icono.tuo-btn--sm { width: 34px; }

  /* ── Segmentado ────────────────────────────────────────────────────────── */
  .tuo-seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 11px; background: var(--color-surface-alt); border: 1px solid var(--color-border); max-width: 100%; }
  .tuo-seg > button { height: 32px; padding: 0 14px; border-radius: 8px; border: none; background: transparent; color: var(--color-muted); font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease; }
  .tuo-seg > button[aria-pressed='true'], .tuo-seg > button[aria-checked='true'] { background: var(--color-bg); color: var(--color-text); font-weight: 600; box-shadow: 0 1px 3px rgba(15,23,42,0.16), 0 0 0 1px var(--color-border); }
  .tuo-seg > button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  @media (hover: hover) { .tuo-seg > button:not([aria-pressed='true']):not([aria-checked='true']):hover { color: var(--color-text); } }

  /* ── Chips ─────────────────────────────────────────────────────────────── */
  .tuo-chip { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; background: var(--color-surface-alt); color: var(--color-body); border: 1px solid transparent; }
  .tuo-chip--primario { background: var(--color-primary-bg); color: var(--chip-primary-fg); }
  .tuo-chip--ok { background: var(--color-success-bg); color: var(--chip-success-fg); }
  .tuo-chip--aviso { background: var(--color-warning-bg); color: var(--chip-warning-fg); }
  .tuo-chip--borde { background: transparent; border-color: var(--color-border); }
  .tuo-chip--hora { font-family: var(--tuo-mono); font-variant-numeric: tabular-nums; }
  button.tuo-chip { cursor: pointer; font-family: inherit; transition: border-color 140ms ease, background 140ms ease, transform 140ms ease; }
  button.tuo-chip.tuo-chip--hora { font-family: var(--tuo-mono); }
  button.tuo-chip:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { button.tuo-chip:hover { border-color: var(--color-primary); } }

  /* ── Campo de búsqueda ─────────────────────────────────────────────────── */
  .tuo-buscar { position: relative; display: block; width: 100%; max-width: 380px; }
  .tuo-buscar > svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--color-subtle); pointer-events: none; }
  .tuo-buscar > input { width: 100%; height: 40px; padding: 0 14px 0 38px; border-radius: var(--tuo-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-size: 14px; font-family: inherit; outline: none; transition: border-color 150ms ease, box-shadow 150ms ease; }
  .tuo-buscar > input::placeholder { color: var(--color-subtle); }
  .tuo-buscar > input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent); }

  /* ── Filas de lista ────────────────────────────────────────────────────── */
  .tuo-fila { transition: background 140ms ease; cursor: pointer; }
  @media (hover: hover) { .tuo-fila:hover { background: color-mix(in srgb, var(--color-primary) 5%, transparent); } }
  .tuo-fila:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }

  /* ── Llavecita ─────────────────────────────────────────────────────────── */
  .tuo-switch { position: relative; width: 42px; height: 24px; border-radius: 999px; border: none; padding: 0; flex-shrink: 0; cursor: pointer; background: var(--color-border-strong); transition: background 180ms ease, box-shadow 180ms ease; }
  .tuo-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(15,23,42,0.3); transition: transform 200ms var(--tuo-ease); }
  .tuo-switch[aria-checked='true'] { background: var(--tuo-grad); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent); }
  .tuo-switch[aria-checked='true']::after { transform: translateX(18px); }
  .tuo-switch:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuo-switch:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Modal (crear, editar, ver un detalle) ────────────────────────────────
     El estándar de Órbita (design-system/Modal): centrado sobre un velo, con
     cabecera, cuerpo que scrollea y pie de acciones a la derecha. Escape y un
     toque en el velo lo cierran. En celular es una hoja que sube desde abajo.
     El velo arranca debajo de la tira de la demo (--tuo-tope). */
  .tuo-modal-velo { position: fixed; inset: var(--tuo-tope, 0px) 0 0 0; z-index: 150; display: flex; align-items: safe center; justify-content: center; padding: 24px; overflow-y: auto; overscroll-behavior: contain; background: rgba(15,23,42,0.50); backdrop-filter: blur(2px); animation: tuoVelo 200ms ease; }
  .tuo-modal-velo[data-encima='true'] { z-index: 152; }
  .tuo-modal { width: 100%; max-width: var(--tuo-ancho, 520px); max-height: calc(100vh - var(--tuo-tope, 0px) - 48px); max-height: calc(100dvh - var(--tuo-tope, 0px) - 48px); display: flex; flex-direction: column; flex-shrink: 0; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: 0 24px 64px rgba(3,6,14,0.38); overflow: hidden; animation: tuoModal 220ms var(--tuo-ease); }
  .tuo-modal:focus { outline: none; }
  .tuo-modal-cab { display: flex; align-items: flex-start; gap: 14px; padding: 18px 16px 16px 20px; border-bottom: 1px solid var(--color-border); flex-shrink: 0; }
  .tuo-modal-titulo { font-family: var(--tuo-fh); font-size: 18px; line-height: 1.25; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); margin: 0; overflow-wrap: anywhere; }
  .tuo-modal-bajada { font-size: 13px; line-height: 1.5; color: var(--color-muted); margin: 4px 0 0; }
  .tuo-modal-form { display: flex; flex-direction: column; flex: 1; min-height: 0; margin: 0; }
  .tuo-modal-cuerpo { flex: 1; min-height: 0; overflow-y: auto; padding: 20px; overscroll-behavior: contain; }
  .tuo-modal-pie { display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; padding: 14px 20px; border-top: 1px solid var(--color-border); background: var(--color-surface); flex-shrink: 0; }
  .tuo-modal-pie > .tuo-btn { height: 42px; min-width: 108px; }
  /* Lo que va a la izquierda del pie (eliminar, un dato): empuja el resto a la derecha. */
  .tuo-modal-pie > .tuo-modal-izq { margin-right: auto; }
  @keyframes tuoVelo { from { opacity: 0 } to { opacity: 1 } }
  @keyframes tuoModal { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: none } }
  @keyframes tuoHoja { from { transform: translateY(48px); opacity: 0 } to { transform: none; opacity: 1 } }
  @media (max-width: 640px) {
    .tuo-modal-velo { align-items: flex-end; padding: 0; }
    .tuo-modal { max-width: none; max-height: calc(100vh - var(--tuo-tope, 0px) - 20px); max-height: calc(100dvh - var(--tuo-tope, 0px) - 20px); border-radius: 22px 22px 0 0; border-bottom: none; animation-name: tuoHoja; }
    .tuo-modal-pie { padding: 12px 16px 16px; }
    .tuo-modal-pie > .tuo-btn { flex: 1 1 140px; height: 46px; }
    .tuo-modal-pie > .tuo-modal-izq { flex: 1 1 100%; margin-right: 0; }
    .tuo-modal-cerrar { width: 44px !important; height: 44px !important; }
  }

  /* ── Movimiento ────────────────────────────────────────────────────────── */
  @keyframes tuoEntra { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
  @keyframes tuoGira { to { transform: rotate(360deg) } }
  @keyframes tuoLate { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.55; transform: scale(1.35) } }
  @keyframes tuoOnda { 0% { transform: scale(0.6); opacity: 0.7 } 100% { transform: scale(2.4); opacity: 0 } }
  @keyframes tuoTitila { 0%, 100% { opacity: var(--o, 0.6) } 50% { opacity: 0.15 } }
  @keyframes tuoTraza { from { stroke-dashoffset: var(--largo, 400) } to { stroke-dashoffset: 0 } }
  .tuo-entra { animation: tuoEntra 520ms var(--tuo-ease) both; animation-delay: calc(var(--i, 0) * 60ms); }
  .tuo-late { animation: tuoLate 1.8s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }

  @media (prefers-reduced-motion: reduce) {
    .tuo-entra, .tuo-late, .tuo-modal, .tuo-modal-velo, .tuo-gira, .tuo-estrella { animation: none !important; }
    .tuo-card--accion, .tuo-card--accion:hover, .tuo-btn, .tuo-btn:active { transition: none; transform: none; }
    .tuo-switch::after { transition: none; }
  }

  @media (max-width: 480px) {
    .tuo-h1 { font-size: 23px; }
    .tuo-card--pad { padding: 16px; }
  }
`

export function EstiloTurnos() {
  return <style>{CSS_TURNOS}</style>
}
