// Estilos de la sección de Turnos de la landing (prefijo tul-). Pinta con la
// paleta --oc-* de PaginaV2 para combinar con el resto de orbita.site; lo único
// que usa los tokens --color-* es el mockup, que va adentro de un .tuo-espacio
// porque el dial (OrbitaDia) está hecho con esos tokens.
//
// Las entradas por scroll son CSS puro (animation-timeline: view()). A
// propósito NO se usa el Reveal de la landing: arranca en opacity 0 y depende
// de un IntersectionObserver, y si la página hidrata en una pestaña en segundo
// plano el contenido queda invisible. Acá, sin soporte o sin JS, todo se ve.
export const CSS_LANDING_TURNOS = `
  .tul { --tul-fh: 'Sora', 'Geist', system-ui, sans-serif; --tul-mono: "Geist Mono", ui-monospace, monospace; --tul-ease: cubic-bezier(0.22, 1, 0.36, 1); color: var(--oc-text-3); }

  @keyframes tulSube { from { opacity: 0; transform: translateY(30px) } to { opacity: 1; transform: none } }
  @supports (animation-timeline: view()) {
    @media (prefers-reduced-motion: no-preference) {
      .tul-rev { animation: tulSube linear both; animation-timeline: view(); animation-range: entry 0% entry 42%; }
    }
  }

  /* ── Encabezado ── */
  .tul-cab { text-align: center; }
  .tul-ceja { display: inline-flex; align-items: center; flex-wrap: wrap; justify-content: center; gap: 10px; font-family: var(--tul-mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--oc-accent); }
  .tul-encamino { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 10px; letter-spacing: 0.12em; color: #FDE68A; background: rgba(217,119,6,0.14); border: 1px solid rgba(251,191,36,0.26); }
  .tul-encamino::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #FBBF24; animation: tulLate 2s ease-in-out infinite; }
  @keyframes tulLate { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
  .tul-h2 { margin: 18px auto 0; max-width: 900px; font-family: var(--tul-fh); font-weight: 800; font-size: clamp(28px, 4.6vw, 54px); line-height: 1.05; letter-spacing: -0.04em; color: var(--oc-text); text-wrap: balance; }
  .tul-h2 em { font-style: normal; color: var(--oc-title-2); }
  .tul-bajada { margin: 20px auto 0; max-width: 640px; font-size: 16px; line-height: 1.65; color: var(--oc-text-3); }
  .tul-h3 { margin: 0; font-family: var(--tul-fh); font-weight: 700; font-size: clamp(22px, 2.6vw, 30px); line-height: 1.15; letter-spacing: -0.03em; color: var(--oc-text); text-wrap: balance; }
  .tul-sub { margin-top: 88px; }
  .tul-sub-cab { text-align: center; margin-bottom: 30px; }
  .tul-sub-cab p { margin: 10px auto 0; max-width: 560px; font-size: 14.5px; line-height: 1.6; color: var(--oc-text-3); }

  /* ── Nube de rubros ── */
  .tul-nube { margin-top: 44px; display: grid; gap: 10px; }
  .tul-familia { display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 14px; align-items: start; }
  .tul-familia-nombre { display: inline-flex; align-items: center; gap: 8px; height: 36px; font-family: var(--tul-mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--oc-text-4); white-space: nowrap; }
  .tul-familia-nombre svg { color: var(--oc-accent); }
  .tul-chips { display: flex; flex-wrap: wrap; gap: 7px; margin: 0; padding: 0; list-style: none; }
  .tul-chip { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 13px; border-radius: 999px; border: 1px solid var(--oc-card-bd); background: var(--oc-card-bg); color: var(--oc-text-2); font-family: inherit; font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer; transition: border-color 180ms ease, background 180ms ease, color 180ms ease, transform 200ms var(--tul-ease), box-shadow 220ms ease; }
  .tul-chip svg { color: var(--oc-text-4); transition: color 180ms ease; }
  .tul-chip:focus-visible { outline: 2px solid var(--oc-accent); outline-offset: 2px; }
  .tul-chip[data-vista='true'] { border-color: var(--oc-card-hover-bd); background: var(--oc-accent-soft); color: var(--oc-text); }
  .tul-chip[data-vista='true'] svg { color: var(--oc-accent); }
  .tul-chip[aria-pressed='true'] { border-color: transparent; background: linear-gradient(135deg, #2563EB, #4F46E5); color: #fff; font-weight: 600; box-shadow: 0 1px 0 rgba(255,255,255,0.2) inset, 0 8px 22px rgba(37,99,235,0.42); }
  .tul-chip[aria-pressed='true'] svg { color: #DBEAFE; }
  .tul-pista { margin: 16px 0 0; text-align: center; font-size: 12.5px; color: var(--oc-text-4); }

  /* ── Escenario: mockup + ficha ── */
  .tul-escena { position: relative; margin-top: 36px; display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr); gap: 40px; align-items: center; }
  .tul-marco-caja { position: relative; }
  /* Resplandor detrás del marco: el mismo eco del planeta que usa la tarjeta de precio destacada. */
  .tul-marco-caja::before { content: ''; position: absolute; inset: 8% 4% -4%; border-radius: 50%; background: radial-gradient(closest-side, rgba(59,130,246,0.42), rgba(99,102,241,0.22) 55%, transparent); filter: blur(46px); pointer-events: none; transition: opacity 400ms ease; opacity: 0.8; }
  .tul-marco { position: relative; border-radius: 22px; border: 1px solid var(--oc-card-alt-bd); background: #05080F; overflow: hidden; box-shadow: 0 1px 0 rgba(255,255,255,0.08) inset, 0 40px 100px rgba(0,0,0,0.7); transition: transform 500ms var(--tul-ease), border-color 300ms ease; }
  .tul-marco-barra { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 16px; border-bottom: 1px solid rgba(147,197,253,0.14); background: rgba(11,16,29,0.9); font-size: 12.5px; color: #B6C2DA; }
  .tul-marco-barra i { width: 9px; height: 9px; border-radius: 50%; background: rgba(147,197,253,0.22); }
  .tul-marco-barra b { margin-left: 6px; font-weight: 600; color: #F1F5FD; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tul-marco-barra span { font-family: var(--tul-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #8794B2; white-space: nowrap; }
  .tul-marco-cuerpo { padding: 26px 18px 20px; }
  .tul-marco-dial { display: grid; place-items: center; }
  .tul-leyenda { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 18px 0 0; padding: 0; list-style: none; }
  .tul-leyenda li { display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 11px; border-radius: 999px; border: 1px solid rgba(147,197,253,0.16); font-size: 12px; color: #B6C2DA; white-space: nowrap; }
  .tul-leyenda i { width: 8px; height: 8px; border-radius: 50%; }

  .tul-ficha-ceja { font-family: var(--tul-mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--oc-text-4); }
  .tul-ficha-titulo { display: flex; align-items: center; gap: 14px; margin-top: 12px; }
  .tul-ficha-icono { width: 52px; height: 52px; border-radius: 16px; flex-shrink: 0; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, #2563EB, #4F46E5); box-shadow: 0 1px 0 rgba(255,255,255,0.22) inset, 0 12px 30px rgba(37,99,235,0.45); }
  .tul-ficha-cuerpo { animation: tulCambia 320ms var(--tul-ease) both; }
  @keyframes tulCambia { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
  .tul-ficha p { margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: var(--oc-text-3); }
  .tul-datos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 22px 0 0; }
  .tul-dato { padding: 13px 14px; border-radius: 14px; border: 1px solid var(--oc-card-bd); background: var(--oc-card-bg); min-width: 0; transition: border-color 200ms ease, background 200ms ease; }
  .tul-dato dt { font-family: var(--tul-mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--oc-text-4); }
  .tul-dato dd { margin: 7px 0 0; font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--oc-text); }
  .tul-servicios { margin: 18px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--oc-card-bd); }
  .tul-servicios li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 4px; border-bottom: 1px solid var(--oc-card-bd); font-size: 14px; color: var(--oc-text-2); transition: background 180ms ease, padding 0ms; }
  .tul-servicios li > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tul-servicios li > span:last-child { font-family: var(--tul-mono); font-size: 12px; font-variant-numeric: tabular-nums; color: var(--oc-text-4); white-space: nowrap; }
  .tul-nota { margin: 10px 0 0 !important; font-size: 12px !important; color: var(--oc-text-4) !important; }

  /* ── Tarjetas (beneficios y pasos) ── */
  .tul-grilla4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  .tul-grilla3 { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .tul-card { position: relative; height: 100%; box-sizing: border-box; padding: 24px 22px; border-radius: 18px; border: 1px solid var(--oc-card-bd); background: var(--oc-card-bg); overflow: hidden; transition: transform 260ms var(--tul-ease), border-color 220ms ease, background 220ms ease, box-shadow 260ms ease; }
  /* Filo de luz arriba, apagado hasta que se pasa por la tarjeta. */
  .tul-card::before { content: ''; position: absolute; left: 20px; right: 20px; top: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--oc-accent), transparent); opacity: 0; transition: opacity 260ms ease; }
  .tul-card-icono { width: 44px; height: 44px; border-radius: 13px; display: grid; place-items: center; color: var(--oc-accent); background: var(--oc-accent-soft); border: 1px solid var(--oc-accent-bd); transition: background 240ms ease, color 240ms ease, box-shadow 260ms ease, transform 300ms var(--tul-ease); }
  .tul-card h4 { margin: 18px 0 0; font-family: var(--tul-fh); font-size: 16.5px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.25; color: var(--oc-text); }
  .tul-card p { margin: 8px 0 0; font-size: 13.5px; line-height: 1.62; color: var(--oc-text-3); }
  .tul-paso-n { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font-family: var(--tul-mono); font-size: 13px; font-weight: 600; color: var(--oc-accent-fuerte); background: var(--oc-panel); border: 1px solid var(--oc-accent-bd); box-shadow: 0 0 26px var(--oc-accent-soft); transition: box-shadow 260ms ease, border-color 220ms ease, transform 300ms var(--tul-ease); }
  .tul-paso { display: flex; flex-direction: column; align-items: center; gap: 18px; min-width: 0; }
  .tul-paso .tul-card { width: 100%; }
  /* La línea punteada une los centros de los números: arranca y termina a
     media columna del borde, a la altura del centro del círculo. */
  .tul-grilla3::before { content: ''; position: absolute; top: 22px; left: calc(100% / 6 + 30px); right: calc(100% / 6 + 30px); height: 1px; background-image: linear-gradient(90deg, var(--oc-linea) 0 6px, transparent 6px 13px); background-size: 13px 1px; pointer-events: none; }

  /* ── Cierre ── */
  .tul-cierre { position: relative; margin-top: 88px; padding: 52px 28px 56px; border-radius: 26px; text-align: center; overflow: hidden; border: 1px solid var(--oc-card-alt-bd); background: var(--oc-card-alt-bg); box-shadow: 0 0 60px var(--oc-accent-soft); }
  .tul-cierre::before { content: ''; position: absolute; left: 50%; bottom: -250px; width: 720px; max-width: 140%; height: 320px; transform: translateX(-50%); border-radius: 50%; background: #000; box-shadow: 0 0 40px 4px rgba(226,240,255,0.5), 0 0 120px 30px rgba(99,102,241,0.42); pointer-events: none; }
  .tul-cierre > * { position: relative; }
  .tul-cierre p { margin: 14px auto 0; max-width: 560px; font-size: 15px; line-height: 1.65; color: var(--oc-text-2); }
  .tul-botones { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 30px; }
  .tul-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 50px; padding: 0 26px; border-radius: 12px; border: 1px solid transparent; font-family: inherit; font-size: 15px; font-weight: 700; text-decoration: none; cursor: pointer; transition: background-color 200ms ease, transform 200ms var(--tul-ease), box-shadow 240ms ease; }
  .tul-btn.oc-ghost { border-color: var(--oc-ghost-bd); font-weight: 600; }
  .tul-btn:focus-visible { outline: 2px solid var(--oc-accent); outline-offset: 3px; }
  .tul-btn:active { transform: translateY(1px); }
  .tul-btn svg { transition: transform 220ms var(--tul-ease); }

  @media (hover: hover) {
    .tul-chip:hover { border-color: var(--oc-card-hover-bd); background: var(--oc-accent-soft); color: var(--oc-text); transform: translateY(-2px); }
    .tul-chip:hover svg { color: var(--oc-accent); }
    .tul-chip[aria-pressed='true']:hover { border-color: transparent; background: linear-gradient(135deg, #2563EB, #4F46E5); box-shadow: 0 1px 0 rgba(255,255,255,0.2) inset, 0 12px 28px rgba(37,99,235,0.55); }
    .tul-chip[aria-pressed='true']:hover svg { color: #fff; }
    .tul-marco-caja:hover .tul-marco { transform: translateY(-4px); border-color: rgba(147,197,253,0.6); }
    .tul-marco-caja:hover::before { opacity: 1; }
    .tul-dato:hover { border-color: var(--oc-card-hover-bd); background: var(--oc-card-hover-bg); }
    .tul-servicios li:hover { background: var(--oc-card-hover-bg); }
    .tul-card:hover { transform: translateY(-5px); border-color: var(--oc-card-hover-bd); background: var(--oc-card-hover-bg); box-shadow: 0 22px 50px rgba(0,0,0,0.5), 0 0 44px var(--oc-accent-soft); }
    .tul-card:hover::before { opacity: 1; }
    .tul-card:hover .tul-card-icono { background: linear-gradient(135deg, #2563EB, #4F46E5); color: #fff; box-shadow: 0 10px 26px rgba(37,99,235,0.5); transform: scale(1.06) rotate(-4deg); }
    .tul-paso:hover .tul-paso-n { border-color: var(--oc-accent); box-shadow: 0 0 34px rgba(96,165,250,0.5); transform: scale(1.08); }
    .tul-btn:hover { transform: translateY(-2px); }
    .tul-btn.oc-cta:hover { box-shadow: 0 16px 46px rgba(147,197,253,0.34); }
    .tul-btn:hover svg { transform: translateX(4px); }
  }

  @media (max-width: 1023px) {
    .tul-escena { grid-template-columns: minmax(0, 1fr); gap: 32px; }
    .tul-grilla4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 767px) {
    .tul-sub, .tul-cierre { margin-top: 64px; }
    /* En celular cada familia es una tira que se desliza de costado: 32 chips
       apilados empujarían el mockup dos pantallas para abajo. */
    .tul-familia { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    .tul-familia-nombre { height: 28px; }
    .tul-chips { flex-wrap: nowrap; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; margin: 0 -24px; padding: 4px 24px 8px; -webkit-mask-image: linear-gradient(90deg, transparent, #000 22px, #000 calc(100% - 30px), transparent); mask-image: linear-gradient(90deg, transparent, #000 22px, #000 calc(100% - 30px), transparent); }
    .tul-chips::-webkit-scrollbar { display: none; }
    .tul-chip { height: 44px; padding: 0 15px; font-size: 14px; flex-shrink: 0; }
    .tul-marco-cuerpo { padding: 20px 10px 16px; }
    .tul-datos { grid-template-columns: minmax(0, 1fr); }
    .tul-dato { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .tul-dato dd { margin: 0; text-align: right; }
    .tul-grilla3 { grid-template-columns: minmax(0, 1fr); gap: 26px; }
    .tul-grilla3::before { display: none; }
    .tul-cierre { padding: 40px 20px 44px; border-radius: 22px; }
    .tul-botones > * { flex: 1 1 100%; }
  }
  @media (max-width: 560px) { .tul-grilla4 { grid-template-columns: minmax(0, 1fr); } }

  @media (prefers-reduced-motion: reduce) {
    .tul-encamino::before, .tul-ficha-cuerpo { animation: none !important; }
    .tul-chip, .tul-marco, .tul-card, .tul-card-icono, .tul-paso-n, .tul-btn, .tul-btn svg { transition: none !important; transform: none !important; }
  }
`

