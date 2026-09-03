// Hero "cinematográfico" — propuesta de rediseño del home de orbita.site.
//
// Referencia visual acordada con el dueño: t3code-cinematic-dark-saas-landing-page
// (negro total + arco de glow tipo horizonte de planeta + titular gigante bicolor
// + marquee de testimonios abajo). La vuelta de tuerca propia de Órbita es que ese
// "horizonte" no es decorativo: es EL planeta, y encima orbitan los módulos reales
// del producto sobre anillos concéntricos centrados en él — el concepto de "órbita"
// queda literal, que era el pedido explícito ("el primer impacto es muy importante,
// el hero section más que nada").
//
// Se mantiene aparte de Hero.tsx a propósito: es una propuesta, el hero viejo sigue
// intacto para poder comparar los dos.

import { useEffect, useRef, useState, type ReactNode } from 'react';

// ── Satélites: los módulos reales del panel, no features inventadas ───────────
interface SatDef {
    label: string;
    icon: ReactNode;
    ring: 1 | 2 | 3;
    /** Posición inicial en el recorrido, 0..1. */
    fase: number;
    /** Segundos que tarda en recorrer su tramo de arco entero. */
    periodo: number;
    /** De qué lado del planeta orbita: -1 izquierda, 1 derecha. */
    lado: -1 | 1;
}

// Cada satélite recorre SU tramo del arco, siempre en el mismo sentido (como
// orbitarían de verdad). Los tramos esquivan la franja central: ahí está el
// titular, los botones y la línea de garantías, y un satélite cruzando por
// encima del texto queda sucio — probado, se veía mal.
const SATS: SatDef[] = [
    { label: 'Turnos',   ring: 3, fase: 0.05, periodo: 34, lado: -1,
      icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></> },
    { label: 'Ventas',   ring: 3, fase: 0.40, periodo: 34, lado: 1,
      icon: <><path d="M3 3h2l2.4 12.6a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 7H6" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></> },
    { label: 'Pedidos',  ring: 2, fase: 0.62, periodo: 44, lado: -1,
      icon: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></> },
    { label: 'Clientes', ring: 2, fase: 0.18, periodo: 44, lado: 1,
      icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></> },
];

// Radios de los anillos, en % del ancho del "planeta". El planeta es enorme y su
// centro cae MUY por debajo del viewport, así que estos anillos se ven como arcos
// anchos cruzando el hero — que es exactamente el efecto buscado.
const RING_SCALE: Record<number, number> = { 1: 1.30, 2: 1.16, 3: 1.05 };

// Porción del recorrido que se usa para el fade de entrada y de salida, así el
// satélite aparece y desaparece en las puntas en vez de cortarse de golpe.
const FADE = 0.16;

/** Media anchura del texto del hero, en px, que los satélites no deben pisar. */
const COLUMNA_TEXTO = 330;
/** Hasta dónde se van hacia afuera antes de salir de cuadro. */
const X_EXTERIOR = 0.68;

// Campo de estrellas determinístico (nada de Math.random(): rompería la
// hidratación con SSR).
const STARS = Array.from({ length: 110 }, (_, i) => {
    const x = (i * 197 + 440) % 1900;
    const y = (i * 313 + 151) % 900;
    const o = 0.25 + ((i * 37) % 60) / 100;
    return `${x}px ${y}px rgba(255,255,255,${o.toFixed(2)})`;
}).join(', ');

const TESTIMONIOS = [
    { n: 'Malena C.',    r: 'Indumentaria · Córdoba',  t: 'Pasé de anotar los pedidos en un cuaderno a tener la tienda online andando en una tarde.' },
    { n: 'Lucas R.',     r: 'Barbería · Rosario',      t: 'Los turnos se cargan solos y dejé de perder clientes por no contestar el WhatsApp a tiempo.' },
    { n: 'Sofía P.',     r: 'Pastelería · CABA',       t: 'Cobro por Mercado Pago sin comisión de plataforma. Eso solo ya me cambió el mes.' },
    { n: 'Diego R.',     r: 'Ferretería · Mendoza',    t: 'Tengo el stock, la caja y los pedidos en el mismo lugar. Antes eran tres planillas.' },
    { n: 'Valentina M.', r: 'Estética · La Plata',     t: 'Mis clientas reservan solas desde el celular. Yo solo miro la agenda a la mañana.' },
    { n: 'Nico B.',      r: 'Distribuidora · Tucumán', t: 'Armar la tienda con mi dominio propio me llevó menos que elegir el nombre.' },
];

