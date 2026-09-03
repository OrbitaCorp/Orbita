// La escena espacial de fondo: estrellas, el planeta con su horizonte iluminado,
// los anillos de órbita y los satélites de los módulos.
//
// Vive en una capa FIJA detrás de toda la página, no dentro del hero. Ese fue el
// pedido explícito del dueño: con la escena metida adentro del hero, se cortaba
// de golpe al terminar la primera pantalla y el resto del sitio parecía otra
// página. Acá el planeta se hunde despacio a medida que bajás y su resplandor
// baja a un ambiente tenue que acompaña hasta el footer — una sola escena
// continua en vez de una sección con fondo lindo.

import { useEffect, useRef, useState, type ReactNode } from 'react';

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

const RING_SCALE: Record<number, number> = { 1: 1.30, 2: 1.16, 3: 1.05 };

/** Porción del recorrido usada para el fade de entrada y salida del satélite. */
const FADE = 0.16;
/** Media anchura del texto del hero, en px, que los satélites no deben pisar. */
const COLUMNA_TEXTO = 330;
/** Hasta dónde se van hacia afuera antes de salir de cuadro. */
const X_EXTERIOR = 0.68;

// Estrellas: patrón de gradientes que se repite, NO una lista larga de
// box-shadow. Con ~160 sombras sobre un elemento fijo el navegador dejaba de
// repintar bien al scrollear; un background que tilea es barato.
const CIELO = [
    'radial-gradient(1.2px 1.2px at 24px 38px, rgba(255,255,255,.55), transparent)',
    'radial-gradient(1px 1px at 128px 92px, rgba(255,255,255,.40), transparent)',
    'radial-gradient(1.4px 1.4px at 202px 168px, rgba(199,222,255,.50), transparent)',
    'radial-gradient(1px 1px at 76px 224px, rgba(255,255,255,.32), transparent)',
    'radial-gradient(1px 1px at 268px 44px, rgba(255,255,255,.36), transparent)',
    'radial-gradient(1.3px 1.3px at 312px 252px, rgba(255,255,255,.30), transparent)',
].join(', ');

/**
 * Devuelve el tramo VISIBLE de una circunferencia como una polilínea.
 *
 * Importa que sea solo el tramo visible y no el círculo entero: el planeta tiene
 * un radio de ~1.1 × el ancho de la pantalla, así que un <circle> obliga al
 * navegador a manejar una figura de miles de píxeles de lado (con trazos de
 * cientos de px encima) de la que se ve apenas una franja. Con la polilínea la
 * caja de dibujo es exactamente la pantalla.
 */
