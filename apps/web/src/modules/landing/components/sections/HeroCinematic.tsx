// Hero "cinematográfico" — propuesta de rediseño del home de orbita.site.
//
// Referencia visual acordada con el dueño: t3code-cinematic-dark-saas-landing-page
// (negro total + arco de glow tipo horizonte de planeta + titular gigante bicolor
// + marquee de testimonios abajo). La vuelta de tuerca propia de Órbita es que ese
// "horizonte" no es decorativo: es EL planeta, y encima orbitan los módulos reales
// del producto (Turnos, Ventas, Pedidos, Clientes, Stats) sobre anillos concéntricos
// centrados en él — el concepto de "órbita" queda literal, que era el pedido
// explícito ("el primer impacto es muy importante, el hero section más que nada").
//
// Se mantiene aparte de Hero.tsx a propósito: es una propuesta, el hero viejo sigue
// intacto para poder comparar los dos.

import { useEffect, useRef, useState, type ReactNode } from 'react';

// ── Satélites: los módulos reales del panel, no features inventadas ───────────
interface SatDef {
    label: string;
    icon: ReactNode;
    ring: 1 | 2 | 3;
    /**
     * Posición horizontal, como fracción del ancho del hero desde el centro
     * (-0.5 = borde izquierdo, +0.5 = borde derecho). La posición VERTICAL no se
     * elige: se calcula para que el satélite caiga exactamente sobre la curva de
     * su anillo (ver posicionarSatelites).
     *
     * Antes esto era un ángulo fijo sobre el anillo, y se rompía feo: con el radio
     * en vw, la altura a la que aterrizaba el satélite dependía de la PROPORCIÓN
     * de la pantalla, así que lo que quedaba bien en 16:9 se le montaba encima al
     * titular en una ventana más alta. Fijando la X y derivando la Y de la
     * circunferencia, el satélite siempre queda sobre el arco y en su columna.
     */
    x: number;
    delay: string;
}

const SATS: SatDef[] = [
    { label: 'Turnos',   ring: 3, x: -0.30, delay: '0s',
      icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></> },
    { label: 'Ventas',   ring: 3, x: 0.30, delay: '-3s',
      icon: <><path d="M3 3h2l2.4 12.6a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 7H6" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></> },
    { label: 'Pedidos',  ring: 2, x: -0.41, delay: '-1.5s',
      icon: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></> },
    { label: 'Clientes', ring: 2, x: 0.41, delay: '-4.5s',
      icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></> },
];

// Radios de los anillos, en % del ancho del "planeta". El planeta es enorme y su
// centro cae MUY por debajo del viewport, así que estos anillos se ven como arcos
// anchos cruzando el hero — que es exactamente el efecto buscado.
const RING_SCALE: Record<number, number> = { 1: 1.30, 2: 1.16, 3: 1.05 };

// Campo de estrellas determinístico (mismo criterio que el Hero viejo: nada de
// Math.random(), rompería la hidratación con SSR).
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

/** Posición en píxeles de cada satélite, calculada sobre la curva de su anillo. */
type PosSat = { left: number; top: number };

