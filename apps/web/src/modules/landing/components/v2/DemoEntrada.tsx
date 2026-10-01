// Entrada a la demo pública (orbita.site/demo): el botón "Probá la demo" del
// hero trae acá, a una vista propia a pantalla completa, en vez de bajar a la
// sección #demo del home (que sigue existiendo, pedido 29/09).
//
// El visitante elige desde dónde mirar Órbita —como cliente (la tienda Nébula
// Tech) o como dueño (el panel)— y el fondo le muestra esa perspectiva,
// borrosa: capturas reales de la demo en public/demo/ (tienda-desk.webp,
// panel-desk.webp y sus versiones de celular). Para regenerarlas: Chrome
// headless contra demo.orbita.site a 1440×900 y 390×844, pasadas a webp.
//
// Al ingresar, en vez de saltar directo, hay una pantalla de carga: el fondo
// se va enfocando (se "entra" a la perspectiva) mientras un anillo de
// progreso avanza con los pasos de lo que se está abriendo. Con movimiento
// reducido no hay animaciones: el cartel aparece y se navega enseguida.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo';
import { ROOT_DOMAIN, tenantUrl } from '@/lib/tenant';
import { DEMO_SLUG } from '@/lib/demo/modo';

type Rol = 'tienda' | 'panel';

const ROLES: Record<Rol, {
    rol: string;
    titulo: string;
    texto: string;
    cta: string;
    path: string;
    fondo: { desk: string; movil: string };
    pasos: string[];
}> = {
    tienda: {
        rol: 'Como cliente',
        titulo: 'La tienda',
        texto: 'Recorré Nébula Tech: catálogo, fichas con video, descuentos, carrito y checkout con pago simulado.',
        cta: 'Ingresar como cliente',
        path: '/',
        fondo: { desk: '/demo/tienda-desk.webp', movil: '/demo/tienda-movil.webp' },
        pasos: ['Cargando el catálogo de Nébula Tech', 'Preparando tu carrito', 'Abriendo la tienda'],
    },
    panel: {
        rol: 'Como dueño',
        titulo: 'El panel',
        texto: 'Pedidos, productos, clientes, descuentos y reportes, con tres meses de ventas cargadas.',
        cta: 'Ingresar como dueño',
        path: '/panel',
        fondo: { desk: '/demo/panel-desk.webp', movil: '/demo/panel-movil.webp' },
        pasos: ['Cargando tres meses de ventas', 'Armando los reportes', 'Abriendo el panel'],
    },
};
const ORDEN: Rol[] = ['tienda', 'panel'];

// Lo que dura la carga antes de navegar. Suficiente para que se lea y se
// sienta la transición, sin que parezca que la demo tarda.
const DURACION_CARGA = 2400;

// En el server no hay window para saber protocolo y puerto: arranca con la
// URL de producción y se corrige al montar (dev: http y :3001). Mismo
// criterio que Demo.tsx.
const urlInicial = (path: string) => `https://${DEMO_SLUG}.${ROOT_DOMAIN}${path}`;

