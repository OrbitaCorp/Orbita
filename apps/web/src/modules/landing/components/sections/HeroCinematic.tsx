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

import { useEffect, useState, type ReactNode } from 'react';

// Acá abajo había un carrusel de testimonios, pero eran INVENTADOS: Órbita
// todavía no tiene clientes con citas reales para mostrar, y una landing que
// arranca con testimonios falsos es lo primero que se nota. En su lugar va algo
// que sí es cierto hoy y que además contesta la pregunta que se hace el que
// entra ("¿esto sirve para lo mío?"): los rubros que el producto contempla.
//
// Cuando haya testimonios de verdad, esta tira es el lugar natural para ellos.
interface Rubro { nombre: string; icon: ReactNode }

// Son los subrubros REALES que ofrece el onboarding (TIENDA_SUBRUBROS en
// apps/api/src/onboarding/onboarding.service.ts). Antes esta tira tenía
// barberías, gimnasios y gastronomía: esos rubros dependen del módulo de Turnos,
// que todavía figura como `disponible: false` — prometerlos acá era mandar a
// alguien a registrarse para algo que no puede hacer.
const RUBROS: Rubro[] = [
    { nombre: 'Indumentaria',   icon: <><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" /></> },
    { nombre: 'Calzado',        icon: <><path d="M4 18h16v-2a4 4 0 0 0-4-4l-3-3H4z" /><path d="M4 14h5" /></> },
    { nombre: 'Cosmética',      icon: <><path d="M9 2h6v5l2 3v12H7V10l2-3z" /><path d="M7 14h10" /></> },
    { nombre: 'Electrónica',    icon: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></> },
    { nombre: 'Ferreterías',    icon: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></> },
    { nombre: 'Corralones',     icon: <><path d="M3 21h18M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></> },
    { nombre: 'Librerías',      icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></> },
    { nombre: 'Jugueterías',    icon: <><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" /></> },
    { nombre: 'Pet shops',      icon: <><circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 0 1 5 5v3a3 3 0 0 1-6 0v-3a5 5 0 0 1 1-3z" /></> },
    { nombre: 'Repuestos',      icon: <><path d="M19 17h2v-6l-3-4h-5v10h2" /><path d="M10 17h4V5H2v12h3" /><circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></> },
    { nombre: 'Joyerías',       icon: <><path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20M12 21 8 9l4-6 4 6-4 12" /></> },
    { nombre: 'Mueblerías',     icon: <><path d="M4 18v3M20 18v3" /><path d="M2 11V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3" /><path d="M4 18h16a2 2 0 0 0 2-2v-3a2 2 0 0 0-4 0v1H6v-1a2 2 0 0 0-4 0v3a2 2 0 0 0 2 2z" /></> },
    { nombre: 'Informática',    icon: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></> },
    { nombre: 'Distribuidoras', icon: <><path d="M16 16V4H2v12h2M22 16h-2v-5l-3-3h-3" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></> },
    { nombre: 'Limpieza',       icon: <><path d="M12 2 8 8v13h8V8z" /><path d="M8 12h8" /></> },
    { nombre: 'Viveros',        icon: <><path d="M7 20h10M12 20V9" /><path d="M12 9c0-3 2-5 6-5 0 4-2 6-6 6zM12 12c0-3-2-5-6-5 0 4 2 6 6 6z" /></> },
    { nombre: 'Mercerías',      icon: <><circle cx="12" cy="12" r="9" /><path d="M8 8c3 3 5 5 8 8M16 8c-3 3-5 5-8 8" /></> },
    { nombre: 'De todo un poco', icon: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></> },
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
                    style={{ ...aparece(120), border: '1px solid var(--oc-accent-bd)', background: 'var(--oc-accent-soft)' }}
                >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: '#4ade80', boxShadow: '0 0 10px #4ade80' }} />
                    Tienda, stock y clientes en un solo lugar
                </span>

                <h1
                    className="mt-7 font-black tracking-[-0.045em]"
                    style={{ ...aparece(240), fontSize: 'clamp(44px, 9.5vw, 132px)', lineHeight: 0.92 }}
                >
                    <span className="text-white">Tu negocio,</span>{' '}
                    <span style={{ color: 'var(--oc-title-2)' }}>en órbita.</span>
                </h1>

                <p
                    className="mt-6 max-w-[560px] text-[15px] leading-relaxed sm:text-lg"
                    style={{ ...aparece(360), color: 'var(--oc-text-2)' }}
                >
                    Tu tienda online con catálogo, stock y pedidos —
                    sin comisiones por venta y con tu propio dominio.
                </p>

                <div className="mt-9 flex flex-wrap items-center justify-center gap-3" style={aparece(480)}>
                    <a
                        href="/onboarding/rubro"
                        className="oc-cta inline-flex cursor-pointer items-center gap-2 rounded-xl px-6 text-[15px] font-bold transition-colors duration-200"
                        style={{ minHeight: 48, background: 'var(--oc-cta-bg)', color: 'var(--oc-cta-fg)', boxShadow: 'var(--oc-cta-sombra)' }}
                    >
                        Crear tu espacio
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </a>
                    <a
                        href="#como-funciona"
                        className="oc-ghost inline-flex cursor-pointer items-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-white/90 transition-colors duration-200 hover:bg-white/10"
                        style={{ minHeight: 48, border: '1px solid var(--oc-ghost-bd)', background: 'var(--oc-ghost-bg)' }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Ver cómo funciona
                    </a>
                </div>

                <div
                    className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] font-medium"
                    style={{ ...aparece(600), color: 'var(--oc-text-3)' }}
                >
                    {['Sin comisiones por venta', 'Sin permanencia', 'Listo en una tarde'].map(t => (
                        <span key={t} className="inline-flex items-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {t}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── Tira de rubros pegada al borde inferior ───────────────────── */}
            <div className="pb-10" style={aparece(760)}>
                <p className="mb-4 text-center text-[10.5px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    Pensado para negocios como el tuyo
                </p>
                <div
                    className="relative overflow-hidden"
                    style={{ maskImage: 'linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)' }}
                >
                    {/* Se repite la lista DOS veces y la animación corre hasta -50%:
                        cuando termina la primera copia, la segunda está exactamente
                        donde arrancó la primera, así que el salto no se ve y el
                        carrusel queda infinito de verdad. Con una sola copia (o con
                        un desplazamiento que no sea la mitad justa) se ve el corte. */}
                    <div className="oc-marquee flex w-max gap-2.5">
                        {[...RUBROS, ...RUBROS].map((r, i) => (
                            <span
                                key={`${r.nombre}-${i}`}
                                className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold text-slate-200"
                                // Fondo casi opaco: el arco del planeta pasa justo por
                                // detrás de esta fila y con algo translúcido el texto
                                // quedaba ilegible sobre el resplandor.
                                style={{ border: '1px solid var(--oc-panel-bd)', background: 'var(--oc-panel)' }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ width: 16, height: 16 }} aria-hidden="true">
                                    {r.icon}
                                </svg>
                                {r.nombre}
                            </span>
                        ))}
                    </div>
                </div>
                <p className="mt-4 text-center text-[12.5px] text-slate-500">
                    ¿No ves el tuyo? Órbita se adapta igual —{' '}
                    <a href="#rubros" className="cursor-pointer text-blue-300 underline-offset-4 transition-colors hover:text-blue-200 hover:underline">
                        mirá cómo
                    </a>
                </p>
            </div>
        </section>
    );
}
