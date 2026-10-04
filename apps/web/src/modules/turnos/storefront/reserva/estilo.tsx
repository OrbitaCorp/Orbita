// Hoja de estilos de la reserva pública y de "Mis turnos" (prefijo tur-).
//
// Manda la marca del negocio: todo pinta con los tokens --color-* y con
// --tu-fh / --tu-fb / --tu-r que SitioNegocio deja en su raíz. Órbita aparece
// como motivo (arcos, anillos, satélite) y como firma, no como paleta.
//
// No depende de las clases internas de SitioNegocio (tu-btn, tu-h…): esa hoja
// la está rediseñando otra persona y acá no tiene que romperse nada si cambia.
//
// Reglas que cumple toda la hoja:
//  · hover solo dentro de @media (hover: hover) y sin mover el layout
//  · nada queda en opacity 0 esperando a JS: las entradas son animaciones CSS
//  · prefers-reduced-motion apaga todo el movimiento (bloque del final)
export const CSS_RESERVA = `
  .tur {
    --tur-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    --tur-ease: cubic-bezier(0.22, 1, 0.36, 1);
    /* Estados: tonos oscuros para los temas claros (4.5:1 sobre fondo y superficie). */
    --tur-ok: #166534; --tur-aviso: #92400E; --tur-error: #B91C1C;
    --tur-sombra: 0 24px 48px -28px rgba(30, 24, 16, 0.38);
    --tur-r: calc(var(--tu-r, 10px) + 6px);
    --tur-r-sm: calc(var(--tu-r, 10px) + 2px);
    --tur-r-lg: calc(var(--tu-r2, 16px) + 8px);
    position: relative; font-family: var(--tu-fb, inherit); color: var(--color-body);
  }
  .tur[data-oscuro="true"] { --tur-ok: #4ADE80; --tur-aviso: #FBBF24; --tur-error: #FCA5A5; --tur-sombra: 0 28px 56px -26px rgba(0, 0, 0, 0.75); }
  .tur *, .tur *::before, .tur *::after { box-sizing: border-box; }

  .tur-cont { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  /* Los brillos de fondo se recortan acá adentro: si no, asoman y aparece scroll horizontal. */
  .tur-fondo { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
  .tur-fondo > span { position: absolute; border-radius: 50%; filter: blur(46px); }
  .tur-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

  /* ── Tipografía ────────────────────────────────────────────────────────── */
  .tur-h { font-family: var(--tu-fh); color: var(--color-text); letter-spacing: -0.015em; line-height: 1.1; margin: 0; text-wrap: balance; }
  .tur[data-mayus="true"] .tur-h { text-transform: uppercase; letter-spacing: 0.01em; }
  .tur-h:focus { outline: none; }
  .tur-bajada { font-size: 16px; line-height: 1.6; color: var(--color-muted); margin: 10px 0 0; max-width: 62ch; }
  .tur-rotulo { font-family: var(--tur-mono); font-size: 11.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-muted); }
  .tur-num { font-family: var(--tur-mono); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }

  /* ── Botones ───────────────────────────────────────────────────────────── */
  .tur-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; padding: 0 24px;
    border-radius: var(--tu-r, 10px); border: 1.5px solid transparent; background: var(--color-primary); color: var(--color-on-primary);
    font: 700 16px var(--tu-fb, inherit); text-decoration: none; white-space: nowrap; cursor: pointer;
    box-shadow: 0 10px 26px -14px var(--color-primary);
    transition: background 180ms ease, border-color 180ms ease, box-shadow 220ms ease, transform 180ms var(--tur-ease), opacity 180ms ease; }
  .tur-btn > svg { flex-shrink: 0; transition: transform 220ms var(--tur-ease); }
  .tur-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  .tur-btn:active:not(:disabled) { transform: translateY(1px); }
  .tur-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
  .tur-btn[data-cargando="true"] { opacity: 0.85; cursor: progress; }
  .tur-btn--sec { background: transparent; color: var(--color-text); border-color: var(--color-border); box-shadow: none; font-weight: 600; }
  .tur-btn--peligro { background: #B91C1C; color: #FFFFFF; box-shadow: none; }
  .tur-btn--chico { min-height: 44px; padding: 0 16px; font-size: 14.5px; }
  .tur-btn--ancho { width: 100%; }
  .tur-enlace { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 6px; margin: 0 -6px; border: none; background: none; border-radius: 8px;
    color: var(--color-text); font: 700 14.5px var(--tu-fb, inherit); text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--color-primary) 70%, transparent);
    text-decoration-thickness: 1.5px; text-underline-offset: 5px; cursor: pointer; transition: color 160ms ease, text-decoration-color 160ms ease, background 160ms ease; }
  .tur-enlace:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tur-enlace:disabled { color: var(--color-muted); text-decoration: none; cursor: default; }
  .tur-redondo { display: inline-grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; border: 1.5px solid var(--color-border);
    background: var(--color-surface); color: var(--color-text); cursor: pointer; transition: border-color 160ms ease, background 160ms ease, transform 180ms var(--tur-ease), opacity 160ms ease; }
  .tur-redondo:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  .tur-redondo:disabled { opacity: 0.4; cursor: not-allowed; }
  .tur-volver { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; padding: 0 14px 0 8px; margin-left: -8px; border-radius: 999px; border: none; background: transparent;
    color: var(--color-text); font: 600 14.5px var(--tu-fb, inherit); cursor: pointer; transition: background 160ms ease; }
  .tur-volver > svg { transition: transform 200ms var(--tur-ease); }
  .tur-volver:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) {
    .tur-btn:not(:disabled):not([data-cargando="true"]):hover { background: var(--color-primary-h); transform: translateY(-2px); box-shadow: 0 18px 34px -16px var(--color-primary); }
    .tur-btn:not(:disabled):hover > svg.tur-flecha { transform: translateX(4px); }
    .tur-btn--sec:not(:disabled):not([data-cargando="true"]):hover { background: color-mix(in srgb, var(--color-text) 6%, transparent); border-color: var(--color-text); box-shadow: none; }
    .tur-btn--peligro:not(:disabled):not([data-cargando="true"]):hover { background: #991B1B; box-shadow: 0 16px 30px -16px #B91C1C; }
    .tur-enlace:not(:disabled):hover { color: var(--color-primary); text-decoration-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 8%, transparent); }
    .tur-redondo:not(:disabled):hover { border-color: var(--color-primary); background: var(--color-primary-bg); transform: scale(1.06); }
    .tur-volver:hover { background: color-mix(in srgb, var(--color-text) 7%, transparent); }
    .tur-volver:hover > svg { transform: translateX(-3px); }
  }

  /* ── Tarjeta de opción (servicio, profesional, cancha, clase) ──────────── */
  .tur-op { position: relative; display: block; width: 100%; min-width: 0; padding: 0; text-align: left; border-radius: var(--tur-r);
    border: 1.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font-family: inherit; cursor: pointer;
    transition: border-color 180ms ease, background 180ms ease, box-shadow 240ms ease, transform 240ms var(--tur-ease); }
  .tur-op:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  .tur-op:active:not(:disabled) { transform: scale(0.99); }
  .tur-op[aria-checked="true"] { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 24%, transparent), var(--tur-sombra); transform: translateY(-2px); }
  .tur-op:disabled { cursor: not-allowed; }
  .tur-op:disabled > *:not(.tur-tilde) { opacity: 0.55; }
  /* El check vive en la esquina, montado sobre el borde: no ocupa lugar ni mueve nada. */
  .tur-tilde { position: absolute; top: -10px; right: -10px; z-index: 2; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
    background: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 0 0 3px var(--color-bg);
    opacity: 0; transform: scale(0.4); transition: opacity 180ms ease, transform 260ms cubic-bezier(0.3, 1.5, 0.5, 1); pointer-events: none; }
  [aria-checked="true"] > .tur-tilde { opacity: 1; transform: scale(1); }
  .tur-foto { position: relative; display: block; overflow: hidden; background: var(--color-surface-alt); }
  .tur-foto > img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform 600ms var(--tur-ease); }
  .tur-marca { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 999px; background: var(--color-primary); color: var(--color-on-primary);
    font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
  .tur-pill { display: inline-flex; align-items: center; gap: 5px; min-height: 26px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--color-border);
    background: var(--color-bg); color: var(--color-body); font-size: 12.5px; font-weight: 600; white-space: nowrap; }
  @media (hover: hover) {
    .tur-op:not([aria-checked="true"]):not(:disabled):hover { border-color: color-mix(in srgb, var(--color-primary) 60%, var(--color-border)); transform: translateY(-3px); box-shadow: var(--tur-sombra); }
    .tur-op:not(:disabled):hover .tur-foto > img { transform: scale(1.06); }
  }

  /* Servicios: foto arriba en pantallas anchas, miniatura al costado en celular. */
  .tur-servicios { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 16px; }
  .tur-serv { display: grid; grid-template-rows: auto 1fr; height: 100%; }
  .tur-serv .tur-foto { height: 136px; border-radius: calc(var(--tur-r) - 2px) calc(var(--tur-r) - 2px) 0 0; }
  .tur-serv-cuerpo { display: flex; flex-direction: column; gap: 14px; padding: 16px 18px 18px; min-width: 0; }
  .tur-serv-nombre { font-size: 21px; font-weight: 700; line-height: 1.2; }
  .tur-serv-pie { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; }
  .tur-serv-precio { font-size: 18px; font-weight: 600; color: var(--color-text); }
  @media (max-width: 600px) {
    .tur-servicios { gap: 12px; }
    .tur-serv { grid-template-rows: none; grid-template-columns: 96px minmax(0, 1fr); }
    .tur-serv .tur-foto { height: 100%; min-height: 112px; border-radius: calc(var(--tur-r) - 2px) 0 0 calc(var(--tur-r) - 2px); }
    .tur-serv-cuerpo { padding: 14px 14px 14px 16px; gap: 10px; }
    .tur-serv-nombre { font-size: 18px; }
    .tur-serv-precio { font-size: 16.5px; }
  }

  /* Profesionales y espacios */
  .tur-cualquiera { display: flex; align-items: center; gap: 18px; padding: 18px 20px; margin-bottom: 16px; }
  .tur-cualquiera-caras { display: flex; flex-shrink: 0; }
  .tur-cualquiera-caras > img, .tur-cualquiera-caras > span { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 3px solid var(--color-surface); margin-left: -16px; background: var(--color-primary-bg); color: var(--color-text); display: grid; place-items: center; }
  .tur-cualquiera-caras > :first-child { margin-left: 0; }
  .tur-recursos { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 16px; }
  .tur-rec .tur-foto { border-radius: calc(var(--tur-r) - 2px) calc(var(--tur-r) - 2px) 0 0; }
  .tur-rec-cuerpo { display: block; padding: 14px 16px 16px; }
  .tur-vivo { width: 8px; height: 8px; border-radius: 50%; background: var(--tur-ok); flex-shrink: 0; }
  @media (max-width: 600px) {
    .tur-recursos { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .tur-cualquiera { gap: 14px; padding: 16px; }
    .tur-cualquiera-caras > img, .tur-cualquiera-caras > span { width: 42px; height: 42px; margin-left: -18px; }
  }

  /* ── Tira de días ──────────────────────────────────────────────────────── */
  .tur-tira-marco { position: relative; display: flex; align-items: center; gap: 8px; }
  .tur-tira { display: flex; gap: 8px; overflow-x: auto; padding: 12px 4px 14px; scroll-snap-type: x proximity; scrollbar-width: none; flex: 1; min-width: 0; -webkit-overflow-scrolling: touch; }
  .tur-tira::-webkit-scrollbar { display: none; }
  .tur-tira-flecha { display: none; }
  @media (hover: hover) and (min-width: 720px) { .tur-tira-flecha { display: inline-grid; } }
  .tur-dia { position: relative; flex: 0 0 auto; width: 76px; min-height: 104px; padding: 10px 0 9px; display: flex; flex-direction: column; align-items: center; gap: 2px; scroll-snap-align: start;
    border-radius: var(--tur-r); border: 1.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font-family: inherit; cursor: pointer;
    transition: border-color 160ms ease, background 180ms ease, color 180ms ease, box-shadow 220ms ease, transform 220ms var(--tur-ease); }
  .tur-dia:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  .tur-dia-sem { font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-muted); }
  .tur-dia-num { font-family: var(--tu-fh); font-size: 28px; font-weight: 700; line-height: 1.1; }
  .tur-dia-puntos { display: flex; gap: 3px; margin-top: 5px; }
  .tur-dia-puntos > i { width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid var(--color-muted); }
  .tur-dia-puntos > i[data-on="true"] { background: var(--color-primary); border-color: var(--color-primary); }
  .tur-dia-txt { font-size: 11.5px; font-weight: 600; color: var(--color-muted); margin-top: 3px; white-space: nowrap; }
  .tur-dia-mes { position: absolute; top: -9px; left: 50%; transform: translateX(-50%); padding: 1px 7px; border-radius: 999px; background: var(--color-bg); border: 1px solid var(--color-border);
    font-family: var(--tur-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-body); }
  .tur-dia[aria-checked="true"] { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); transform: translateY(-2px);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 24%, transparent), 0 16px 28px -18px var(--color-primary); }
  .tur-dia[aria-checked="true"] .tur-dia-sem, .tur-dia[aria-checked="true"] .tur-dia-txt { color: var(--color-on-primary); }
  .tur-dia[aria-checked="true"] .tur-dia-puntos > i { border-color: var(--color-on-primary); }
  .tur-dia[aria-checked="true"] .tur-dia-puntos > i[data-on="true"] { background: var(--color-on-primary); }
  .tur-dia:disabled { cursor: not-allowed; background: transparent; border-style: dashed; color: var(--color-muted); }
  .tur-dia:disabled .tur-dia-num { text-decoration: line-through; text-decoration-thickness: 1.5px; }
  @media (hover: hover) {
    .tur-dia:not(:disabled):not([aria-checked="true"]):hover { border-color: var(--color-primary); transform: translateY(-3px); box-shadow: var(--tur-sombra); }
  }

  /* ── Horarios ──────────────────────────────────────────────────────────── */
  .tur-franja { margin-top: 22px; }
  .tur-corte { display: flex; align-items: center; gap: 12px; margin: 0 0 20px; font-size: 13px; color: var(--color-muted); }
  .tur-corte::before, .tur-corte::after { content: ''; flex: 1; border-top: 1px dashed var(--color-border); }
  .tur-sin-horas { margin: 22px 0 0; padding: 26px 20px; text-align: center; border-radius: var(--tur-r); border: 1.5px dashed var(--color-border); color: var(--color-muted); font-size: 15px; }
  .tur-franja-tit { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: var(--color-text); margin-bottom: 14px; }
  .tur-franja-tit > span { font-weight: 500; color: var(--color-muted); }
  .tur-horas { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 14px 10px; }
  .tur-hora { position: relative; height: 52px; border-radius: var(--tur-r-sm); border: 1.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text);
    font-family: var(--tur-mono); font-variant-numeric: tabular-nums; font-size: 16px; font-weight: 600; cursor: pointer;
    transition: border-color 160ms ease, background 180ms ease, color 180ms ease, box-shadow 220ms ease, transform 200ms var(--tur-ease); }
  .tur-hora:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  .tur-hora[aria-checked="true"] { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 24%, transparent), 0 14px 24px -16px var(--color-primary); }
  .tur-hora:disabled { cursor: not-allowed; background: transparent; border-style: dashed; color: var(--color-muted); text-decoration: line-through; text-decoration-thickness: 1.5px; }
  .tur-hora-marca { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); height: 19px; padding: 0 7px; border-radius: 999px; display: inline-flex; align-items: center;
    background: var(--color-text); color: var(--color-bg); font-family: var(--tu-fb, inherit); font-size: 10.5px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; }
  .tur-rapido { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 10px 16px; margin-bottom: 8px; text-align: left; border-radius: var(--tur-r);
    border: 1.5px dashed color-mix(in srgb, var(--color-primary) 60%, var(--color-border)); background: var(--color-primary-bg); color: var(--color-text); font-family: inherit; font-size: 15px; cursor: pointer;
    transition: border-color 160ms ease, box-shadow 220ms ease, transform 200ms var(--tur-ease); }
  .tur-rapido:disabled { cursor: default; border-style: solid; border-color: var(--color-primary); }
  .tur-rapido:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  .tur-rango { display: flex; align-items: center; gap: 10px; min-height: 52px; margin-top: 24px; padding: 12px 16px; border-radius: var(--tur-r); border: 1px solid var(--color-border); background: var(--color-surface); font-size: 15px; color: var(--color-body); }
  @media (hover: hover) {
    .tur-hora:not(:disabled):not([aria-checked="true"]):hover { border-color: var(--color-primary); background: var(--color-primary-bg); transform: translateY(-2px); }
    .tur-rapido:not(:disabled):hover { border-style: solid; border-color: var(--color-primary); transform: translateY(-2px); box-shadow: var(--tur-sombra); }
    .tur-rapido:hover .tur-flecha { transform: translateX(4px); }
  }
  .tur-flecha { transition: transform 220ms var(--tur-ease); }

  /* ── Clases con cupo ───────────────────────────────────────────────────── */
  .tur-clases { display: flex; flex-direction: column; gap: 12px; }
  .tur-clase { display: grid; grid-template-columns: 78px minmax(0, 1fr) auto; align-items: center; gap: 18px; padding: 16px 20px; }
  .tur-clase-hora { font-size: 24px; font-weight: 600; color: var(--color-text); }
  .tur-clase-cupo { display: flex; align-items: center; gap: 12px; text-align: right; }
  @media (max-width: 560px) {
    .tur-clase { grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; padding: 14px 16px; }
    .tur-clase-hora { grid-column: 1; font-size: 21px; }
    .tur-clase-info { grid-column: 1; }
    .tur-clase-cupo { grid-column: 2; grid-row: 1 / span 2; flex-direction: column-reverse; gap: 6px; text-align: center; }
  }

  /* ── Formulario ────────────────────────────────────────────────────────── */
  .tur-campos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; }
  @media (max-width: 640px) { .tur-campos { grid-template-columns: minmax(0, 1fr); } }
  .tur-campo { display: flex; flex-direction: column; min-width: 0; }
  .tur-campo > label { font-size: 14.5px; font-weight: 700; color: var(--color-text); margin-bottom: 8px; }
  .tur-campo > label > span { font-weight: 500; color: var(--color-muted); }
  .tur-caja { display: flex; align-items: center; height: 56px; border-radius: var(--tur-r-sm); border: 1.5px solid var(--color-border); background: var(--color-surface); overflow: hidden;
    transition: border-color 160ms ease, box-shadow 200ms ease, background 160ms ease; }
  .tur-caja > input { flex: 1; min-width: 0; height: 100%; padding: 0 16px; border: none; outline: none; background: transparent; color: var(--color-text); font: 500 16px var(--tu-fb, inherit); }
  .tur-caja > input::placeholder { color: var(--color-muted); opacity: 1; }
  .tur-caja-pre { display: grid; place-items: center; height: 100%; padding: 0 12px 0 16px; border-right: 1px solid var(--color-border); color: var(--color-body); font-family: var(--tur-mono); font-size: 15px; font-weight: 600; }
  .tur-caja-icono { display: grid; place-items: center; padding-right: 14px; }
  .tur-caja:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 20%, transparent); }
  .tur-caja[data-error="true"] { border-color: var(--tur-error); }
  .tur-caja[data-error="true"]:focus-within { box-shadow: 0 0 0 4px color-mix(in srgb, var(--tur-error) 22%, transparent); }
  /* La línea de ayuda/error reserva su alto: el formulario no salta cuando aparece un error. */
  .tur-ayuda { display: flex; align-items: flex-start; gap: 6px; min-height: 40px; padding-top: 7px; font-size: 13.5px; line-height: 1.4; color: var(--color-muted); margin: 0; }
  .tur-ayuda[data-error="true"] { color: var(--tur-error); font-weight: 600; }
  .tur-ayuda > svg { flex-shrink: 0; margin-top: 2px; }
  .tur-aviso { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: var(--tur-r); border: 1px solid var(--color-border); background: var(--color-surface); }
  /* El área táctil se agranda sin mover nada: 52 x 32 a la vista, 44 de alto para el dedo. */
  .tur-switch::before { content: ''; position: absolute; inset: -6px -4px; }
  .tur-switch { position: relative; width: 52px; height: 32px; flex-shrink: 0; border-radius: 999px; border: none; padding: 0; cursor: pointer; background: var(--color-muted); transition: background 200ms ease, box-shadow 200ms ease; }
  /* Área táctil de 44 px sin agrandar el dibujo. */
  .tur-switch::before { content: ''; position: absolute; inset: -6px; }
  .tur-switch::after { content: ''; position: absolute; top: 4px; left: 4px; width: 24px; height: 24px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35); transition: transform 220ms var(--tur-ease); }
  .tur-switch[aria-checked="true"] { background: var(--color-primary); }
  .tur-switch[aria-checked="true"]::after { transform: translateX(20px); background: var(--color-on-primary); }
  .tur-switch:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  @media (hover: hover) {
    .tur-caja:not(:focus-within):hover { border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); }
    .tur-switch:hover { box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 20%, transparent); }
  }

  /* Dónde se hace el turno (solo si el negocio atiende de más de una forma). */
  .tur-donde { margin-bottom: 22px; }
  .tur-donde > .tur-rotulo { display: block; margin-bottom: 12px; }
  .tur-donde-ops { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 12px; }
  .tur-donde-op { display: flex; align-items: center; gap: 12px; min-height: 68px; padding: 12px 14px; }
  .tur-donde-op b { display: block; font-size: 15.5px; color: var(--color-text); }
  .tur-donde-op b + span { display: block; margin-top: 1px; font-size: 13px; line-height: 1.4; color: var(--color-muted); }
  .tur-donde-ico { display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0; border-radius: var(--tur-r-sm); background: var(--color-primary-bg); color: var(--color-primary); transition: background 180ms ease, color 180ms ease; }
  .tur-donde-op[aria-checked="true"] .tur-donde-ico { background: var(--color-primary); color: var(--color-on-primary); }
  .tur-donde .tur-campo { margin-top: 16px; }

  /* La cuenta, siempre opcional: lo que ofrece el negocio a quien la crea. */
  .tur-cuenta { margin-top: 14px; padding: 16px 18px; border-radius: var(--tur-r); border: 1.5px dashed color-mix(in srgb, var(--color-primary) 46%, var(--color-border)); background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));
    transition: border-color 200ms ease, background 200ms ease; }
  .tur-cuenta[data-activa="true"] { border-style: solid; border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 9%, var(--color-surface)); }
  .tur-cuenta-cab { display: flex; align-items: center; gap: 14px; }
  .tur-cuenta-cab b { display: block; font-size: 15px; color: var(--color-text); }
  .tur-cuenta-cab b + span { display: block; font-size: 13.5px; line-height: 1.5; color: var(--color-muted); }
  .tur-cuenta-ico { display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; background: var(--color-primary); color: var(--color-on-primary); }
  .tur-cuenta-lista { display: grid; gap: 8px; margin: 14px 0 0; padding: 14px 0 0; list-style: none; border-top: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border)); font-size: 14px; line-height: 1.5; color: var(--color-body); }
  .tur-cuenta-lista li { display: flex; align-items: flex-start; gap: 9px; }
  .tur-cuenta-lista li > svg { flex-shrink: 0; margin-top: 3px; color: var(--color-primary); }
  .tur-cuenta-lista b { color: var(--color-text); }
  .tur-cuenta-pie { display: flex; align-items: center; flex-wrap: wrap; gap: 0 8px; margin: 8px 0 -6px; font-size: 14px; color: var(--color-muted); }
  .tur-cuenta-codigo { margin-top: 14px; padding-top: 14px; border-top: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border)); }
  .tur-cuenta-codigo-fila { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
  .tur-cuenta-codigo-fila .tur-caja { flex: 1 1 150px; height: 44px; }
  .tur-cuenta-codigo-fila .tur-caja > input { font-family: var(--tur-mono); letter-spacing: 0.24em; }
  @media (max-width: 480px) { .tur-cuenta-codigo-fila .tur-caja { flex-basis: 100%; height: 52px; } .tur-cuenta-codigo-fila .tur-btn { flex: 1; } }

  /* El descuento de bienvenida en el ticket. */
  .tur-rebaja { display: grid; gap: 6px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed var(--color-border); font-size: 14px; color: var(--color-body); }
  .tur-rebaja > span { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .tur-rebaja > span > span { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
  .tur-rebaja s { color: var(--color-muted); }
  .tur-rebaja b { color: var(--tur-ok); white-space: nowrap; }

  /* ── Seña ──────────────────────────────────────────────────────────────── */
  .tur-pago { max-width: 620px; border-radius: var(--tur-r-lg); border: 1px solid var(--color-border); background: var(--color-surface); overflow: hidden; box-shadow: var(--tur-sombra); }
  .tur-pago-barra { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: var(--color-surface-alt); }
  .tur-pago-barra > span { display: block; height: 100%; background: var(--color-primary); border-radius: 999px; transform-origin: left; animation: turCrece 700ms var(--tur-ease) both; }
  .tur-pago-partes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
  .tur-medio { display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px 16px; }
  .tur-medio-logo { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; background: #009EE3; color: #06283D; }
  .tur-solo-ancho { display: inline-flex; }
  @media (max-width: 980px) { .tur-solo-ancho { display: none; } }

  /* ── Progreso en órbita ────────────────────────────────────────────────── */
  .tur-orb { position: relative; width: 100%; max-width: 760px; margin: 0 auto; aspect-ratio: 760 / 116; }
  .tur-orb > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .tur-orb ol { list-style: none; margin: 0; padding: 0; }
  .tur-orb li { position: absolute; transform: translate(-50%, -22px); }
  .tur-orb-paso { display: flex; flex-direction: column; align-items: center; min-width: 44px; padding: 0; border: none; background: none; font-family: inherit; color: var(--color-muted); cursor: pointer; border-radius: 12px; }
  .tur-orb-paso:disabled { cursor: default; }
  .tur-orb-paso:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tur-orb-punto { display: grid; place-items: center; width: 30px; height: 30px; margin: 7px; border-radius: 50%; border: 1.5px solid var(--color-border); background: var(--color-bg);
    font-family: var(--tur-mono); font-size: 13px; font-weight: 600; color: var(--color-muted);
    transition: background 260ms ease, border-color 260ms ease, color 260ms ease, transform 260ms var(--tur-ease), box-shadow 260ms ease; }
  .tur-orb-txt { font-size: 13.5px; font-weight: 600; white-space: nowrap; transition: color 200ms ease; }
  .tur-orb-paso[data-estado="hecho"] { color: var(--color-body); }
  .tur-orb-paso[data-estado="hecho"] .tur-orb-punto { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
  .tur-orb-paso[data-estado="actual"] { color: var(--color-text); }
  .tur-orb-paso[data-estado="actual"] .tur-orb-punto { border: 2px solid var(--color-primary); color: var(--color-text); transform: scale(1.1); }
  .tur-orb-paso[data-estado="actual"] .tur-orb-txt { font-weight: 800; }
  .tur-orb-avance { transition: stroke-dashoffset 560ms var(--tur-ease); }
  .tur-orb-nave { transition: transform 560ms var(--tur-ease); }
  .tur-orb-sat { animation: turGira 7s linear infinite; }
  .tur-orb-compacto { display: none; align-items: center; gap: 14px; }
  @media (hover: hover) {
    .tur-orb-paso[data-estado="hecho"]:hover { color: var(--color-text); }
    .tur-orb-paso[data-estado="hecho"]:hover .tur-orb-punto { transform: scale(1.14); box-shadow: 0 0 0 5px color-mix(in srgb, var(--color-primary) 24%, transparent); }
    .tur-orb-paso[data-estado="hecho"]:hover .tur-orb-txt { text-decoration: underline; text-underline-offset: 4px; }
  }
  @media (max-width: 719px) {
    .tur-orb { display: none; }
    .tur-orb-compacto { display: flex; }
  }

  /* ── Armazón del flujo ─────────────────────────────────────────────────── */
  .tur-flujo { padding-top: 28px; padding-bottom: 72px; }
  .tur-grilla { display: grid; grid-template-columns: minmax(0, 1fr) 372px; gap: 44px; align-items: start; margin-top: 30px; }
  .tur-lateral { position: sticky; top: 132px; }
  .tur-cabeza { display: flex; align-items: center; gap: 12px; min-height: 44px; margin-bottom: 8px; }
  .tur-titulo { font-size: clamp(30px, 4vw, 44px); font-weight: 700; }
  .tur-hoja { display: none; }
  @media (max-width: 980px) {
    .tur-grilla { grid-template-columns: minmax(0, 1fr); gap: 0; margin-top: 22px; }
    .tur-lateral { display: none; }
    .tur-flujo { padding-top: 20px; padding-bottom: 32px; min-height: calc(100vh - 240px); }
    /* Pegada abajo mientras dura el flujo y se va con él: no tapa el pie del sitio. */
    .tur-hoja { display: block; position: sticky; bottom: 0; z-index: 60; border-top: 1px solid var(--color-border);
      background: color-mix(in srgb, var(--color-bg) 94%, transparent); backdrop-filter: blur(16px) saturate(1.3); -webkit-backdrop-filter: blur(16px) saturate(1.3);
      box-shadow: 0 -18px 40px -24px rgba(0, 0, 0, 0.45); padding: 0 16px calc(12px + env(safe-area-inset-bottom)); }
  }
  @media (max-width: 860px) { .tur-cont { padding: 0 16px; } }

  /* ── Reserva de la página simple: una columna angosta, barrita de avance y el resumen pegado abajo ── */
  .tur-pasitos { display: flex; gap: 6px; }
  .tur-pasitos > i { flex: 1; height: 4px; border-radius: 999px; background: var(--color-border); transition: background 280ms var(--tur-ease); }
  .tur-pasitos > i[data-on="true"] { background: var(--color-primary); }
  .tur[data-simple="true"] .tur-cont { max-width: 600px; }
  .tur[data-simple="true"] .tur-flujo { padding-top: 20px; padding-bottom: 32px; min-height: calc(100vh - 240px); }
  .tur[data-simple="true"] .tur-grilla { grid-template-columns: minmax(0, 1fr); gap: 0; margin-top: 14px; }
  .tur[data-simple="true"] .tur-lateral { display: none; }
  .tur[data-simple="true"] .tur-titulo { font-size: clamp(26px, 6vw, 32px); }
  .tur[data-simple="true"] .tur-hoja { display: block; position: sticky; bottom: 0; z-index: 60; box-sizing: border-box; border-top: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-bg) 94%, transparent); backdrop-filter: blur(16px) saturate(1.3); -webkit-backdrop-filter: blur(16px) saturate(1.3);
    box-shadow: 0 -18px 40px -24px rgba(0, 0, 0, 0.45); padding: 0 16px calc(12px + env(safe-area-inset-bottom)); }
  @media (min-width: 981px) {
    .tur[data-simple="true"] .tur-hoja { max-width: 600px; margin: 0 auto; bottom: 16px; border: 1px solid var(--color-border); border-radius: calc(var(--tu-r2) + 4px); padding-bottom: 12px; }
  }
  @media (prefers-reduced-motion: reduce) { .tur-pasitos > i { transition: none; } }
  .tur-hoja-asa { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 6px 0 4px; border: none; background: none; color: var(--color-text); font-family: inherit; text-align: left; cursor: pointer; border-radius: 10px; }
  .tur-hoja-asa:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .tur-hoja-asa > svg { flex-shrink: 0; transition: transform 260ms var(--tur-ease); }
  .tur-hoja-asa[aria-expanded="true"] > svg { transform: rotate(180deg); }
  /* 0fr → 1fr: la hoja se abre con su alto real, sin medir nada con JS. */
  .tur-hoja-cuerpo { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 300ms var(--tur-ease), visibility 300ms; visibility: hidden; }
  .tur-hoja-cuerpo[data-abierta="true"] { grid-template-rows: 1fr; visibility: visible; }
  .tur-hoja-cuerpo > div { overflow: hidden; min-height: 0; }
  .tur-hoja-pie { display: flex; align-items: center; gap: 14px; }

  /* Pasos: entran desde el lado hacia el que se avanza. */
  .tur-paso { animation: turDesdeDer 280ms var(--tur-ease) backwards; min-width: 0; }
  .tur-paso[data-dir="atras"] { animation-name: turDesdeIzq; }
  .tur-entra { animation: turEntra 480ms var(--tur-ease) backwards; animation-delay: calc(var(--i, 0) * 60ms); }
  .tur-llega { display: inline-block; animation: turLlega 360ms var(--tur-ease) both; }
  .tur-gira { animation: turGira 800ms linear infinite; }

  /* ── Ticket ────────────────────────────────────────────────────────────── */
  .tur-ticket { position: relative; border-radius: var(--tur-r-lg); border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--tur-sombra); overflow: hidden; }
  .tur-ticket-foto { position: relative; height: 112px; }
  .tur-ticket-foto > img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tur-ticket-foto::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0, 0, 0, 0.82), rgba(0, 0, 0, 0.18)); }
  .tur-fila { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--color-border); }
  .tur-fila:last-child { border-bottom: none; }
  .tur-fila-icono { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; border: 1.5px dashed var(--color-border); color: var(--color-muted); transition: background 260ms ease, border-color 260ms ease, color 260ms ease; }
  .tur-fila[data-lista="true"] .tur-fila-icono { border-style: solid; border-color: transparent; background: var(--color-primary-bg); color: var(--color-text); }
  .tur-fila-k { display: block; font-size: 12.5px; color: var(--color-muted); }
  .tur-fila-v { display: block; font-size: 15px; font-weight: 700; color: var(--color-text); overflow-wrap: anywhere; }
  .tur-fila-v[data-vacia="true"] { font-weight: 500; color: var(--color-muted); }
  .tur-troquel { position: relative; height: 22px; }
  .tur-troquel::before, .tur-troquel::after { content: ''; position: absolute; top: 0; width: 22px; height: 22px; border-radius: 50%; background: var(--color-bg); border: 1px solid var(--color-border); }
  .tur-troquel::before { left: -12px; }
  .tur-troquel::after { right: -12px; }
  .tur-troquel > i { position: absolute; left: 20px; right: 20px; top: 10px; border-top: 2px dashed var(--color-border); }
  .tur-total { font-size: 28px; font-weight: 600; color: var(--color-text); }

  /* ── Confirmación ──────────────────────────────────────────────────────── */
  .tur-sello-anillo { stroke-dasharray: 289; animation: turTraza 900ms var(--tur-ease) 120ms both; }
  .tur-sello-check { stroke-dasharray: 60; animation: turTraza 420ms ease-out 820ms both; }
  .tur-sello-onda { transform-origin: center; transform-box: fill-box; animation: turOnda 1400ms ease-out 900ms both; }
  .tur-sello-sat { transform-origin: 60px 60px; animation: turGira 9s linear infinite; }
  .tur-entrada { display: grid; grid-template-columns: minmax(0, 1fr) 232px; max-width: 760px; margin: 0 auto; border-radius: var(--tur-r-lg); border: 1px solid var(--color-border); background: var(--color-surface);
    box-shadow: var(--tur-sombra); position: relative; transition: transform 300ms var(--tur-ease), box-shadow 300ms ease; }
  .tur-entrada-talon { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 26px 22px; border-left: 2px dashed var(--color-border); text-align: center; }
  .tur-entrada-talon::before, .tur-entrada-talon::after { content: ''; position: absolute; left: -13px; width: 24px; height: 24px; border-radius: 50%; background: var(--color-bg); border: 1px solid var(--color-border); }
  .tur-entrada-talon::before { top: -13px; clip-path: inset(50% 0 0 0); }
  .tur-entrada-talon::after { bottom: -13px; clip-path: inset(0 0 50% 0); }
  .tur-qr { padding: 10px; border-radius: 14px; background: #FFFFFF; line-height: 0; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08); }
  .tur-datos-entrada { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 18px 22px; }
  .tur-acciones { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
  /* Lo que sumó con su cuenta: la tarjeta de sellos y, al lado, qué significa. */
  .tur-premio { display: grid; grid-template-columns: minmax(0, 300px) minmax(0, 1fr); gap: 20px; align-items: center; max-width: 760px; margin: 20px auto 0; padding: 16px; border-radius: var(--tur-r-lg); border: 1px solid var(--color-border); background: var(--color-surface); }
  .tur-premio > :only-child { grid-column: 1 / -1; }
  .tur-premio b { display: block; font-size: 16px; color: var(--color-text); }
  .tur-premio b + span { display: block; margin-top: 4px; font-size: 14.5px; line-height: 1.55; color: var(--color-body); }
  @media (max-width: 620px) { .tur-premio { grid-template-columns: minmax(0, 1fr); } }
  .tur-firma { display: inline-flex; align-items: center; gap: 10px; padding: 8px 16px 8px 10px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-body); font-size: 13.5px; font-weight: 600; }
  @media (hover: hover) { .tur-entrada:hover { transform: translateY(-4px); box-shadow: 0 36px 70px -34px rgba(0, 0, 0, 0.6); } }
  @media (max-width: 680px) {
    .tur-entrada { grid-template-columns: minmax(0, 1fr); }
    .tur-entrada-talon { flex-direction: row; justify-content: flex-start; gap: 16px; padding: 22px; border-left: none; border-top: 2px dashed var(--color-border); text-align: left; }
    .tur-entrada-talon::before { top: -13px; left: -13px; clip-path: inset(0 0 0 50%); }
    .tur-entrada-talon::after { top: -13px; bottom: auto; left: auto; right: -13px; clip-path: inset(0 50% 0 0); }
    .tur-acciones > * { flex: 1 1 100%; }
  }

  /* ── Mis turnos ────────────────────────────────────────────────────────── */
  .tur-ingreso { max-width: 460px; margin: 0 auto; text-align: center; }
  .tur-ingreso-icono { position: relative; display: grid; place-items: center; width: 88px; height: 88px; margin: 0 auto 22px; color: var(--color-text); }
  .tur-codigo { display: flex; justify-content: center; gap: 8px; }
  .tur-codigo > input { flex: 1 1 0; min-width: 0; max-width: 58px; height: 64px; padding: 0; text-align: center; border-radius: var(--tur-r-sm); border: 1.5px solid var(--color-border); background: var(--color-surface);
    color: var(--color-text); font-family: var(--tur-mono); font-size: 26px; font-weight: 600; outline: none; caret-color: var(--color-primary);
    transition: border-color 160ms ease, box-shadow 200ms ease, transform 200ms var(--tur-ease), background 160ms ease; }
  .tur-codigo > input[data-lleno="true"] { border-color: var(--color-primary); background: var(--color-primary-bg); }
  .tur-codigo > input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 22%, transparent); transform: translateY(-2px); }
  .tur-codigo > input:disabled { opacity: 0.7; cursor: progress; }
  .tur-codigo > input:nth-child(3) { margin-right: 10px; }
  @media (hover: hover) { .tur-codigo > input:not(:focus):not(:disabled):hover { border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); } }
  .tur-mt { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 40px; align-items: start; }
  @media (max-width: 980px) { .tur-mt { grid-template-columns: minmax(0, 1fr); gap: 36px; } }
  .tur-prox { position: relative; border-radius: var(--tur-r-lg); border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--tur-sombra); }
  .tur-prox-cuerpo { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 22px 26px; align-items: center; padding: 26px; }
  .tur-prox-pie { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 22px; align-items: center; padding: 22px 26px 26px; }
  .tur-prox-acciones { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .tur-prox-qr { display: flex; align-items: center; gap: 14px; }
  .tur-meta { display: flex; flex-wrap: wrap; gap: 14px 26px; }
  .tur-meta > span { display: inline-flex; align-items: center; gap: 10px; font-size: 14.5px; color: var(--color-text); min-width: 0; }
  .tur-meta small { display: block; font-size: 12.5px; color: var(--color-muted); }
  .tur-estado { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 2px 11px; border-radius: 999px; border: 1px solid currentColor; font-size: 12.5px; font-weight: 700; white-space: nowrap; background: var(--color-bg); }
  @media (max-width: 640px) {
    .tur-prox-cuerpo { grid-template-columns: minmax(0, 1fr); padding: 20px; gap: 18px; }
    .tur-prox-pie { grid-template-columns: minmax(0, 1fr); padding: 20px; }
    .tur-prox-qr { order: -1; }
  }
  .tur-cuenta-traza { stroke-dasharray: var(--largo); animation: turTraza 1100ms var(--tur-ease) 150ms both; }
  .tur-item { display: flex; align-items: center; gap: 16px; padding: 16px 18px; border-radius: var(--tur-r); border: 1px solid var(--color-border); background: var(--color-surface); transition: border-color 180ms ease, box-shadow 220ms ease, transform 220ms var(--tur-ease); }
  .tur-linea { list-style: none; margin: 0; padding: 0; position: relative; }
  .tur-linea::before { content: ''; position: absolute; left: 7px; top: 10px; bottom: 10px; border-left: 2px dashed var(--color-border); }
  .tur-linea > li { position: relative; padding: 0 0 8px 30px; }
  .tur-linea > li::before { content: ''; position: absolute; left: 0; top: 22px; width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--color-primary); background: var(--color-bg); transition: background 200ms ease, transform 220ms var(--tur-ease); }
  .tur-hist { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: var(--tur-r); border: 1px solid transparent; transition: background 180ms ease, border-color 180ms ease; }
  @media (hover: hover) {
    .tur-item:hover { border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); transform: translateY(-2px); box-shadow: var(--tur-sombra); }
    .tur-linea > li:hover::before { background: var(--color-primary); transform: scale(1.15); }
    .tur-linea > li:hover .tur-hist { background: var(--color-surface); border-color: var(--color-border); }
  }
  /* .tur-cont arma su propia pila (z-index: 1): sin esto el velo y el aviso quedan debajo de la cabecera del sitio. */
  .tur-cont:has(.tur-velo), .tur-cont:has(.tur-toast) { z-index: 180; }
  .tur-velo { position: fixed; inset: 0; z-index: 180; display: grid; place-items: center; padding: 16px; background: rgba(0, 0, 0, 0.62); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); animation: turVelo 200ms ease both; }
  .tur-modal { width: 100%; max-width: 540px; max-height: calc(100vh - 32px); overflow-y: auto; padding: 26px; border-radius: var(--tur-r-lg); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-body);
    box-shadow: 0 40px 90px -24px rgba(0, 0, 0, 0.7); animation: turSube 280ms var(--tur-ease) both; }
  .tur-modal:focus { outline: none; }
  @media (max-width: 560px) {
    .tur-velo { place-items: end center; padding: 0; }
    .tur-modal { max-width: none; padding: 22px 16px calc(20px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; border-bottom: none; max-height: 92vh; }
  }
  .tur-toast { position: fixed; left: 50%; bottom: 24px; z-index: 200; display: flex; align-items: center; gap: 10px; max-width: calc(100vw - 32px); padding: 14px 18px; border-radius: 14px;
    background: var(--color-text); color: var(--color-bg); font-size: 15px; font-weight: 600; box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.55); transform: translateX(-50%); animation: turToast 300ms var(--tur-ease) both; }

  /* ── Estado vacío ──────────────────────────────────────────────────────── */
  .tur-vacio { max-width: 520px; margin: 0 auto; text-align: center; }
  .tur-vacio-sat { transform-origin: 110px 110px; animation: turGira 18s linear infinite; }
  .tur-vacio-sat2 { transform-origin: 110px 110px; animation: turGira 28s linear infinite reverse; }

  /* ── Movimiento ────────────────────────────────────────────────────────── */
  @keyframes turDesdeDer { from { opacity: 0; transform: translateX(28px) } to { opacity: 1; transform: none } }
  @keyframes turDesdeIzq { from { opacity: 0; transform: translateX(-28px) } to { opacity: 1; transform: none } }
  @keyframes turEntra { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
  @keyframes turLlega { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
  @keyframes turGira { to { transform: rotate(360deg) } }
  @keyframes turTraza { from { stroke-dashoffset: var(--largo, 289) } to { stroke-dashoffset: 0 } }
  @keyframes turOnda { 0% { transform: scale(1); opacity: 0.55 } 100% { transform: scale(1.7); opacity: 0 } }
  @keyframes turCrece { from { transform: scaleX(0) } to { transform: none } }
  @keyframes turVelo { from { opacity: 0 } to { opacity: 1 } }
  @keyframes turSube { from { opacity: 0; transform: translateY(22px) scale(0.98) } to { opacity: 1; transform: none } }
  @keyframes turToast { from { opacity: 0; transform: translate(-50%, 16px) } to { opacity: 1; transform: translate(-50%, 0) } }

  @media (prefers-reduced-motion: reduce) {
    .tur *, .tur *::before, .tur *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    .tur-sello-onda { opacity: 0; }
  }
`

export function EstiloReserva() {
  return <style>{CSS_RESERVA}</style>
}
