// Hojas de estilo del sitio público del negocio.
//
// CSS_SITIO  → el kit (prefijo tu-): chrome, tipografía, botones, tarjetas,
//              horarios, motivo orbital. Lo monta SitioNegocio, así que está
//              disponible en portada, servicios, reserva y mis turnos.
// CSS_PORTADA → secciones de la portada (prefijo tup-). Solo la monta HomeNegocio.
// CSS_SERVICIOS → catálogo (prefijo tus-). Solo lo monta ServiciosNegocio.
// CSS_SIMPLE  → la página simple (prefijo tusp-). Solo la monta PaginaSimple.
//
// Los prefijos separados son a propósito: Reserva y Mis turnos definen sus
// propias clases tu-* y no tienen que heredar nada de una sección de la portada.
//
// Reglas que valen para las tres hojas:
//  · Todo pinta con las variables del tema (--color-*, --tu-*): ningún color de
//    marca escrito a mano, salvo el blanco sobre foto.
//  · La FORMA sale de los atributos de la raíz (data-estilo, data-tarjeta,
//    data-forma, data-textura): cada plantilla cambia el trazo, no solo el color.
//  · Todo hover vive dentro de @media (hover: hover) y solo mueve
//    transform / opacity / sombra / color: nunca el layout.
//  · prefers-reduced-motion apaga animaciones y transiciones al final de cada hoja.

const RUIDO = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

