// Estilos propios del alta (prefijo tuob-). Lo genérico —botones, chips,
// tarjetas, segmentado, tipografía— sale del kit compartido
// (_shared/orbita/estilo.tsx); acá va solo lo que es de esta pantalla.
//
// Todo se monta adentro de un .tuo-espacio, así que los tokens --color-* ya
// vienen en "espacio profundo" sin importar el tema del sistema.
//
// Reglas de la hoja: todo hover vive dentro de @media (hover: hover) y solo
// mueve transform / sombra / color; lo que se toca mide 44 px en celular; los
// campos van a 16 px en celular (con menos, iOS hace zoom); y el bloque final
// apaga el movimiento con prefers-reduced-motion.
export const CSS_ONBOARDING = `
  /* overflow: clip y no hidden (el del kit): hidden convierte al bloque en
     contenedor de scroll y los paneles "así queda" dejarían de ser sticky. */
  .tuob.tuo-espacio { overflow: clip; min-height: calc(100vh - 40px); display: flex; flex-direction: column; padding-bottom: 116px; font-size: 14px;
    /* El fondo del home: negro liso, y arriba el cielo (estrellas y cometas). Las
       superficies son vidrio: apenas un velo, para que el cielo se siga viendo. */
    background: #000;
    --tuob-vidrio: rgba(255,255,255,0.03); --tuob-vidrio-alto: rgba(255,255,255,0.055); --tuob-hueco: rgba(255,255,255,0.025);
    --tuob-panel: rgba(8,11,19,0.62); --tuob-desenfoque: blur(14px) saturate(130%); }
  /* La botonera es fija: lo que el navegador trae a la vista (un campo que toma el foco, un ancla) frena antes de quedar debajo. */
  html:has(.tuob) { scroll-padding-bottom: 112px; }
  .tuob-cielo { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
  .tuob-ancho { width: 100%; max-width: 1180px; margin: 0 auto; padding: 0 24px; box-sizing: border-box; }
  .tuob-ancho--medio { max-width: 1000px; }
  .tuob-ancho--form { max-width: 720px; }

  /* ── Cabecera con la órbita de pasos ── */
  .tuob-cab { position: relative; display: flex; align-items: flex-start; justify-content: center; padding: 22px 24px 0; }
  .tuob-marca { position: absolute; left: 24px; top: 22px; display: inline-flex; align-items: center; gap: 9px; color: var(--color-text); font-family: var(--tuo-fh); font-size: 16px; font-weight: 700; letter-spacing: -0.02em; }
  /* El dibujo es siempre el mismo (viewBox 720×126); el marco es más ancho para que entren los ocho rótulos de Turnos. */
  .tuob-pasos { position: relative; width: 100%; max-width: 880px; aspect-ratio: 720 / 126; margin: 0 auto; }
  .tuob-pasos > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .tuob-pasos ol { list-style: none; margin: 0; padding: 0; }
  /* Cuando cambia la cantidad de pasos (al elegir módulo), las estaciones que ya
     estaban se deslizan hasta su lugar nuevo y las que se suman aparecen en el hueco. */
  .tuob-pasos li { position: absolute; transform: translate(-50%, -50%); transition: left 620ms var(--tuo-ease), top 620ms var(--tuo-ease); animation: tuobEstacion 520ms var(--tuo-ease) both; }
  @keyframes tuobEstacion { from { opacity: 0; transform: translate(-50%, -50%) scale(0.4) } to { opacity: 1; transform: translate(-50%, -50%) } }
  .tuob-punto { position: relative; width: 44px; height: 44px; display: grid; place-items: center; padding: 0; border: none; background: none; color: inherit; font-family: inherit; cursor: default; border-radius: 50%; }
  .tuob-punto > i { width: 12px; height: 12px; border-radius: 50%; display: grid; place-items: center; background: #05070C; border: 1.5px solid rgba(147,197,253,0.34); color: #fff; transition: transform 240ms var(--tuo-ease), background 240ms ease, border-color 240ms ease, box-shadow 240ms ease, width 240ms var(--tuo-ease), height 240ms var(--tuo-ease); }
  .tuob-punto > i svg { width: 10px; height: 10px; opacity: 0; transition: opacity 200ms ease; }
  .tuob-punto > span { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); white-space: nowrap; font-size: 12px; font-weight: 500; color: var(--color-muted); transition: color 200ms ease; }
  .tuob-punto[data-tocable='true'] { cursor: pointer; }
  .tuob-punto[data-estado='hecho'] > i { width: 18px; height: 18px; border-color: transparent; background: var(--tuo-grad); box-shadow: 0 0 14px rgba(59,130,246,0.55); }
  .tuob-punto[data-estado='hecho'] > i svg { opacity: 1; }
  .tuob-punto[data-estado='hecho'] > span { color: var(--color-body); }
  /* Ya se pasó por acá, pero se volvió para atrás: queda marcado y se puede saltar. */
  .tuob-punto[data-estado='visitado'] > i { width: 14px; height: 14px; border-color: #60A5FA; background: rgba(59,130,246,0.3); }
  .tuob-punto[data-estado='visitado'] > span { color: var(--color-body); }
  /* En el paso actual el punto lo dibuja el satélite del SVG. */
  .tuob-punto[data-estado='actual'] > i { opacity: 0; }
  .tuob-punto[data-estado='actual'] > span { color: var(--color-text); font-weight: 600; }
  .tuob-punto:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -4px; }
  .tuob-satelite { transition: transform 700ms var(--tuo-ease); }
  .tuob-recorrido { transition: stroke-dasharray 700ms var(--tuo-ease); }
  .tuob-pasos-mini { display: none; align-items: center; gap: 14px; }

  /* ── Contenido del paso ── */
  .tuob-paso { flex: 1; padding-top: 18px; animation: tuobDesdeDerecha 300ms var(--tuo-ease) both; }
  .tuob-paso[data-dir='atras'] { animation-name: tuobDesdeIzquierda; }
  @keyframes tuobDesdeDerecha { from { opacity: 0; transform: translateX(36px) } to { opacity: 1; transform: none } }
  @keyframes tuobDesdeIzquierda { from { opacity: 0; transform: translateX(-36px) } to { opacity: 1; transform: none } }
  .tuob-titulo { text-align: center; margin: 0 auto 28px; max-width: 640px; }
  .tuob-h1 { font-family: var(--tuo-fh); font-size: clamp(25px, 3.3vw, 38px); line-height: 1.1; font-weight: 700; letter-spacing: -0.035em; color: var(--color-text); margin: 0; text-wrap: balance; outline: none; }
  .tuob-h1 em { font-style: normal; background: linear-gradient(100deg, #60A5FA 0%, #818CF8 55%, #93C5FD 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tuob-titulo p { font-size: 15px; line-height: 1.6; color: var(--color-body); margin: 10px 0 0; }
  .tuob-gira { transform-box: view-box; }
  .tuob-girando { animation: tuoGira 900ms linear infinite; }

  /* ── Paso "Módulo": dos tarjetas grandes ──
     Solo texto, sin dibujos: vidrio sobre el cielo, y lo elegido se enciende en
     el azul de la marca. */
  .tuob-modulos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
  .tuob-modulo { position: relative; display: flex; flex-direction: column; overflow: hidden; border-radius: 20px; border: 1px solid rgba(255,255,255,0.10); background: var(--tuob-vidrio); -webkit-backdrop-filter: var(--tuob-desenfoque); backdrop-filter: var(--tuob-desenfoque); transition: transform 260ms var(--tuo-ease), border-color 200ms ease, background 200ms ease, box-shadow 260ms ease; }
  /* Filo de luz arriba, que se enciende al elegir. */
  .tuob-modulo::before { content: ''; position: absolute; left: 24px; right: 24px; top: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(147,197,253,0.9), transparent); opacity: 0; transition: opacity 240ms ease; pointer-events: none; }
  .tuob-modulo[data-elegido='true']::before { opacity: 1; }
  /* El radio ocupa toda la tarjeta, invisible y por encima: se elige tocando en cualquier lado. */
  .tuob-modulo > input { position: absolute; inset: 0; z-index: 3; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  .tuob-modulo:has(input:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  .tuob-modulo[data-elegido='true'] { border-color: #60A5FA; background: linear-gradient(180deg, rgba(37,99,235,0.20), rgba(30,58,138,0.07)); box-shadow: 0 0 0 3px rgba(96,165,250,0.16), 0 24px 60px rgba(37,99,235,0.20); }
  .tuob-modulo-cuerpo { display: flex; flex-direction: column; gap: 20px; flex: 1; padding: 26px; }
  .tuob-modulo-cab { display: flex; align-items: flex-start; gap: 16px; }
  .tuob-modulo-icono { width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; color: var(--color-primary-h); background: rgba(96,165,250,0.10); border: 1px solid rgba(147,197,253,0.18); transition: background 220ms ease, color 220ms ease, box-shadow 240ms ease; }
  .tuob-modulo[data-elegido='true'] .tuob-modulo-icono { background: var(--tuo-grad); color: #fff; border-color: transparent; box-shadow: 0 6px 18px rgba(37,99,235,0.45); }
  .tuob-modulo h2 { margin: 0; font-family: var(--tuo-fh); font-size: 20px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; color: var(--color-text); }
  .tuob-modulo-cab p { margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: var(--color-body); }
  .tuob-modulo-lista { display: grid; gap: 12px; margin: 0; padding: 18px 0 0; list-style: none; border-top: 1px solid rgba(255,255,255,0.08); font-size: 14px; color: var(--color-body); }
  .tuob-modulo-lista li { display: flex; align-items: flex-start; gap: 10px; line-height: 1.45; }
  .tuob-modulo-lista svg { flex-shrink: 0; margin-top: 2px; color: var(--color-primary); }
  .tuob-modulo-pie { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12.5px; line-height: 1.45; color: var(--color-muted); }
  .tuob-modulo-pie b { color: var(--color-body); font-weight: 600; }
  .tuob-modulo-pasos { flex-shrink: 0; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--chip-primary-fg); }
  /* Módulo todavía no habilitado: se lee entero pero no se elige ni reacciona al mouse. */
  .tuob-modulo[data-proximamente='true'] { border-style: dashed; border-color: rgba(255,255,255,0.14); }
  .tuob-modulo[data-proximamente='true'] > input { cursor: not-allowed; }
  .tuob-modulo[data-proximamente='true'] .tuob-modulo-cab, .tuob-modulo[data-proximamente='true'] .tuob-modulo-lista, .tuob-modulo[data-proximamente='true'] .tuob-modulo-pie { opacity: 0.62; }
  .tuob-modulo[data-proximamente='true'] .tuob-modulo-lista svg { color: var(--color-muted); }
  .tuob-modulo-pronto { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; color: var(--chip-primary-fg); background: rgba(96,165,250,0.12); border: 1px solid rgba(147,197,253,0.28); }
  .tuob-modulo-aviso { margin: 0; font-size: 13px; line-height: 1.5; color: var(--color-body); }
  .tuob-ya-cuenta { margin: 22px 0 0; text-align: center; font-size: 14px; color: var(--color-muted); }
  .tuob-ya-cuenta a { display: inline-block; padding: 10px 4px; color: var(--color-primary-h); font-weight: 600; text-decoration: underline; text-decoration-color: rgba(147,197,253,0.4); text-underline-offset: 3px; border-radius: 6px; transition: color 160ms ease, text-decoration-color 160ms ease; }
  .tuob-ya-cuenta a:hover { color: #fff; text-decoration-color: #fff; }
  .tuob-ya-cuenta a:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  /* El tilde de las tarjetas elegibles: círculo (una sola) o cuadrado (varias). */
  .tuob-marca-opcion { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; border: 1.5px solid var(--color-border-strong); color: transparent; transition: background 180ms ease, border-color 180ms ease, color 180ms ease, transform 260ms var(--tuo-ease); }
  .tuob-marca-opcion--casilla { border-radius: 7px; }
  [data-elegido='true'] > .tuob-marca-opcion, [data-elegido='true'] .tuob-modulo-cab > .tuob-marca-opcion { background: #fff; border-color: #fff; color: #1D4ED8; transform: scale(1.06); }

  /* ── Rubros (Turnos) y qué vendés (Tienda) ── */
  .tuob-rubro-grid { display: grid; grid-template-columns: minmax(0, 1fr) 372px; gap: 28px; align-items: start; }
  .tuob-filtros { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
  .tuob-filtros .tuo-buscar { max-width: 300px; }
  .tuob .tuo-buscar > input { height: 44px; background: var(--tuob-panel); }
  .tuob .tuo-seg { background: var(--tuob-panel); }
  .tuob-contador { margin: -12px 0 20px; text-align: center; font-size: 12.5px; color: var(--color-muted); }
  .tuob-seg-scroll { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
  .tuob-seg-scroll::-webkit-scrollbar { display: none; }
  .tuob .tuo-seg > button { height: 36px; display: inline-flex; align-items: center; gap: 6px; }
  .tuob-familia { display: flex; align-items: center; gap: 9px; margin: 0 0 10px; }
  .tuob-familia::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, var(--color-border), transparent); }
  .tuob-grupo + .tuob-grupo { margin-top: 24px; }
  .tuob-rubros { display: grid; grid-template-columns: repeat(auto-fill, minmax(178px, 1fr)); gap: 10px; }
  .tuob-rubro { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 0; width: 100%; min-height: 128px; padding: 14px; text-align: left; font-family: inherit; color: inherit; cursor: pointer; border-radius: 16px; border: 1px solid rgba(255,255,255,0.10); background: var(--tuob-vidrio); transition: transform 240ms var(--tuo-ease), border-color 180ms ease, box-shadow 240ms ease, background 200ms ease; }
  .tuob-rubro-icono { width: 40px; height: 40px; border-radius: 12px; margin-bottom: 12px; display: grid; place-items: center; color: var(--color-primary-h); background: rgba(96,165,250,0.12); border: 1px solid rgba(147,197,253,0.18); transition: background 220ms ease, color 220ms ease, box-shadow 240ms ease, transform 260ms var(--tuo-ease); }
  .tuob-rubro b { font-family: var(--tuo-fh); font-size: 14px; font-weight: 600; letter-spacing: -0.015em; color: var(--color-text); }
  .tuob-rubro small { margin-top: 4px; font-size: 12px; line-height: 1.45; color: var(--color-muted); }
  .tuob-rubro:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuob-rubro[aria-pressed='true'] { border-color: #60A5FA; background: linear-gradient(180deg, rgba(37,99,235,0.26), rgba(30,58,138,0.12)); box-shadow: 0 0 0 3px rgba(96,165,250,0.18), 0 16px 40px rgba(37,99,235,0.22); }
  .tuob-rubro[aria-pressed='true'] .tuob-rubro-icono { background: var(--tuo-grad); color: #fff; border-color: transparent; box-shadow: 0 6px 18px rgba(37,99,235,0.5); }
  .tuob-rubro[aria-pressed='true'] small { color: var(--color-body); }
  .tuob-etiqueta { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; padding: 3px 8px; border-radius: 999px; background: rgba(96,165,250,0.12); font-size: 10.5px; font-weight: 600; color: var(--chip-primary-fg); }
  .tuob-tilde { position: absolute; top: 12px; right: 12px; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: #fff; color: #1D4ED8; animation: tuobTilde 320ms var(--tuo-ease) both; }
  @keyframes tuobTilde { from { transform: scale(0.3) rotate(-40deg); opacity: 0 } to { transform: none; opacity: 1 } }
  .tuob-vacio { background: var(--tuob-vidrio); display: grid; justify-items: center; gap: 10px; padding: 44px 20px; text-align: center; border: 1px dashed var(--color-border-strong); border-radius: 16px; color: var(--color-muted); }

  /* Panel "así va a quedar" */
  .tuob-previa { position: sticky; top: 56px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.10); background: var(--tuob-panel); -webkit-backdrop-filter: var(--tuob-desenfoque); backdrop-filter: var(--tuob-desenfoque); box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 70px rgba(0,0,0,0.5); padding: 18px; scroll-margin-top: 56px;
    /* Entra entero entre la tira de arriba y la botonera; si no, se desliza adentro. */
    max-height: calc(100vh - 56px - 108px); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: rgba(147,197,253,0.3) transparent; }
  .tuob-previa::before { content: ""; position: sticky; display: block; margin: -18px 6px 17px; top: -18px; height: 1px; background: linear-gradient(90deg, transparent, rgba(147,197,253,0.8), transparent); pointer-events: none; }
  .tuob-previa-cuerpo { animation: tuoEntra 360ms var(--tuo-ease) both; }
  .tuob-previa-dial { display: grid; place-items: center; padding: 12px 0 4px; }
  .tuob-dato { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid var(--color-border); }
  .tuob-dato > svg { flex-shrink: 0; margin-top: 2px; color: var(--color-primary); }
  .tuob-dato strong { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .tuob-dato p { margin: 3px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
  .tuob-mini-serv { margin: 0; padding: 12px 0 0; list-style: none; border-top: 1px solid var(--color-border); font-size: 13px; }
  .tuob-mini-serv li { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; color: var(--color-body); }
  .tuob-mini-serv li > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tuob-previa-hueco { display: grid; justify-items: center; gap: 12px; padding: 26px 12px 18px; text-align: center; }
  .tuob-previa-hueco svg { animation: tuoGira 40s linear infinite; }

  /* ── Servicios ── */
  .tuob-serv-lista { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
  .tuob-serv { display: grid; grid-template-columns: minmax(0, 1fr) 132px 148px 44px; gap: 10px; align-items: start; padding: 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.10); background: var(--tuob-panel); transform-origin: 50% 0; animation: tuobServEntra 320ms var(--tuo-ease) both; transition: border-color 180ms ease, box-shadow 220ms ease, background 180ms ease; }
  .tuob-serv[data-saliendo='true'] { animation: tuobServSale 240ms ease both; pointer-events: none; }
  .tuob-serv:focus-within { border-color: var(--color-border-strong); box-shadow: 0 10px 30px rgba(3,6,14,0.45); }
  @keyframes tuobServEntra { from { opacity: 0; transform: translateY(-8px) scale(0.98) } to { opacity: 1; transform: none } }
  @keyframes tuobServSale { to { opacity: 0; transform: translateX(28px) scale(0.98) } }
  /* 25px = alto del label + separación: el botón queda a la altura de los campos. */
  .tuob-quitar { margin-top: 26px; width: 44px; height: 44px; display: grid; place-items: center; padding: 0; border-radius: 12px; border: 1px solid transparent; background: transparent; color: var(--color-muted); cursor: pointer; transition: color 160ms ease, background 160ms ease, border-color 160ms ease; }
  .tuob-quitar:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuob-agregar { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 52px; margin-top: 10px; border-radius: 16px; border: 1.5px dashed var(--color-border-strong); background: transparent; color: var(--color-body); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: border-color 180ms ease, color 180ms ease, background 180ms ease; }
  .tuob-agregar:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuob-agregar svg { transition: transform 260ms var(--tuo-ease); }
  .tuob-dupla { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 22px; }
  .tuob-caja { border-radius: 16px; border: 1px solid rgba(255,255,255,0.10); background: var(--tuob-panel); padding: 16px; transition: border-color 180ms ease; }
  .tuob-caja strong { display: block; margin-top: 8px; font-family: var(--tuo-fh); font-size: 15px; font-weight: 600; color: var(--color-text); }
  .tuob-caja p { margin: 5px 0 0; font-size: 13px; line-height: 1.55; color: var(--color-muted); }

  .tuob .tuo-switch::before { content: ''; position: absolute; inset: -10px -4px; }

  /* ── Formularios ── */
  .tuob-form { display: grid; gap: 18px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.10); background: var(--tuob-panel); -webkit-backdrop-filter: var(--tuob-desenfoque); backdrop-filter: var(--tuob-desenfoque); box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 70px rgba(0,0,0,0.45); padding: 26px; }
  .tuob-fila2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
  .tuob-bloque { display: grid; gap: 14px; }
  .tuob-campo { display: grid; gap: 7px; min-width: 0; align-content: start; }
  .tuob-campo > label, .tuob-leyenda { line-height: 18px; font-size: 13px; font-weight: 600; color: var(--color-text); display: flex; align-items: baseline; gap: 6px; padding: 0; }
  .tuob-campo > label small, .tuob-leyenda small { font-size: 12px; font-weight: 400; color: var(--color-muted); }
  .tuob-control { position: relative; display: flex; align-items: center; }
  .tuob-control > .tuob-prefijo { position: absolute; left: 13px; color: var(--color-muted); pointer-events: none; font-size: 14px; display: inline-flex; }
  .tuob-control > .tuob-sufijo { position: absolute; right: 13px; color: var(--color-muted); pointer-events: none; font-size: 13px; }
  .tuob-input { width: 100%; box-sizing: border-box; height: 46px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--color-border); background: rgba(255,255,255,0.035); color: var(--color-text); font-family: inherit; font-size: 15px; outline: none; transition: border-color 160ms ease, box-shadow 200ms ease, background 160ms ease; }
  textarea.tuob-input { height: auto; min-height: 84px; padding: 12px 14px 22px; line-height: 1.5; resize: vertical; }
  select.tuob-input { appearance: none; -webkit-appearance: none; padding-right: 34px; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238794B2' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
  select.tuob-input option { background: #0B101D; color: #F1F5FD; }
  .tuob-input::placeholder { color: var(--color-muted); opacity: 0.85; }
  .tuob-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(96,165,250,0.22); background: rgba(255,255,255,0.05); }
  .tuob-input[aria-invalid='true'] { border-color: var(--color-error); box-shadow: 0 0 0 3px rgba(248,113,113,0.16); }
  .tuob-input:disabled { opacity: 0.6; cursor: progress; }
  .tuob-input--prefijo { padding-left: 36px; }
  .tuob-input--sufijo { padding-right: 96px; }
  .tuob-input--mono { font-family: var(--tuo-mono); font-variant-numeric: tabular-nums; }
  /* Contador de caracteres del área de texto, en su esquina. */
  .tuob-cuenta { position: absolute; right: 12px; bottom: 7px; font-size: 11px; color: var(--color-muted); pointer-events: none; }
  .tuob-error { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; color: var(--color-error); animation: tuoEntra 220ms ease both; }
  .tuob-error > svg { flex-shrink: 0; }
  .tuob-ayuda { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
  .tuob-ojo { position: absolute; right: 2px; width: 44px; height: 44px; display: grid; place-items: center; padding: 0; border: none; background: none; color: var(--color-muted); cursor: pointer; border-radius: 10px; transition: color 160ms ease; }
  .tuob-ojo:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -4px; }
  fieldset.tuob-campo { border: none; margin: 0; padding: 0; }
  /* Resultado de un chequeo (subdominio, email, contraseñas): verificando, o bien. */
  .tuob-chequeo { display: inline-flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
  .tuob-chequeo[data-ok='true'] { color: var(--color-success); }
  .tuob-control[data-chequeo='libre'] > .tuob-input:not(:focus) { border-color: rgba(52,211,153,0.55); }
  .tuob-control[data-chequeo='ocupado'] > .tuob-input { border-color: var(--color-error); box-shadow: 0 0 0 3px rgba(248,113,113,0.16); }
  .tuob-enlace { display: inline-flex; align-items: center; gap: 6px; justify-self: start; min-height: 28px; padding: 0; border: none; background: none; color: var(--color-primary-h); font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; text-decoration: underline; text-decoration-color: rgba(147,197,253,0.4); text-underline-offset: 3px; border-radius: 6px; transition: color 160ms ease, text-decoration-color 160ms ease; }
  .tuob-enlace:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

  /* Logo */
  .tuob-logo { display: flex; align-items: center; gap: 18px; }
  .tuob-logo-marco { position: relative; width: 92px; height: 92px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; padding: 0; border: 1.5px dashed var(--color-border-strong); background: var(--tuob-hueco); color: var(--color-muted); cursor: pointer; transition: border-color 180ms ease, box-shadow 220ms ease, transform 260ms var(--tuo-ease); }
  .tuob-logo-marco:has(img) { border-style: solid; border-color: rgba(147,197,253,0.5); }
  .tuob-logo-marco img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
  .tuob-logo-marco:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  .tuob-logo-sigla { font-family: var(--tuo-fh); font-size: 28px; font-weight: 700; letter-spacing: -0.03em; color: var(--color-text); }
  .tuob-logo-marco > i { position: absolute; right: -2px; bottom: -2px; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--tuo-grad); color: #fff; border: 2px solid #05070C; }
  .tuob-logo-botones { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }

  /* Opciones tipo tarjeta: radio (una) o casilla (varias) */
  .tuob-opciones { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .tuob-opciones[data-n='1'], .tuob-opciones--pila { grid-template-columns: minmax(0, 1fr); }
  .tuob-opciones[data-n='3'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tuob-opcion { position: relative; display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: 14px; border: 1px solid var(--color-border); background: var(--tuob-hueco); cursor: pointer; transition: border-color 180ms ease, background 180ms ease, box-shadow 220ms ease, transform 220ms var(--tuo-ease); }
  .tuob-opcion input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
  .tuob-opcion > svg { flex-shrink: 0; margin-top: 1px; color: var(--color-muted); transition: color 180ms ease; }
  .tuob-opcion > span { flex: 1; min-width: 0; }
  .tuob-opcion strong { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .tuob-opcion > span > span { display: block; margin-top: 3px; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
  .tuob-opcion > span > span b { font-weight: 600; color: var(--color-body); }
  .tuob-opcion:has(input:checked) { border-color: #60A5FA; background: linear-gradient(180deg, rgba(37,99,235,0.26), rgba(30,58,138,0.12)); box-shadow: 0 0 0 3px rgba(96,165,250,0.2); }
  .tuob-opcion:has(input:checked) > svg { color: var(--color-primary-h); }
  .tuob-opcion:has(input:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuob-opcion[data-fija='true'] { cursor: default; }
  .tuob-plan-chip { height: 20px; margin-left: 8px; padding: 0 8px; font-size: 10.5px; vertical-align: 2px; }
  .tuob-plan-precio { font-size: 15px; font-weight: 600; color: var(--color-text); }
  .tuob-dias { display: flex; flex-wrap: wrap; gap: 8px; }
  .tuob-dia { min-width: 50px; height: 44px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--color-border); background: var(--tuob-hueco); color: var(--color-muted); font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: border-color 160ms ease, background 160ms ease, color 160ms ease, box-shadow 200ms ease; }
  .tuob-dia[aria-pressed='true'] { border-color: transparent; background: var(--tuo-grad); color: #fff; box-shadow: 0 6px 16px rgba(37,99,235,0.35); }
  .tuob-dia:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuob-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  /* Horarios: un renglón por turno de atención (mañana y tarde), cada uno con su llave y su "de… a…". */
  .tuob-turnos { display: grid; gap: 10px; }
  .tuob-turno { display: grid; grid-template-columns: 38px 76px minmax(0, 1fr) auto; gap: 12px; align-items: center; min-height: 46px; padding: 10px 14px; border-radius: 14px; border: 1px solid var(--color-border); background: var(--tuob-hueco); transition: border-color 180ms ease, background 180ms ease; }
  .tuob-turno[data-on='true'] { border-color: rgba(147,197,253,0.34); background: rgba(37,99,235,0.08); }
  .tuob-turno-ico { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; color: var(--color-muted); background: rgba(96,165,250,0.08); transition: color 180ms ease, background 180ms ease; }
  .tuob-turno[data-on='true'] .tuob-turno-ico { color: var(--color-primary-h); background: rgba(96,165,250,0.16); }
  .tuob-turno > strong { font-size: 14px; font-weight: 600; color: var(--color-text); }
  .tuob-turno-horas { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13px; color: var(--color-muted); }
  .tuob-turno-horas select.tuob-input { width: 112px; height: 44px; }
  .tuob-turno-off { font-size: 13px; color: var(--color-muted); }
  .tuob-check { display: flex; align-items: flex-start; gap: 10px; min-height: 44px; font-size: 13px; line-height: 1.5; font-weight: 400; color: var(--color-body); cursor: pointer; }
  .tuob-check input { width: 20px; height: 20px; margin: 1px 0 0; flex-shrink: 0; accent-color: #3B82F6; cursor: pointer; }
  .tuob-check a { color: var(--color-primary-h); font-weight: 600; text-underline-offset: 3px; }
  .tuob-check a:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 4px; }

  /* Avisos: información (azul), advertencia (ámbar) o confirmación (verde). */
  .tuob-aviso { display: flex; gap: 10px; align-items: flex-start; margin: 0; padding: 12px 14px; border-radius: 12px; font-size: 13px; line-height: 1.55; color: #BFDBFE; background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.24); }
  .tuob-aviso > svg { flex-shrink: 0; margin-top: 2px; color: #60A5FA; }
  .tuob-aviso strong { font-weight: 600; color: #F1F5FD; }
  .tuob-aviso[data-tono='aviso'] { color: #FDE68A; background: rgba(251,191,36,0.08); border-color: rgba(251,191,36,0.24); }
  .tuob-aviso[data-tono='aviso'] > svg { color: #FBBF24; }
  .tuob-aviso[data-tono='ok'] { color: #A7F3D0; background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.26); }
  .tuob-aviso[data-tono='ok'] > svg { color: #34D399; }

  /* Mapa. isolation: Leaflet usa z-index de hasta 1000 y sin esto tapa la botonera fija. */
  .tuob-mapa { isolation: isolate; overflow: hidden; border-radius: 14px; border: 1px solid var(--color-border); background: var(--tuob-hueco); }
  .tuob-mapa-barra { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px; border-bottom: 1px solid var(--color-border); }
  .tuob-mapa-estado { display: inline-flex; align-items: center; gap: 6px; flex: 1 1 200px; min-width: 0; font-size: 12.5px; line-height: 1.4; color: var(--color-muted); }
  .tuob-mapa-estado > svg { flex-shrink: 0; }
  .tuob-mapa-estado[data-tono='ok'] { color: var(--color-success); }
  .tuob-mapa-estado[data-tono='aviso'] { color: var(--color-warning); }

  /* ── "Tu página": las dos formas y el celular de vista previa ── */
  .tuob-pagina { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 32px; align-items: start; }
  .tuob-pagina-vista { position: sticky; top: 56px; display: grid; justify-items: center; gap: 14px; scroll-margin-top: 56px; }
  .tuob-sinreg { display: flex; align-items: flex-start; gap: 14px; }
  .tuob-sinreg-ico { width: 42px; height: 42px; border-radius: 13px; flex-shrink: 0; display: grid; place-items: center; color: #34D399; background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.26); }
  .tuob-sinreg strong, .tuob-llave-fila strong, .tuob-benef strong, .tuob-benef label { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .tuob-sinreg p, .tuob-llave-fila p, .tuob-benef p { margin: 3px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
  .tuob-llave-fila { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 18px; border-top: 1px solid var(--color-border); }
  .tuob-benef { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
  .tuob-benef li { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--color-border); background: var(--tuob-hueco); }
  .tuob-benef-ico { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; color: var(--color-primary-h); background: rgba(96,165,250,0.12); }
  .tuob-benef select.tuob-input { width: 140px; height: 44px; }

  .tuob-tel { position: relative; width: 272px; height: 548px; box-sizing: border-box; padding: 10px; border-radius: 42px; border: 1px solid rgba(147,197,253,0.3); background: linear-gradient(160deg, #1E293B, #0B101D); box-shadow: 0 30px 80px rgba(3,6,14,0.7), 0 0 90px rgba(59,130,246,0.2), inset 0 1px 0 rgba(255,255,255,0.12); }
  .tuob-tel-isla { position: absolute; top: 19px; left: 50%; z-index: 4; width: 70px; height: 19px; margin-left: -35px; border-radius: 999px; background: #05080F; }
  .tuob-tel-pantalla { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 33px; animation: tuobPantalla 380ms var(--tuo-ease) both; }
  @keyframes tuobPantalla { from { opacity: 0; transform: scale(0.97) } to { opacity: 1; transform: none } }
  /* El sitio en miniatura: pinta con los colores y tipografías de la plantilla del rubro (--ms-*). */
  .tuob-ms { display: flex; flex-direction: column; background: var(--ms-bg); color: var(--ms-body); font-family: var(--ms-fb); font-size: 10.5px; line-height: 1.45; text-align: left; }
  .tuob-ms p { margin: 0; }
  .tuob-ms-h { font-family: var(--ms-fh); font-weight: var(--ms-peso); line-height: 1.1; letter-spacing: -0.01em; color: var(--ms-text); }
  .tuob-ms[data-mayus='true'] .tuob-ms-h { text-transform: uppercase; }
  .tuob-ms-h em { font-style: italic; color: var(--ms-primary); }
  .tuob-ms-eyebrow { font-family: "Geist Mono", ui-monospace, monospace; font-size: 7.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ms-primary); }
  .tuob-ms-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; box-sizing: border-box; height: 30px; padding: 0 14px; border-radius: var(--ms-rbtn); background: var(--ms-primary); color: var(--ms-on); font-size: 10.5px; font-weight: 700; white-space: nowrap; }
  .tuob-ms-btn--ancho { width: 100%; height: 36px; font-size: 11.5px; }
  .tuob-ms-avatar { width: 62px; height: 62px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; overflow: hidden; background: var(--ms-primary); color: var(--ms-on); font-family: var(--ms-fh); font-size: 21px; font-weight: 700; }
  .tuob-ms-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .tuob-ms-avatar--chico { width: 24px; height: 24px; font-size: 9.5px; }
  .tuob-ms-datos { display: grid; gap: 5px; width: 100%; margin: 0; padding: 0; list-style: none; font-size: 9.5px; color: var(--ms-body); text-align: left; }
  .tuob-ms-datos li { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .tuob-ms-datos li svg { flex-shrink: 0; color: var(--ms-primary); }
  .tuob-ms-sello { margin-top: auto; padding: 10px 0 12px; text-align: center; font-family: "Geist Mono", ui-monospace, monospace; font-size: 7px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ms-muted); }
  /* Página simple: todo entra en la pantalla. */
  .tuob-ms-portada { position: relative; height: 158px; flex-shrink: 0; }
  .tuob-ms-portada img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .tuob-ms-portada::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, var(--ms-bg), transparent 55%); }
  .tuob-ms-centro { position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 18px; text-align: center; }
  .tuob-ms-centro > .tuob-ms-avatar { margin-top: -36px; box-shadow: 0 0 0 4px var(--ms-bg); }
  .tuob-ms-centro > .tuob-ms-h { margin-top: 6px; font-size: 21px; }
  .tuob-ms-centro > p { max-width: 204px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .tuob-ms-centro > .tuob-ms-btn { margin-top: 8px; }
  .tuob-ms-nota { font-size: 8.5px; color: var(--ms-muted); }
  .tuob-ms-centro > .tuob-ms-datos { margin-top: 6px; padding-top: 9px; border-top: 1px solid var(--ms-border); }
  .tuob-ms-benef { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; margin-top: 4px; padding: 4px 9px; box-sizing: border-box; border-radius: 999px; border: 1px dashed var(--ms-primary); font-size: 8.5px; color: var(--ms-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Página simple: la reserva de un turno, en cinco pantallas que se turnan solas. Cada una ocupa un
     quinto del ciclo de 22 s (--k dice cuál) y adentro pasa lo mismo: aparece el dedo, toca, y lo
     elegido queda marcado. Todo con opacity y transform. */
  .tuob-ms[data-forma='simple'] { position: relative; }
  .tuob-esc { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--ms-bg); opacity: 0; animation: tuobEscena 22s linear infinite; animation-delay: calc(var(--k) * 4.4s); }
  @keyframes tuobEscena { 0% { opacity: 0; transform: translateX(18px) } 1.6%, 19% { opacity: 1; transform: none } 20.6%, 100% { opacity: 0; transform: translateX(-18px) } }
  .tuob-esc-cab { display: flex; align-items: center; gap: 7px; padding: 34px 14px 10px; border-bottom: 1px solid var(--ms-border); font-family: var(--ms-fh); font-size: 11.5px; color: var(--ms-text); }
  .tuob-esc-cab b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
  .tuob-esc-paso { margin: 14px 14px 0; font-family: "Geist Mono", ui-monospace, monospace; font-size: 7.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ms-primary); }
  .tuob-esc-tit { display: block; margin: 4px 14px 12px; font-size: 19px; }
  .tuob-esc-lista { display: grid; gap: 7px; margin: 0 14px; }
  .tuob-esc-op { position: relative; display: flex; align-items: center; gap: 8px; padding: 10px 11px; border-radius: var(--ms-r); border: 1px solid var(--ms-border); background: var(--ms-surface); }
  .tuob-esc-op > span { flex: 1; min-width: 0; display: grid; gap: 1px; }
  .tuob-esc-op b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--ms-text); }
  .tuob-esc-op small { font-size: 9px; color: var(--ms-muted); }
  .tuob-esc-op > i:not(.tuob-dedo) { font-style: normal; font-family: "Geist Mono", ui-monospace, monospace; font-size: 10px; font-weight: 600; color: var(--ms-text); }
  /* Lo elegido: el marco aparece recién después del toque. */
  .tuob-esc [data-el]::after { content: ''; position: absolute; inset: -1px; border-radius: inherit; border: 1.5px solid var(--ms-primary); background: color-mix(in srgb, var(--ms-primary) 14%, transparent); opacity: 0; animation: tuobElegido 22s linear infinite; animation-delay: calc(var(--k) * 4.4s); }
  @keyframes tuobElegido { 0%, 11.6% { opacity: 0 } 12.6%, 20% { opacity: 1 } 21%, 100% { opacity: 0 } }
  .tuob-dedo { position: absolute; right: 14px; top: 50%; z-index: 2; width: 26px; height: 26px; margin-top: -13px; border-radius: 50%; background: rgba(255,255,255,0.55); box-shadow: 0 0 0 2px rgba(0,0,0,0.3), 0 6px 14px rgba(0,0,0,0.3); opacity: 0; pointer-events: none; animation: tuobDedo 22s linear infinite; animation-delay: calc(var(--k) * 4.4s); }
  @keyframes tuobDedo { 0%, 8% { opacity: 0; transform: scale(1.6) } 10.5% { opacity: 1; transform: scale(1) } 11.8% { opacity: 1; transform: scale(0.76) } 13.2% { opacity: 1; transform: scale(1) } 15%, 100% { opacity: 0; transform: scale(1.3) } }
  .tuob-esc-pulso { position: relative; animation: tuobPulso 22s linear infinite; animation-delay: calc(var(--k) * 4.4s); }
  @keyframes tuobPulso { 0%, 11.3% { transform: none } 12% { transform: scale(0.96) } 13%, 100% { transform: none } }
  .tuob-esc-pulso > .tuob-dedo { right: 22px; }
  .tuob-esc-dias { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 0 14px 4px; }
  .tuob-esc-dias span { display: grid; justify-items: center; gap: 1px; padding: 7px 0; border-radius: var(--ms-r); border: 1px solid var(--ms-border); background: var(--ms-surface); }
  .tuob-esc-dias small { font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ms-muted); }
  .tuob-esc-dias b { font-family: var(--ms-fh); font-size: 15px; color: var(--ms-text); }
  .tuob-esc-dias span[data-sel] { border-color: var(--ms-primary); background: var(--ms-primary); }
  .tuob-esc-dias span[data-sel] small, .tuob-esc-dias span[data-sel] b { color: var(--ms-on); }
  .tuob-esc-franja { display: flex; align-items: center; gap: 5px; margin: 10px 14px 6px; font-size: 9px; font-weight: 700; color: var(--ms-muted); }
  .tuob-esc-horas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 0 14px; }
  .tuob-esc-horas span { position: relative; display: grid; place-items: center; height: 30px; border-radius: var(--ms-r); border: 1px solid var(--ms-border); background: var(--ms-surface); font-family: "Geist Mono", ui-monospace, monospace; font-size: 10.5px; font-weight: 600; color: var(--ms-text); }
  .tuob-esc-horas .tuob-dedo { right: 50%; margin-right: -13px; }
  .tuob-esc-campo { display: grid; gap: 3px; margin: 0 14px 8px; }
  .tuob-esc-campo small { font-size: 8.5px; font-weight: 700; color: var(--ms-text); }
  .tuob-esc-campo span { display: flex; align-items: center; height: 32px; padding: 0 10px; border-radius: var(--ms-r); border: 1px solid var(--ms-border); background: var(--ms-surface); font-size: 10.5px; color: var(--ms-text); }
  .tuob-esc-resumen { display: flex; justify-content: space-between; gap: 8px; margin: 4px 14px 12px; padding: 9px 11px; border-radius: var(--ms-r); border: 1px dashed var(--ms-border); font-size: 9.5px; color: var(--ms-body); }
  .tuob-esc-resumen span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tuob-esc-resumen b { flex-shrink: 0; font-family: "Geist Mono", ui-monospace, monospace; font-weight: 600; color: var(--ms-text); }
  .tuob-esc > .tuob-ms-btn--ancho { width: auto; margin: 0 14px 7px; }
  .tuob-esc > .tuob-ms-nota { margin: 0 14px; }
  .tuob-esc-ok { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 30px 18px 22px; text-align: center; }
  .tuob-esc-tilde { width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary); color: var(--ms-on); box-shadow: 0 0 0 7px color-mix(in srgb, var(--ms-primary) 20%, transparent); animation: tuobTilde 22s linear infinite; animation-delay: calc(var(--k) * 4.4s); }
  @keyframes tuobTilde { 0% { transform: scale(0.4) } 3%, 100% { transform: none } }
  .tuob-esc-ok > .tuob-ms-h { font-size: 19px; }
  .tuob-esc-ticket { display: grid; gap: 4px; width: 100%; box-sizing: border-box; padding: 12px; border-radius: var(--ms-r); border: 1px solid var(--ms-border); background: var(--ms-surface); text-align: left; }
  .tuob-esc-ticket small { font-family: "Geist Mono", ui-monospace, monospace; font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ms-muted); }
  .tuob-esc-ticket b { font-size: 12px; color: var(--ms-text); }
  .tuob-esc-ticket span { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 9.5px; color: var(--ms-body); }
  .tuob-esc-ticket svg { flex-shrink: 0; color: var(--ms-primary); }
  .tuob-esc-wa { display: inline-flex; align-items: center; gap: 5px; font-size: 9px; color: var(--ms-muted); }
  .tuob-esc-puntos { position: absolute; left: 0; right: 0; bottom: 9px; z-index: 3; display: flex; justify-content: center; gap: 5px; }
  .tuob-esc-puntos i { width: 5px; height: 5px; border-radius: 50%; background: var(--ms-text); opacity: 0.25; animation: tuobPunto 22s linear infinite; animation-delay: calc(var(--k) * 4.4s); }
  @keyframes tuobPunto { 0%, 20% { opacity: 0.9; transform: scale(1.5) } 20.5%, 100% { opacity: 0.25; transform: none } }
  /* Sitio web completo: es más largo que la pantalla y se recorre solo, despacio, para que se note. */
  .tuob-ms[data-forma='web'] { display: block; }
  .tuob-ms-rollo { display: flex; flex-direction: column; min-height: 560px; padding-bottom: 6px; animation: tuobRollo 20s ease-in-out 1.2s infinite; }
  /* 476px = alto de la pantalla (528) menos la barra de reservar (52). */
  @keyframes tuobRollo { 0%, 12% { transform: none } 48%, 62% { transform: translateY(calc(-100% + 476px)) } 96%, 100% { transform: none } }
  .tuob-ms-cab { display: flex; align-items: center; gap: 7px; padding: 34px 12px 9px; font-family: var(--ms-fh); font-size: 11.5px; color: var(--ms-text); }
  .tuob-ms-cab b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
  .tuob-ms-hero { position: relative; height: 190px; flex-shrink: 0; }
  .tuob-ms-hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .tuob-ms-hero::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.84), rgba(0,0,0,0.25) 62%, rgba(0,0,0,0.3)); }
  .tuob-ms-hero-txt { position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 1; display: grid; gap: 7px; justify-items: start; }
  .tuob-ms-hero-txt .tuob-ms-h { font-size: 22px; color: #fff; }
  .tuob-ms-hero-txt .tuob-ms-eyebrow { color: #fff; opacity: 0.85; }
  .tuob-ms-sec { display: grid; gap: 7px; padding: 15px 14px 0; }
  .tuob-ms-sec > p { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .tuob-ms-serv { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1px 8px; padding: 7px 9px; border-radius: var(--ms-r); border: 1px solid var(--ms-border); background: var(--ms-surface); }
  .tuob-ms-serv b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10.5px; color: var(--ms-text); }
  .tuob-ms-serv span { grid-column: 1; font-size: 9px; color: var(--ms-muted); }
  .tuob-ms-serv i { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-style: normal; font-family: "Geist Mono", ui-monospace, monospace; font-size: 10px; font-weight: 600; color: var(--ms-text); }
  .tuob-ms-equipo { display: flex; gap: 7px; }
  .tuob-ms-equipo img { width: 54px; height: 62px; border-radius: var(--ms-r); object-fit: cover; }
  .tuob-ms-mapa { display: grid; place-items: center; height: 54px; border-radius: var(--ms-r); border: 1px solid var(--ms-border); color: var(--ms-primary); background: repeating-linear-gradient(45deg, var(--ms-alt) 0 8px, var(--ms-surface) 8px 16px); }
  .tuob-ms-cta { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; height: 52px; box-sizing: border-box; padding: 8px 12px; border-top: 1px solid var(--ms-border); background: var(--ms-bg); }

  /* ── Pago ── */
  .tuob-resumen { margin: 0; display: grid; gap: 0; }
  .tuob-resumen > div { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-top: 1px solid var(--color-border); font-size: 13.5px; }
  .tuob-resumen > div:first-child { border-top: none; padding-top: 0; }
  .tuob-resumen dt { color: var(--color-muted); flex-shrink: 0; }
  .tuob-resumen dd { margin: 0; color: var(--color-text); font-weight: 500; text-align: right; min-width: 0; overflow-wrap: anywhere; }
  .tuob-codigo { display: flex; gap: 8px; }
  .tuob-codigo > .tuob-control { flex: 1; min-width: 0; }
  .tuob-codigo > .tuo-btn { height: 46px; flex-shrink: 0; }
  .tuob-codigo-ok { display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 14px; border-radius: 12px; border: 1px solid rgba(52,211,153,0.3); background: rgba(52,211,153,0.08); font-size: 13px; line-height: 1.5; color: #A7F3D0; animation: tuoEntra 260ms ease both; }
  .tuob-codigo-ok b { color: #fff; }
  .tuob-codigo-ico { width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; background: #34D399; color: #052E1B; }
  .tuob-total { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; padding: 16px 18px; border-radius: 14px; border: 1px solid var(--color-border-strong); background: var(--tuob-vidrio-alto); }
  .tuob-total p { margin: 4px 0 0; font-size: 13px; color: var(--color-body); }
  .tuob-total-monto { display: flex; align-items: baseline; gap: 10px; flex-shrink: 0; }
  .tuob-total-monto s { font-size: 14px; color: var(--color-muted); }
  .tuob-total-monto b { font-size: 26px; font-weight: 600; letter-spacing: -0.03em; color: var(--color-text); }
  /* El "pago" tapa todo mientras dura: no se puede tocar nada. */
  .tuob-procesando { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: 20px; background: rgba(0,0,0,0.84); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); animation: tuobVelo 220ms ease both; }
  @keyframes tuobVelo { from { opacity: 0 } to { opacity: 1 } }
  .tuob-procesando-caja { display: grid; justify-items: center; gap: 12px; text-align: center; }
  .tuob-procesando-caja strong { font-family: var(--tuo-fh); font-size: 19px; font-weight: 600; letter-spacing: -0.02em; color: var(--color-text); }
  .tuob-procesando-caja span { font-size: 13px; color: var(--color-muted); }

  /* ── ¡Listo! ── */
  .tuob-listo { display: grid; justify-items: center; text-align: center; padding-top: 8px; }
  .tuob-planeta { position: relative; width: 210px; height: 210px; display: grid; place-items: center; }
  .tuob-planeta::before, .tuob-planeta::after { content: ''; position: absolute; inset: 58px; border-radius: 50%; border: 1px solid rgba(147,197,253,0.5); animation: tuoOnda 3.2s ease-out infinite; }
  .tuob-planeta::after { animation-delay: 1.6s; }
  .tuob-planeta svg { position: relative; animation: tuobDespega 900ms var(--tuo-ease) both; }
  @keyframes tuobDespega { from { opacity: 0; transform: translateY(26px) scale(0.8) } to { opacity: 1; transform: none } }
  .tuob-armado { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 18px 0 0; padding: 0; list-style: none; }
  .tuob-armado li { display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.10); background: var(--tuob-vidrio); font-size: 12.5px; color: var(--color-body); }
  .tuob-armado svg { flex-shrink: 0; color: var(--color-primary-h); }
  .tuob-pase { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 22px; align-items: center; width: 100%; max-width: 620px; box-sizing: border-box; margin-top: 26px; padding: 20px; text-align: left; border-radius: 22px; border: 1px solid rgba(255,255,255,0.14); background: var(--tuob-panel); -webkit-backdrop-filter: var(--tuob-desenfoque); backdrop-filter: var(--tuob-desenfoque); box-shadow: 0 24px 70px rgba(0,0,0,0.5); }
  .tuob-qr { padding: 10px; border-radius: 16px; background: #fff; line-height: 0; box-shadow: 0 10px 30px rgba(3,6,14,0.5); transition: transform 260ms var(--tuo-ease), box-shadow 260ms ease; }
  .tuob-link { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 0 6px 0 14px; height: 48px; border-radius: 12px; border: 1px solid var(--color-border); background: rgba(255,255,255,0.035); }
  .tuob-link code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--tuo-mono); font-size: 14px; color: var(--color-primary-h); }
  .tuob-listo-acciones { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 26px; }

  /* ── Botonera fija ── */
  .tuob-pie { position: fixed; left: 0; right: 0; bottom: 0; z-index: 100; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.72); -webkit-backdrop-filter: blur(16px) saturate(140%); backdrop-filter: blur(16px) saturate(140%); padding: 14px 0 calc(14px + env(safe-area-inset-bottom, 0px)); box-shadow: 0 -18px 50px rgba(0,0,0,0.6); }
  .tuob-pie::before { content: ''; position: absolute; left: 0; right: 0; top: -1px; height: 1px; background: linear-gradient(90deg, transparent, rgba(147,197,253,0.45), transparent); }
  .tuob-pie-in { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .tuob-pie-resumen { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .tuob-pie-resumen > span:first-child { width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; background: rgba(96,165,250,0.14); border: 1px solid rgba(147,197,253,0.2); color: var(--color-primary-h); }
  .tuob-pie-resumen b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tuob-pie-resumen small { display: block; font-size: 12.5px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tuob-pie-resumen small[data-error='true'] { color: var(--color-error); }
  .tuob-pie-botones { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .tuob-flecha { transition: transform 220ms var(--tuo-ease); }
  .tuob-ver-previa { display: none; }

  @media (hover: hover) {
    .tuob-punto[data-tocable='true']:hover > i { transform: scale(1.25); box-shadow: 0 0 20px rgba(96,165,250,0.9); }
    .tuob-punto[data-tocable='true']:hover > span { color: var(--color-text); }
    .tuob-modulo:not([data-elegido='true']):not([data-proximamente='true']):hover { background: var(--tuob-vidrio-alto); }
    .tuob-modulo:not([data-proximamente='true']):hover { transform: translateY(-3px); border-color: rgba(147,197,253,0.5); box-shadow: 0 22px 50px rgba(0,0,0,0.45); }
    .tuob-modulo[data-elegido='true']:hover { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(96,165,250,0.24), 0 26px 64px rgba(37,99,235,0.28); }
    .tuob-rubro:not([aria-pressed='true']):hover { background: var(--tuob-vidrio-alto); }
    .tuob-rubro:hover { transform: translateY(-3px); border-color: rgba(147,197,253,0.5); box-shadow: 0 18px 40px rgba(0,0,0,0.45); }
    .tuob-rubro[aria-pressed='true']:hover { box-shadow: 0 0 0 3px rgba(96,165,250,0.3), 0 20px 46px rgba(37,99,235,0.4); }
    .tuob-rubro:hover .tuob-rubro-icono { transform: scale(1.08) rotate(-5deg); box-shadow: 0 0 22px rgba(96,165,250,0.45); }
    .tuob-serv:hover { border-color: var(--color-border-strong); }
    .tuob-quitar:hover { color: var(--color-error); background: rgba(248,113,113,0.12); border-color: rgba(248,113,113,0.3); }
    .tuob-agregar:hover { border-color: var(--color-primary); color: var(--color-text); background: rgba(96,165,250,0.08); }
    .tuob-agregar:hover svg { transform: rotate(90deg); }
    .tuob-caja:hover { border-color: var(--color-border-strong); }
    .tuob-input:hover:not(:focus):not(:disabled) { border-color: var(--color-border-strong); }
    .tuob-ojo:hover { color: var(--color-text); }
    .tuob-enlace:hover { color: #fff; text-decoration-color: #fff; }
    .tuob-check a:hover { color: #fff; }
    .tuob-logo-marco:hover { border-color: #60A5FA; box-shadow: 0 0 0 4px rgba(96,165,250,0.18); transform: scale(1.03); }
    .tuob-opcion:not([data-fija='true']):hover { border-color: rgba(147,197,253,0.5); transform: translateY(-2px); box-shadow: 0 12px 30px rgba(3,6,14,0.5); }
    .tuob-opcion:has(input:checked):not([data-fija='true']):hover { box-shadow: 0 0 0 3px rgba(96,165,250,0.28), 0 12px 30px rgba(37,99,235,0.3); }
    .tuob-dia:hover { border-color: var(--color-border-strong); color: var(--color-text); }
    .tuob-qr:hover { transform: scale(1.04) rotate(-1.5deg); box-shadow: 0 16px 40px rgba(37,99,235,0.45); }
    .tuo-btn:hover .tuob-flecha { transform: translateX(4px); }
    .tuo-btn:hover .tuob-flecha--atras { transform: translateX(-4px); }
  }

  @media (max-width: 1100px) {
    /* Con menos ancho el logo se pisa con el primer punto de la órbita. */
    .tuob-cab { flex-direction: column; align-items: center; gap: 6px; }
    .tuob-marca { position: static; }
  }
  @media (max-width: 1080px) {
    .tuob-rubro-grid, .tuob-pagina { grid-template-columns: minmax(0, 1fr); }
    .tuob-previa { position: relative; top: auto; max-height: none; overflow: visible; }
    .tuob-pagina-vista { position: static; }
    .tuob-ver-previa { display: inline-flex; }
  }
  @media (max-width: 720px) {
    .tuob-cab { align-items: stretch; padding: 16px 16px 0; gap: 14px; }
    .tuob-pasos { display: none; }
    .tuob-pasos-mini { display: flex; padding: 12px 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.10); background: var(--tuob-panel); }
    .tuob-ancho { padding: 0 16px; }
    .tuob.tuo-espacio { padding-bottom: 150px; }
    .tuob-titulo { text-align: left; margin-bottom: 22px; }
    html:has(.tuob) { scroll-padding-bottom: 168px; }
    /* Los dos módulos tienen que verse sin deslizar: el detalle de cada uno aparece recién cuando se lo elige. */
    .tuob-modulos { grid-template-columns: minmax(0, 1fr); gap: 12px; }
    .tuob-modulo-cuerpo { padding: 16px; gap: 12px; }
    .tuob-modulo-icono { width: 44px; height: 44px; border-radius: 13px; }
    .tuob-modulo-lista { padding-top: 12px; gap: 9px; }
    .tuob-modulo:not([data-elegido='true']) .tuob-modulo-lista { display: none; }
    .tuob-modulo[data-elegido='true'] .tuob-modulo-lista { animation: tuoEntra 280ms var(--tuo-ease) both; }
    .tuob-modulo-pie { padding-top: 12px; }
    .tuob-filtros .tuo-buscar { max-width: none; }
    .tuob-contador { margin-top: -8px; text-align: left; }
    .tuob .tuo-buscar > input, .tuob-input { font-size: 16px; height: 48px; }
    .tuob .tuo-seg > button { height: 44px; }
    .tuob-rubros { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .tuob-rubro { min-height: 136px; padding: 12px; }
    /* La duración lleva más lugar que el precio: "1 h 30 min" tiene que entrar entero. */
    .tuob-serv { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) 44px; gap: 10px 8px; }
    .tuob-serv select.tuob-input { padding-left: 12px; padding-right: 28px; background-position: right 9px center; }
    .tuob-serv > .tuob-campo:first-child { grid-column: 1 / -1; }
    .tuob-dupla, .tuob-fila2, .tuob-opciones, .tuob-opciones[data-n='3'] { grid-template-columns: minmax(0, 1fr); }
    .tuob-form { padding: 18px 16px; border-radius: 18px; }
    .tuob-dias { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .tuob-dia { min-width: 0; height: 46px; }
    .tuob-turno { grid-template-columns: 38px minmax(0, 1fr) auto; }
    .tuob-turno > .tuo-switch { grid-column: 3; grid-row: 1; }
    .tuob-turno-horas, .tuob-turno-off { grid-column: 1 / -1; grid-row: 2; }
    .tuob-turno-horas select.tuob-input { flex: 1; width: auto; height: 48px; }
    .tuob-logo { align-items: flex-start; gap: 14px; }
    .tuob-logo-marco { width: 76px; height: 76px; }
    .tuob-logo-botones .tuo-btn, .tuob-mapa-barra .tuo-btn { height: 44px; }
    .tuob-enlace { min-height: 44px; }
    .tuob-mapa-barra .tuo-btn { flex: 1 1 140px; }
    .tuob-benef li:has(select) { grid-template-columns: 38px minmax(0, 1fr); }
    .tuob-benef li:has(select) select.tuob-input { grid-column: 1 / -1; width: 100%; height: 48px; }
    .tuob-codigo > .tuo-btn { height: 48px; }
    .tuob-resumen > div { flex-direction: column; gap: 2px; }
    .tuob-resumen dd { text-align: left; }
    .tuob-pase { grid-template-columns: minmax(0, 1fr); justify-items: center; text-align: center; }
    .tuob-pase > div:last-child { width: 100%; }
    /* El link entero, sin puntos suspensivos: va arriba y el botón de copiar, abajo. */
    .tuob-link { flex-wrap: wrap; justify-content: center; height: auto; padding: 12px; gap: 10px; }
    .tuob-link code { flex: 1 1 100%; white-space: normal; overflow-wrap: anywhere; text-align: center; font-size: 13.5px; }
    .tuob-link .tuo-btn { flex: 1; height: 44px; }
    .tuob-listo-acciones > * { flex: 1 1 100%; }
    .tuob-planeta { width: 170px; height: 170px; }
    .tuob-planeta::before, .tuob-planeta::after { inset: 46px; }
    /* Botonera: el resumen arriba, los botones abajo a todo el ancho. */
    .tuob-pie { padding-top: 10px; }
    .tuob-pie-in { flex-direction: column; align-items: stretch; gap: 10px; }
    .tuob-pie-resumen > span:first-child { width: 32px; height: 32px; border-radius: 10px; }
    .tuob-pie-botones .tuo-btn { height: 50px; font-size: 15.5px; }
    .tuob-pie-botones .tuo-btn--primario { flex: 1; }
    .tuob-volver span, .tuob-solo-ancho { display: none; }
    .tuob-volver { width: 50px; padding: 0; }
    .tuob-ver-previa { height: 44px; }
    .tuob-quitar { margin-top: 28px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tuob-paso, .tuob-previa-cuerpo, .tuob-serv, .tuob-serv[data-saliendo='true'], .tuob-tilde, .tuob-error, .tuob-planeta::before, .tuob-planeta::after, .tuob-planeta svg, .tuob-previa-hueco svg,
    .tuob .tuob-gira, .tuob-girando, .tuob-pasos li, .tuob-tel-pantalla, .tuob-ms-rollo, .tuob-procesando, .tuob-codigo-ok, .tuob-modulo-lista { animation: none !important; }
    .tuob-planeta::before, .tuob-planeta::after { opacity: 0; }
    /* La reserva de la página simple queda quieta en su primera pantalla: la página con el botón. */
    .tuob-esc, .tuob-dedo, .tuob-esc [data-el]::after, .tuob-esc-pulso, .tuob-esc-tilde, .tuob-esc-puntos i { animation: none !important; }
    .tuob-esc:first-child { opacity: 1; }
    .tuob-esc-puntos { display: none; }
    .tuob-satelite, .tuob-recorrido, .tuob-rubro, .tuob-rubro-icono, .tuob-opcion, .tuob-modulo, .tuob-qr, .tuob-flecha, .tuob-agregar svg, .tuob-punto > i, .tuob-pasos li, .tuob-logo-marco, .tuob-marca-opcion { transition: none !important; }
    .tuob-rubro, .tuob-rubro-icono, .tuob-opcion, .tuob-modulo, .tuob-qr, .tuob-flecha, .tuob-agregar svg, .tuob-logo-marco { transform: none !important; }
  }
  @media (max-width: 640px) { .tuob .tuo-btn--sm { min-height: 44px; } }
`
