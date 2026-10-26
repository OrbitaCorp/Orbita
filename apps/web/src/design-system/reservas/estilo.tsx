// Kit visual de reservas (prefijo rv-). Lo comparten Alquileres, Gimnasio y el
// alta (vive en el design system, como Toast u OrbitaLogo): una sola hoja para
// el panel, el alta y el sitio, un color de acento, la tipografía del cuerpo,
// bordes finos, sin degradados ni brillos. Pinta con los tokens --color-* del
// design system, así el modo claro y el oscuro salen solos. El sitio público
// redefine esos tokens con el tema del negocio (ver storefront/Sitio.tsx de
// cada módulo).
//
// Reglas que cumple toda la hoja: targets de 44 px en celular, inputs de 16 px
// (con menos, iOS hace zoom), foco visible, nada que dependa del hover para
// funcionar y movimiento corto que se apaga con prefers-reduced-motion.
// "Celular" es hasta 768 px, igual que el estándar del panel en globals.css.
//
// Variables que puede poner quien usa el kit:
//   --rv-tope  alto de lo que está fijo arriba (la tira de la demo): el modal y el cajón arrancan debajo.
//   --rv-pie   alto de lo que está fijo abajo (el botón de reservar del sitio): el aviso se pone encima.
export const CSS_RESERVAS = `
  .rv { --rv-r: 12px; --rv-r-sm: 8px; --rv-ease: cubic-bezier(0.22, 1, 0.36, 1); --rv-mono: "Geist Mono", ui-monospace, monospace; color: var(--color-body); }
  .rv *, .rv *::before, .rv *::after { box-sizing: border-box; }
  .rv img { max-width: 100%; display: block; }
  /* Un ícono metido en un texto va en la línea del texto: el preflight de Tailwind pone
     todo svg en display: block y el ícono saltaba solo a su propio renglón. Adentro de un
     flex o de un grid (botones, chips) no cambia nada: ahí ya es un ítem del contenedor. */
  .rv :is(p, span, small, b, strong, em, dd, dt, li, label, h1, h2, h3, h4) > svg { display: inline-block; }

  /* ── Tipografía ── */
  .rv-h1 { font-size: 26px; line-height: 1.15; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); margin: 0; text-wrap: balance; }
  .rv-h2 { font-size: 17px; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text); margin: 0; }
  .rv-h3 { font-size: 15px; line-height: 1.35; font-weight: 600; color: var(--color-text); margin: 0; }
  .rv-bajada { font-size: 14px; line-height: 1.55; color: var(--color-muted); margin: 6px 0 0; max-width: 64ch; }
  .rv-rotulo { font-family: var(--rv-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-muted); }
  .rv-num { font-family: var(--rv-mono); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .rv-muted { color: var(--color-muted); }
  .rv-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  /* ── Disposición ── */
  .rv-pagina { max-width: 1120px; margin: 0 auto; padding: 24px 24px 56px; }
  .rv-cab { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap; margin-bottom: 20px; }
  .rv-cab-acciones { display: flex; gap: 8px; flex-wrap: wrap; }
  .rv-pila { display: flex; flex-direction: column; gap: 14px; }
  .rv-fila { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .rv-entre { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .rv-grid { display: grid; gap: 14px; }
  .rv-grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rv-grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .rv-grid--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .rv-dos { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }

  /* ── Tarjetas ── */
  .rv-card { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--rv-r); min-width: 0; }
  .rv-card--pad { padding: 18px; }
  .rv-card--accion { cursor: pointer; text-align: left; font: inherit; color: inherit; width: 100%; transition: border-color 160ms ease; }
  .rv-card--accion:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .rv-card--sel { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
  @media (hover: hover) { .rv-card--accion:hover { border-color: var(--color-border-strong); } }

  /* ── Botones ── */
  .rv-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 0 16px; border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 14px; font-weight: 600; white-space: nowrap; cursor: pointer; text-decoration: none; transition: background 150ms ease, border-color 150ms ease; }
  .rv-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .rv-btn:disabled, .rv-btn[aria-disabled='true'] { opacity: 0.5; cursor: not-allowed; }
  @media (hover: hover) { .rv-btn:not(:disabled):hover { background: var(--color-surface); border-color: var(--color-border-strong); } }
  .rv-btn--primario { background: var(--color-primary); border-color: transparent; color: var(--color-on-primary); }
  @media (hover: hover) { .rv-btn--primario:not(:disabled):hover { background: var(--color-primary-h); border-color: transparent; } }
  .rv-btn--fantasma { background: transparent; border-color: transparent; color: var(--color-body); }
  .rv-btn--peligro { color: var(--color-error); }
  .rv-btn--sm { min-height: 34px; padding: 0 12px; font-size: 13px; }
  .rv-btn--lg { min-height: 48px; padding: 0 22px; font-size: 15px; border-radius: 10px; }
  .rv-btn--icono { width: 40px; padding: 0; color: var(--color-body); }
  .rv-btn--ancho { width: 100%; }

  /* ── Chips ── */
  .rv-chip { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; background: var(--color-surface-alt); color: var(--color-body); border: 1px solid transparent; }
  .rv-chip--primario { background: var(--color-primary-bg); color: var(--chip-primary-fg); }
  .rv-chip--ok { background: var(--color-success-bg); color: var(--chip-success-fg); }
  .rv-chip--aviso { background: var(--color-warning-bg); color: var(--chip-warning-fg); }
  .rv-chip--error { background: var(--color-error-bg); color: var(--chip-error-fg); }
  .rv-chip--gris { background: var(--color-surface-alt); color: var(--color-muted); }
  .rv-chip--borde { background: transparent; border-color: var(--color-border); }
  button.rv-chip { cursor: pointer; font: inherit; font-size: 12px; font-weight: 600; min-height: 32px; }
  button.rv-chip:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  button.rv-chip[aria-pressed='true'], button.rv-chip[aria-selected='true'] { background: var(--color-primary); color: var(--color-on-primary); border-color: transparent; }

  /* ── Campos ── */
  .rv-campo { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  /* Solo el rótulo (el span sin clase): la ayuda, el error y el prefijo también son hijos
     directos del label y con ".rv-campo > span" salían como un segundo rótulo en negrita
     (el error en negro, no en rojo) y el texto del input con prefijo, en negrita. */
  .rv-campo > span:not([class]) { font-size: 13px; font-weight: 600; color: var(--color-text); }
  .rv-input, .rv-select, .rv-textarea { width: 100%; min-height: 42px; padding: 0 12px; border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 14px; outline: none; transition: border-color 150ms ease; }
  .rv-textarea { padding: 10px 12px; min-height: 88px; resize: vertical; line-height: 1.5; }
  .rv-select { appearance: none; -webkit-appearance: none; padding-right: 34px; background-image: linear-gradient(45deg, transparent 50%, var(--color-muted) 50%), linear-gradient(135deg, var(--color-muted) 50%, transparent 50%); background-position: calc(100% - 17px) 50%, calc(100% - 12px) 50%; background-size: 5px 5px; background-repeat: no-repeat; }
  .rv-input::placeholder, .rv-textarea::placeholder { color: var(--color-subtle); }
  .rv-input:focus, .rv-select:focus, .rv-textarea:focus { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
  .rv-input[aria-invalid='true'], .rv-select[aria-invalid='true'] { border-color: var(--color-error); }
  .rv-ayuda { font-size: 12.5px; line-height: 1.45; color: var(--color-muted); }
  .rv-error { font-size: 12.5px; line-height: 1.45; color: var(--color-error); }
  /* En el panel en oscuro, los controles nativos (el ícono de calendario de un input date, la
     lista de un select) también en oscuro: si no, el ícono quedaba negro sobre el fondo oscuro.
     Solo adentro del panel (.rvp): los sitios públicos son siempre claros aunque el sistema esté
     en oscuro. */
  .dark .rvp :is(.rv-input, .rv-select, .rv-textarea) { color-scheme: dark; }
  .rv-con-prefijo { position: relative; }
  .rv-con-prefijo > i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-style: normal; font-size: 14px; color: var(--color-muted); pointer-events: none; }
  .rv-con-prefijo > .rv-input { padding-left: 26px; }

  /* ── Segmentado ── */
  /* Si las opciones no entran a lo ancho, scrollea adentro: nunca empuja la página. */
  .rv-seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 10px; background: var(--color-surface-alt); border: 1px solid var(--color-border); max-width: 100%; overflow-x: auto; scrollbar-width: none; }
  .rv-seg::-webkit-scrollbar { display: none; }
  .rv-seg > button { min-height: 32px; padding: 0 14px; border-radius: 7px; border: none; background: transparent; color: var(--color-muted); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: background 160ms ease, color 160ms ease; }
  .rv-seg > button[aria-pressed='true'], .rv-seg > button[aria-checked='true'] { background: var(--color-bg); color: var(--color-text); font-weight: 600; box-shadow: 0 0 0 1px var(--color-border); }
  .rv-seg > button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  .rv-seg--lleno { display: flex; }
  .rv-seg--lleno > button { flex: 1; }

  /* ── Llave ── */
  .rv-switch { position: relative; width: 42px; height: 24px; border-radius: 999px; border: none; padding: 0; flex-shrink: 0; cursor: pointer; background: var(--color-border-strong); transition: background 180ms ease; }
  .rv-switch::before { content: ''; position: absolute; inset: -10px -6px; }
  .rv-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 200ms var(--rv-ease); }
  .rv-switch[aria-checked='true'] { background: var(--color-primary); }
  .rv-switch[aria-checked='true']::after { transform: translateX(18px); }
  .rv-switch:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .rv-fila-switch { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; border-top: 1px solid var(--color-border); }
  .rv-fila-switch:first-child { border-top: none; padding-top: 0; }
  .rv-fila-switch > div { min-width: 0; }
  .rv-fila-switch b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .rv-fila-switch small { display: block; font-size: 12.5px; color: var(--color-muted); margin-top: 2px; line-height: 1.45; }

  /* ── Listas ── */
  .rv-lista { display: flex; flex-direction: column; }
  .rv-lista > * + * { border-top: 1px solid var(--color-border); }
  .rv-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; min-width: 0; }
  button.rv-item { width: 100%; background: none; border: none; border-top: 1px solid var(--color-border); text-align: left; font: inherit; color: inherit; cursor: pointer; }
  button.rv-item:first-child { border-top: none; }
  button.rv-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; border-radius: 6px; }
  .rv-item-cuerpo { flex: 1; min-width: 0; }
  .rv-item-titulo { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rv-item-sub { display: block; font-size: 12.5px; color: var(--color-muted); margin-top: 2px; }
  .rv-sigla { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; font-size: 12px; font-weight: 700; color: #fff; }

  /* ── Tabla que se vuelve tarjetas en celular ── */
  .rv-tabla { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .rv-tabla th { text-align: left; padding: 8px 10px; font-family: var(--rv-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-muted); border-bottom: 1px solid var(--color-border); }
  .rv-tabla td { padding: 10px; border-bottom: 1px solid var(--color-border); color: var(--color-body); vertical-align: middle; }
  .rv-tabla td:first-child { color: var(--color-text); font-weight: 600; }
  .rv-tabla tr:last-child td { border-bottom: none; }
  /* Cada fila es una tarjeta: la primera celda es el título; las demás llevan su
     data-label a la izquierda y el valor a la derecha; la celda sin data-label
     (las acciones) va sola, a la derecha. */
  @media (max-width: 768px) {
    .rv-tabla thead { display: none; }
    .rv-tabla, .rv-tabla tbody, .rv-tabla tr, .rv-tabla td { display: block; }
    .rv-tabla tr { padding: 12px 0; border-bottom: 1px solid var(--color-border); }
    .rv-tabla tr:last-child { border-bottom: none; }
    .rv-tabla td { padding: 4px 0; border: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; text-align: right; }
    .rv-tabla td > * { min-width: 0; }
    .rv-tabla td::before { content: attr(data-label); font-size: 12px; color: var(--color-muted); flex-shrink: 0; text-align: left; }
    .rv-tabla td:first-child { text-align: left; padding-bottom: 6px; }
    .rv-tabla td:first-child::before, .rv-tabla td:not([data-label])::before { content: none; }
    .rv-tabla td:not([data-label]) { justify-content: flex-end; }
  }

  /* ── Indicadores y gráficos ── */
  .rv-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .rv-kpi { padding: 14px 16px; min-width: 0; }
  /* La tarjeta es un contenedor: el número se achica con el ancho de SU tarjeta
     (no con el de la pantalla), de 24 px en escritorio a 16 px en dos columnas a
     390. Un monto que igual no entre se parte en vez de desbordar la tarjeta. */
  .rv-kpis > .rv-kpi { container-type: inline-size; }
  .rv-kpi-valor { display: block; font-family: var(--rv-mono); font-size: 24px; font-size: clamp(16px, 13cqi, 24px); font-weight: 600; letter-spacing: -0.02em; color: var(--color-text); margin-top: 6px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .rv-kpi-nota { display: block; font-size: 12.5px; color: var(--color-muted); margin-top: 4px; }
  /* Columnas finas (24 px como máximo: el resto del lugar es aire) que crecen desde la base. */
  .rv-barras { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 6px; align-items: end; height: 160px; padding-top: 22px; }
  .rv-barra { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 6px; min-width: 0; border-radius: 6px; outline: none; }
  .rv-barra > i { position: relative; width: 100%; max-width: 24px; border-radius: 4px 4px 0 0; background: var(--color-primary); display: block; }
  .rv-barra > i[data-tono='suave'] { background: var(--color-primary-bg); }
  .rv-barra > span { font-size: 11px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  /* El valor va escrito sobre la columna más alta (da la escala). El de las demás aparece al
     pasar el mouse, al llegar con Tab o al tocar la columna: no hace falta el hover para
     leerlo. Va en tinta de texto, no en el color del acento. */
  .rv-barra-dato { position: absolute; left: 50%; bottom: calc(100% + 4px); transform: translateX(-50%); font-family: var(--rv-mono); font-size: 11px; font-style: normal; font-weight: 600; color: var(--color-text); white-space: nowrap; pointer-events: none; opacity: 0; }
  .rv-barra[data-max] .rv-barra-dato, .rv-barra:focus .rv-barra-dato { opacity: 1; }
  .rv-barras:has(.rv-barra:focus) .rv-barra[data-max]:not(:focus) .rv-barra-dato { opacity: 0; }
  @media (hover: hover) {
    .rv-barra:hover .rv-barra-dato { opacity: 1; }
    .rv-barras:has(.rv-barra:hover) .rv-barra:not(:hover) .rv-barra-dato { opacity: 0; }
  }
  .rv-barra:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

  /* ── Calendario ── */
  .rv-cal { width: 100%; max-width: 420px; }
  .rv-cal-cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
  .rv-cal-mes { font-size: 15px; font-weight: 600; color: var(--color-text); text-transform: capitalize; }
  .rv-cal-dias { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
  .rv-cal-dias > span { text-align: center; font-family: var(--rv-mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-muted); padding: 6px 0; }
  .rv-cal-celda { position: relative; min-height: 44px; width: 100%; border: none; border-radius: var(--rv-r-sm); background: transparent; color: var(--color-text); font: inherit; font-size: 14px; font-variant-numeric: tabular-nums; cursor: pointer; display: grid; place-items: center; }
  .rv-cal-celda:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  /* Los días del mes de al lado se pueden elegir: van atenuados pero legibles (AA). */
  .rv-cal-celda[data-fuera='true'] { color: var(--color-muted); }
  .rv-cal-celda[data-hoy='true']::after { content: ''; position: absolute; bottom: 5px; width: 4px; height: 4px; border-radius: 50%; background: var(--color-primary); }
  /* Un día que no se puede elegir sigue recibiendo el foco (aria-disabled, no disabled): así las flechas pasan por encima sin perderse. */
  .rv-cal-celda:disabled, .rv-cal-celda[aria-disabled='true'] { color: var(--color-subtle); cursor: not-allowed; text-decoration: line-through; }
  .rv-cal-celda[data-ocupado='true'] { background: var(--color-surface-alt); color: var(--color-subtle); text-decoration: line-through; }
  .rv-cal-celda[data-rango='medio'] { background: var(--color-primary-bg); border-radius: 0; }
  .rv-cal-celda[data-rango='inicio'] { background: var(--color-primary); color: var(--color-on-primary); border-radius: var(--rv-r-sm) 0 0 var(--rv-r-sm); }
  .rv-cal-celda[data-rango='fin'] { background: var(--color-primary); color: var(--color-on-primary); border-radius: 0 var(--rv-r-sm) var(--rv-r-sm) 0; }
  .rv-cal-celda[data-rango='solo'], .rv-cal-celda[aria-pressed='true'] { background: var(--color-primary); color: var(--color-on-primary); }
  /* La entrada y la salida elegidas nunca van tachadas: la salida puede caer en un día ocupado
     (esa noche no se duerme) y sigue siendo la salida. */
  .rv-cal-celda[data-rango] { text-decoration: none; }
  .rv-cal-celda[data-rango='inicio']::after, .rv-cal-celda[data-rango='fin']::after, .rv-cal-celda[aria-pressed='true']::after { background: var(--color-on-primary); }
  /* Sobre el fondo del acento, un anillo del acento no se ve: el foco va con el color del texto. */
  .rv-cal-celda[aria-pressed='true']:focus-visible, .rv-cal-celda[data-rango='inicio']:focus-visible, .rv-cal-celda[data-rango='fin']:focus-visible, .rv-cal-celda[data-rango='solo']:focus-visible { outline: 2px solid var(--color-text); outline-offset: 1px; z-index: 1; }
  @media (hover: hover) { .rv-cal-celda:not(:disabled):not([aria-disabled='true']):not([aria-pressed='true']):not([data-rango]):hover { background: var(--color-surface); } }

  /* ── Franjas horarias ── */
  .rv-franjas { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
  .rv-franja { min-height: 44px; border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font: inherit; font-family: var(--rv-mono); font-size: 14px; cursor: pointer; display: grid; place-items: center; gap: 2px; padding: 6px 4px; }
  .rv-franja small { font-family: inherit; font-size: 11px; color: var(--color-muted); }
  .rv-franja:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .rv-franja:disabled { color: var(--color-subtle); background: var(--color-surface-alt); text-decoration: line-through; cursor: not-allowed; }
  /* Elegida: como botón (aria-pressed) o como opción de un radiogroup (aria-checked), que es como las usa Alquileres. */
  .rv-franja[aria-pressed='true'], .rv-franja[aria-checked='true'] { background: var(--color-primary); color: var(--color-on-primary); border-color: transparent; }
  .rv-franja[aria-pressed='true'] small, .rv-franja[aria-checked='true'] small { color: inherit; opacity: 0.85; }

  /* ── Modal (hoja desde abajo en celular) ── */
  .rv-velo { position: fixed; inset: var(--rv-tope, 0px) 0 0 0; z-index: 150; display: flex; align-items: safe center; justify-content: center; padding: 24px; overflow-y: auto; overscroll-behavior: contain; background: rgba(15,23,42,0.5); animation: rvVelo 180ms ease; }
  .rv-modal { width: 100%; max-width: var(--rv-ancho, 520px); max-height: calc(100vh - var(--rv-tope, 0px) - 48px); max-height: calc(100dvh - var(--rv-tope, 0px) - 48px); display: flex; flex-direction: column; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: 0 16px 40px rgba(3,6,14,0.24); overflow: hidden; animation: rvModal 200ms var(--rv-ease); }
  .rv-modal:focus { outline: none; }
  .rv-modal-cab { display: flex; align-items: flex-start; gap: 12px; padding: 16px 16px 14px 20px; border-bottom: 1px solid var(--color-border); }
  .rv-modal-cab > div { flex: 1; min-width: 0; }
  .rv-modal-cuerpo { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 18px 20px; }
  .rv-modal-pie { display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 20px; border-top: 1px solid var(--color-border); background: var(--color-surface); }
  .rv-modal-pie > .rv-modal-izq { margin-right: auto; }
  @keyframes rvVelo { from { opacity: 0 } to { opacity: 1 } }
  @keyframes rvModal { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
  @keyframes rvHoja { from { transform: translateY(40px); opacity: 0 } to { transform: none; opacity: 1 } }
  /* En celular, hoja pegada abajo a todo el ancho: scrollea solo el cuerpo, el
     pie con los botones queda siempre a la vista y respeta la barra de inicio
     del iPhone (safe-area). */
  @media (max-width: 768px) {
    .rv-velo { align-items: flex-end; padding: 0; }
    /* Hasta 72 px del borde de arriba: ahí entra el aviso (rv-toast) sin tapar la hoja, y se ve que atrás sigue la página. */
    .rv-modal { max-width: none; max-height: calc(100vh - var(--rv-tope, 0px) - 72px); max-height: calc(100dvh - var(--rv-tope, 0px) - 72px); border-radius: 20px 20px 0 0; border-bottom: none; border-left: none; border-right: none; box-shadow: 0 -8px 28px rgba(3,6,14,0.2); animation-name: rvHoja; }
    .rv-modal-cab { padding: 14px 12px 12px 16px; }
    .rv-modal-cuerpo { padding: 16px; }
    .rv-modal-cuerpo:last-child { padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
    .rv-modal-pie { padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px)); }
    .rv-modal-pie > .rv-btn { flex: 1 1 140px; min-height: 46px; }
    .rv-modal-pie > .rv-modal-izq { flex: 1 1 100%; margin-right: 0; }
  }

  /* ── Avisos ── */
  /* --rv-pie: si la pantalla tiene un botón fijo abajo, el aviso sale encima y no lo tapa. */
  .rv-toast { position: fixed; right: 16px; bottom: calc(16px + var(--rv-pie, 0px)); z-index: 400; max-width: calc(100vw - 32px); animation: rvModal 240ms var(--rv-ease) both; }
  .rv-vacio { display: grid; place-items: center; gap: 8px; padding: 40px 20px; text-align: center; border: 1px dashed var(--color-border-strong); border-radius: var(--rv-r); color: var(--color-muted); }
  .rv-nota { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: var(--rv-r-sm); background: var(--color-surface); border: 1px solid var(--color-border); font-size: 13px; line-height: 1.5; color: var(--color-body); }
  .rv-nota--aviso { background: var(--color-warning-bg); border-color: transparent; color: var(--chip-warning-fg); }
  .rv-nota--info { background: var(--color-primary-bg); border-color: transparent; color: var(--chip-primary-fg); }
  /* Se lee tal cual está escrito ("Demo: sincronización simulada"), sin pasarlo a mayúsculas. */
  .rv-demo { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 1.3; background: var(--color-warning-bg); color: var(--chip-warning-fg); }

  /* ── Filtros que se pliegan en celular (ver Filtros en piezas.tsx) ── */
  .rv-filtros { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .rv-filtros-boton { display: none; }
  .rv-filtros-boton[aria-expanded='true'] { border-color: var(--color-primary); color: var(--chip-primary-fg); }

  /* ── Movimiento ── */
  @keyframes rvEntra { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
  .rv-entra { animation: rvEntra 320ms var(--rv-ease) both; animation-delay: calc(var(--i, 0) * 40ms); }

  /* ── Responsive ── */
  @media (max-width: 1024px) { .rv-grid--4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .rv-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  /* Celular y tablet chica: todo lo que se toca mide 44 px y los campos usan
     16 px (con menos, iOS hace zoom al enfocar y desarma la página). */
  @media (max-width: 768px) {
    .rv-pagina { padding: 18px 16px 48px; }
    .rv-grid--3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .rv-cab { margin-bottom: 16px; }
    .rv-input, .rv-select, .rv-textarea { font-size: 16px; }
    .rv-input, .rv-select { min-height: 46px; }
    .rv-con-prefijo > i { font-size: 16px; }
    .rv-con-prefijo > .rv-input { padding-left: 28px; }
    .rv-btn, .rv-btn--sm { min-height: 44px; }
    .rv-btn--lg { min-height: 48px; }
    .rv-btn--icono { width: 44px; }
    .rv-seg > button { min-height: 44px; }
    button.rv-chip { min-height: 44px; padding: 0 14px; font-size: 13px; }
    .rv-filtros-boton { display: inline-flex; align-self: flex-start; }
    .rv-filtros-cuerpo[data-abierto='false'] { display: none; }
    .rv-toast { left: 16px; right: 16px; max-width: none; display: flex; justify-content: center; }
    /* Con una hoja abierta (va pegada abajo), el aviso sale arriba: abajo tapaba el texto y los
       botones de la hoja. Y no se esconde: muchas acciones de adentro de la hoja (check-in,
       anotar) avisan con él. */
    body:has(.rv-velo) .rv-toast { top: calc(var(--rv-tope, 0px) + 8px); bottom: auto; }
  }
  @media (max-width: 640px) {
    .rv-h1 { font-size: 22px; }
    .rv-grid--2, .rv-grid--3, .rv-grid--4, .rv-dos { grid-template-columns: minmax(0, 1fr); }
    .rv-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .rv-kpi { padding: 12px 12px; }
    .rv-cab-acciones { width: 100%; }
    .rv-cab-acciones > .rv-btn { flex: 1 1 auto; }
  }
  @media (prefers-reduced-motion: reduce) {
    .rv-entra, .rv-modal, .rv-velo, .rv-toast { animation: none !important; }
    .rv-btn, .rv-card--accion, .rv-switch::after { transition: none; }
  }
`

export function EstiloReservas() {
  return <style>{CSS_RESERVAS}</style>
}
