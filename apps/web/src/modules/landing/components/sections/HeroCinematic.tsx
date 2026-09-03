// Hero "cinematográfico" — propuesta de rediseño del home de orbita.site.
//
// Referencia visual acordada con el dueño: t3code-cinematic-dark-saas-landing-page
// (negro total + arco de glow tipo horizonte de planeta + titular gigante bicolor
// + marquee de testimonios abajo).
//
// OJO: acá NO está el planeta. El planeta, los anillos, los satélites y las
// estrellas viven en EscenaEspacial.tsx, una capa fija detrás de TODA la página.
// Se hizo así por pedido explícito del dueño: teniéndolo dentro del hero, la
// escena se cortaba al terminar la primera pantalla y el resto del sitio parecía
// otra página. Este componente es solo el contenido que va encima.
//
// Se mantiene aparte de Hero.tsx a propósito: es una propuesta, el hero viejo
// sigue intacto para poder comparar los dos.

import { useEffect, useState } from 'react';

const TESTIMONIOS = [
    { n: 'Malena C.',    r: 'Indumentaria · Córdoba',  t: 'Pasé de anotar los pedidos en un cuaderno a tener la tienda online andando en una tarde.' },
    { n: 'Lucas R.',     r: 'Barbería · Rosario',      t: 'Los turnos se cargan solos y dejé de perder clientes por no contestar el WhatsApp a tiempo.' },
    { n: 'Sofía P.',     r: 'Pastelería · CABA',       t: 'Cobro por Mercado Pago sin comisión de plataforma. Eso solo ya me cambió el mes.' },
    { n: 'Diego R.',     r: 'Ferretería · Mendoza',    t: 'Tengo el stock, la caja y los pedidos en el mismo lugar. Antes eran tres planillas.' },
    { n: 'Valentina M.', r: 'Estética · La Plata',     t: 'Mis clientas reservan solas desde el celular. Yo solo miro la agenda a la mañana.' },
    { n: 'Nico B.',      r: 'Distribuidora · Tucumán', t: 'Armar la tienda con mi dominio propio me llevó menos que elegir el nombre.' },
];

export function HeroCinematic() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 60);
        return () => clearTimeout(t);
    }, []);

    const aparece = (delayMs: number) => ({
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 900ms cubic-bezier(.16,1,.3,1), transform 900ms cubic-bezier(.16,1,.3,1)',
        transitionDelay: `${delayMs}ms`,
    });

    return (
        <section
            className="oc-hero relative z-10 w-full"
            style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}
        >
            <style>{`
                @keyframes ocMarquee { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
                .oc-marquee       { animation: ocMarquee 44s linear infinite; }
                .oc-marquee:hover { animation-play-state: paused; }

                .oc-cta:focus-visible,
                .oc-ghost:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }

                @media (prefers-reduced-motion: reduce) { .oc-marquee { animation: none !important; } }
            `}</style>

            <div className="flex flex-1 flex-col items-center justify-center px-6 pt-28 pb-10 text-center">
                <span
                    className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100/80"
                    style={{ ...aparece(120), border: '1px solid rgba(147,197,253,.22)', background: 'rgba(59,130,246,.08)' }}
                >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: '#4ade80', boxShadow: '0 0 10px #4ade80' }} />
                    Turnos, ventas y clientes en un solo lugar
                </span>

                <h1
                    className="mt-7 font-black tracking-[-0.045em]"
                    style={{ ...aparece(240), fontSize: 'clamp(44px, 9.5vw, 132px)', lineHeight: 0.92 }}
                >
                    <span className="text-white">Tu negocio,</span>{' '}
                    <span style={{ color: '#7c869b' }}>en órbita.</span>
                </h1>

                <p
                    className="mt-6 max-w-[560px] text-[15px] leading-relaxed sm:text-lg"
                    style={{ ...aparece(360), color: 'rgba(203,213,225,.78)' }}
                >
                    Tienda online, turnos, pedidos y métricas reales — todo funcionando el mismo día,
                    sin comisiones por venta y con tu propio dominio.
                </p>

                <div className="mt-9 flex flex-wrap items-center justify-center gap-3" style={aparece(480)}>
                    <a
                        href="/onboarding/rubro"
                        className="oc-cta inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-bold text-slate-900 transition-colors duration-200 hover:bg-blue-50"
                        style={{ minHeight: 48, boxShadow: '0 10px 40px rgba(147,197,253,.22)' }}
                    >
                        Crear mi tienda gratis
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </a>
                    <a
                        href="#como-funciona"
                        className="oc-ghost inline-flex cursor-pointer items-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-white/90 transition-colors duration-200 hover:bg-white/10"
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
            <div className="pb-8" style={aparece(760)}>
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
                                // Fondo casi opaco a propósito: el arco del planeta pasa
                                // justo por detrás de esta fila, y con tarjetas
                                // translúcidas el texto quedaba ilegible sobre el
                                // resplandor.
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
