// La escena espacial de fondo: estrellas, cometas, el planeta con su horizonte
// iluminado, los anillos de órbita y los satélites de los módulos.
//
// Vive en una capa FIJA detrás de toda la página, no dentro del hero. Ese fue el
// pedido explícito del dueño: con la escena metida adentro del hero, se cortaba
// de golpe al terminar la primera pantalla y el resto del sitio parecía otra
// página.
//
// El recorrido es un viaje de ida y vuelta: el planeta arranca abajo del hero,
// se hunde mientras leés el medio de la página (queda un ambiente tenue y algún
// cometa lejano), y vuelve a asomar sobre el final para cerrar detrás del footer
// donde empezó.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '@/modules/landing/context/ThemeContext';

// Paleta de la escena por tema. En claro NO se invierte sin más: un planeta
// negro sobre fondo blanco quedaba como un agujero. Se convierte en un amanecer
// — cielo celeste pálido, planeta gris muy claro y el mismo halo azul, ahora
// oscureciendo hacia el horizonte en vez de iluminando.
interface Paleta {
    cieloOpacidad: number;
    planeta: string;
    linea: string;
    anillo: (ring: number) => string;
    glow: string[];
    neblina: string;
    cometa: [string, string];
}

const PALETAS: Record<'oscuro' | 'claro', Paleta> = {
    oscuro: {
        cieloOpacidad: 0.7,
        planeta: '#000',
        linea: 'rgba(240,248,255,.95)',
        anillo: r => `rgba(191,219,254,${r === 1 ? 0.16 : 0.3})`,
        glow: [
            'rgba(59,130,246,.10)', 'rgba(79,70,229,.15)', 'rgba(99,102,241,.22)',
            'rgba(129,140,248,.32)', 'rgba(147,197,253,.52)', 'rgba(219,234,254,.85)',
        ],
        neblina: 'radial-gradient(ellipse at 50% 100%, rgba(147,197,253,.34) 0%, rgba(99,102,241,.24) 22%, rgba(59,130,246,.10) 45%, rgba(0,0,0,0) 72%)',
        cometa: ['rgba(226,240,255,', 'rgba(147,197,253,'],
    },
    claro: {
        cieloOpacidad: 0.16,
        planeta: '#e7edf7',
        linea: 'rgba(37,99,235,.55)',
        anillo: r => `rgba(37,99,235,${r === 1 ? 0.10 : 0.16})`,
        glow: [
            'rgba(37,99,235,.05)', 'rgba(79,70,229,.06)', 'rgba(99,102,241,.09)',
            'rgba(129,140,248,.13)', 'rgba(147,197,253,.22)', 'rgba(191,219,254,.55)',
        ],
        neblina: 'radial-gradient(ellipse at 50% 100%, rgba(147,197,253,.42) 0%, rgba(129,140,248,.22) 24%, rgba(191,219,254,.12) 48%, rgba(255,255,255,0) 74%)',
        cometa: ['rgba(37,99,235,', 'rgba(99,102,241,'],
    },
};

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
    { label: 'Stock',    ring: 3, fase: 0.05, periodo: 34, lado: -1,
      icon: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></> },
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

/** Desde qué punto del scroll total el planeta empieza a volver a subir. */
const REGRESO_DESDE = 0.80;

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

// ── Cometas ──────────────────────────────────────────────────────────────────
// Pocos y lejanos a propósito: uno cada tanto, chico, fino y tenue. La idea es
// que el fondo respire cuando ya no está el planeta, no montar una lluvia de
// meteoritos que le robe la atención al texto.
interface Cometa { x: number; y: number; vx: number; vy: number; largo: number; vida: number; total: number; brillo: number }

function nuevoCometa(W: number, H: number): Cometa {
    // Entran desde el borde superior o desde los laterales de arriba, siempre
    // bajando en diagonal, como se ven de verdad.
    const desdeArriba = Math.random() < 0.6;
    const x = desdeArriba ? Math.random() * W : (Math.random() < 0.5 ? -60 : W + 60);
    const y = desdeArriba ? -60 : Math.random() * H * 0.5;
    const haciaLaDerecha = x < W / 2;
    const ang = (haciaLaDerecha ? 0.42 : Math.PI - 0.42) + (Math.random() - 0.5) * 0.22;
    // Lento: la lejanía se lee sobre todo en la velocidad y el tamaño.
    const vel = 0.9 + Math.random() * 0.7;
    const total = 3200 + Math.random() * 2200;
    return {
        x, y,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel,
        largo: 90 + Math.random() * 120,
        vida: 0, total,
        brillo: 0.35 + Math.random() * 0.35,
    };
}