export function HeroCinematic() {
    const [mounted, setMounted] = useState(false);
    const [posiciones, setPosiciones] = useState<PosSat[] | null>(null);
    const heroRef = useRef<HTMLElement>(null);
    const starsRef = useRef<HTMLDivElement>(null);
    const planetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 60);
        return () => clearTimeout(t);
    }, []);

    // Cada satélite se apoya sobre la circunferencia real de su anillo:
    // elegimos la X (una fracción del ancho) y despejamos la Y de la ecuación del
    // círculo. Así siguen la curva sin importar la proporción de la ventana.
    useEffect(() => {
        const el = heroRef.current;
        if (!el) return;

        const recalcular = () => {
            const W = el.clientWidth;
            const H = el.clientHeight;
            // Mismos números que el CSS del planeta: 220vw de ancho (radio =
            // 1.1 × ancho) y borde superior al 72% del alto (86% en celular).
            const R = 1.1 * W;
            const topPlaneta = (W <= 768 ? 0.86 : 0.72) * H;
            const cy = topPlaneta + R;

            setPosiciones(SATS.map(s => {
                const dx = s.x * W;
                const rRing = RING_SCALE[s.ring] * R;
                const dy = Math.sqrt(Math.max(rRing * rRing - dx * dx, 0));
                return { left: W / 2 + dx, top: cy - dy };
            }));
        };

        recalcular();
        const ro = new ResizeObserver(recalcular);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Parallax suave al hacer scroll: las estrellas se mueven poco, el planeta un
    // poco más — da profundidad sin marear. Se apaga entero si el sistema pide
    // menos movimiento (prefers-reduced-motion).
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const state = { target: 0, current: 0 };
        let raf = 0;
        const onScroll = () => { state.target = window.scrollY; };
        window.addEventListener('scroll', onScroll, { passive: true });
        const tick = () => {
            state.current += (state.target - state.current) * 0.08;
            const y = state.current;
            if (starsRef.current) starsRef.current.style.transform = `translate3d(0, ${y * 0.05}px, 0)`;
            if (planetRef.current) planetRef.current.style.transform = `translate3d(-50%, ${y * 0.14}px, 0)`;
            raf = requestAnimationFrame(tick);
        };
        tick();
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
            className="oc-hero relative w-full overflow-hidden bg-black"
            style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}
        >
            <style>{`
                /* Los anillos quedan quietos y los satélites flotan apenas sobre
                   ellos. Se probó rotar los anillos, pero con un radio de ~110vw
                   hasta 3° de giro corrían los satélites casi 100px en horizontal
                   y se le montaban al texto. */
                @keyframes ocFloat    { 0%,100% { transform: translate(-50%,-50%); } 50% { transform: translate(-50%, calc(-50% - 9px)); } }
                @keyframes ocTwinkle  { 0%,100% { opacity: .55; } 50% { opacity: .95; } }
                @keyframes ocMarquee  { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }

                .oc-sat-wrap      { animation: ocFloat 9s ease-in-out infinite; }
                .oc-marquee       { animation: ocMarquee 44s linear infinite; }
                .oc-marquee:hover { animation-play-state: paused; }

                .oc-cta:focus-visible,
                .oc-ghost:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }

                /* En pantallas chicas los satélites no entran sin taparle el
                   titular: queda solo el horizonte, que es lo que de verdad
                   sostiene el impacto visual. */
                @media (max-width: 1023px) { .oc-sat-wrap { display: none !important; } }

                /* En celular el planeta es proporcionalmente mucho más chico
                   (220vw de 375px), así que el arco sube hasta el medio del
                   texto y el resplandor se come la línea de garantías. Se baja
                   el planeta y se achica el bloom para que el texto siempre
                   quede sobre negro. */
                @media (max-width: 768px) {
                    .oc-planet {
                        top: 86% !important;
                        box-shadow:
                            0 0 22px 2px rgba(226,240,255,.9),
                            0 0 60px 8px rgba(147,197,253,.6),
                            0 0 130px 24px rgba(99,102,241,.42),
                            0 0 240px 60px rgba(79,70,229,.22) !important;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .oc-sat-wrap, .oc-marquee, .oc-stars { animation: none !important; }
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
                    background: 'radial-gradient(ellipse at 50% 100%, rgba(99,102,241,.26) 0%, rgba(59,130,246,.11) 35%, rgba(0,0,0,0) 70%)',
                    filter: 'blur(20px)',
                }}
            />

            {/* ── El planeta: su borde superior ES el horizonte que ilumina ──── */}
            <div
                ref={planetRef}
                className="oc-planet absolute pointer-events-none z-[1]"
                style={{
                    left: '50%', top: '72%', width: '220vw', height: '220vw',
                    transform: 'translate3d(-50%, 0, 0)',
                    borderRadius: '50%',
                    background: '#000',
                    // El borde fino y muy claro es la "línea del amanecer"; las
                    // sombras van de chica y brillante a enorme y difusa para que
                    // el resplandor se derrame hacia arriba como en la referencia.
                    border: '1.5px solid rgba(224,240,255,.95)',
                    boxShadow:
                        '0 0 30px 2px rgba(226,240,255,.95),' +
                        '0 0 90px 12px rgba(147,197,253,.85),' +
                        '0 0 200px 45px rgba(99,102,241,.75),' +
                        '0 0 380px 110px rgba(79,70,229,.50),' +
                        '0 0 620px 200px rgba(59,130,246,.28)',
                }}
            >
                {/* Anillos de órbita, concéntricos al planeta */}
                {([1, 2, 3] as const).map(ring => (
                    <div
                        key={ring}
                        className="absolute"
                        style={{
                            left: '50%', top: '50%',
                            width: `${RING_SCALE[ring] * 100}%`, height: `${RING_SCALE[ring] * 100}%`,
                            transform: 'translate(-50%,-50%)',
                            borderRadius: '50%',
                            border: `1px ${ring === 2 ? 'dashed' : 'solid'} rgba(191,219,254,${ring === 1 ? .16 : .30})`,
                        }}
                    />
                ))}
            </div>

            {/* ── Satélites: van sobre el hero (no dentro del planeta) porque su
                 posición se calcula en píxeles contra la curva de cada anillo ── */}
            {posiciones && SATS.map((sat, i) => (
                <div
                    key={sat.label}
                    className="oc-sat-wrap absolute z-[2] pointer-events-none"
                    style={{
                        left: posiciones[i].left, top: posiciones[i].top,
                        transform: 'translate(-50%,-50%)',
                        animationDelay: sat.delay,
                        opacity: mounted ? 1 : 0,
                        transition: 'opacity 1s ease 700ms',
                    }}
                >
                    <Satelite sat={sat} />
                </div>
            ))}

            {/* ── Contenido ─────────────────────────────────────────────────── */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-10 text-center">
                <span
                    className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100/80"
                    style={{ ...aparece(120), border: '1px solid rgba(147,197,253,.22)', background: 'rgba(59,130,246,.08)', backdropFilter: 'blur(8px)' }}
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
                        href="#rubros"
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
                                style={{ border: '1px solid rgba(255,255,255,.09)', background: 'rgba(2,6,23,.82)', backdropFilter: 'blur(12px)' }}
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
                backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
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