export const CSS_SITIO = `
  .tu-sitio { --tu-ease: cubic-bezier(.2,.7,.2,1); position: relative; isolation: isolate; overflow-x: clip;
    font-family: var(--tu-fb); font-size: 16px; line-height: 1.6; color: var(--color-body); background: var(--color-bg); -webkit-font-smoothing: antialiased; }
  .tu-sitio ::selection { background: var(--color-primary); color: var(--color-on-primary); }
  .tu-sitio a, .tu-sitio button { -webkit-tap-highlight-color: transparent; }
  .tu-sitio a:focus-visible, .tu-sitio button:focus-visible, .tu-sitio input:focus-visible, .tu-sitio summary:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  .tu-cont { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
  .tu-sec { margin-top: clamp(72px, 9vw, 128px); }
  .tu-sec--corta { margin-top: clamp(28px, 4vw, 48px); }
  .tu-ancla { scroll-margin-top: 130px; }

  /* ── Textura de fondo de cada plantilla ─────────────────────────────────── */
  .tu-textura { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
  .tu-sitio[data-textura="puntos"] .tu-textura { height: 1100px; background-image: radial-gradient(color-mix(in srgb, var(--color-primary) 22%, transparent) 1px, transparent 1.4px); background-size: 22px 22px;
    -webkit-mask-image: linear-gradient(to bottom, #000, transparent); mask-image: linear-gradient(to bottom, #000, transparent); }
  .tu-sitio[data-textura="trama"] .tu-textura { background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.028) 0 1px, transparent 1px 14px); }
  .tu-sitio[data-textura="papel"] .tu-textura { background-image: ${RUIDO}; opacity: .22; mix-blend-mode: multiply; }
  .tu-grano { position: fixed; inset: 0; pointer-events: none; z-index: 70; opacity: .05; mix-blend-mode: overlay; background-image: ${RUIDO}; }

  /* ── Tipografía ─────────────────────────────────────────────────────────── */
  .tu-sitio .tu-h { font-family: var(--tu-fh); font-weight: var(--tu-peso); color: var(--color-text); letter-spacing: -0.015em; line-height: 1.08; margin: 0; text-wrap: balance; }
  .tu-sitio[data-mayus="true"] .tu-h { text-transform: uppercase; letter-spacing: 0.005em; line-height: 1; }
  .tu-sitio .tu-h em { font-style: italic; font-weight: inherit; color: var(--color-primary); }
  .tu-sitio[data-estilo="clinica"] .tu-h em { font-style: normal; }
  .tu-sitio .tu-h2 { font-size: clamp(32px, 4.2vw, 54px); }
  .tu-sitio[data-mayus="true"] .tu-h2 { font-size: clamp(38px, 5vw, 68px); }
  .tu-sitio .tu-eyebrow { font-family: var(--tu-fm); font-size: 12px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-primary); }
  .tu-eyebrow--raya { display: flex; align-items: center; gap: 12px; }
  .tu-eyebrow--raya::before { content: ''; width: 28px; height: 1.5px; background: currentColor; flex-shrink: 0; }
  .tu-num { font-family: var(--tu-fm); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .tu-rotulo { font-family: var(--tu-fm); font-size: 11px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-muted); }
  .tu-bajada { font-size: 17px; line-height: 1.6; color: var(--color-body); margin: 16px 0 0; max-width: 56ch; }
  .tu-enc { display: flex; align-items: flex-end; gap: 20px 32px; flex-wrap: wrap; margin-bottom: clamp(28px, 3.4vw, 44px); }
  .tu-enc-txt { flex: 1; min-width: min(100%, 280px); }
  .tu-enc .tu-eyebrow { margin-bottom: 14px; }
  .tu-enc[data-centro="true"] { justify-content: center; text-align: center; }
  .tu-enc[data-centro="true"] .tu-eyebrow { justify-content: center; }
  .tu-enc[data-centro="true"] .tu-eyebrow::after { content: ''; width: 28px; height: 1.5px; background: currentColor; }

  /* ── Botones y links ────────────────────────────────────────────────────── */
  .tu-btn, .tu-btn-sec { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 50px; padding: 0 24px; border-radius: var(--tu-r-btn, var(--tu-r));
    font: 700 15px var(--tu-fb); cursor: pointer; text-decoration: none; white-space: nowrap; box-sizing: border-box; }
  .tu-btn { position: relative; overflow: hidden; isolation: isolate; border: none; background: var(--color-primary); color: var(--color-on-primary);
    box-shadow: 0 10px 26px -12px var(--color-primary); transition: background 180ms ease, transform 180ms ease, box-shadow 180ms ease; }
  .tu-btn > svg, .tu-btn-sec > svg, .tu-link > svg { transition: transform 200ms var(--tu-ease); flex-shrink: 0; }
  /* Brillo que recorre el botón principal al pasar el mouse. */
  .tu-btn::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.38) 50%, transparent 65%); transform: translateX(-120%); transition: transform 700ms var(--tu-ease); }
  .tu-btn:active, .tu-btn-sec:active { transform: translateY(1px); }
  .tu-btn:disabled { opacity: .4; cursor: not-allowed; transform: none; box-shadow: none; }
  .tu-btn-sec { border: 1px solid var(--color-border); background: transparent; color: var(--color-text); font-weight: 600; transition: border-color 180ms ease, background 180ms ease, transform 180ms ease; }
  .tu-btn--lg { height: 56px; padding: 0 30px; font-size: 16px; }
  .tu-btn--inverso { background: var(--color-on-primary); color: var(--color-primary); box-shadow: 0 14px 30px -14px rgba(0,0,0,.5); }
  .tu-sitio[data-estilo="box"] .tu-btn, .tu-sitio[data-estilo="box"] .tu-btn-sec { font-family: var(--tu-fh); text-transform: uppercase; letter-spacing: .07em; font-size: 17px; }
  .tu-sitio[data-estilo="box"] .tu-btn--lg { font-size: 19px; }
  .tu-link { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; color: var(--color-primary); font-size: 15px; font-weight: 700; text-decoration: none; background-image: linear-gradient(currentColor, currentColor); background-repeat: no-repeat; background-position: 0 calc(100% - 9px); background-size: 0 1.5px; transition: background-size 250ms var(--tu-ease); }
  .tu-link-suave { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; color: inherit; text-decoration: none; transition: color 160ms ease; }
  @media (hover: hover) {
    .tu-btn:not(:disabled):hover { background: var(--color-primary-h); transform: translateY(-2px); box-shadow: 0 16px 32px -12px var(--color-primary); }
    .tu-btn:not(:disabled):hover::after { transform: translateX(120%); }
    .tu-btn--inverso:not(:disabled):hover { background: var(--color-on-primary); box-shadow: 0 20px 36px -14px rgba(0,0,0,.6); }
    .tu-btn:hover > svg:last-child, .tu-btn-sec:hover > svg:last-child, .tu-link:hover > svg { transform: translateX(3px); }
    .tu-btn-sec:hover { border-color: var(--color-text); background: color-mix(in srgb, var(--color-text) 6%, transparent); transform: translateY(-2px); }
    .tu-link:hover { background-size: 100% 1.5px; }
    .tu-link-suave:hover { color: var(--color-primary); }
  }

  /* ── Tarjetas: una forma por plantilla ──────────────────────────────────── */
  .tu-card { position: relative; box-sizing: border-box; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--tu-r2); color: var(--color-text); }
  a.tu-card { text-decoration: none; cursor: pointer; }
  /* Estudio: doble filete, como la etiqueta de un frasco de barbería. */
  .tu-sitio[data-tarjeta="filete"] .tu-card { border-radius: var(--tu-r); }
  .tu-sitio[data-tarjeta="filete"] .tu-card::after { content: ''; position: absolute; inset: 5px; z-index: 2; pointer-events: none; border-radius: inherit; border: 1px solid color-mix(in srgb, var(--color-primary) 24%, transparent); transition: border-color 220ms ease; }
  /* Clínica: blanca, sin peso, con sombra suave. */
  .tu-sitio[data-tarjeta="suave"] .tu-card { background: var(--color-bg); box-shadow: var(--tu-sombra); }
  /* Box: recta, con la esquina cortada. */
  .tu-sitio[data-tarjeta="corte"] .tu-card { border-radius: 0; }
  .tu-sitio[data-tarjeta="corte"] .tu-card::after { content: ''; position: absolute; top: -1px; right: -1px; width: 24px; height: 24px; z-index: 3; pointer-events: none;
    background: linear-gradient(225deg, var(--color-bg) 0 calc(50% - 1.5px), var(--color-primary) calc(50% - 1.5px) 50%, transparent 50%); }
  /* Atelier y Taller: papel apoyado, con canto. */
  .tu-sitio[data-tarjeta="papel"] .tu-card { box-shadow: 0 3px 0 var(--color-border), var(--tu-sombra); }
  .tu-card-h { transition: transform 240ms var(--tu-ease), box-shadow 240ms ease, border-color 240ms ease; }
  /* Luz que sigue al mouse (coordenadas en --mx/--my, las pone SitioNegocio). */
  .tu-spot { position: relative; }
  .tu-spot::before { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; transition: opacity 300ms ease; z-index: 1;
    background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--color-primary) 16%, transparent), transparent 60%); }
  .tu-borde-luz { position: relative; }
  .tu-borde-luz::after { content: ''; position: absolute; inset: -1px; border-radius: inherit; padding: 1px; pointer-events: none;
    background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 70%, transparent), transparent 40%, transparent 60%, color-mix(in srgb, var(--color-primary) 40%, transparent));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
  .tu-ir { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; background: var(--color-primary-bg); color: var(--color-primary); transition: background 200ms ease, color 200ms ease, transform 240ms var(--tu-ease); }
  .tu-sitio[data-tarjeta="corte"] .tu-ir, .tu-sitio[data-tarjeta="filete"] .tu-ir { border-radius: var(--tu-r); }
  @media (hover: hover) {
    .tu-card-h:hover { transform: translateY(-4px); box-shadow: 0 26px 46px -26px rgba(0,0,0,.5); border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); }
    .tu-sitio[data-tarjeta="filete"] .tu-card-h:hover::after { border-color: color-mix(in srgb, var(--color-primary) 70%, transparent); }
    .tu-sitio[data-tarjeta="suave"] .tu-card-h:hover { box-shadow: 0 2px 4px color-mix(in srgb, var(--color-text) 6%, transparent), 0 32px 56px -28px color-mix(in srgb, var(--color-primary) 45%, transparent); }
    .tu-sitio[data-tarjeta="corte"] .tu-card-h:hover { transform: translate(4px, -4px); box-shadow: -7px 7px 0 var(--color-primary); border-color: var(--color-primary); }
    .tu-sitio[data-tarjeta="papel"] .tu-card-h:hover { transform: translateY(-5px) rotate(-.6deg); box-shadow: 0 3px 0 var(--color-border), 0 30px 50px -28px color-mix(in srgb, var(--color-text) 40%, transparent); }
    .tu-spot:hover::before { opacity: 1; }
    .tu-card-h:hover .tu-ir { background: var(--color-primary); color: var(--color-on-primary); transform: translateX(3px); }
  }

  /* ── Fotos ──────────────────────────────────────────────────────────────── */
  .tu-foto { position: relative; display: block; overflow: hidden; background: var(--color-surface-alt); }
  .tu-foto > img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tu-zoom { overflow: hidden; }
  .tu-zoom img { transition: transform 900ms var(--tu-ease, cubic-bezier(.2,.7,.2,1)); }
  @media (hover: hover) { .tu-zoom:hover img, .tu-card-h:hover .tu-zoom img { transform: scale(1.06); } }

  /* ── Horarios, estados y avisos ─────────────────────────────────────────── */
  .tu-horas { display: flex; gap: 8px; flex-wrap: wrap; }
  .tu-hora { display: inline-grid; place-items: center; min-width: 44px; height: 40px; padding: 0 13px; box-sizing: border-box; border-radius: var(--tu-r-btn, 999px); border: 1px solid var(--color-border); background: transparent;
    font: 600 14px var(--tu-fm); font-variant-numeric: tabular-nums; color: var(--color-text); text-decoration: none; cursor: pointer; transition: background 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease; }
  .tu-hora--mas { padding: 0; width: 44px; color: var(--color-primary); }
  .tu-estado { display: inline-flex; align-items: center; gap: 7px; min-height: 28px; padding: 0 11px; border-radius: 999px; font-size: 13px; font-weight: 700; color: var(--tu-ok); background: color-mix(in srgb, var(--tu-ok) 13%, transparent); }
  .tu-estado::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
  .tu-estado[data-tono="aviso"] { color: var(--tu-aviso); background: color-mix(in srgb, var(--tu-aviso) 13%, transparent); }
  .tu-estado[data-tono="lleno"] { color: var(--tu-lleno); background: color-mix(in srgb, var(--tu-lleno) 13%, transparent); }
  .tu-estado[data-tono="lleno"]::before { border-radius: 1px; }
  .tu-chip-hoy { display: inline-block; margin-left: 8px; padding: 2px 7px; border-radius: 999px; background: var(--color-primary); color: var(--color-on-primary); font: 600 10px var(--tu-fm); letter-spacing: .08em; text-transform: uppercase; vertical-align: middle; }
  .tu-vivo { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--tu-ok, #22C55E); animation: tuPulso 2s infinite; flex-shrink: 0; }
  .tu-vivo--off { background: var(--color-muted); animation: none; }
  .tu-abierto { display: inline-flex; align-items: center; gap: 9px; min-height: 34px; padding: 0 14px 0 12px; border-radius: 999px; border: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-surface) 80%, transparent); font-size: 13.5px; font-weight: 700; color: var(--color-text); }
  .tu-abierto-hora { font-size: 12.5px; font-weight: 500; color: var(--color-muted); padding-left: 9px; border-left: 1px solid var(--color-border); }
  @media (hover: hover) { .tu-hora:hover { background: var(--color-primary); color: var(--color-on-primary); border-color: var(--color-primary); transform: translateY(-2px); } }

  /* ── Motivo orbital ─────────────────────────────────────────────────────── */
  @keyframes tuGira { to { transform: rotate(360deg) } }
  .tu-orbita-gira { animation: tuGira 12s linear infinite; }
  .tu-orbita-gira--rev { animation-direction: reverse; }
  .tu-anillos { position: absolute; pointer-events: none; color: var(--color-primary); }

  .tu-prox { position: relative; border-radius: calc(var(--tu-r2) + 2px); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); box-shadow: 0 30px 60px -30px rgba(0,0,0,.55); overflow: hidden; text-align: left; transition: border-color 220ms ease, transform 240ms var(--tu-ease), box-shadow 240ms ease; }
  .tu-prox[data-vidrio="true"] { background: color-mix(in srgb, var(--color-bg) 66%, transparent); border-color: rgba(255,255,255,.2); -webkit-backdrop-filter: blur(18px) saturate(1.3); backdrop-filter: blur(18px) saturate(1.3); }
  .tu-sitio[data-tarjeta="corte"] .tu-prox { border-radius: 0; border-left: 3px solid var(--color-primary); }
  .tu-sitio[data-tarjeta="filete"] .tu-prox { border-radius: var(--tu-r); }
  .tu-prox-main { position: relative; z-index: 2; display: flex; align-items: center; gap: 16px; padding: 18px 18px 16px; color: inherit; text-decoration: none; }
  .tu-prox-hora { display: flex; align-items: baseline; gap: 10px; margin-top: 4px; font-size: 30px; font-weight: 600; line-height: 1.1; color: var(--color-text); }
  .tu-prox-cuando { font-family: var(--tu-fh); font-weight: var(--tu-peso); font-size: 22px; }
  .tu-sitio[data-mayus="true"] .tu-prox-cuando { text-transform: uppercase; }
  .tu-prox-det { display: block; font-size: 14px; color: var(--color-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-prox-ir { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; background: var(--color-primary); color: var(--color-on-primary); transition: transform 240ms var(--tu-ease); }
  .tu-prox-otros { position: relative; z-index: 2; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 18px 16px; border-top: 1px dashed var(--color-border); }
  .tu-prox-otros .tu-rotulo { margin-right: 4px; }
  @media (hover: hover) {
    .tu-prox:hover { border-color: color-mix(in srgb, var(--color-primary) 60%, var(--color-border)); transform: translateY(-3px); }
    .tu-prox-main:hover .tu-prox-ir { transform: translate(2px, -2px) scale(1.06); }
  }

  .tu-semana { display: grid; grid-template-columns: minmax(220px, 330px) minmax(0, 1fr); gap: clamp(20px, 3vw, 40px); align-items: center; }
  .tu-semana-svg { width: 100%; height: auto; display: block; overflow: visible; }
  .tu-semana-dia { transition: opacity 200ms ease; cursor: default; }
  .tu-semana-tramo { transition: stroke-width 200ms ease; }
  .tu-semana-dia[data-foco="true"] .tu-semana-tramo { stroke-width: 18px; opacity: 1; }
  .tu-semana-svg[data-con-foco="true"] .tu-semana-dia:not([data-foco="true"]) { opacity: .32; }
  .tu-semana-rot { font: 500 10px var(--tu-fm); letter-spacing: .14em; fill: var(--color-muted); }
  .tu-semana-rot[data-hoy="true"] { fill: var(--color-primary); }
  .tu-semana-num { font: 600 12px var(--tu-fm); fill: var(--color-text); }
  .tu-semana-hora { font: 600 42px var(--tu-fm); letter-spacing: -.04em; fill: var(--color-text); }
  .tu-semana-pie { font: 500 13px var(--tu-fb); fill: var(--color-body); }
  .tu-semana-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .tu-semana-lista li + li { border-top: 1px solid var(--color-border); }
  /* Estado arriba y "desde" abajo: en una sola línea se pisan cuando la columna es angosta. */
  .tu-semana-fila { display: grid; grid-template-columns: 74px minmax(0, 1fr) 16px; align-items: center; gap: 1px 14px; min-height: 60px; box-sizing: border-box; padding: 8px 12px; border-radius: var(--tu-r); color: var(--color-text); text-decoration: none; font-size: 14.5px; transition: background 160ms ease; }
  .tu-semana-fila[data-sin="true"] { color: var(--color-muted); }
  .tu-semana-fila[data-foco="true"] { background: color-mix(in srgb, var(--color-primary) 9%, transparent); }
  .tu-semana-fecha { display: flex; align-items: baseline; gap: 8px; font-weight: 700; }
  .tu-semana-fecha .tu-num { font-size: 17px; }
  .tu-semana-fecha { grid-row: 1 / span 2; }
  .tu-semana-est { grid-column: 2; grid-row: 1; font-weight: 600; }
  .tu-semana-desde { grid-column: 2; grid-row: 2; font-size: 13px; color: var(--color-muted); white-space: nowrap; }
  .tu-semana-desde:empty { display: none; }
  .tu-semana-ir { grid-column: 3; grid-row: 1 / span 2; }
  .tu-semana-ir { color: var(--color-primary); transition: transform 200ms var(--tu-ease); }
  @media (hover: hover) { a.tu-semana-fila:hover .tu-semana-ir { transform: translateX(3px); } }
  @media (max-width: 720px) {
    .tu-semana { grid-template-columns: 1fr; }
    .tu-semana-svg { max-width: 300px; margin: 0 auto; }
    .tu-semana-fila { grid-template-columns: 66px minmax(0, 1fr) 16px; column-gap: 10px; padding: 8px 6px; }
  }

  /* ── Tarjeta de sellos (fidelidad) ──────────────────────────────────────── */
  .tu-sellos { position: relative; box-sizing: border-box; overflow: hidden; padding: 20px 20px 22px; border-radius: var(--tu-r2); background: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 26px 50px -30px var(--color-primary); text-align: left; }
  .tu-sitio[data-tarjeta="corte"] .tu-sellos { border-radius: 0; }
  .tu-sitio[data-tarjeta="filete"] .tu-sellos { border-radius: var(--tu-r); }
  /* La órbita de fondo: un anillo punteado que asoma por la esquina. */
  .tu-sellos::before { content: ''; position: absolute; right: -80px; top: -110px; width: 250px; height: 250px; border-radius: 50%; pointer-events: none; border: 1px dashed color-mix(in srgb, var(--color-on-primary) 46%, transparent); box-shadow: 0 0 0 36px color-mix(in srgb, var(--color-on-primary) 7%, transparent); }
  .tu-sellos-cab { position: relative; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .tu-sellos-nombre { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--tu-fh); font-weight: var(--tu-peso); font-size: 21px; line-height: 1.15; }
  .tu-sitio[data-mayus="true"] .tu-sellos-nombre { text-transform: uppercase; }
  .tu-sellos-cuenta { flex-shrink: 0; font-size: 14px; font-weight: 600; opacity: .88; }
  .tu-sellos-fila { position: relative; display: flex; flex-wrap: wrap; gap: 9px; margin: 0; padding: 0; list-style: none; }
  .tu-sello-ficha { display: grid; place-items: center; width: 42px; height: 42px; box-sizing: border-box; border-radius: 50%; border: 1.5px dashed color-mix(in srgb, var(--color-on-primary) 55%, transparent); color: color-mix(in srgb, var(--color-on-primary) 78%, transparent); font-size: 13px; font-weight: 600; }
  .tu-sello-ficha[data-premio="true"] { border-style: solid; color: var(--color-on-primary); }
  .tu-sello-ficha[data-hecho="true"] { border-style: solid; border-color: var(--color-on-primary); background: var(--color-on-primary); color: var(--color-primary); }
  .tu-sellos[data-compacta="true"] { padding: 14px 14px 16px; box-shadow: none; }
  .tu-sellos[data-compacta="true"] .tu-sellos-cab { margin-bottom: 12px; }
  .tu-sellos[data-compacta="true"] .tu-sellos-nombre { font-size: 17px; }
  .tu-sellos[data-compacta="true"] .tu-sellos-fila { gap: 7px; }
  .tu-sellos[data-compacta="true"] .tu-sello-ficha { width: 34px; height: 34px; font-size: 12px; }

  /* ── Entradas ───────────────────────────────────────────────────────────── */
  @keyframes tuFade { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
  @keyframes tuPulso { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--tu-ok, #22C55E) 55%, transparent) } 50% { box-shadow: 0 0 0 7px transparent } }
  @keyframes tuSube { to { transform: none } }
  @keyframes tuCinta { to { transform: translateX(-50%) } }
  .tu-entra { animation: tuFade 560ms var(--tu-ease, cubic-bezier(.2,.7,.2,1)) both; animation-delay: calc(var(--i, 0) * 70ms); }
  /* Visible por defecto: .tu-pre solo la pone el hook, en el cliente, a lo que está debajo del pliegue. */
  .tu-reveal.tu-pre { opacity: 0; }
  .tu-reveal.tu-on { animation: tuFade 760ms var(--tu-ease) both; animation-delay: var(--tu-d, 0ms); }
  .tu-linea { display: block; overflow: hidden; padding: 0 .06em .1em; margin: 0 -.06em; }
  .tu-linea > span { display: inline-block; transform: translateY(108%); animation: tuSube 1s cubic-bezier(.2,.8,.2,1) forwards; }
  .tu-cinta { display: flex; width: max-content; animation: tuCinta var(--tu-vel, 38s) linear infinite; }
  @media (hover: hover) { .tu-cinta:hover { animation-play-state: paused; } }

  /* ── Header ─────────────────────────────────────────────────────────────── */
  .tu-header { position: sticky; top: 40px; left: 0; right: 0; z-index: 80; color: var(--color-text); border-bottom: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-bg) 88%, transparent); -webkit-backdrop-filter: saturate(1.4) blur(14px); backdrop-filter: saturate(1.4) blur(14px);
    transition: background 250ms ease, border-color 250ms ease, color 250ms ease; }
  .tu-header[data-fijo="true"] { position: fixed; }
  .tu-header[data-transparente="true"] { color: #fff; border-color: transparent; background: linear-gradient(to bottom, rgba(0,0,0,.55), transparent); -webkit-backdrop-filter: none; backdrop-filter: none; }
  .tu-header-barra { height: 72px; display: flex; align-items: center; gap: 28px; }
  .tu-progreso { position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--color-primary); transform: scaleX(0); transform-origin: left; }
  .tu-header[data-transparente="true"] .tu-progreso { opacity: 0; }
  .tu-marca { display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 44px; color: inherit; text-decoration: none; }
  .tu-mono { position: relative; width: 42px; height: 42px; display: grid; place-items: center; flex-shrink: 0; border-radius: 50%; background: var(--color-primary); color: var(--color-on-primary); font-family: var(--tu-fh); font-size: 17px; font-weight: 700; transition: transform 300ms var(--tu-ease); }
  .tu-mono::after { content: ''; position: absolute; inset: -5px; border-radius: inherit; border: 1px dashed color-mix(in srgb, var(--color-primary) 60%, transparent); opacity: 0; transform: scale(.8); transition: opacity 250ms ease, transform 400ms var(--tu-ease); }
  .tu-sitio[data-estilo="box"] .tu-mono { border-radius: 0; transform: skewX(-8deg); }
  .tu-sitio[data-estilo="clinica"] .tu-mono { border-radius: 14px; }
  .tu-sitio[data-estilo="taller"] .tu-mono, .tu-sitio[data-estilo="atelier"] .tu-mono { border-radius: 999px 999px 12px 12px; }
  /* Con logo cargado, el monograma muestra la imagen (y pierde la inclinación del box: un logo torcido se ve roto). */
  .tu-mono--logo { overflow: hidden; background: var(--color-surface); box-shadow: 0 0 0 1px var(--color-border); }
  .tu-mono--logo img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .tu-sitio[data-estilo="box"] .tu-mono--logo { transform: none; }
  .tu-marca-nombre { font-family: var(--tu-fh); font-weight: 700; font-size: 21px; line-height: 1.1; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tu-sitio[data-mayus="true"] .tu-marca-nombre { text-transform: uppercase; letter-spacing: .02em; font-size: 23px; }
  .tu-nav { display: flex; gap: 4px; margin-left: auto; }
  .tu-nav-a { position: relative; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; color: inherit; text-decoration: none; opacity: .84; font-size: 14px; font-weight: 600; transition: opacity 150ms ease; }
  .tu-nav-a::after { content: ''; position: absolute; left: 12px; right: 12px; bottom: 9px; height: 1.5px; background: currentColor; transform: scaleX(0); transform-origin: left; transition: transform 250ms var(--tu-ease); }
  .tu-nav-a[aria-current="page"] { opacity: 1; }
  .tu-nav-a[aria-current="page"]::after { transform: scaleX(1); }
  .tu-acciones { display: flex; align-items: center; gap: 10px; margin-left: auto; }
  .tu-nav + .tu-acciones { margin-left: 0; }
  .tu-hamb { width: 44px; height: 44px; border-radius: var(--tu-r-btn, 10px); border: 1px solid var(--color-border); background: transparent; color: inherit; display: grid; place-items: center; cursor: pointer; transition: background 160ms ease, border-color 160ms ease; }
  .tu-header[data-transparente="true"] .tu-hamb { border-color: rgba(255,255,255,.4); }
  .tu-menu { border-top: 1px solid var(--color-border); background: var(--color-bg); padding: 8px 20px 22px; display: flex; flex-direction: column; max-height: calc(100vh - 112px); overflow-y: auto; }
  .tu-menu a:not(.tu-btn) { display: flex; align-items: center; justify-content: space-between; min-height: 56px; border-bottom: 1px solid var(--color-border); color: var(--color-text); text-decoration: none; font-family: var(--tu-fh); font-size: 22px; font-weight: var(--tu-peso); }
  .tu-sitio[data-mayus="true"] .tu-menu a:not(.tu-btn) { text-transform: uppercase; }
  .tu-menu .tu-btn { margin-top: 18px; }
  @media (hover: hover) {
    .tu-nav-a:hover { opacity: 1; }
    .tu-nav-a:hover::after { transform: scaleX(1); }
    .tu-marca:hover .tu-mono::after { opacity: 1; transform: none; }
    .tu-hamb:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
  }

  /* ── Encabezado mínimo (página simple: reserva y mis turnos) ────────────── */
  .tu-header--simple .tu-header-barra { height: 64px; gap: 10px; }
  .tu-header--simple .tu-mono { width: 36px; height: 36px; font-size: 14px; }
  .tu-header--simple .tu-marca-nombre { font-size: 18px; }
  .tu-sitio[data-mayus="true"] .tu-header--simple .tu-marca-nombre { font-size: 20px; }
  .tu-volver { display: grid; place-items: center; width: 44px; height: 44px; margin-left: -10px; flex-shrink: 0; border-radius: 50%; color: inherit; text-decoration: none; transition: background 160ms ease, transform 200ms var(--tu-ease); }
  @media (hover: hover) { .tu-volver:hover { background: color-mix(in srgb, currentColor 10%, transparent); transform: translateX(-2px); } }

  /* ── Pie ────────────────────────────────────────────────────────────────── */
  .tu-pie { position: relative; overflow: hidden; margin-top: clamp(80px, 9vw, 128px); border-top: 1px solid var(--color-border); background: var(--color-surface); }
  .tu-pie-anillos { right: -180px; bottom: -260px; opacity: .5; }
  .tu-pie-cols { position: relative; display: grid; grid-template-columns: minmax(0, 1.5fr) repeat(3, minmax(0, 1fr)); gap: 40px; padding-top: 64px; padding-bottom: 44px; }
  .tu-pie-nombre { font-size: clamp(30px, 3.4vw, 44px); margin-bottom: 10px; }
  .tu-pie-tag { font-size: 15px; line-height: 1.6; margin: 0 0 22px; color: var(--color-body); max-width: 300px; }
  .tu-pie-col { font-size: 14.5px; }
  .tu-pie-col .tu-rotulo { display: block; margin-bottom: 10px; }
  .tu-pie-col ul { list-style: none; margin: 0; padding: 0; }
  .tu-pie-col li > a, .tu-pie-col li > span { display: flex; align-items: center; gap: 9px; min-height: 36px; }
  /* Horario de un día: la mañana y la tarde son dos tramos que no se parten; si no entran en el renglón, la tarde baja. */
  .tu-horas-dia { display: inline-flex; justify-content: flex-end; gap: 1px 10px; white-space: nowrap; }
  .tu-horas-dia > span + span::before { content: '· '; opacity: .6; }
  .tu-horas-dia[data-apilado="true"] { flex-direction: column; align-items: flex-end; }
  .tu-horas-dia[data-apilado="true"] > span + span::before { content: none; }
  @media (max-width: 720px) {
    .tu-horas-dia { flex-direction: column; align-items: flex-end; }
    .tu-horas-dia > span + span::before { content: none; }
  }
  .tu-pie-hor { display: flex; justify-content: space-between; gap: 12px; max-width: 250px; min-height: 30px; padding: 3px 0; align-items: baseline; }
  .tu-pie-hor[data-hoy="true"] { color: var(--color-text); font-weight: 700; }
  .tu-pie-hor[data-cerrado="true"] { color: var(--color-muted); }
  .tu-pie-base { position: relative; display: flex; flex-wrap: wrap; gap: 8px 22px; align-items: center; padding-top: 18px; padding-bottom: 26px; border-top: 1px solid var(--color-border); font-size: 13px; color: var(--color-muted); }
  .tu-pie-base .tu-link-suave { font-size: 13px; }
  .tu-sello { margin-left: auto; display: inline-flex; align-items: center; gap: 11px; min-height: 48px; padding: 0 16px 0 12px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); text-decoration: none; transition: border-color 200ms ease, box-shadow 240ms ease, transform 240ms var(--tu-ease); }
  .tu-sello-txt { display: flex; flex-direction: column; line-height: 1.15; }
  .tu-sello-rot { font: 500 9.5px var(--tu-fm); letter-spacing: .12em; text-transform: uppercase; color: var(--color-muted); }
  .tu-sello-marca { font: 700 15px 'Sora', 'Geist', system-ui, sans-serif; letter-spacing: -.02em; }
  /* Página simple: solo los legales y el sello, sin columnas ni fondo. */
  .tu-pie--simple { margin-top: 0; border-top: none; background: transparent; }
  .tu-pie--simple .tu-pie-base { border-top: 1px solid var(--color-border); justify-content: center; padding-top: 14px; padding-bottom: 20px; }
  .tu-pie--simple .tu-sello { margin-left: 0; }
  @media (hover: hover) { .tu-sello:hover { border-color: #3B82F6; box-shadow: 0 0 0 4px rgba(59,130,246,.16), 0 14px 30px -16px rgba(59,130,246,.7); transform: translateY(-2px); } }

  /* ── Barra fija de celular ──────────────────────────────────────────────── */
  .tu-movil-cta { display: none; position: fixed; left: 0; right: 0; bottom: 0; z-index: 90; align-items: center; gap: 12px; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-bg) 90%, transparent); -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4); }
  .tu-movil-cta-txt { min-width: 0; flex: 1; line-height: 1.25; }
  .tu-movil-cta-txt b { display: block; font-size: 15px; color: var(--color-text); }
  .tu-movil-cta .tu-btn { height: 50px; padding: 0 20px; flex-shrink: 0; }

  @media (max-width: 960px) { .tu-pie-cols { grid-template-columns: 1fr 1fr; } .tu-pie-cols > :first-child { grid-column: 1 / -1; } }
  @media (max-width: 860px) {
    .tu-nav-desk { display: none !important; }
    .tu-cont { padding: 0 20px; }
    .tu-movil-cta { display: flex; }
    .tu-sitio[data-cta-movil="true"] .tu-pie { padding-bottom: 84px; }
    .tu-header-barra { height: 64px; gap: 14px; }
    .tu-nav + .tu-acciones { margin-left: auto; }
    .tu-hora { height: 44px; }
    .tu-sello { margin-left: 0; }
    .tu-pie-col li > a, .tu-pie-col li > span { min-height: 44px; }
  }
  @media (max-width: 560px) { .tu-pie-cols { grid-template-columns: 1fr; gap: 30px; padding-top: 48px; } }
  @media (min-width: 861px) { .tu-nav-movil { display: none !important; } }

  /* ── Ventanas (legales, fotos en grande) ────────────────────────────────── */
  /* El velo deja libre arriba la franja de la barra de la demo (40px). */
  @keyframes tuVelo { from { opacity: 0 } to { opacity: 1 } }
  .tu-velo { position: fixed; inset: 0; z-index: 180; display: grid; place-items: center; box-sizing: border-box; padding: 56px 16px 16px; background: rgba(0,0,0,.62); -webkit-backdrop-filter: blur(5px); backdrop-filter: blur(5px); animation: tuVelo 200ms ease both; }
  .tu-dialogo { width: 100%; max-width: 560px; max-height: calc(100vh - 72px); overflow-y: auto; box-sizing: border-box; padding: 26px; border-radius: var(--tu-r2); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-body); text-align: left;
    box-shadow: 0 40px 90px -24px rgba(0,0,0,.7); animation: tuFade 280ms var(--tu-ease) both; }
  .tu-sitio[data-tarjeta="corte"] .tu-dialogo { border-radius: 0; }
  .tu-dialogo:focus { outline: none; }
  .tu-dialogo-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .tu-dialogo-cab .tu-h { flex: 1; min-width: 0; font-size: 27px; }
  .tu-dialogo h3 { margin: 18px 0 6px; font: 700 15px var(--tu-fb); color: var(--color-text); }
  .tu-dialogo p { margin: 0 0 10px; font-size: 14.5px; line-height: 1.65; }
  .tu-dialogo-nota { display: flex; gap: 9px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--color-border); font-size: 13px; line-height: 1.55; color: var(--color-muted); }
  .tu-dialogo-nota > svg { flex-shrink: 0; margin-top: 2px; }
  .tu-dialogo-pie { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
  .tu-dialogo-pie > * { flex: 1 1 160px; }
  .tu-cerrar { display: inline-grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; padding: 0; border-radius: 50%; border: 1px solid var(--color-border); background: transparent; color: var(--color-text); cursor: pointer; transition: border-color 160ms ease, background 160ms ease; }
  .tu-campo { display: block; margin-bottom: 14px; font-size: 14px; font-weight: 700; color: var(--color-text); }
  .tu-campo input { display: block; width: 100%; height: 50px; box-sizing: border-box; margin-top: 6px; padding: 0 14px; border-radius: var(--tu-r); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font: 500 16px var(--tu-fb); }
  .tu-campo input[aria-invalid="true"] { border-color: var(--tu-lleno); }
  .tu-campo-error { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 13.5px; font-weight: 600; color: var(--tu-lleno); }
  .tu-listo { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 0 4px; text-align: center; }
  .tu-listo-ico { display: grid; place-items: center; width: 56px; height: 56px; margin-bottom: 8px; border-radius: 50%; background: color-mix(in srgb, var(--tu-ok) 16%, transparent); color: var(--tu-ok); }
  /* Un botón con aspecto de link (los legales del pie abren una ventana, no navegan). */
  button.tu-link-suave { padding: 0; border: none; background: none; font: inherit; text-align: left; cursor: pointer; }
  /* Un dato del negocio que no es link (el teléfono de ejemplo no se puede llamar). */
  .tu-dato { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; }

  /* WhatsApp e Instagram simulados (ContactoDemo.tsx): colores propios de cada app, no del tema. */
  .tu-wa { overflow: hidden; border-radius: var(--tu-r); border: 1px solid var(--color-border); }
  .tu-wa-cab { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #075E54; color: #FFFFFF; }
  .tu-wa-cab b { display: block; font-size: 15px; line-height: 1.25; }
  .tu-wa-estado { display: block; font-size: 12.5px; opacity: .85; }
  .tu-wa-chat { display: flex; flex-direction: column; gap: 6px; min-height: 160px; padding: 14px; background: #EFEAE2; }
  .tu-wa-aviso { align-self: center; padding: 5px 10px; border-radius: 8px; background: #FFF3C4; color: #54656F; font-size: 12.5px; }
  .tu-wa-msj { max-width: 84%; padding: 7px 10px 5px; border-radius: 10px; background: #FFFFFF; color: #111B21; font-size: 14.5px; line-height: 1.45; box-shadow: 0 1px 1px rgba(0,0,0,.1); overflow-wrap: anywhere; animation: tuFade 240ms var(--tu-ease) both; }
  .tu-wa-msj[data-yo] { align-self: flex-end; background: #D9FDD3; }
  .tu-wa-hora { display: flex; justify-content: flex-end; align-items: center; gap: 3px; margin-top: 2px; font-size: 11px; color: #667781; }
  .tu-wa-msj[data-yo] .tu-wa-hora svg { color: #53BDEB; }
  .tu-wa-escribir { display: flex; gap: 8px; padding: 10px; background: #F0F2F5; }
  .tu-wa-escribir input { flex: 1; min-width: 0; height: 44px; box-sizing: border-box; padding: 0 16px; border-radius: 22px; border: 1px solid #D1D7DB; background: #FFFFFF; color: #111B21; font: 500 16px var(--tu-fb); }
  .tu-wa-escribir button { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; padding: 0; border-radius: 50%; border: none; background: #00A884; color: #FFFFFF; cursor: pointer; transition: opacity 160ms ease; }
  .tu-wa-escribir button:disabled { opacity: .45; cursor: not-allowed; }
  .tu-wa-escribir input:focus-visible, .tu-wa-escribir button:focus-visible { outline: 2px solid #00A884; outline-offset: 2px; }
  .tu-ig-cab { display: flex; align-items: center; gap: 16px; }
  .tu-ig-avatar { display: grid; place-items: center; width: 76px; height: 76px; flex-shrink: 0; border-radius: 50%; background: var(--color-primary); color: var(--color-on-primary); font: 700 24px var(--tu-fh);
    box-shadow: 0 0 0 3px var(--color-bg), 0 0 0 5px #DD2A7B; }
  .tu-ig-usuario { display: block; font-size: 17px; color: var(--color-text); overflow-wrap: anywhere; }
  .tu-ig-nombre { display: block; font-size: 14px; color: var(--color-muted); }
  .tu-ig-numeros { display: flex; gap: 4px 16px; flex-wrap: wrap; margin-top: 8px; font-size: 13.5px; }
  .tu-ig-numeros b { color: var(--color-text); }
  .tu-dialogo .tu-ig-bio { margin: 14px 0 12px; font-size: 14px; }
  .tu-ig .tu-btn, .tu-ig .tu-btn-sec { width: 100%; height: 44px; }
  .tu-ig-grilla { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; margin: 16px 0 0; padding: 0; list-style: none; }
  .tu-ig-grilla img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; }
  @media (hover: hover) { .tu-cerrar:hover { border-color: var(--color-primary); background: var(--color-primary-bg); } }
  @media (max-width: 560px) {
    .tu-velo { place-items: end center; padding: 56px 0 0; }
    .tu-dialogo { max-width: none; max-height: calc(100vh - 56px); padding: 22px 16px calc(20px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; border-bottom: none; }
    .tu-sitio[data-tarjeta="corte"] .tu-dialogo { border-radius: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .tu-sitio *, .tu-sitio *::before, .tu-sitio *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    .tu-reveal.tu-pre { opacity: 1; }
    .tu-linea > span { transform: none; }
    .tu-btn::after { display: none; }
  }
`