function prefiereMenosMovimiento() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function DemoEntrada({ rolInicial }: { rolInicial?: Rol | null }) {
    const [elegido, setElegido] = useState<Rol | null>(rolInicial ?? null);
    const [hover, setHover] = useState<Rol | null>(null);
    // Sin nada elegido ni el mouse encima, el fondo alterna solo entre las
    // dos perspectivas: anticipa qué hay detrás de cada tarjeta.
    const [alterna, setAlterna] = useState<Rol>('tienda');
    const [cargando, setCargando] = useState(false);
    const [progreso, setProgreso] = useState(0);
    const [urls, setUrls] = useState<Record<Rol, string>>({ tienda: urlInicial('/'), panel: urlInicial('/panel') });
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        setUrls({ tienda: tenantUrl(DEMO_SLUG, '/'), panel: tenantUrl(DEMO_SLUG, '/panel') });
    }, []);

    useEffect(() => {
        if (elegido || hover || cargando || prefiereMenosMovimiento()) return;
        const id = window.setInterval(() => setAlterna(a => (a === 'tienda' ? 'panel' : 'tienda')), 3600);
        return () => window.clearInterval(id);
    }, [elegido, hover, cargando]);

    // Volver con el botón "atrás" del navegador restaura la página desde el
    // bfcache tal como quedó: con la pantalla de carga puesta. Se resetea.
    useEffect(() => {
        const alVolver = (e: PageTransitionEvent) => {
            if (!e.persisted) return;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            setCargando(false);
            setProgreso(0);
        };
        window.addEventListener('pageshow', alVolver);
        return () => window.removeEventListener('pageshow', alVolver);
    }, []);

    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    const visible: Rol = cargando && elegido ? elegido : hover ?? elegido ?? alterna;
    const enfocado = !!(hover || elegido);

    const ingresar = useCallback(() => {
        if (!elegido || cargando) return;
        const destino = urls[elegido];
        setCargando(true);
        if (prefiereMenosMovimiento()) {
            setProgreso(1);
            window.setTimeout(() => { window.location.href = destino; }, 350);
            return;
        }
        const inicio = performance.now();
        const paso = (ahora: number) => {
            const t = Math.min(1, (ahora - inicio) / DURACION_CARGA);
            // Arranca rápido y frena al final: se siente más a "cargando" que
            // una barra lineal.
            setProgreso(1 - Math.pow(1 - t, 2.2));
            if (t < 1) rafRef.current = requestAnimationFrame(paso);
            else window.location.href = destino;
        };
        rafRef.current = requestAnimationFrame(paso);
    }, [elegido, cargando, urls]);

    // Flechas para moverse entre las dos opciones, como cualquier grupo de
    // radios nativo.
    const alTeclado = (e: KeyboardEvent<HTMLDivElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const actual = ORDEN.indexOf(elegido ?? 'panel');
        const siguiente = ORDEN[(actual + 1) % ORDEN.length];
        setElegido(siguiente);
        document.getElementById(`de-op-${siguiente}`)?.focus();
    };

    const pasos = elegido ? ROLES[elegido].pasos : [];
    const pasoActual = Math.min(pasos.length - 1, Math.floor(progreso * pasos.length));

    return (
        <div className={`de-raiz${cargando ? ' de-cargando' : ''}`}>
            <style>{CSS}</style>

            {/* ── Fondo: las dos perspectivas, borrosas, superpuestas ── */}
            <div className="de-fondo" aria-hidden="true">
                {ORDEN.map(r => (
                    <picture
                        key={r}
                        className="de-capa"
                        data-activa={visible === r ? '' : undefined}
                        data-enfocada={visible === r && enfocado ? '' : undefined}
                    >
                        <source media="(max-width: 640px)" srcSet={ROLES[r].fondo.movil} />
                        <img src={ROLES[r].fondo.desk} alt="" decoding="async" />
                    </picture>
                ))}
                <div className="de-velo" />
            </div>

            {/* ── Barra de arriba ── */}
            <header className="de-top">
                <a href="/" className="de-marca" aria-label="Órbita — Volver al inicio">
                    <OrbitaLogo size={24} />
                    <span>Órbita</span>
                </a>
                <a href="/" className="de-volver">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Volver
                </a>
            </header>

            {/* ── Elección ── */}
            <main className="de-main" aria-hidden={cargando || undefined}>
                <p className="de-eyebrow de-in" style={{ ['--d' as string]: '60ms' }}>
                    Demo en vivo · sin cuenta y sin tarjeta
                </p>
                <h1 className="de-titulo de-in" style={{ ['--d' as string]: '140ms' }}>
                    ¿Desde dónde querés<br className="de-br" /> <span>ver Órbita?</span>
                </h1>
                <p className="de-bajada de-in" style={{ ['--d' as string]: '220ms' }}>
                    Una tienda de verdad, con pedidos, clientes y reportes. Elegí tu perspectiva.
                </p>

                <div className="de-opciones" role="radiogroup" aria-label="Perspectiva de la demo" onKeyDown={alTeclado}>
                    {ORDEN.map((r, i) => {
                        const d = ROLES[r];
                        const sel = elegido === r;
                        return (
                            <button
                                key={r}
                                id={`de-op-${r}`}
                                type="button"
                                role="radio"
                                aria-checked={sel}
                                tabIndex={sel || (!elegido && i === 0) ? 0 : -1}
                                className="de-op de-in"
                                style={{ ['--d' as string]: `${300 + i * 90}ms` }}
                                onClick={() => setElegido(r)}
                                onMouseEnter={() => setHover(r)}
                                onMouseLeave={() => setHover(null)}
                                onMouseMove={e => {
                                    // Posición del cursor para el brillo que lo
                                    // sigue (.de-op::before/::after).
                                    const b = e.currentTarget.getBoundingClientRect();
                                    e.currentTarget.style.setProperty('--mx', `${e.clientX - b.left}px`);
                                    e.currentTarget.style.setProperty('--my', `${e.clientY - b.top}px`);
                                }}
                            >
                                <span className="de-mini" aria-hidden="true">
                                    <img src={d.fondo.desk} alt="" loading="lazy" decoding="async" />
                                </span>
                                <span className="de-op-texto">
                                    <span className="de-op-cabeza">
                                        <span className="de-op-rol">{d.rol}</span>
                                        <span className="de-radio" aria-hidden="true">
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                                        </span>
                                    </span>
                                    <span className="de-op-titulo">{d.titulo}</span>
                                    <span className="de-op-desc">{d.texto}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="de-accion de-in" style={{ ['--d' as string]: '520ms' }}>
                    <button type="button" className="de-cta" onClick={ingresar} disabled={!elegido}>
                        {elegido ? ROLES[elegido].cta : 'Elegí una perspectiva'}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </button>
                    <p className="de-nota">Lo que cambies queda solo en tu navegador: no se toca nada real.</p>
                </div>
            </main>

            {/* ── Pantalla de carga ── */}
            {elegido && (
                <div className="de-carga" role="status" aria-live="polite" aria-hidden={!cargando}>
                    <div className="de-orbita" aria-hidden="true">
                        <svg viewBox="0 0 120 120" className="de-anillos">
                            <circle cx="60" cy="60" r="52" className="de-pista" />
                            <circle
                                cx="60" cy="60" r="52" className="de-avance"
                                style={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - progreso) }}
                            />
                            <circle cx="60" cy="60" r="36" className="de-orbita-linea" />
                        </svg>
                        <span className="de-planeta" />
                        <span className="de-satelite-eje"><span className="de-satelite" /></span>
                    </div>
                    <p className="de-carga-titulo">Ingresando a la demo</p>
                    <p className="de-carga-paso" key={pasoActual}>{pasos[pasoActual]}…</p>
                    <p className="de-carga-pct">{Math.round(progreso * 100)}%</p>
                </div>
            )}
        </div>
    );
}

const CSS = `
.de-raiz {
    position: relative; min-height: 100vh; min-height: 100svh;
    display: flex; flex-direction: column;
    background: #000; color: #fff; overflow-x: hidden;
    font-family: Geist, system-ui, sans-serif;
}

/* Fondo */
.de-fondo { position: fixed; inset: 0; overflow: hidden; }
.de-capa { position: absolute; inset: 0; opacity: 0; transition: opacity 900ms ease; }
.de-capa img {
    width: 100%; height: 100%; object-fit: cover; object-position: top center;
    filter: blur(18px) saturate(1.2) brightness(.8);
    transform: scale(1.1);
    transition: filter 1100ms cubic-bezier(.2,.7,.2,1), transform 1400ms cubic-bezier(.2,.7,.2,1);
}
.de-capa[data-activa] { opacity: .55; }
.de-capa[data-enfocada] { opacity: 1; }
.de-capa[data-enfocada] img { filter: blur(9px) saturate(1.2) brightness(.78); transform: scale(1.05); }
.de-velo {
    position: absolute; inset: 0;
    background:
        radial-gradient(ellipse 75% 65% at 50% 48%, rgba(2,6,23,.62) 0%, rgba(2,6,23,.5) 55%, rgba(0,0,0,.82) 100%),
        linear-gradient(180deg, rgba(2,6,23,.45) 0%, rgba(2,6,23,0) 30%, rgba(2,6,23,.55) 100%);
    transition: opacity 1200ms ease;
}

/* Barra de arriba */
.de-top {
    position: relative; z-index: 2;
    display: flex; align-items: center; justify-content: space-between;
    max-width: 1120px; width: 100%; margin: 0 auto; padding: 20px 24px;
    transition: opacity 500ms ease;
}
.de-marca { display: inline-flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; font-weight: 900; font-size: 17px; letter-spacing: -.02em; }
.de-volver {
    display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 14px;
    border-radius: 10px; border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.04);
    color: rgba(255,255,255,.85); font-size: 13.5px; font-weight: 600; text-decoration: none;
    backdrop-filter: blur(10px); transition: background 200ms ease, color 200ms ease;
}
.de-volver:hover { background: rgba(255,255,255,.1); color: #fff; }

/* Contenido */
.de-main {
    position: relative; z-index: 2; flex: 1;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    width: 100%; max-width: 960px; margin: 0 auto; padding: 24px 24px 56px; text-align: center;
    transition: opacity 600ms ease, transform 700ms cubic-bezier(.2,.7,.2,1), filter 600ms ease;
}
/* Entrada escalonada con animación CSS, no con un estado "montado" puesto
   desde requestAnimationFrame: en una pestaña en segundo plano ese rAF no
   corre y el contenido quedaba invisible. */
.de-in { animation: de-entra 800ms cubic-bezier(.2,.7,.2,1) var(--d, 0ms) both; transition: border-color 250ms ease, background 250ms ease, box-shadow 300ms ease; }
@keyframes de-entra { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

.de-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(203,213,225,.85); margin: 0; }

.de-titulo { margin: 18px 0 0; font-weight: 900; letter-spacing: -.04em; line-height: .98; font-size: clamp(38px, 6.4vw, 76px); }
.de-titulo span { color: #3b82f6; }
.de-bajada { margin: 18px 0 0; max-width: 520px; font-size: 16px; line-height: 1.6; color: rgba(203,213,225,.82); }

.de-opciones { margin-top: 40px; width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; text-align: left; }
.de-op {
    position: relative; display: flex; flex-direction: column; gap: 0; padding: 0; overflow: hidden;
    border-radius: 18px; border: 1px solid rgba(255,255,255,.1);
    background: rgba(2,6,23,.55); backdrop-filter: blur(18px) saturate(1.2); -webkit-backdrop-filter: blur(18px) saturate(1.2);
    color: #fff; cursor: pointer; text-align: left; font: inherit;
    --mx: 50%; --my: 0px;
    /* translate y no transform: transform lo fija la animación de entrada
       (.de-in, fill both) y le ganaría al hover. */
    translate: 0 0;
    transition: translate 420ms cubic-bezier(.2,.7,.2,1), border-color 250ms ease, background 250ms ease, box-shadow 350ms ease;
}
/* Brillo que sigue al cursor: una luz suave adentro (::before) y el borde
   encendido cerca del puntero (::after, recortado a 1px con máscara). */
.de-op::before, .de-op::after {
    content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    opacity: 0; transition: opacity 350ms ease; z-index: 1;
}
.de-op::before { background: radial-gradient(420px circle at var(--mx) var(--my), rgba(147,197,253,.10), transparent 55%); }
.de-op::after {
    padding: 1px;
    background: radial-gradient(240px circle at var(--mx) var(--my), rgba(191,219,254,.9), rgba(147,197,253,.15) 55%, transparent 75%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
    mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
}
@media (hover: hover) {
    .de-op:hover { translate: 0 -4px; border-color: rgba(147,197,253,.22); background: rgba(15,23,42,.66); box-shadow: 0 30px 70px -28px rgba(0,0,0,.9), 0 18px 50px -24px rgba(59,130,246,.45); }
    .de-op:hover::before, .de-op:hover::after { opacity: 1; }
}
.de-op[aria-checked="true"] {
    border-color: #93c5fd; background: rgba(30,58,138,.32);
    box-shadow: 0 0 0 1px #93c5fd, 0 24px 60px -18px rgba(59,130,246,.55);
}
.de-op:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
.de-mini { position: relative; display: block; height: 150px; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,.08); background: #0b1224; }
.de-mini::after { content: ''; position: absolute; inset: auto 0 0 0; height: 40px; background: linear-gradient(180deg, transparent, rgba(2,6,23,.45)); pointer-events: none; }
.de-mini img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top left; opacity: .9; transition: transform 2600ms cubic-bezier(.45,.05,.3,1), opacity 300ms ease; }
.de-op:hover .de-mini img, .de-op[aria-checked="true"] .de-mini img { opacity: 1; }
/* En escritorio la miniatura va con su alto natural y al pasar el mouse se
   desplaza hasta abajo, como si se recorriera la pantalla. */
@media (min-width: 641px) and (hover: hover) {
    .de-mini img { height: auto; object-fit: initial; }
    .de-op:hover .de-mini img { transform: translateY(calc(-100% + 150px)); }
}
.de-op-texto { position: relative; z-index: 2; display: flex; flex-direction: column; padding: 18px 20px 22px; }
.de-op-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.de-op-rol { font-size: 12.5px; font-weight: 600; color: #93c5fd; }
.de-op-titulo { margin-top: 4px; font-size: 22px; font-weight: 900; letter-spacing: -.02em; }
.de-op-desc { margin-top: 6px; font-size: 14px; line-height: 1.55; color: rgba(203,213,225,.78); }
.de-radio {
    flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
    display: grid; place-items: center; color: transparent;
    border: 1.5px solid rgba(255,255,255,.3); background: transparent;
    transition: background 220ms ease, border-color 220ms ease, color 220ms ease, transform 300ms cubic-bezier(.3,1.6,.5,1);
}
.de-op:hover .de-radio { border-color: rgba(191,219,254,.7); }
.de-op[aria-checked="true"] .de-radio { background: #3b82f6; border-color: #3b82f6; color: #fff; transform: scale(1.1); }

.de-accion { margin-top: 28px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.de-cta {
    display: inline-flex; align-items: center; justify-content: center; gap: 9px;
    min-height: 52px; min-width: 260px; padding: 0 28px; border-radius: 14px; border: 0;
    background: #fff; color: #0f172a; font: inherit; font-size: 15.5px; font-weight: 700; cursor: pointer;
    box-shadow: 0 10px 40px rgba(147,197,253,.25);
    transition: background 200ms ease, opacity 250ms ease, transform 200ms ease, box-shadow 250ms ease;
}
.de-cta:hover:not(:disabled) { background: #eff6ff; box-shadow: 0 14px 48px rgba(147,197,253,.38); }
.de-cta:active:not(:disabled) { transform: scale(.98); }
.de-cta:disabled { cursor: default; opacity: .45; box-shadow: none; }
.de-cta:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
.de-nota { margin: 0; font-size: 12.5px; color: #94a3b8; }

/* Cargando: el contenido se va, el fondo se enfoca */
.de-cargando .de-main { opacity: 0; transform: scale(.97); filter: blur(6px); pointer-events: none; }
.de-cargando .de-top { opacity: 0; pointer-events: none; }
.de-cargando .de-capa[data-activa] { opacity: 1; }
.de-cargando .de-capa[data-activa] img { filter: blur(2px) saturate(1.1) brightness(.7); transform: scale(1.01); transition-duration: 2400ms; }
.de-cargando .de-velo { opacity: .75; }

.de-carga {
    position: fixed; inset: 0; z-index: 3;
    display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
    opacity: 0; visibility: hidden; transition: opacity 500ms ease 250ms, visibility 0s linear 750ms;
}
.de-cargando .de-carga { opacity: 1; visibility: visible; transition: opacity 500ms ease 250ms, visibility 0s; }
.de-orbita { position: relative; width: 132px; height: 132px; }
.de-anillos { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.de-pista { fill: none; stroke: rgba(255,255,255,.12); stroke-width: 2; }
.de-avance { fill: none; stroke: #93c5fd; stroke-width: 2.5; stroke-linecap: round; stroke-dasharray: ${(2 * Math.PI * 52).toFixed(2)}; filter: drop-shadow(0 0 6px rgba(147,197,253,.7)); }
.de-orbita-linea { fill: none; stroke: rgba(147,197,253,.3); stroke-width: 1; stroke-dasharray: 2 4; }
.de-planeta {
    position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #bfdbfe, #3b82f6 55%, #1e3a8a);
    box-shadow: 0 0 30px rgba(59,130,246,.75), 0 0 70px rgba(59,130,246,.35);
    animation: de-respira 2.4s ease-in-out infinite;
}
.de-satelite-eje { position: absolute; inset: 24px; animation: de-gira 1.6s linear infinite; }
.de-satelite { position: absolute; top: -4px; left: 50%; width: 9px; height: 9px; margin-left: -4.5px; border-radius: 50%; background: #fff; box-shadow: 0 0 12px #fff, 0 0 22px rgba(147,197,253,.9); }
@keyframes de-gira { to { transform: rotate(360deg); } }
@keyframes de-respira { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.de-carga-titulo { margin: 30px 0 0; font-size: clamp(24px, 3.4vw, 34px); font-weight: 900; letter-spacing: -.03em; }
.de-carga-paso { margin: 8px 0 0; font-size: 15px; color: rgba(203,213,225,.85); animation: de-paso 450ms ease both; }
@keyframes de-paso { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.de-carga-pct { margin: 14px 0 0; font-family: "Geist Mono", ui-monospace, monospace; font-size: 13px; color: #93c5fd; font-variant-numeric: tabular-nums; }

/* Celular: tarjetas apiladas y horizontales (miniatura a la izquierda) */
@media (max-width: 640px) {
    .de-top { padding: 16px; }
    .de-main { padding: 12px 16px 36px; justify-content: flex-start; }
    .de-br { display: none; }
    .de-titulo { margin-top: 20px; }
    .de-bajada { font-size: 15px; }
    .de-opciones { grid-template-columns: minmax(0, 1fr); gap: 12px; margin-top: 28px; }
    .de-op { flex-direction: row; align-items: stretch; }
    .de-mini { width: 96px; height: auto; min-height: 128px; flex-shrink: 0; border-bottom: 0; border-right: 1px solid rgba(255,255,255,.08); }
    .de-op-texto { flex: 1; min-width: 0; padding: 14px 14px 16px; }
    .de-op-titulo { font-size: 19px; }
    .de-op-desc { font-size: 13px; }
    .de-accion { width: 100%; }
    .de-cta { width: 100%; min-width: 0; }
}

@media (prefers-reduced-motion: reduce) {
    .de-in, .de-op, .de-capa, .de-capa img, .de-main, .de-mini img, .de-carga { transition: none !important; }
    .de-op:hover { translate: none; }
    .de-op:hover .de-mini img { transform: none; }
    .de-in,
    .de-planeta, .de-satelite-eje, .de-carga-paso { animation: none; }
}
`;