export function EscenaEspacial() {
    const { isDark } = useTheme();
    const paleta = PALETAS[isDark ? 'oscuro' : 'claro'];
    const [medidas, setMedidas] = useState({ W: 0, H: 0 });
    const escenaRef = useRef<HTMLDivElement>(null);
    const brilloRef = useRef<HTMLDivElement>(null);
    const satsRef = useRef<(HTMLDivElement | null)[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const medir = () => setMedidas({ W: window.innerWidth, H: window.innerHeight });
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    useEffect(() => {
        if (medidas.W === 0) return;
        const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const { W, H } = medidas;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d') ?? null;
        if (canvas && ctx) {
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            ctx.scale(dpr, dpr);
        }

        let raf = 0;
        let anterior = performance.now();
        const t0 = anterior;
        const suave = { objetivo: 0, actual: 0 };
        const cometas: Cometa[] = [];
        let proximoCometa = 2500 + Math.random() * 4000;

        const onScroll = () => { suave.objetivo = window.scrollY; };
        window.addEventListener('scroll', onScroll, { passive: true });

        const tick = (ahora: number) => {
            const dt = Math.min(ahora - anterior, 50);
            anterior = ahora;

            suave.actual += (suave.objetivo - suave.actual) * 0.1;
            const y = suave.actual;

            // Progreso total de la página, para saber cuándo estamos cerca del final.
            const alto = document.documentElement.scrollHeight - H;
            const prog = alto > 0 ? clamp(y / alto, 0, 1) : 0;

            // Ida: el planeta se hunde mientras dejás atrás el hero.
            const hundimiento = Math.min(y * 0.24, H * 0.5);
            // Vuelta: sobre el final vuelve a asomar, para cerrar detrás del footer
            // donde empezó. Con ease para que no se sienta un salto.
            const t = clamp((prog - REGRESO_DESDE) / (1 - REGRESO_DESDE), 0, 1);
            const regreso = (t * t * (3 - 2 * t)) * (H * 0.5 + Math.min(y * 0.24, H * 0.5) * 0.9);
            const desplazamiento = hundimiento - regreso;

            const brilloIda = clamp(1 - y / (H * 1.15), 0.16, 1);
            const brillo = Math.max(brilloIda, t * 0.92);

            if (escenaRef.current) escenaRef.current.style.transform = `translate3d(0, ${desplazamiento}px, 0)`;
            if (brilloRef.current) brilloRef.current.style.opacity = String(brillo);

            // Satélites: solo mientras se ve el hero.
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

                el.style.transform = `translate3d(${W / 2 + dx}px, ${cy - dy + desplazamiento}px, 0) translate(-50%, -50%)`;
                el.style.opacity = String(borde * visSats);
            });

            // ── Cometas ──────────────────────────────────────────────────────
            // Aparecen recién después del hero (ahí ya está el planeta ocupando
            // la escena) y se apagan de nuevo cuando el planeta vuelve al final.
            if (ctx && !quieto) {
                const zonaCometas = clamp((y - H * 0.7) / (H * 0.6), 0, 1) * (1 - t);

                proximoCometa -= dt;
                if (proximoCometa <= 0) {
                    if (zonaCometas > 0.2 && cometas.length < 2) cometas.push(nuevoCometa(W, H));
                    proximoCometa = 5000 + Math.random() * 7000;
                }

                ctx.clearRect(0, 0, W, H);
                for (let i = cometas.length - 1; i >= 0; i--) {
                    const c = cometas[i];
                    c.vida += dt;
                    c.x += c.vx * dt * 0.06;
                    c.y += c.vy * dt * 0.06;

                    const vidaN = c.vida / c.total;
                    if (vidaN >= 1 || c.x < -200 || c.x > W + 200 || c.y > H + 200) { cometas.splice(i, 1); continue; }

                    // Entra y sale con un fundido: nunca aparece ni se corta de golpe.
                    const fundido = Math.min(vidaN / 0.25, (1 - vidaN) / 0.35, 1);
                    const alpha = c.brillo * fundido * zonaCometas;
                    if (alpha <= 0.01) continue;

                    const norma = Math.hypot(c.vx, c.vy) || 1;
                    const tx = c.x - (c.vx / norma) * c.largo;
                    const ty = c.y - (c.vy / norma) * c.largo;

                    const grad = ctx.createLinearGradient(c.x, c.y, tx, ty);
                    grad.addColorStop(0, `${paleta.cometa[0]}${alpha})`);
                    grad.addColorStop(0.35, `${paleta.cometa[1]}${alpha * 0.42})`);
                    grad.addColorStop(1, `${paleta.cometa[1]}0)`);

                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 1.3;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(c.x, c.y);
                    ctx.lineTo(tx, ty);
                    ctx.stroke();

                    // Cabeza: apenas un punto con halo, para que se lea lejano.
                    const halo = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 5);
                    halo.addColorStop(0, `${paleta.cometa[0]}${alpha})`);
                    halo.addColorStop(1, `${paleta.cometa[0]}0)`);
                    ctx.fillStyle = halo;
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
    }, [medidas, paleta]);

    const { W, H } = medidas;
    const R = 1.1 * W;
    const cy = (W <= 768 ? 0.86 : 0.72) * H + R;
    const horizonte = W > 0 ? arco(W / 2, cy, R, W) : '';

    return (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
            {/* Cielo: queda quieto, es el "fondo del fondo" */}
            <div
                className="absolute inset-0"
                style={{ backgroundImage: CIELO, backgroundSize: '360px 300px', opacity: paleta.cieloOpacidad }}
            />

            {/* Cometas */}
            <canvas ref={canvasRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />

            {/* Todo lo que se mueve con el scroll */}
            <div ref={escenaRef} className="absolute inset-0" style={{ willChange: 'transform' }}>
                <div ref={brilloRef} className="absolute inset-0" style={{ willChange: 'opacity' }}>
                    {/* Neblina atmosférica sobre el horizonte */}
                    <div
                        className="absolute"
                        style={{
                            left: '50%', bottom: '-10%', width: 'min(1600px, 150vw)', height: 'min(900px, 90vh)',
                            transform: 'translateX(-50%)',
                            background: paleta.neblina,
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
                                    stroke={paleta.anillo(ring)}
                                    strokeWidth={1}
                                    strokeDasharray={ring === 2 ? '5 8' : undefined}
                                />
                            ))}

                            {/* Resplandor del horizonte: trazos anchos y translúcidos,
                                de más ancho a más fino. Se usa esto en vez de un blur
                                porque un filtro sobre una figura de este tamaño es
                                carísimo de rasterizar. */}
                            <path d={horizonte} fill="none" stroke={paleta.glow[0]} strokeWidth={420} />
                            <path d={horizonte} fill="none" stroke={paleta.glow[1]} strokeWidth={220} />
                            <path d={horizonte} fill="none" stroke={paleta.glow[2]} strokeWidth={110} />
                            <path d={horizonte} fill="none" stroke={paleta.glow[3]} strokeWidth={48} />
                            <path d={horizonte} fill="none" stroke={paleta.glow[4]} strokeWidth={18} />
                            <path d={horizonte} fill="none" stroke={paleta.glow[5]} strokeWidth={6} />

                            {/* Cuerpo del planeta: el mismo arco cerrado contra el borde
                                de abajo. Va DESPUÉS del resplandor para tapar la mitad
                                que cae del lado de adentro — el planeta queda negro y la
                                luz se ve solo por encima del horizonte. */}
                            <path d={`${horizonte} L${W} ${H} L0 ${H} Z`} fill={paleta.planeta} />

                            {/* La "línea del amanecer", nítida, al final de todo. */}
                            <path d={horizonte} fill="none" stroke={paleta.linea} strokeWidth={1.6} />
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
                        <Satelite sat={sat} claro={!isDark} />
                    </div>
                ))}
            </div>
        </div>
    );
}

function Satelite({ sat, claro }: { sat: SatDef; claro: boolean }) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-1"
            style={{
                width: 78, height: 78, borderRadius: 20,
                // En tema claro la cápsula se invierte: con el fondo oscuro
                // quedaban cuatro cajas negras flotando sobre un cielo pálido.
                background: claro ? 'rgba(255,255,255,.94)' : 'rgba(2,6,23,.72)',
                border: `1px solid ${claro ? 'rgba(37,99,235,.22)' : 'rgba(147,197,253,.22)'}`,
                boxShadow: claro
                    ? '0 14px 34px rgba(15,23,42,.14), 0 0 22px rgba(37,99,235,.10)'
                    : '0 18px 45px rgba(0,0,0,.75), 0 0 28px rgba(59,130,246,.22)',
            }}
        >
            <svg viewBox="0 0 24 24" fill="none" stroke={claro ? '#2563eb' : '#93c5fd'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                style={{ width: 24, height: 24, filter: claro ? 'none' : 'drop-shadow(0 0 8px rgba(59,130,246,.85))' }}>
                {sat.icon}
            </svg>
            <span
                className="text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{ color: claro ? '#0f172a' : '#e2e8f0' }}
            >
                {sat.label}
            </span>
        </div>
    );
}