// ═════════════════════════════════════════════════════════════════════════════
// Portada
// ═════════════════════════════════════════════════════════════════════════════

export const CSS_PORTADA = `
  /* ── Hero: lo común ─────────────────────────────────────────────────────── */
  .tup-hero { position: relative; }
  .tup-hero .tu-h1 { margin-top: 18px; }
  .tup-hero-p { font-size: clamp(17px, 1.6vw, 20px); line-height: 1.6; color: var(--color-body); margin: 22px 0 0; max-width: 54ch; }
  .tup-hero-p b { color: var(--color-text); font-weight: 700; }
  .tup-hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 32px; }
  /* La luz ambiente se apaga hacia abajo: sin la máscara, el hero termina en un borde duro. */
  .tup-hero-luz { position: absolute; inset: 0 0 -120px; z-index: -1; pointer-events: none; background: var(--tu-grad); -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent); mask-image: linear-gradient(to bottom, #000 55%, transparent); }
  .tup-social { display: inline-flex; align-items: center; gap: 14px; margin-top: 30px; min-height: 48px; color: var(--color-text); text-decoration: none; font-size: 15px; }
  .tup-social b { display: block; font-size: 15px; font-weight: 700; line-height: 1.3; }
  .tup-social-det { display: block; font-size: 13.5px; color: var(--color-muted); transition: color 160ms ease; }
  .tup-social-ico { display: grid; place-items: center; width: 42px; height: 42px; flex-shrink: 0; border-radius: 50%; background: var(--color-primary); color: var(--color-on-primary); }
  .tup-caras { display: flex; }
  .tup-caras img { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 2px solid var(--color-bg); margin-left: -12px; transition: transform 260ms var(--tu-ease); }
  .tup-caras img:first-child { margin-left: 0; }
  @media (hover: hover) {
    .tup-social:hover .tup-social-det { color: var(--color-primary); }
    .tup-social:hover .tup-caras img { transform: translateX(4px); }
    .tup-social:hover .tup-caras img:first-child { transform: translateX(-2px); }
  }

  /* ── Heros con foto a sangre (cine, impacto) ────────────────────────────── */
  .tup-hero--cine, .tup-hero--impacto { display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; min-height: max(660px, calc(100vh - 40px));
    --color-text: #FFFFFF; --color-body: rgba(255,255,255,.88); --color-muted: rgba(255,255,255,.76); --color-border: rgba(255,255,255,.3); }
  @keyframes tupKen { from { transform: scale(1.1) } to { transform: scale(1) } }
  .tup-hero-foto { position: absolute; inset: 0; overflow: hidden; animation: tupKen 2.4s var(--tu-ease) both; }
  .tup-hero-foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; will-change: transform; }
  .tup-hero-velo { position: absolute; inset: 0; pointer-events: none; }
  .tup-hero--cine .tup-hero-velo { background: linear-gradient(90deg, rgba(10,8,5,.9) 0%, rgba(10,8,5,.66) 42%, rgba(10,8,5,.3) 100%), linear-gradient(180deg, rgba(0,0,0,.5) 0%, transparent 30%, transparent 62%, var(--color-bg) 100%); }
  .tup-hero--impacto .tup-hero-velo { background: linear-gradient(90deg, rgba(6,6,8,.94) 0%, rgba(6,6,8,.72) 46%, rgba(6,6,8,.35) 100%), linear-gradient(180deg, rgba(0,0,0,.55) 0%, transparent 28%, transparent 55%, var(--color-bg) 100%); }
  .tup-hero-cuerpo { position: relative; width: 100%; box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 390px); gap: 48px; align-items: end; padding-top: 170px; padding-bottom: 60px; }
  .tup-hero--cine .tu-h1 { font-size: clamp(46px, 8vw, 122px); line-height: .96; }
  .tup-hero--cine .tu-btn-sec, .tup-hero--impacto .tu-btn-sec { color: #fff; border-color: rgba(255,255,255,.42); }
  .tup-hero--cine .tup-caras img, .tup-hero--impacto .tup-caras img { border-color: rgba(10,8,5,.9); }

  /* En una columna flex, el margin auto de .tu-cont lo encoge al contenido: hay que pedirle el ancho. */
  .tup-hero--cine > .tu-cont, .tup-hero--impacto > .tu-cont { width: 100%; box-sizing: border-box; }
  .tup-hero--impacto .tup-hero-cuerpo { padding-bottom: 36px; }
  .tup-hero--impacto .tu-h1 { font-size: clamp(60px, 10.5vw, 164px); line-height: .86; letter-spacing: -.01em; }
  .tup-hero--impacto .tu-h1 em { color: transparent; -webkit-text-stroke: 2px var(--color-primary); }
  .tup-hero-franjas { position: absolute; right: -60px; top: 120px; width: 300px; height: 300px; pointer-events: none; opacity: .5; background: repeating-linear-gradient(135deg, var(--color-primary) 0 3px, transparent 3px 18px);
    -webkit-mask-image: radial-gradient(circle at 70% 30%, #000, transparent 68%); mask-image: radial-gradient(circle at 70% 30%, #000, transparent 68%); }
  .tup-tablero { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; margin: 0 0 44px; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
  .tup-tablero > div { padding: 18px 22px; border-left: 1px solid var(--color-border); transition: background 200ms ease; }
  .tup-tablero > div:first-child { border-left: none; padding-left: 0; }
  .tup-tablero dd { margin: 0; font-size: clamp(30px, 3.6vw, 46px); font-weight: 600; line-height: 1; color: var(--color-primary); }
  .tup-tablero dt { margin-top: 8px; }
  .tup-tablero-estado { display: flex; align-items: center; }
  @media (hover: hover) { .tup-tablero > div:not(:first-child):hover { background: rgba(255,255,255,.05); } }

  /* ── Hero partido (clínica, atelier) ────────────────────────────────────── */
  .tup-hero--partido { padding: clamp(36px, 5vw, 72px) 0 24px; }
  .tup-hp { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: clamp(36px, 5vw, 76px); align-items: center; }
  .tup-hero--partido .tu-h1 { font-size: clamp(40px, 5.6vw, 82px); line-height: 1.02; }
  .tu-sitio[data-estilo="atelier"] .tup-hero--partido .tu-h1 { font-size: clamp(46px, 6.6vw, 98px); line-height: .98; }
  .tup-hp-lado { position: relative; }
  .tup-hp-anillos { right: -170px; top: -120px; z-index: -1; opacity: .7; }
  .tup-hp-marco { aspect-ratio: 4 / 4.5; border-radius: 32px 32px 32px 140px; box-shadow: 0 50px 90px -50px color-mix(in srgb, var(--color-text) 60%, transparent); }
  .tu-sitio[data-forma="arco"] .tup-hp-marco { border-radius: 999px 999px var(--tu-r2) var(--tu-r2); aspect-ratio: 4 / 4.9; }
  @keyframes tupFlota { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
  .tup-hp-mini { position: absolute; right: -22px; top: 9%; width: 30%; aspect-ratio: 1; border-radius: 50%; border: 6px solid var(--color-bg); box-shadow: 0 30px 60px -30px rgba(0,0,0,.5); animation: tupFlota 7s ease-in-out infinite; }
  .tup-hp-prox { position: absolute; left: -36px; bottom: 34px; width: min(370px, 92%); }

  /* ── Hero collage (taller) ──────────────────────────────────────────────── */
  .tup-hero--collage { padding: clamp(40px, 5vw, 76px) 0 56px; text-align: center; }
  .tup-hero--collage .tup-hero-txt { display: flex; flex-direction: column; align-items: center; }
  .tup-hero--collage .tu-h1 { font-size: clamp(46px, 7.4vw, 112px); line-height: .98; }
  .tup-hero--collage .tup-hero-ctas { justify-content: center; }
  .tup-hero--collage .tup-social { text-align: left; }
  .tup-collage { position: relative; display: grid; grid-template-columns: 1fr 1.22fr 1fr; gap: clamp(10px, 2vw, 26px); align-items: end; max-width: 1000px; margin: 56px auto 0; }
  .tup-collage-f { border-radius: 999px 999px var(--tu-r2) var(--tu-r2); box-shadow: 0 40px 70px -40px color-mix(in srgb, var(--color-text) 60%, transparent); border: 6px solid var(--color-surface); box-sizing: border-box; transition: transform 500ms var(--tu-ease); }
  .tup-collage-f0 { aspect-ratio: 3 / 3.9; transform: rotate(-4deg) translateY(-18px); }
  .tup-collage-f1 { aspect-ratio: 3 / 4.1; }
  .tup-collage-f2 { aspect-ratio: 3 / 3.9; transform: rotate(4deg) translateY(-18px); }
  .tup-collage-prox { position: absolute; left: 50%; bottom: -30px; width: min(390px, 92%); transform: translateX(-50%); }
  @media (hover: hover) {
    .tup-collage-f0:hover { transform: rotate(-2deg) translateY(-26px); }
    .tup-collage-f2:hover { transform: rotate(2deg) translateY(-26px); }
    .tup-collage-f1:hover { transform: translateY(-8px); }
  }

  /* ── Cinta del box ──────────────────────────────────────────────────────── */
  .tup-cinta-marco { overflow: hidden; padding: 14px 0; margin: -8px 0 0; }
  .tup-cinta-banda { overflow: hidden; background: var(--color-primary); color: var(--color-on-primary); padding: 16px 0; transform: rotate(-1.2deg) scale(1.04); }
  .tup-cinta-item { display: inline-flex; align-items: center; gap: 28px; padding-right: 28px; font-size: 28px; font-weight: 800; font-style: italic; white-space: nowrap; text-transform: uppercase; }

  /* ── Franja de confianza ────────────────────────────────────────────────── */
  .tup-confianza { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; overflow: hidden; background: var(--color-border); border: 1px solid var(--color-border); border-radius: var(--tu-r2); }
  .tu-sitio[data-tarjeta="corte"] .tup-confianza { border-radius: 0; }
  .tu-sitio[data-tarjeta="suave"] .tup-confianza { box-shadow: var(--tu-sombra); }
  .tup-confianza li { background: var(--color-surface); }
  .tu-sitio[data-tarjeta="suave"] .tup-confianza li { background: var(--color-bg); }
  .tup-dato { display: flex; align-items: center; gap: 14px; min-height: 88px; height: 100%; box-sizing: border-box; padding: 18px 22px; color: inherit; text-decoration: none; transition: background 200ms ease; }
  .tup-dato-ico { width: 42px; height: 42px; border-radius: var(--tu-r); display: grid; place-items: center; flex-shrink: 0; background: var(--color-primary-bg); color: var(--color-primary); transition: transform 260ms var(--tu-ease), background 200ms ease, color 200ms ease; }
  .tup-dato-tit { display: block; font-size: 15px; font-weight: 700; color: var(--color-text); line-height: 1.3; }
  .tup-dato-txt { display: block; font-size: 13.5px; color: var(--color-muted); }
  @media (hover: hover) {
    a.tup-dato:hover { background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface)); }
    a.tup-dato:hover .tup-dato-ico { background: var(--color-primary); color: var(--color-on-primary); transform: rotate(-8deg) scale(1.06); }
  }

  /* ── Disponibilidad ─────────────────────────────────────────────────────── */
  .tup-disp { display: grid; grid-template-columns: minmax(0, .78fr) minmax(0, 1.7fr); gap: clamp(28px, 4vw, 56px); align-items: center; padding: clamp(24px, 4vw, 56px); background-image: var(--tu-grad); overflow: hidden; }
  .tup-disp .tu-eyebrow { margin-bottom: 14px; }

  /* ── Grillas ────────────────────────────────────────────────────────────── */
  .tup-grilla, .tu-grilla { display: grid; gap: 20px; }
  /* Servicios: la grilla se arma según cuántos hay, para que nunca quede una tarjeta suelta en la última fila. */
  .tu-grilla--sv { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tu-grilla--sv[data-n="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .tu-grilla--sv[data-n="5"] { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .tu-grilla--sv[data-n="5"] > * { grid-column: span 2; }
  .tu-grilla--sv[data-n="5"] > :nth-child(n+4) { grid-column: span 3; }
  @media (max-width: 980px) {
    .tu-grilla--sv, .tu-grilla--sv[data-n="4"], .tu-grilla--sv[data-n="5"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .tu-grilla--sv[data-n="5"] > *, .tu-grilla--sv[data-n="5"] > :nth-child(n+4) { grid-column: auto; }
    .tu-grilla--sv[data-n="3"] > :last-child, .tu-grilla--sv[data-n="5"] > :last-child { grid-column: 1 / -1; }
  }
  @media (max-width: 600px) {
    .tu-grilla--sv, .tu-grilla--sv[data-n="4"], .tu-grilla--sv[data-n="5"] { grid-template-columns: minmax(0, 1fr); }
    .tu-grilla--sv > :nth-child(n) { grid-column: auto !important; }
  }
  .tu-grilla--cl { grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr)); }
  .tu-grilla--eq { grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr)); }
  .tu-grilla > .tu-reveal { display: flex; }
  .tu-grilla > .tu-reveal > * { flex: 1; min-width: 0; }

  /* ── Servicios ──────────────────────────────────────────────────────────── */
  .tup-sv { display: flex; flex-direction: column; overflow: hidden; }
  .tup-sv-cab { display: flex; align-items: flex-start; justify-content: space-between; padding: 26px 26px 0; }
  .tup-sv-ico { width: 50px; height: 50px; border-radius: var(--tu-r); display: grid; place-items: center; background: var(--color-primary-bg); color: var(--color-primary); transition: transform 300ms var(--tu-ease), background 200ms ease, color 200ms ease; }
  .tup-sv-n { font-size: 13px; color: var(--color-muted); }
  .tu-sitio[data-tarjeta="corte"] .tup-sv-n { font-size: 40px; font-weight: 600; line-height: 1; color: color-mix(in srgb, var(--color-text) 16%, transparent); margin-right: 14px; transition: color 200ms ease; }
  .tup-sv-foto { aspect-ratio: 16 / 10; margin: 10px 10px 0; border-radius: calc(var(--tu-r2) - 8px); }
  .tu-sitio[data-estilo="atelier"] .tup-sv-foto { border-radius: 999px 999px calc(var(--tu-r2) - 8px) calc(var(--tu-r2) - 8px); aspect-ratio: 5 / 4; }
  .tup-sv-cuerpo { position: relative; z-index: 2; display: flex; flex-direction: column; flex: 1; padding: 22px 26px 24px; }
  .tup-sv-nombre { font-size: 24px; margin-bottom: 8px; }
  .tu-sitio[data-mayus="true"] .tup-sv-nombre { font-size: 28px; }
  .tup-sv-dur { display: flex; align-items: center; gap: 7px; font-size: 14px; color: var(--color-muted); }
  .tup-sv-pie { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 26px; }
  @media (hover: hover) {
    .tup-sv:hover .tup-sv-ico { transform: rotate(-8deg) scale(1.06); background: var(--color-primary); color: var(--color-on-primary); }
    .tu-sitio[data-tarjeta="corte"] .tup-sv:hover .tup-sv-n { color: var(--color-primary); }
  }

  .tup-carta-lista { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 430px), 1fr)); column-gap: 64px; }
  .tup-carta { display: block; padding: 22px 4px; min-height: 48px; border-bottom: 1px solid var(--color-border); text-decoration: none; color: var(--color-text); transition: border-color 220ms ease; }
  .tup-carta-fila { display: flex; align-items: baseline; gap: 12px; transition: transform 300ms var(--tu-ease); }
  .tup-carta-n { font-size: 12.5px; color: var(--color-primary); }
  .tup-carta-nombre { font-size: clamp(22px, 2.3vw, 28px); transition: color 200ms ease; }
  .tup-carta-puntos { flex: 1; min-width: 16px; border-bottom: 1.5px dotted var(--color-muted); opacity: .5; transform: translateY(-6px); }
  .tup-carta-det { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--color-muted); margin-top: 6px; padding-left: 30px; }
  .tup-carta-cta { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; color: var(--color-primary); font-weight: 700; transition: opacity 200ms ease, transform 200ms ease; }
  .tup-carta-foto { position: fixed; left: 0; top: 0; width: 220px; height: 270px; pointer-events: none; z-index: 60; border-radius: var(--tu-r); overflow: hidden; border: 1px solid color-mix(in srgb, var(--color-primary) 50%, transparent); box-shadow: 0 30px 60px -20px rgba(0,0,0,.7); transition: opacity 250ms ease; display: none; }
  .tup-carta-foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: opacity 250ms ease; }
  @media (hover: hover) {
    .tup-carta-foto { display: block; }
    .tup-carta .tup-carta-cta { opacity: 0; transform: translateX(-6px); }
    .tup-carta:hover, .tup-carta:focus-visible { border-color: var(--color-primary); }
    .tup-carta:hover .tup-carta-fila { transform: translateX(10px); }
    .tup-carta:hover .tup-carta-nombre { color: var(--color-primary); }
    .tup-carta:hover .tup-carta-cta, .tup-carta:focus-visible .tup-carta-cta { opacity: 1; transform: none; }
  }

  /* ── Clases con cupo ────────────────────────────────────────────────────── */
  .tup-clase { display: flex; flex-direction: column; padding: 24px; }
  .tup-clase > * { position: relative; z-index: 2; }
  .tup-clase-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .tup-clase-hora { display: block; font-size: 38px; font-weight: 600; line-height: 1.05; color: var(--color-text); margin-top: 4px; }
  .tup-clase-nombre { display: block; font-size: 23px; margin: 18px 0 6px; }
  .tu-sitio[data-mayus="true"] .tup-clase-nombre { font-size: 28px; }
  .tup-clase-det { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-size: 14px; color: var(--color-muted); }
  .tup-clase-pie { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 22px; }

  /* ── Canchas ────────────────────────────────────────────────────────────── */
  .tup-cancha { display: flex; flex-direction: column; overflow: hidden; }
  .tup-cancha-dib { padding: 22px 22px 0; color: var(--color-primary); }
  .tup-cancha-svg { display: block; width: 100%; height: auto; border-radius: 4px; background: color-mix(in srgb, var(--color-primary) 7%, transparent); transition: background 240ms ease; }
  .tup-cancha-cuerpo { position: relative; z-index: 2; display: flex; flex-direction: column; gap: 12px; padding: 20px 22px 24px; }
  @media (hover: hover) { .tup-cancha:hover .tup-cancha-svg { background: color-mix(in srgb, var(--color-primary) 16%, transparent); } }

  /* ── Equipo ─────────────────────────────────────────────────────────────── */
  .tup-pro { overflow: hidden; display: flex; flex-direction: column; }
  .tup-pro-foto { aspect-ratio: 4 / 4.5; color: #fff; }
  .tu-sitio[data-forma="arco"] .tup-pro-foto { margin: 10px 10px 0; border-radius: 999px 999px calc(var(--tu-r2) - 8px) calc(var(--tu-r2) - 8px); }
  .tu-sitio[data-forma="redonda"] .tup-pro-foto { margin: 10px 10px 0; border-radius: calc(var(--tu-r2) - 6px); }
  .tup-pro-velo { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.84), rgba(0,0,0,.2) 46%, transparent 62%); }
  .tup-pro-nombre { position: absolute; left: 22px; right: 22px; bottom: 20px; font-size: 14px; color: rgba(255,255,255,.9); }
  .tup-pro-nombre .tu-h { display: block; font-size: 27px; color: #fff; margin-bottom: 3px; }
  .tu-sitio[data-forma="arco"] .tup-pro-nombre { text-align: center; }
  .tup-pro-pie { position: relative; z-index: 2; padding: 18px 20px 22px; display: flex; flex-direction: column; gap: 12px; }

  /* ── Galería ────────────────────────────────────────────────────────────── */
  .tup-gal { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-auto-rows: clamp(180px, 20vw, 270px); gap: 14px; }
  .tup-gal-item { position: relative; margin: 0; overflow: hidden; border-radius: var(--tu-r2); cursor: zoom-in; }
  .tu-sitio[data-tarjeta="corte"] .tup-gal-item { border-radius: 0; }
  .tup-gal-item .tu-foto { position: absolute; inset: 0; }
  .tup-gal-item:nth-child(1) { grid-column: 1 / 6; grid-row: span 2; }
  .tup-gal-item:nth-child(2) { grid-column: 6 / 10; }
  .tup-gal-item:nth-child(3) { grid-column: 10 / 13; }
  .tup-gal-item:nth-child(4) { grid-column: 6 / 9; }
  .tup-gal-item:nth-child(5) { grid-column: 9 / 13; }
  .tup-gal[data-n="4"] .tup-gal-item:nth-child(4) { grid-column: 6 / 13; }
  .tu-sitio[data-forma="arco"] .tup-gal-item:nth-child(1) { border-radius: 999px 999px var(--tu-r2) var(--tu-r2); }
  .tup-gal-item figcaption { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; display: flex; gap: 10px; align-items: baseline; padding: 44px 18px 16px; font-size: 14px; font-weight: 600; color: #fff; background: linear-gradient(to top, rgba(0,0,0,.82), transparent); transition: opacity 260ms ease, transform 300ms var(--tu-ease); }
  .tup-gal-item figcaption .tu-num { font-size: 11.5px; opacity: .8; }
  .tu-sitio[data-forma="arco"] .tup-gal-item:nth-child(1) figcaption { justify-content: center; }
  @media (hover: hover) {
    .tup-gal-item figcaption { opacity: 0; transform: translateY(10px); }
    .tup-gal-item:hover figcaption { opacity: 1; transform: none; }
    .tup-gal:hover .tup-gal-item:not(:hover) .tu-foto { filter: saturate(.55) brightness(.8); }
    .tup-gal-item .tu-foto { transition: filter 300ms ease; }
  }
  /* Cada foto es un botón que ocupa todo el marco y la abre en grande. */
  .tup-gal-abrir { position: absolute; inset: 0; z-index: 3; width: 100%; height: 100%; padding: 0; border: none; border-radius: inherit; background: transparent; cursor: zoom-in; }
  .tu-sitio .tup-gal-abrir:focus-visible { outline-offset: -5px; }
  .tup-gal-item:focus-within figcaption { opacity: 1; transform: none; }
  .tu-velo.tup-velo-foto { place-items: center; padding: 56px 16px 16px; background: rgba(0,0,0,.88); }
  .tup-visor { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 1080px; min-width: 0; color: #fff; animation: tuFade 280ms var(--tu-ease) both; }
  .tup-visor:focus { outline: none; }
  .tup-visor-cab, .tup-visor-pie { display: flex; align-items: center; gap: 12px; }
  .tup-visor-cuenta { flex: 1; font-size: 13px; letter-spacing: .06em; color: rgba(255,255,255,.8); }
  .tup-visor-foto { display: grid; place-items: center; min-width: 0; cursor: zoom-out; }
  .tup-visor-foto img { display: block; max-width: 100%; max-height: calc(100vh - 220px); object-fit: contain; border-radius: var(--tu-r2); cursor: default; }
  .tu-sitio[data-tarjeta="corte"] .tup-visor-foto img { border-radius: 0; }
  .tup-visor-txt { flex: 1; min-width: 0; text-align: center; font-size: 15px; font-weight: 600; line-height: 1.4; }
  .tup-visor-btn { display: inline-grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; padding: 0; border-radius: 50%; border: 1px solid rgba(255,255,255,.4); background: rgba(0,0,0,.4); color: #fff; cursor: pointer; transition: background 160ms ease, border-color 160ms ease; }
  .tu-sitio .tup-visor-btn:focus-visible { outline-color: #fff; }
  @media (hover: hover) { .tup-visor-btn:hover { background: rgba(255,255,255,.18); border-color: #fff; } }

  /* ── Nosotros ───────────────────────────────────────────────────────────── */
  .tup-nos { display: grid; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); gap: clamp(28px, 5vw, 76px); align-items: start; }
  .tup-nos-cab { position: sticky; top: 150px; }
  .tup-nos-cab .tu-eyebrow { margin-bottom: 14px; }
  /* El número arriba y su rótulo abajo (en el HTML va primero el rótulo: es el término de la lista). */
  .tup-nos-datos { display: flex; margin: clamp(28px, 3.4vw, 44px) 0 0; }
  .tup-nos-datos > div { display: flex; flex-direction: column; gap: 8px; padding: 0 clamp(16px, 2.2vw, 30px); border-left: 1px solid var(--color-border); }
  .tup-nos-datos > div:first-child { padding-left: 0; border-left: none; }
  .tup-nos-datos dd { order: -1; margin: 0; font-size: clamp(34px, 4vw, 54px); font-weight: 600; line-height: 1; color: var(--color-primary); }
  .tup-nos-txt { overflow: hidden; padding: clamp(26px, 3.6vw, 46px); }
  .tup-nos-txt > :not(.tu-anillos) { position: relative; z-index: 2; }
  .tup-nos-anillos { right: -170px; top: -170px; opacity: .4; }
  .tup-nos-txt p { margin: 0 0 16px; max-width: 60ch; font-size: 16.5px; line-height: 1.7; color: var(--color-body); }
  .tup-nos-txt .tup-nos-lead { font-family: var(--tu-fh); font-weight: var(--tu-peso); font-size: clamp(21px, 2.1vw, 27px); line-height: 1.36; letter-spacing: -.01em; color: var(--color-text); text-wrap: pretty; }
  .tu-sitio[data-estilo="box"] .tup-nos-lead { font-family: var(--tu-fb); font-weight: 600; font-size: clamp(19px, 1.8vw, 23px); }
  .tup-nos-valores { display: grid; gap: 11px; margin: 24px 0 0; padding: 24px 0 0; list-style: none; border-top: 1px solid var(--color-border); }
  .tup-nos-valores li { display: flex; align-items: center; gap: 12px; font-size: 15.5px; font-weight: 600; color: var(--color-text); }
  .tup-nos-tilde { display: grid; place-items: center; width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%; background: var(--color-primary-bg); color: var(--color-primary); }
  .tup-nos-firma { display: flex; align-items: center; gap: 12px; margin-top: 28px; }
  .tup-nos-firma b { display: block; font-size: 15px; color: var(--color-text); }
  .tup-nos-firma span > span { display: block; font-size: 13.5px; color: var(--color-muted); }

  /* ── Beneficios de la cuenta ────────────────────────────────────────────── */
  .tup-ben { display: grid; grid-template-columns: minmax(0, 1.06fr) minmax(0, 1fr); gap: clamp(28px, 4.4vw, 68px); align-items: center; overflow: hidden; padding: clamp(24px, 4vw, 56px); background-image: var(--tu-grad); }
  .tup-ben > * { position: relative; z-index: 2; min-width: 0; }
  .tup-ben .tu-eyebrow { margin-bottom: 14px; }
  .tup-ben .tu-h2 { font-size: clamp(30px, 3.7vw, 48px); }
  .tu-sitio[data-mayus="true"] .tup-ben .tu-h2 { font-size: clamp(34px, 4.4vw, 58px); }
  .tup-ben-ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
  .tup-ben-lado { display: flex; flex-direction: column; gap: 16px; }
  .tup-ben-lista { margin: 0; padding: 0; list-style: none; }
  .tup-ben-lista li { display: flex; align-items: flex-start; gap: 14px; padding: 13px 0; border-top: 1px solid var(--color-border); }
  .tup-ben-lista li:first-child { border-top: none; }
  .tup-ben-ico { display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0; border-radius: var(--tu-r); background: var(--color-primary-bg); color: var(--color-primary); }
  .tup-ben-lista b { display: block; font-size: 15.5px; color: var(--color-text); }
  .tup-ben-lista b + span { display: block; margin-top: 2px; font-size: 14.5px; line-height: 1.5; color: var(--color-body); }

  /* ── Cómo funciona: tres paradas sobre una órbita punteada ──────────────── */
  .tup-pasos { list-style: none; margin: 0; padding: 0; position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(20px, 4vw, 56px); text-align: center; }
  .tup-pasos::before { content: ''; position: absolute; left: 16.6%; right: 16.6%; top: 38px; border-top: 1.5px dashed color-mix(in srgb, var(--color-primary) 55%, transparent); }
  .tup-paso { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .tup-paso-nodo { position: relative; width: 76px; height: 76px; border-radius: 50%; display: grid; place-items: center; margin-bottom: 12px; background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-primary); box-shadow: 0 0 0 8px var(--color-bg); transition: transform 300ms var(--tu-ease), border-color 200ms ease, background 200ms ease, color 200ms ease; }
  .tup-paso-n { position: absolute; top: -4px; right: -4px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--color-primary); color: var(--color-on-primary); font-size: 12.5px; font-weight: 600; }
  .tup-paso-tit { font-size: 23px; }
  .tup-paso-txt { font-size: 16px; line-height: 1.6; color: var(--color-body); max-width: 32ch; }
  @media (hover: hover) { .tup-paso:hover .tup-paso-nodo { transform: translateY(-5px) scale(1.05); background: var(--color-primary); color: var(--color-on-primary); border-color: var(--color-primary); } .tup-paso:hover .tup-paso-n { background: var(--color-on-primary); color: var(--color-primary); } }

  /* ── Ubicación ──────────────────────────────────────────────────────────── */
  .tup-ub { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 20px; }
  .tup-ub-mapa { display: block; overflow: hidden; min-height: 340px; padding: 0; }
  .tup-mapa { width: 100%; height: 100%; display: block; background: var(--color-surface-alt); }
  .tup-ub-datos { padding: clamp(22px, 3vw, 32px); display: flex; flex-direction: column; align-items: flex-start; }
  .tup-ub-dir { font-size: 28px; margin-top: 18px; }
  .tup-ub-barrio { font-size: 15px; color: var(--color-muted); }
  .tup-contacto { list-style: none; margin: 10px 0 6px; padding: 0; display: flex; gap: 4px 22px; flex-wrap: wrap; font-size: 14.5px; }
  .tup-horarios { width: 100%; border-collapse: collapse; font-size: 14.5px; margin-top: 8px; }
  .tup-horarios caption { text-align: left; padding-bottom: 8px; }
  .tup-horarios th { text-align: left; font-weight: inherit; padding: 8px 12px; border-radius: var(--tu-r) 0 0 var(--tu-r); }
  .tup-horarios td { text-align: right; padding: 8px 12px; border-radius: 0 var(--tu-r) var(--tu-r) 0; }
  .tup-horarios th { white-space: nowrap; vertical-align: baseline; }
  .tup-horarios tr { transition: background 160ms ease; }
  .tup-horarios tr[data-hoy="true"] { background: var(--color-primary-bg); color: var(--color-text); font-weight: 700; }
  .tup-horarios tr[data-cerrado="true"] { color: var(--color-muted); }
  .tup-ub-ctas { display: flex; gap: 10px; flex-wrap: wrap; width: 100%; margin-top: auto; padding-top: 24px; }
  .tup-ub-ctas > * { flex: 1; }
  /* Sin local no hay mapa: se cuenta que atiende a domicilio y en qué zonas. */
  .tup-ub-modos { display: flex; align-items: center; overflow: hidden; min-height: 340px; padding: clamp(24px, 4vw, 48px); background-image: var(--tu-grad); }
  .tup-ub-anillos { right: -170px; bottom: -220px; opacity: .5; }
  .tup-ub-modos ul { position: relative; z-index: 2; display: grid; gap: 28px; margin: 0; padding: 0; list-style: none; }
  .tup-ub-modos li { display: flex; align-items: flex-start; gap: 16px; }
  .tup-ub-modo-tit { display: block; margin-bottom: 4px; font-size: 26px; }
  .tup-ub-modo-txt { display: block; max-width: 44ch; font-size: 16px; line-height: 1.6; color: var(--color-body); }
  .tup-ub-tambien { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; }
  .tup-ub-tambien li { display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 0 12px; border-radius: 999px; background: var(--color-primary-bg); color: var(--color-primary); font-size: 13px; font-weight: 700; }
  @media (hover: hover) { .tup-horarios tr:not([data-hoy="true"]):hover { background: color-mix(in srgb, var(--color-text) 5%, transparent); } }

  /* ── Cierre ─────────────────────────────────────────────────────────────── */
  .tup-cierre { position: relative; overflow: hidden; border-radius: calc(var(--tu-r2) + 8px); padding: clamp(40px, 7vw, 96px) clamp(24px, 6vw, 80px); background: var(--color-primary); color: var(--color-on-primary); }
  .tu-sitio[data-tarjeta="corte"] .tup-cierre { border-radius: 0; clip-path: polygon(0 0, calc(100% - 44px) 0, 100% 44px, 100% 100%, 44px 100%, 0 calc(100% - 44px)); }
  .tup-cierre-anillos { right: -170px; top: 50%; margin-top: -310px; color: var(--color-on-primary); opacity: .55; transition: transform 1200ms var(--tu-ease); }
  .tup-cierre-txt { position: relative; max-width: 600px; }
  .tup-cierre-rot { display: flex; align-items: center; gap: 12px; font: 500 12px var(--tu-fm); letter-spacing: .14em; text-transform: uppercase; margin-bottom: 20px; }
  .tup-cierre .tu-h { color: inherit; font-size: clamp(34px, 5vw, 66px); }
  .tup-cierre p { font-size: 18px; line-height: 1.55; margin: 18px 0 32px; max-width: 46ch; }
  @media (hover: hover) { .tup-cierre:hover .tup-cierre-anillos { transform: scale(1.06) rotate(8deg); } }

  /* ── Botón flotante (escritorio) ────────────────────────────────────────── */
  .tup-flotante { position: fixed; left: 50%; bottom: 24px; z-index: 85; transform: translate(-50%, 140%); opacity: 0; pointer-events: none; transition: transform 450ms cubic-bezier(.2,.8,.2,1), opacity 300ms ease; }
  .tup-flotante[data-ver="true"] { transform: translate(-50%, 0); opacity: 1; pointer-events: auto; }
  .tup-flotante-caja { display: flex; align-items: center; gap: 16px; padding: 8px 8px 8px 22px; border-radius: calc(var(--tu-r-btn) + 8px); border: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-bg) 82%, transparent); -webkit-backdrop-filter: blur(18px) saturate(1.4); backdrop-filter: blur(18px) saturate(1.4); box-shadow: 0 24px 60px -18px rgba(0,0,0,.55); }
  .tup-flotante-txt { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--color-text); white-space: nowrap; }

  /* ── Responsive ─────────────────────────────────────────────────────────── */
  @media (max-width: 1100px) { .tup-disp { grid-template-columns: 1fr; } }
  @media (max-width: 1020px) { .tup-confianza { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 520px) { .tup-confianza { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 980px) {
    .tup-hero-cuerpo { grid-template-columns: 1fr; gap: 32px; padding-top: 150px; }
    .tup-gal { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: auto; gap: 10px; }
    .tup-gal .tup-gal-item:nth-child(n) { grid-column: auto; grid-row: auto; aspect-ratio: 1; }
    .tup-gal .tup-gal-item:nth-child(1) { grid-column: 1 / -1; aspect-ratio: 16 / 11; }
    .tup-gal[data-n="4"] .tup-gal-item:nth-child(4) { grid-column: 1 / -1; aspect-ratio: 16 / 9; }
  }
  @media (max-width: 900px) {
    .tup-hp { grid-template-columns: 1fr; }
    .tup-hp-mini, .tup-hp-anillos { display: none; }
    .tup-hp-marco { aspect-ratio: 4 / 3.6; }
    .tu-sitio[data-forma="arco"] .tup-hp-marco { aspect-ratio: 1 / 1.08; max-width: 520px; margin: 0 auto; }
    .tu-sitio[data-forma="arco"] .tup-hp-prox { max-width: 492px; margin-inline: auto; }
    .tup-hp-prox { position: relative; left: auto; bottom: auto; width: auto; margin: -56px 14px 0; }
    .tup-ub { grid-template-columns: 1fr; }
    .tup-ub-modos { min-height: 0; }
    .tup-nos, .tup-ben { grid-template-columns: 1fr; }
    .tup-nos-cab { position: static; }
    .tup-ub-mapa { min-height: 260px; }
    .tup-ub-mapa .tup-mapa { min-height: 260px; }
  }
  @media (max-width: 860px) {
    .tup-flotante { display: none; }
    .tup-hero--cine, .tup-hero--impacto { min-height: max(620px, calc(100svh - 40px)); }
    .tup-hero--cine .tup-hero-velo, .tup-hero--impacto .tup-hero-velo { background: linear-gradient(180deg, rgba(0,0,0,.6) 0%, rgba(0,0,0,.62) 36%, rgba(0,0,0,.9) 74%, var(--color-bg) 100%); }
    .tup-hero-cuerpo { padding-top: 124px; padding-bottom: 36px; }
    .tup-hero-ctas > *, .tup-ben-ctas > * { flex: 1 1 100%; }
    .tup-tablero { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 28px; }
    .tup-tablero > div { padding: 14px 12px; }
    .tup-tablero-estado { grid-column: 1 / -1; border-left: none !important; border-top: 1px solid var(--color-border); padding-left: 0 !important; }
    .tup-hero-franjas { display: none; }
    .tup-cierre-anillos { opacity: .28; right: -300px; }
    .tup-collage { margin-top: 40px; }
    .tup-collage-f { border-width: 4px; }
    .tup-collage-prox { position: relative; left: auto; bottom: auto; transform: none; width: auto; grid-column: 1 / -1; margin-top: 4px; text-align: left; }
    .tup-hero--collage { padding-bottom: 8px; }
    .tup-pasos { grid-template-columns: 1fr; text-align: left; gap: 28px; }
    .tup-pasos::before { left: 38px; right: auto; top: 38px; bottom: 38px; border-top: none; border-left: 1.5px dashed color-mix(in srgb, var(--color-primary) 55%, transparent); }
    .tup-paso { display: grid; grid-template-columns: 76px minmax(0, 1fr); column-gap: 18px; align-items: start; justify-items: start; }
    .tup-paso-nodo { grid-row: span 2; margin: 0; }
    .tup-paso-tit { align-self: end; }
    .tup-cinta-item { font-size: 22px; }
    .tup-carta-det { padding-left: 0; }
    .tup-carta-fila { flex-wrap: wrap; }
    .tup-carta-puntos { display: none; }
    .tup-carta-nombre { flex: 1 1 60%; }
  }
  @media (max-width: 420px) {
    .tup-nos-datos > div { padding: 0 14px; }
    .tup-tablero dd { font-size: 26px; }
    .tup-tablero dt { font-size: 9.5px; letter-spacing: .06em; }
    .tup-sv-cab { padding: 22px 22px 0; }
    .tup-sv-cuerpo { padding: 20px 22px 22px; }
  }
`