// Formulario de contacto de la vista previa (ContactoDemo). Se monta afuera de
// PaginaV2, así que no tiene la paleta --oc-*: lleva sus colores escritos, los
// mismos del modo oscuro de la landing.
export const CSS_CONTACTO_DEMO = `
  .tul-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: inherit; }
  .tul-modal-velo { position: absolute; inset: 0; background: rgba(0,0,0,0.7); animation: tulVelo 180ms ease-out both; }
  .tul-modal-panel { position: relative; box-sizing: border-box; width: 100%; max-width: 520px; max-height: 100%; overflow-y: auto; padding: 20px 24px 22px; border-radius: 18px; color: #94a3b8; background: #000; border: 1px solid rgba(147,197,253,0.16); box-shadow: 0 30px 80px rgba(0,0,0,0.6); animation: tulModal 240ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes tulVelo { from { opacity: 0 } to { opacity: 1 } }
  @keyframes tulModal { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
  .tul-modal-cab { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .tul-modal-cab h2 { margin: 0; font-family: 'Sora', 'Geist', system-ui, sans-serif; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #fff; }
  .tul-modal-cerrar { width: 44px; height: 44px; margin-right: -10px; flex-shrink: 0; display: grid; place-items: center; padding: 0; border: none; border-radius: 12px; background: transparent; color: #94a3b8; cursor: pointer; transition: background 200ms ease, color 200ms ease; }
  .tul-modal-aviso { display: inline-flex; align-items: center; height: 24px; margin-top: 10px; padding: 0 10px; border-radius: 999px; font-family: "Geist Mono", ui-monospace, monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #FDE68A; background: rgba(217,119,6,0.14); border: 1px solid rgba(251,191,36,0.26); }
  .tul-modal form { display: grid; gap: 14px; margin-top: 16px; }
  .tul-campo { display: grid; gap: 6px; min-width: 0; }
  .tul-campo label { font-size: 12.5px; font-weight: 600; color: rgba(203,213,225,0.82); }
  .tul-input { width: 100%; box-sizing: border-box; height: 46px; padding: 0 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.075); background: rgba(255,255,255,0.028); color: #fff; font-family: inherit; font-size: 14.5px; outline: none; transition: border-color 160ms ease, box-shadow 200ms ease; }
  textarea.tul-input { height: auto; min-height: 104px; padding: 12px 14px; line-height: 1.5; resize: none; }
  .tul-input::placeholder { color: #6a7b91; }
  .tul-input:focus-visible { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(147,197,253,0.22); }
  .tul-input[aria-invalid='true'] { border-color: rgba(248,113,113,0.65); }
  .tul-error { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; color: #fca5a5; }
  .tul-modal-enviar { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 48px; padding: 0 26px; border: none; border-radius: 12px; background: #fff; color: #0f172a; font-family: inherit; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 40px rgba(147,197,253,0.22); transition: background 200ms ease; }
  .tul-modal-cerrar:focus-visible, .tul-modal-enviar:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
  .tul-modal-listo { display: grid; justify-items: center; gap: 16px; padding: 22px 4px 4px; text-align: center; }
  .tul-modal-listo > span { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; color: #4ade80; background: rgba(74,222,128,0.12); border: 1px solid rgba(74,222,128,0.35); }
  .tul-modal-listo p { margin: 0; max-width: 380px; font-size: 14.5px; line-height: 1.6; color: rgba(203,213,225,0.82); }
  .tul-modal-listo p strong { font-weight: 600; color: #fff; }
  .tul-modal-listo .tul-modal-enviar { width: auto; min-width: 160px; }
  @media (hover: hover) {
    .tul-modal-cerrar:hover { background: rgba(255,255,255,0.10); color: #fff; }
    .tul-modal-enviar:hover { background: #eff6ff; }
  }
  @media (max-width: 640px) {
    /* En celular es una hoja que sube desde abajo, como el formulario real. */
    .tul-modal { align-items: flex-end; padding: 0; }
    .tul-modal-panel { max-width: none; max-height: 100dvh; padding: 20px 20px calc(20px + env(safe-area-inset-bottom, 0px)); border-radius: 18px 18px 0 0; }
    /* 16px: con menos, iOS hace zoom al enfocar. */
    .tul-input { font-size: 16px; height: 48px; }
  }
  @media (prefers-reduced-motion: reduce) { .tul-modal-velo, .tul-modal-panel { animation: none; } }
`