/**
 * Devuelve el tramo VISIBLE de una circunferencia como una polilínea.
 *
 * Importa que sea solo el tramo visible y no el círculo entero: el planeta tiene
 * un radio de ~1.1 × el ancho de la pantalla, así que un <circle> obliga al
 * navegador a manejar una figura de miles de píxeles de lado (con trazos de
 * cientos de px encima) de la que se ve apenas una franja. Con la polilínea, la
 * caja de dibujo es exactamente el hero.
 */
function arco(cx: number, cy: number, r: number, W: number, pasos = 48): string {
    const puntos: string[] = [];
    for (let i = 0; i <= pasos; i++) {
        const x = (W * i) / pasos;
        const dx = x - cx;
        const dentro = r * r - dx * dx;
        const y = cy - Math.sqrt(Math.max(dentro, 0));
        puntos.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return puntos.join(' ');
}

/** Geometría del planeta en píxeles, recalculada cuando cambia el tamaño. */
function geometria(W: number, H: number) {
    // El planeta es enorme y su centro cae MUY por debajo del viewport: de ahí
    // que su borde superior se lea como un horizonte y los anillos como arcos
    // anchos cruzando la pantalla.
    const R = 1.1 * W;
    const cy = (W <= 768 ? 0.86 : 0.72) * H + R;
    return { R, cy, cx: W / 2 };
}

export function HeroCinematic() {
    const [mounted, setMounted] = useState(false);
    const [medidas, setMedidas] = useState({ W: 0, H: 0 });
    const heroRef = useRef<HTMLElement>(null);
    const starsRef = useRef<HTMLDivElement>(null);
    const planetRef = useRef<HTMLDivElement>(null);
    const satsRef = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 60);
        return () => clearTimeout(t);
    }, []);

    // El planeta y los anillos se dibujan en un SVG del tamaño del hero, con el
    // círculo definido en píxeles reales.
    //
    // Antes eran <div> con border-radius: 50% de 220vw (~2800px) y sombras de
    // 400-600px de blur. Se veía bien, pero el navegador no daba abasto: al
    // scrollear dejaba de repintar (franjas negras, el navbar dibujado en el
    // medio del contenido) y el panel de preview ni llegaba a capturar la
    // página. Un SVG rasteriza solo la parte visible y el costo se desploma.
    useEffect(() => {
        const hero = heroRef.current;
        if (!hero) return;
        const medir = () => setMedidas({ W: hero.clientWidth, H: hero.clientHeight });
        medir();
        const ro = new ResizeObserver(medir);
        ro.observe(hero);
        return () => ro.disconnect();
    }, []);

    // ── Órbita real de los satélites ──────────────────────────────────────────
    // Cada satélite recorre el arco de su anillo: se elige la X (avanza sola con
    // el tiempo) y se despeja la Y de la ecuación de la circunferencia, así el
    // recorrido calza exactamente sobre la línea punteada que se ve de fondo.
    //
    // Antes era un ángulo fijo, y se rompía feo: con el radio en vw, la altura a
    // la que caía el satélite dependía de la PROPORCIÓN de la pantalla, así que
    // lo que quedaba bien en 16:9 se le montaba encima al titular en una ventana
    // más alta. Fijando la X y derivando la Y, siempre queda sobre el arco.
    useEffect(() => {
        const hero = heroRef.current;
        if (!hero) return;

        const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let W = hero.clientWidth;
        let H = hero.clientHeight;
        const medir = () => { W = hero.clientWidth; H = hero.clientHeight; };
        const ro = new ResizeObserver(medir);
        ro.observe(hero);

        // El bucle se APAGA cuando el hero sale de pantalla. No es solo ahorro:
        // dejándolo corriendo, el navegador se quedaba sin aire mientras pintaba
        // el resto de la página y dejaba de repintar al scrollear (secciones en
        // negro, capturas que no llegaban a completarse).
        let visible = true;
        let raf = 0;
        const t0 = performance.now();

        const ubicar = (ahora: number) => {
            if (!visible) { raf = 0; return; }
            const { R, cy } = geometria(W, H);
            const seg = (ahora - t0) / 1000;

            // El borde interno del recorrido se calcula en píxeles, no en
            // fracción del ancho: la columna de texto mide lo mismo en una
            // pantalla de 1000 que en una de 1600, así que una fracción fija
            // dejaba al satélite encima del texto en las angostas.
            const interior = Math.min(0.46, Math.max(0.28, COLUMNA_TEXTO / W));

            SATS.forEach((sat, i) => {
                const el = satsRef.current[i];
                if (!el) return;

                const avance = quieto ? 0 : seg / sat.periodo;
                const p = (sat.fase + avance) % 1;
                const fx = sat.lado * (interior + (X_EXTERIOR - interior) * p);

                const dx = fx * W;
                const rRing = RING_SCALE[sat.ring] * R;
                const dy = Math.sqrt(Math.max(rRing * rRing - dx * dx, 0));

                // Fade al entrar y al salir del tramo.
                const opacidad = Math.max(0, Math.min(1, Math.min(p, 1 - p) / FADE));

                el.style.transform = `translate3d(${W / 2 + dx}px, ${cy - dy}px, 0) translate(-50%, -50%)`;
                el.style.opacity = String(opacidad);
            });

            raf = requestAnimationFrame(ubicar);
        };

        const io = new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible && !raf) raf = requestAnimationFrame(ubicar);
        });
        io.observe(hero);

        raf = requestAnimationFrame(ubicar);
        return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
    }, []);

    // Parallax suave al hacer scroll: las estrellas se mueven poco, el planeta un
    // poco más — da profundidad sin marear. Se apaga entero si el sistema pide
    // menos movimiento.
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const state = { target: 0, current: 0 };
        let raf = 0;
        const onScroll = () => {
            state.target = window.scrollY;
            // Solo se anima mientras el hero está a la vista; más abajo no hay
            // nada que mover y el bucle solo le robaba frames al repintado del
            // resto de la página.
            if (!raf && state.target < window.innerHeight * 1.2) raf = requestAnimationFrame(tick);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        const tick = () => {
            state.current += (state.target - state.current) * 0.08;
            const y = state.current;
            if (starsRef.current) starsRef.current.style.transform = `translate3d(0, ${y * 0.05}px, 0)`;
            // Solo en Y: el contenedor del planeta ocupa todo el hero (inset-0),
            // no está centrado con left:50% como la versión vieja — meterle un
            // -50% en X lo corría media pantalla y el SVG quedaba cortado al medio.
            if (planetRef.current) planetRef.current.style.transform = `translate3d(0, ${y * 0.14}px, 0)`;

            // Se detiene cuando ya alcanzó la posición y no hay scroll nuevo.
            const quieto = Math.abs(state.target - state.current) < 0.4;
            const fuera = state.target > window.innerHeight * 1.2;
            raf = (quieto || fuera) ? 0 : requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
    }, []);

    const aparece = (delayMs: number) => ({
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 900ms cubic-bezier(.16,1,.3,1), transform 900ms cubic-bezier(.16,1,.3,1)',
        transitionDelay: `${delayMs}ms`,
    });

    return (
        <section
            ref={heroRef}
            className="oc-hero relative w-full overflow-hidden"
            style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}
        >
            <style>{`
                @keyframes ocTwinkle  { 0%,100% { opacity: .55; } 50% { opacity: .95; } }
                @keyframes ocMarquee  { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }

                .oc-marquee       { animation: ocMarquee 44s linear infinite; }
                .oc-marquee:hover { animation-play-state: paused; }

                .oc-cta:focus-visible,
                .oc-ghost:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }

                /* En pantallas chicas los satélites no entran sin taparle el
                   titular: queda solo el horizonte, que es lo que de verdad
                   sostiene el impacto visual. */
                @media (max-width: 1023px) { .oc-sat-wrap { display: none !important; } }

                @media (prefers-reduced-motion: reduce) {
                    .oc-marquee, .oc-stars { animation: none !important; }
                }
            `}</style>

            {/* ── Fondo: estrellas ─────────────────────────────────────────── */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div
                    ref={starsRef}
                    className="oc-stars absolute"
                    style={{ inset: '-120px', boxShadow: STARS, width: 1, height: 1, animation: 'ocTwinkle 7s ease-in-out infinite' }}
                />
            </div>

            {/* ── Fondo: neblina atmosférica sobre el horizonte ─────────────── */}
            <div
                className="absolute pointer-events-none z-0"
                style={{
                    left: '50%', bottom: '-10%', width: 'min(1600px, 150vw)', height: 'min(900px, 90vh)',
                    transform: 'translateX(-50%)',
                    background: 'radial-gradient(ellipse at 50% 100%, rgba(147,197,253,.44) 0%, rgba(99,102,241,.30) 22%, rgba(59,130,246,.13) 45%, rgba(0,0,0,0) 72%)',
                    filter: 'blur(24px)',
                }}
            />

            {/* ── El planeta: su borde superior ES el horizonte que ilumina ──── */}
            <div ref={planetRef} className="absolute inset-0 z-[1] pointer-events-none" style={{ willChange: 'transform' }}>
                {medidas.W > 0 && (() => {
                    const { R, cy, cx } = geometria(medidas.W, medidas.H);
                    const horizonte = arco(cx, cy, R, medidas.W);
                    return (
                        <svg width="100%" height="100%" viewBox={`0 0 ${medidas.W} ${medidas.H}`} aria-hidden="true">
                            {/* Anillos, de afuera hacia adentro */}
                            {([1, 2, 3] as const).map(ring => (
                                <path
                                    key={ring}
                                    d={arco(cx, cy, RING_SCALE[ring] * R, medidas.W)}
                                    fill="none"
                                    stroke={`rgba(191,219,254,${ring === 1 ? 0.16 : 0.3})`}
                                    strokeWidth={1}
                                    strokeDasharray={ring === 2 ? '5 8' : undefined}
                                />
                            ))}

                            {/* Resplandor del horizonte: varios trazos anchos y
                                translúcidos, de más ancho a más fino. Se usa esto
                                en vez de un blur porque un filtro sobre una figura
                                de este tamaño es carísimo de rasterizar. */}
                            <path d={horizonte} fill="none" stroke="rgba(59,130,246,.10)" strokeWidth={420} />
                            <path d={horizonte} fill="none" stroke="rgba(79,70,229,.15)" strokeWidth={220} />
                            <path d={horizonte} fill="none" stroke="rgba(99,102,241,.22)" strokeWidth={110} />
                            <path d={horizonte} fill="none" stroke="rgba(129,140,248,.32)" strokeWidth={48} />
                            <path d={horizonte} fill="none" stroke="rgba(147,197,253,.52)" strokeWidth={18} />
                            <path d={horizonte} fill="none" stroke="rgba(219,234,254,.85)" strokeWidth={6} />

                            {/* Cuerpo del planeta: el mismo arco cerrado contra el
                                borde de abajo. Va DESPUÉS del resplandor para tapar
                                la mitad que cae del lado de adentro — el planeta
                                tiene que quedar negro, la luz solo se ve por encima
                                del horizonte. */}
                            <path d={`${horizonte} L${medidas.W} ${medidas.H} L0 ${medidas.H} Z`} fill="#000" />

                            {/* La "línea del amanecer", nítida, al final de todo. */}
                            <path d={horizonte} fill="none" stroke="rgba(240,248,255,.95)" strokeWidth={1.6} />
                        </svg>
                    );
                })()}
            </div>

            {/* ── Satélites: van sobre el hero (no dentro del planeta) porque su
                 posición se calcula en píxeles contra la curva de cada anillo ── */}
            {SATS.map((sat, i) => (
                <div
                    key={sat.label}
                    ref={el => { satsRef.current[i] = el; }}
                    className="oc-sat-wrap absolute left-0 top-0 z-[2] pointer-events-none"
                    style={{ opacity: 0, willChange: 'transform' }}
                >
                    <Satelite sat={sat} />
                </div>
            ))}

            {/* ── Contenido ─────────────────────────────────────────────────── */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-10 text-center">
                <span
                    className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100/80"
                    style={{ ...aparece(120), border: '1px solid rgba(147,197,253,.22)', background: 'rgba(59,130,246,.08)' }}
                >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: '#4ade80', boxShadow: '0 0 10px #4ade80' }} />
                    Turnos, ventas y clientes en un solo lugar
                </span>

                <h1
                    className="font-black tracking-[-0.045em] mt-7"
                    style={{ ...aparece(240), fontSize: 'clamp(44px, 9.5vw, 132px)', lineHeight: 0.92 }}
                >
                    <span className="text-white">Tu negocio,</span>{' '}
                    <span style={{ color: '#7c869b' }}>en órbita.</span>
                </h1>

                <p
                    className="mt-6 max-w-[560px] text-[15px] sm:text-lg leading-relaxed"
                    style={{ ...aparece(360), color: 'rgba(203,213,225,.78)' }}
                >
                    Tienda online, turnos, pedidos y métricas reales — todo funcionando el mismo día,
                    sin comisiones por venta y con tu propio dominio.
                </p>

                <div className="mt-9 flex flex-wrap items-center justify-center gap-3" style={aparece(480)}>
                    <a
                        href="/onboarding/rubro"
                        className="oc-cta inline-flex items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-bold text-slate-900 transition-colors duration-200 hover:bg-blue-50 cursor-pointer"
                        style={{ minHeight: 48, boxShadow: '0 10px 40px rgba(147,197,253,.22)' }}
                    >
                        Crear mi tienda gratis
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </a>
                    <a
                        href="#como-funciona"
                        className="oc-ghost inline-flex items-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-white/90 transition-colors duration-200 hover:bg-white/10 cursor-pointer"
                        style={{ minHeight: 48, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.04)' }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Ver cómo funciona
                    </a>
                </div>

                <div
                    className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] font-medium"
                    style={{ ...aparece(600), color: 'rgba(148,163,184,.85)' }}
                >
                    {['Gratis para empezar', 'Sin comisiones por venta', 'Listo en una tarde'].map(t => (
                        <span key={t} className="inline-flex items-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {t}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── Marquee de testimonios pegado al borde inferior ───────────── */}
            <div className="relative z-10 pb-8" style={aparece(760)}>
                <p className="mb-4 text-center text-[10.5px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    Negocios que ya están en órbita
                </p>
                <div
                    className="relative overflow-hidden"
                    style={{ maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}
                >
                    <div className="oc-marquee flex w-max gap-3">
                        {[...TESTIMONIOS, ...TESTIMONIOS].map((t, i) => (
                            <figure
                                key={`${t.n}-${i}`}
                                className="w-[300px] shrink-0 rounded-xl p-4 text-left"
                                // Fondo casi opaco a propósito: en celular el arco del
                                // planeta pasa justo por detrás de esta fila, y con
                                // tarjetas translúcidas el texto quedaba ilegible sobre
                                // el resplandor.
                                style={{ border: '1px solid rgba(255,255,255,.09)', background: 'rgba(2,6,23,.82)' }}
                            >
                                <figcaption className="mb-2 flex items-center gap-2.5">
                                    <span
                                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                                        style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}
                                        aria-hidden="true"
                                    >
                                        {t.n.slice(0, 1)}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-[12.5px] font-bold text-white">{t.n}</span>
                                        <span className="block truncate text-[11px] text-slate-400">{t.r}</span>
                                    </span>
                                </figcaption>
                                <blockquote className="text-[12.5px] leading-relaxed text-slate-300/85">{t.t}</blockquote>
                            </figure>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

function Satelite({ sat }: { sat: SatDef }) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-1"
            style={{
                width: 78, height: 78, borderRadius: 20,
                background: 'rgba(2,6,23,.72)',
                border: '1px solid rgba(147,197,253,.22)',
                
                boxShadow: '0 18px 45px rgba(0,0,0,.75), 0 0 28px rgba(59,130,246,.22)',
            }}
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                style={{ width: 24, height: 24, filter: 'drop-shadow(0 0 8px rgba(59,130,246,.85))' }} aria-hidden="true">
                {sat.icon}
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-200">{sat.label}</span>
        </div>
    );
}