// ═════════════════════════════════════════════════════════════════════════════
// Servicios y precios
// ═════════════════════════════════════════════════════════════════════════════

export const CSS_SERVICIOS = `
  .tus-cab { position: relative; padding: clamp(40px, 5vw, 72px) 0 clamp(28px, 3vw, 40px); overflow: hidden; }
  .tus-cab-luz { position: absolute; inset: 0; z-index: -1; pointer-events: none; background: var(--tu-grad); -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent); mask-image: linear-gradient(to bottom, #000 55%, transparent); }
  .tus-cab-anillos { right: -140px; top: -200px; z-index: -1; opacity: .6; }
  .tus-cab-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 380px); gap: 40px; align-items: end; }
  .tus-cab .tu-h1 { font-size: clamp(40px, 5.8vw, 78px); margin-top: 16px; }
  .tu-sitio[data-mayus="true"] .tus-cab .tu-h1 { font-size: clamp(48px, 7vw, 100px); }
  .tus-cab p { font-size: 17px; line-height: 1.6; color: var(--color-body); margin: 16px 0 0; max-width: 56ch; }
  .tus-resumen { display: flex; gap: 0; margin: 28px 0 0; }
  .tus-resumen > div { padding: 0 22px; border-left: 1px solid var(--color-border); }
  .tus-resumen > div:first-child { padding-left: 0; border-left: none; }
  .tus-resumen dd { margin: 0; font-size: 26px; font-weight: 600; color: var(--color-text); line-height: 1.1; }
  .tus-resumen dt { margin-top: 4px; }

  .tus-barra { position: sticky; top: 112px; z-index: 40; padding: 12px 0; margin-bottom: 20px; background: color-mix(in srgb, var(--color-bg) 90%, transparent); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border-bottom: 1px solid var(--color-border); }
  .tus-barra-in { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  .tus-buscar { position: relative; flex: 1 1 260px; max-width: 420px; }
  .tus-buscar > svg { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; transition: color 160ms ease; }
  .tus-buscar input { width: 100%; height: 50px; box-sizing: border-box; padding: 0 44px; border-radius: var(--tu-r-btn); border: 1.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font: 500 16px var(--tu-fb); outline: none; transition: border-color 160ms ease, box-shadow 160ms ease; }
  .tus-buscar input::placeholder { color: var(--color-muted); }
  .tus-buscar input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 18%, transparent); }
  .tus-buscar:focus-within > svg { color: var(--color-primary); }
  .tus-limpiar { position: absolute; right: 3px; top: 3px; width: 44px; height: 44px; border-radius: 50%; border: none; background: transparent; color: var(--color-muted); display: grid; place-items: center; cursor: pointer; transition: color 160ms ease, background 160ms ease; }
  .tus-filtros { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 3px; margin: -3px; }
  .tus-filtro { flex-shrink: 0; height: 44px; padding: 0 16px; border-radius: var(--tu-r-btn); cursor: pointer; font: 700 14px var(--tu-fb); border: 1.5px solid var(--color-border); background: transparent; color: var(--color-text); white-space: nowrap; display: inline-flex; align-items: center; gap: 8px; transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease; }
  .tus-filtro .tu-num { font-size: 12px; opacity: .75; }
  .tus-filtro[aria-pressed="true"] { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
  .tus-cuenta { margin-left: auto; font-size: 13.5px; color: var(--color-muted); }
  @media (hover: hover) {
    .tus-filtro:not([aria-pressed="true"]):hover { border-color: var(--color-primary); transform: translateY(-2px); }
    .tus-limpiar:hover { color: var(--color-text); background: var(--color-surface-alt); }
  }

  .tus-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .tus-item { overflow: hidden; transition: border-color 220ms ease, box-shadow 240ms ease, transform 240ms var(--tu-ease); }
  .tus-item[data-abierto="true"] { border-color: var(--color-primary); }
  .tus-cabecera { position: relative; z-index: 2; display: grid; grid-template-columns: 96px minmax(0, 1fr) auto 44px; gap: 20px; align-items: center; width: 100%; box-sizing: border-box; padding: 14px; background: none; border: none; cursor: pointer; text-align: left; font-family: inherit; color: var(--color-text); }
  .tus-foto { width: 96px; height: 96px; border-radius: calc(var(--tu-r2) - 6px); }
  .tu-sitio[data-forma="arco"] .tus-foto { border-radius: 999px 999px calc(var(--tu-r2) - 6px) calc(var(--tu-r2) - 6px); }
  .tu-sitio[data-tarjeta="corte"] .tus-foto, .tu-sitio[data-tarjeta="filete"] .tus-foto { border-radius: var(--tu-r); }
  .tus-nombre { display: block; font-size: clamp(21px, 2.2vw, 27px); }
  .tus-meta { display: flex; align-items: center; gap: 6px 14px; flex-wrap: wrap; font-size: 14px; color: var(--color-muted); margin-top: 7px; }
  .tus-meta > span { display: inline-flex; align-items: center; gap: 6px; }
  .tus-precio { text-align: right; }
  .tus-precio .tu-rotulo { display: block; margin-top: 2px; }
  .tus-flecha { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: var(--color-muted); background: var(--color-surface-alt); transition: transform 300ms var(--tu-ease), background 200ms ease, color 200ms ease; }
  .tus-item[data-abierto="true"] .tus-flecha { transform: rotate(180deg); background: var(--color-primary); color: var(--color-on-primary); }
  .tus-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 340ms var(--tu-ease); }
  .tus-item[data-abierto="true"] .tus-panel { grid-template-rows: 1fr; }
  .tus-panel > div { overflow: hidden; min-height: 0; }
  .tus-panel[aria-hidden="true"] > div { visibility: hidden; transition: visibility 0s 340ms; }
  .tus-det { position: relative; z-index: 2; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px 32px; align-items: end; padding: 8px 20px 22px 130px; }
  .tus-det p { margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: var(--color-body); max-width: 60ch; }
  .tus-datos { display: flex; gap: 10px 24px; flex-wrap: wrap; font-size: 14px; color: var(--color-body); }
  .tus-datos > span { display: inline-flex; align-items: center; gap: 9px; min-height: 34px; }
  .tus-datos svg { color: var(--color-primary); flex-shrink: 0; }
  .tus-caras { display: flex; }
  .tus-caras img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid var(--color-surface); margin-left: -10px; }
  .tus-caras img:first-child { margin-left: 0; }
  .tus-vacio { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 56px 20px; text-align: center; color: var(--color-body); }
  .tus-vacio .tu-h { font-size: 26px; }
  .tus-final { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; margin-top: 44px; padding: clamp(22px, 3vw, 34px); background-image: var(--tu-grad); }
  .tus-final > div { flex: 1 1 260px; position: relative; z-index: 2; }
  .tus-final .tu-h { font-size: clamp(24px, 2.6vw, 32px); }
  .tus-final p { margin: 6px 0 0; font-size: 16px; color: var(--color-body); }
  @media (hover: hover) {
    .tus-item:hover { border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); transform: translateY(-2px); box-shadow: 0 22px 40px -28px rgba(0,0,0,.5); }
    .tus-item:not([data-abierto="true"]) .tus-cabecera:hover .tus-flecha { background: var(--color-primary-bg); color: var(--color-primary); transform: translateY(2px); }
  }
  @media (max-width: 860px) {
    .tus-cab-grid { grid-template-columns: 1fr; gap: 24px; }
    .tus-barra { top: 104px; }
    .tus-cuenta { display: none; }
    .tus-buscar { max-width: none; flex-basis: 100%; }
  }
  @media (max-width: 640px) {
    .tus-cabecera { grid-template-columns: 68px minmax(0, 1fr) 44px; gap: 14px; padding: 12px; }
    .tus-foto { width: 68px; height: 68px; }
    .tus-precio { grid-column: 2; grid-row: 2; text-align: left; margin-top: -6px; display: flex; align-items: baseline; gap: 8px; }
    .tus-flecha { grid-column: 3; grid-row: 1 / span 2; }
    .tus-foto { grid-row: 1 / span 2; }
    .tus-det { grid-template-columns: 1fr; padding: 6px 16px 18px; }
    .tus-det .tu-btn { width: 100%; }
    .tus-resumen > div { padding: 0 14px; }
    .tus-resumen dd { font-size: 21px; }
  }
`