function arco(cx: number, cy: number, r: number, W: number, pasos = 44): string {
    const puntos: string[] = [];
    for (let i = 0; i <= pasos; i++) {
        const x = (W * i) / pasos;
        const dx = x - cx;
        const y = cy - Math.sqrt(Math.max(r * r - dx * dx, 0));
        puntos.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return puntos.join(' ');
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function EscenaEspacial() {
    const [medidas, setMedidas] = useState({ W: 0, H: 0 });
    const escenaRef = useRef<HTMLDivElement>(null);
    const brilloRef = useRef<HTMLDivElement>(null);
    const satsRef = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const medir = () => setMedidas({ W: window.innerWidth, H: window.innerHeight });
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    useEffect(() => {
        if (medidas.W === 0) return;
        const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let raf = 0;
        const t0 = performance.now();
        const suave = { objetivo: 0, actual: 0 };
        const onScroll = () => { suave.objetivo = window.scrollY; };
        window.addEventListener('scroll', onScroll, { passive: true });

        const tick = (ahora: number) => {
            const { W, H } = medidas;
            suave.actual += (suave.objetivo - suave.actual) * 0.1;
            const y = suave.actual;

            // El planeta se hunde despacio (no se va del todo) y su resplandor
            // cae hasta un ambiente tenue que sigue acompañando abajo. Esa cola
            // es lo que hace que el sitio se sienta una sola escena.
            const hundimiento = Math.min(y * 0.24, H * 0.5);
            const brillo = clamp(1 - y / (H * 1.15), 0.16, 1);

            if (escenaRef.current) escenaRef.current.style.transform = `translate3d(0, ${hundimiento}px, 0)`;
            if (brilloRef.current) brilloRef.current.style.opacity = String(brillo);

            // Los satélites solo tienen sentido mientras se ve el hero.
            const visSats = clamp(1 - y / (H * 0.8), 0, 1);
            const R = 1.1 * W;
            const cy = (W <= 768 ? 0.86 : 0.72) * H + R;
            const interior = Math.min(0.46, Math.max(0.28, COLUMNA_TEXTO / W));
            const seg = (ahora - t0) / 1000;

            SATS.forEach((sat, i) => {
                const el = satsRef.current[i];
                if (!el) return;
                if (visSats === 0) { el.style.opacity = '0'; return; }

                const avance = quieto ? 0 : seg / sat.periodo;
                const p = (sat.fase + avance) % 1;
                const fx = sat.lado * (interior + (X_EXTERIOR - interior) * p);
                const dx = fx * W;
                const rRing = RING_SCALE[sat.ring] * R;
                const dy = Math.sqrt(Math.max(rRing * rRing - dx * dx, 0));
                const borde = clamp(Math.min(p, 1 - p) / FADE, 0, 1);

                el.style.transform = `translate3d(${W / 2 + dx}px, ${cy - dy + hundimiento}px, 0) translate(-50%, -50%)`;
                el.style.opacity = String(borde * visSats);
            });

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
    }, [medidas]);

    const { W, H } = medidas;
    const R = 1.1 * W;
    const cy = (W <= 768 ? 0.86 : 0.72) * H + R;
    const horizonte = W > 0 ? arco(W / 2, cy, R, W) : '';

    return (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
            {/* Cielo: queda quieto, es el "fondo del fondo" */}
            <div
                className="absolute inset-0"
                style={{ backgroundImage: CIELO, backgroundSize: '360px 300px', opacity: 0.7 }}
            />

            {/* Todo lo que se hunde con el scroll */}
            <div ref={escenaRef} className="absolute inset-0" style={{ willChange: 'transform' }}>
                <div ref={brilloRef} className="absolute inset-0" style={{ willChange: 'opacity' }}>
                    {/* Neblina atmosférica sobre el horizonte */}
                    <div
                        className="absolute"
                        style={{
                            left: '50%', bottom: '-10%', width: 'min(1600px, 150vw)', height: 'min(900px, 90vh)',
                            transform: 'translateX(-50%)',
                            background: 'radial-gradient(ellipse at 50% 100%, rgba(147,197,253,.34) 0%, rgba(99,102,241,.24) 22%, rgba(59,130,246,.10) 45%, rgba(0,0,0,0) 72%)',
                            filter: 'blur(24px)',
                        }}
                    />

                    {W > 0 && (
                        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
                            {/* Anillos, de afuera hacia adentro */}
                            {([1, 2, 3] as const).map(ring => (
                                <path
                                    key={ring}
                                    d={arco(W / 2, cy, RING_SCALE[ring] * R, W)}
                                    fill="none"
                                    stroke={`rgba(191,219,254,${ring === 1 ? 0.16 : 0.3})`}
                                    strokeWidth={1}
                                    strokeDasharray={ring === 2 ? '5 8' : undefined}
                                />
                            ))}

                            {/* Resplandor del horizonte: trazos anchos y translúcidos,
                                de más ancho a más fino. Se usa esto en vez de un blur
                                porque un filtro sobre una figura de este tamaño es
                                carísimo de rasterizar. */}
                            <path d={horizonte} fill="none" stroke="rgba(59,130,246,.10)" strokeWidth={420} />
                            <path d={horizonte} fill="none" stroke="rgba(79,70,229,.15)" strokeWidth={220} />
                            <path d={horizonte} fill="none" stroke="rgba(99,102,241,.22)" strokeWidth={110} />
                            <path d={horizonte} fill="none" stroke="rgba(129,140,248,.32)" strokeWidth={48} />
                            <path d={horizonte} fill="none" stroke="rgba(147,197,253,.52)" strokeWidth={18} />
                            <path d={horizonte} fill="none" stroke="rgba(219,234,254,.85)" strokeWidth={6} />

                            {/* Cuerpo del planeta: el mismo arco cerrado contra el borde
                                de abajo. Va DESPUÉS del resplandor para tapar la mitad
                                que cae del lado de adentro — el planeta queda negro y la
                                luz se ve solo por encima del horizonte. */}
                            <path d={`${horizonte} L${W} ${H} L0 ${H} Z`} fill="#000" />

                            {/* La "línea del amanecer", nítida, al final de todo. */}
                            <path d={horizonte} fill="none" stroke="rgba(240,248,255,.95)" strokeWidth={1.6} />
                        </svg>
                    )}
                </div>

                {/* Satélites: sobre la escena, con posición calculada en píxeles */}
                {SATS.map((sat, i) => (
                    <div
                        key={sat.label}
                        ref={el => { satsRef.current[i] = el; }}
                        className="oc-sat-wrap absolute left-0 top-0"
                        style={{ opacity: 0, willChange: 'transform, opacity' }}
                    >
                        <Satelite sat={sat} />
                    </div>
                ))}
            </div>
        </div>
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
                style={{ width: 24, height: 24, filter: 'drop-shadow(0 0 8px rgba(59,130,246,.85))' }}>
                {sat.icon}
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-200">{sat.label}</span>
        </div>
    );
}