// ═════════════════════════════════════════════════════════════════════════════
// Página simple
// ═════════════════════════════════════════════════════════════════════════════
// Una sola pantalla: portada, logo, nombre, descripción corta y el botón de
// reservar. En escritorio es una tarjeta centrada sobre la foto desenfocada; en
// celular ocupa todo el ancho, sin marco: es la página, no una tarjeta.

export const CSS_SIMPLE = `
  .tusp { position: relative; isolation: isolate; display: grid; place-items: center; box-sizing: border-box; min-height: calc(100vh - 40px - 84px); padding: clamp(20px, 5vw, 56px) 20px; }
  .tusp-fondo { position: absolute; inset: 0; z-index: -1; overflow: hidden; }
  .tusp-fondo img { position: absolute; inset: -48px; width: calc(100% + 96px); height: calc(100% + 96px); object-fit: cover; filter: blur(42px) saturate(1.15); opacity: .55; }
  .tusp-fondo::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 50%, transparent), var(--color-bg) 94%); }

  .tusp-tarjeta { --tusp-fondo: var(--color-surface); width: min(100%, 468px); overflow: hidden; border-radius: calc(var(--tu-r2) + 10px); border: 1px solid var(--color-border); background: var(--tusp-fondo); box-shadow: 0 50px 100px -44px rgba(0,0,0,.6); }
  .tu-sitio[data-tarjeta="corte"] .tusp-tarjeta { border-radius: 0; }
  .tu-sitio[data-tarjeta="filete"] .tusp-tarjeta { border-radius: calc(var(--tu-r) + 6px); }

  .tusp-portada { position: relative; aspect-ratio: 16 / 10; background: var(--color-surface-alt); }
  .tusp-portada img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .tusp-portada::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to top, var(--tusp-fondo) 0%, transparent 44%), linear-gradient(to bottom, rgba(0,0,0,.34), transparent 34%); }
  .tusp-estado { position: absolute; left: 14px; top: 14px; z-index: 2; }
  .tusp-estado .tu-abierto { background: color-mix(in srgb, var(--color-bg) 82%, transparent); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }

  .tusp-cuerpo { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; padding: 0 clamp(20px, 6vw, 34px) 28px; text-align: center; }
  .tusp-logo.tu-mono { width: 96px; height: 96px; margin-top: -56px; font-size: 34px; box-shadow: 0 0 0 5px var(--tusp-fondo), 0 18px 36px -14px rgba(0,0,0,.6); }
  .tusp-logo.tu-mono::after { display: none; }
  .tusp-nombre { margin-top: 18px; font-size: clamp(31px, 8vw, 42px); }
  .tu-sitio[data-mayus="true"] .tusp-nombre { font-size: clamp(36px, 9.4vw, 50px); }
  .tusp-lugar { margin-top: 9px; }
  .tusp-desc { margin: 14px 0 0; max-width: 36ch; font-size: 16.5px; line-height: 1.6; color: var(--color-body); text-wrap: pretty; }
  .tusp-cta { width: 100%; height: 60px; margin-top: 26px; font-size: 17px; }
  .tusp-nota { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px 10px; margin: 13px 0 0; font-size: 13.5px; line-height: 1.5; color: var(--color-muted); }
  .tusp-nota b { color: var(--color-text); font-weight: 600; }
  .tusp-nota-punto { width: 3px; height: 3px; border-radius: 50%; background: currentColor; opacity: .6; }

  .tusp-datos { width: 100%; margin: 26px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--color-border); text-align: left; }
  .tusp-datos > li { border-bottom: 1px solid var(--color-border); }
  .tusp-fila { display: flex; align-items: center; gap: 14px; width: 100%; min-height: 60px; box-sizing: border-box; padding: 9px 2px; border: none; background: none; color: var(--color-text); font: inherit; text-align: left; text-decoration: none; }
  a.tusp-fila, button.tusp-fila { cursor: pointer; }
  .tusp-fila-ico { display: grid; place-items: center; width: 38px; height: 38px; flex-shrink: 0; border-radius: var(--tu-r); background: var(--color-primary-bg); color: var(--color-primary); transition: background 180ms ease, color 180ms ease; }
  .tusp-fila-txt { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; line-height: 1.35; }
  .tusp-fila-txt > span { display: block; font-size: 13.5px; font-weight: 400; color: var(--color-muted); }
  .tusp-fila-ir { flex-shrink: 0; color: var(--color-muted); transition: transform 220ms var(--tu-ease), color 180ms ease; }
  .tusp-fila[aria-expanded="true"] .tusp-fila-ir { transform: rotate(180deg); color: var(--color-primary); }
  .tusp-horarios { display: grid; gap: 2px; margin: 0; padding: 2px 0 14px 52px; font-size: 14px; }
  .tusp-horarios > div { display: flex; justify-content: space-between; gap: 12px; min-height: 30px; align-items: baseline; padding: 5px 10px; border-radius: var(--tu-r); color: var(--color-body); }
  .tusp-horarios > div[data-hoy="true"] { background: var(--color-primary-bg); color: var(--color-text); font-weight: 700; }
  .tusp-horarios > div[data-cerrado="true"] { color: var(--color-muted); }
  .tusp-horarios dt, .tusp-horarios dd { margin: 0; }

  .tusp-links { display: flex; gap: 10px; width: 100%; margin-top: 18px; }
  .tusp-links > * { flex: 1 1 0; min-width: 0; height: 48px; padding: 0 12px; font-size: 14.5px; }
  .tusp-cuenta { width: 100%; margin: 18px 0 0; padding: 14px 16px; box-sizing: border-box; border-radius: var(--tu-r2); border: 1px dashed color-mix(in srgb, var(--color-primary) 46%, var(--color-border)); background: color-mix(in srgb, var(--color-primary) 6%, transparent); text-align: left; font-size: 14px; line-height: 1.5; color: var(--color-body); }
  .tu-sitio[data-tarjeta="corte"] .tusp-cuenta { border-radius: 0; }
  .tusp-cuenta b { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; font-size: 14.5px; color: var(--color-text); }
  .tusp-cuenta b svg { color: var(--color-primary); flex-shrink: 0; }
  .tusp-cuenta .tu-link { min-height: 32px; margin-top: 4px; font-size: 14px; }

  @media (hover: hover) {
    a.tusp-fila:hover .tusp-fila-ico, button.tusp-fila:hover .tusp-fila-ico { background: var(--color-primary); color: var(--color-on-primary); }
    a.tusp-fila:hover .tusp-fila-ir { transform: translateX(3px); color: var(--color-primary); }
  }
  @media (max-width: 560px) {
    .tusp { display: block; min-height: 0; padding: 0; }
    .tusp-fondo { display: none; }
    .tusp-tarjeta { --tusp-fondo: var(--color-bg); width: 100%; border: none; border-radius: 0 !important; box-shadow: none; }
    .tusp-portada { aspect-ratio: 16 / 11; }
  }

  /* ── Los otros cuatro diseños. "tarjeta" es el de arriba, sin nada más. ── */
  .tusp-arriba { padding-bottom: 0; }

  /* Portada: la foto ocupa la pantalla y el texto va encima, en blanco. */
  .tusp[data-diseno="portada"] { display: block; padding: 0; }
  .tusp[data-diseno="portada"] .tusp-fondo { display: none; }
  .tusp[data-diseno="portada"] .tusp-tarjeta { --tusp-fondo: var(--color-bg); width: 100%; border: none; border-radius: 0; box-shadow: none; }
  .tusp[data-diseno="portada"] .tusp-heroe { position: relative; display: flex; flex-direction: column; justify-content: flex-end; min-height: min(84vh, 760px); }
  .tusp[data-diseno="portada"] .tusp-portada { position: absolute; inset: 0; aspect-ratio: auto; }
  .tusp[data-diseno="portada"] .tusp-portada::after { background: linear-gradient(to top, rgba(0,0,0,.88) 0%, rgba(0,0,0,.5) 46%, rgba(0,0,0,.28) 100%); }
  .tusp[data-diseno="portada"] .tusp-arriba { --color-text: #FFFFFF; --color-body: rgba(255,255,255,.9); --color-muted: rgba(255,255,255,.78); width: min(100%, 560px); margin: 0 auto; box-sizing: border-box; padding-top: 96px; padding-bottom: 34px; color: #FFFFFF; }
  .tusp[data-diseno="portada"] .tusp-lugar { color: rgba(255,255,255,.82); }
  .tusp[data-diseno="portada"] .tusp-logo.tu-mono { margin-top: 0; box-shadow: 0 0 0 4px rgba(255,255,255,.22), 0 18px 36px -14px rgba(0,0,0,.7); }
  .tusp[data-diseno="portada"] .tusp-abajo { width: min(100%, 560px); margin: 0 auto; box-sizing: border-box; }
  .tusp[data-diseno="portada"] .tusp-datos { margin-top: 8px; border-top: none; }

  /* Partida: texto a un lado y foto al otro; en el celular, apilados. */
  .tusp[data-diseno="partida"] .tusp-tarjeta { width: min(100%, 940px); display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .tusp[data-diseno="partida"] .tusp-heroe { display: contents; }
  .tusp[data-diseno="partida"] .tusp-portada { grid-column: 2; grid-row: 1 / span 2; aspect-ratio: auto; min-height: 100%; }
  .tusp[data-diseno="partida"] .tusp-portada::after { background: linear-gradient(to bottom, rgba(0,0,0,.3), transparent 30%); }
  .tusp[data-diseno="partida"] .tusp-cuerpo { grid-column: 1; align-items: flex-start; text-align: left; }
  .tusp[data-diseno="partida"] .tusp-arriba { padding-top: 34px; }
  .tusp[data-diseno="partida"] .tusp-logo.tu-mono { width: 72px; height: 72px; margin-top: 0; font-size: 26px; box-shadow: 0 14px 30px -14px rgba(0,0,0,.5); }
  .tusp[data-diseno="partida"] .tusp-nota { justify-content: flex-start; }

  /* Editorial: el nombre bien grande y la foto como una lámina. */
  .tusp[data-diseno="editorial"] .tusp-heroe { display: flex; flex-direction: column; align-items: flex-start; padding: 32px clamp(20px, 6vw, 34px) 0; text-align: left; }
  .tusp[data-diseno="editorial"] .tusp-arriba { display: contents; }
  .tusp[data-diseno="editorial"] .tusp-logo.tu-mono { order: 1; width: 52px; height: 52px; margin-top: 0; font-size: 19px; box-shadow: none; }
  .tusp[data-diseno="editorial"] .tusp-lugar { order: 2; margin-top: 18px; }
  .tusp[data-diseno="editorial"] .tusp-nombre { order: 3; margin-top: 8px; font-size: clamp(44px, 13vw, 66px); line-height: .98; text-wrap: balance; }
  .tusp[data-diseno="editorial"] .tusp-portada { order: 4; width: 100%; margin-top: 22px; aspect-ratio: 4 / 3; overflow: hidden; border-radius: var(--tu-r2); }
  .tu-sitio[data-tarjeta="corte"] .tusp[data-diseno="editorial"] .tusp-portada { border-radius: 0; }
  .tusp[data-diseno="editorial"] .tusp-portada::after { background: linear-gradient(to bottom, rgba(0,0,0,.3), transparent 32%); }
  .tusp[data-diseno="editorial"] .tusp-desc { order: 5; margin-top: 20px; max-width: none; font-size: 17.5px; }
  .tusp[data-diseno="editorial"] .tusp-cta { order: 6; }
  .tusp[data-diseno="editorial"] .tusp-nota { order: 7; justify-content: flex-start; }

  /* Enlaces: logo al centro y botones uno debajo del otro, como un link de bio. */
  .tusp[data-diseno="enlaces"] .tusp-portada { display: none; }
  .tusp[data-diseno="enlaces"] .tusp-arriba { padding-top: 38px; }
  .tusp[data-diseno="enlaces"] .tusp-logo.tu-mono { width: 108px; height: 108px; margin-top: 0; font-size: 38px; box-shadow: 0 0 0 5px color-mix(in srgb, var(--color-primary) 24%, transparent), 0 18px 36px -14px rgba(0,0,0,.5); }
  .tusp[data-diseno="enlaces"] .tusp-abajo { display: flex; flex-direction: column; }
  .tusp[data-diseno="enlaces"] .tusp-links { order: 1; flex-direction: column; margin-top: 12px; }
  .tusp[data-diseno="enlaces"] .tusp-links > * { flex: none; width: 100%; height: 56px; box-sizing: border-box; font-size: 15.5px; }
  .tusp[data-diseno="enlaces"] .tusp-datos { order: 2; }
  .tusp[data-diseno="enlaces"] .tusp-cuenta { order: 3; }

  @media (max-width: 760px) {
    .tusp[data-diseno="partida"] .tusp-tarjeta { display: block; width: min(100%, 468px); }
    .tusp[data-diseno="partida"] .tusp-portada { aspect-ratio: 16 / 10; min-height: 0; }
    .tusp[data-diseno="partida"] .tusp-arriba { padding-top: 24px; }
  }
  @media (max-width: 560px) {
    .tusp[data-diseno="partida"] .tusp-tarjeta { width: 100%; }
    .tusp[data-diseno="portada"] .tusp-heroe { min-height: 78vh; }
    /* Sin foto de portada, el fondo desenfocado es lo que le da cara a la página. */
    .tusp[data-diseno="enlaces"] { position: relative; min-height: calc(100vh - 124px); }
    .tusp[data-diseno="enlaces"] .tusp-fondo { display: block; }
    .tusp[data-diseno="enlaces"] .tusp-tarjeta { background: transparent; }
  }
`
