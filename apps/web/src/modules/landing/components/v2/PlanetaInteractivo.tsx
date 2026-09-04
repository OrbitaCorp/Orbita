// Planeta 3D interactivo: se arrastra con el mouse o con el dedo y gira.
//
// Está hecho a mano con canvas 2D y un poco de trigonometría en vez de traer
// three.js: para una esfera de puntos y tres anillos, la librería serían ~600 kB
// de JS en una landing que ya venía peleando con el rendimiento. Acá el costo es
// un canvas del tamaño de la pieza y un bucle que se apaga solo cuando la
// sección no está en pantalla.
//
// La metáfora es la del producto: los módulos giran alrededor del negocio, que
// es el centro. Y es literalmente manipulable — el visitante lo agarra y lo hace
// girar, que es la primera vez en la página que TOCA algo en vez de leerlo.
//
// Tres decisiones que vale la pena tener presentes al tocar esto:
//
//  1. El radio NO es un porcentaje fijo del recuadro: se despeja para que el
//     anillo más grande entre entero incluso en su punto más cercano a la
//     cámara. Con un radio fijo, al arrastrar se salían los satélites y las
//     etiquetas quedaban cortadas contra el borde.
//  2. La rotación del usuario es un DESVÍO sobre la rotación de base, no la
//     rotación misma. Así, al soltar, el desvío se va apagando y el planeta
//     vuelve solo a su posición natural sin frenar el giro de fondo.
//  3. Los anillos precesan por su cuenta (cada uno a su ritmo): los satélites
//     que están del otro lado terminan pasando al frente sin que haga falta
//     arrastrar nada.

import { useEffect, useRef } from 'react';
import { Reveal, Seccion, Encabezado } from './Reveal';
import { useTheme } from '@/modules/landing/context/ThemeContext';

/** Distancia de la cámara. Más grande = menos deformación de perspectiva. */
const PERSPECTIVA = 5.2;
/** Hasta dónde puede inclinar el usuario, para que no se vea el planeta de canto. */
const PITCH_MAX = 0.55;
/** Inclinación de base, la que se recupera al soltar. */
const PITCH_BASE = -0.32;
/** Margen interno reservado para que las etiquetas no toquen el borde. */
const MARGEN = 32;
/**
 * Cuánto del radio del anillo se traduce en altura, en el peor caso.
 *
 * Un anillo visto de frente ocuparía todo su radio hacia arriba, pero acá nunca
 * llega a eso: entre su inclinación propia y el tope de arrastre, el ángulo
 * máximo contra el eje de la cámara ronda 0.93 rad. Sin este factor había que
 * asumir el caso imposible y el planeta quedaba diminuto dentro del recuadro.
 */
const FACTOR_ALTO = Math.sin(PITCH_MAX + 0.38);

// Los módulos son los reales del panel. Se ponen todos: son justamente la
// respuesta a "qué hace Órbita", y al precesar los anillos van desfilando.
const MODULOS = [
    { label: 'Ventas',     anillo: 0, fase: 0.00 },
    { label: 'Pedidos',    anillo: 0, fase: 0.34 },
    { label: 'Catálogo',   anillo: 0, fase: 0.67 },
    { label: 'Stock',      anillo: 1, fase: 0.12 },
    { label: 'Clientes',   anillo: 1, fase: 0.37 },
    { label: 'Mensajes',   anillo: 1, fase: 0.62 },
    { label: 'Descuentos', anillo: 1, fase: 0.87 },
    { label: 'Reportes',   anillo: 2, fase: 0.05 },
    { label: 'Orbi',       anillo: 2, fase: 0.30 },
    { label: 'Equipo',     anillo: 2, fase: 0.55 },
    { label: 'Dominio',    anillo: 2, fase: 0.80 },
];

// `precesion` = vueltas por segundo del plano del anillo. Distintas y lentas, y
// una al revés, para que el conjunto no se lea como un bloque rígido.
//
// Los radios son ajustados (1.2-1.5 veces la esfera) a propósito: lo que entra
// en el recuadro es el ANILLO MÁS GRANDE, así que cuanto más lejos orbita, más
// chico hay que hacer el planeta para que todo quepa. Con anillos anchos la
// esfera quedaba diminuta en el medio del cuadro.
const ANILLOS = [
    { r: 1.18, incl: 0.28, giro: 0.0,  precesion: 0.020, velocidad: 0.14 },
    { r: 1.36, incl: -0.38, giro: 0.9, precesion: -0.014, velocidad: -0.10 },
    { r: 1.54, incl: 0.14, giro: -0.6, precesion: 0.009, velocidad: 0.07 },
];
const R_MAX = 1.54;

/** Puntos repartidos parejo sobre la esfera (espiral de Fibonacci). */
function puntosEsfera(n: number) {
    const phi = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: n }, (_, i) => {
        const y = 1 - (i / (n - 1)) * 2;
        const radio = Math.sqrt(Math.max(1 - y * y, 0));
        const th = phi * i;
        return { x: Math.cos(th) * radio, y, z: Math.sin(th) * radio };
    });
}

export function PlanetaInteractivo() {
    const { isDark } = useTheme();
    const contRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const cont = contRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!cont || !canvas || !ctx) return;

        const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const puntos = puntosEsfera(760);

        let W = 0, H = 0, radio = 0;
        const medir = () => {
            const r = cont.getBoundingClientRect();
            W = r.width; H = r.height;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = W * dpr; canvas.height = H * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // El punto más cercano del anillo más grande es el que más se agranda
            // por perspectiva: se despeja el radio para que ESE caso entre, alto y
            // ancho por separado (el recuadro es más ancho que alto, y los anillos
            // se estiran justamente a lo ancho).
            const perspMax = PERSPECTIVA / (PERSPECTIVA - R_MAX);
            const porAlto = (H / 2 - MARGEN) / (R_MAX * perspMax * FACTOR_ALTO);
            const porAncho = (W / 2 - MARGEN) / (R_MAX * perspMax);
            radio = Math.min(porAlto, porAncho);
        };
        medir();
        const ro = new ResizeObserver(medir);
        ro.observe(cont);

        // La rotación se parte en dos: la de base (que corre sola) y el desvío
        // que agrega el usuario al arrastrar. Al soltar, el desvío vuelve a cero.
        const base = { yaw: 0.5 };
        const desvio = { yaw: 0, pitch: 0 };
        const inercia = { yaw: 0, pitch: 0 };
        let arrastrando = false;
        let ultimo = { x: 0, y: 0 };

        const onDown = (e: PointerEvent) => {
            arrastrando = true;
            ultimo = { x: e.clientX, y: e.clientY };
            canvas.setPointerCapture(e.pointerId);
            cont.style.cursor = 'grabbing';
        };
        const onMove = (e: PointerEvent) => {
            if (!arrastrando) return;
            const dx = e.clientX - ultimo.x;
            const dy = e.clientY - ultimo.y;
            ultimo = { x: e.clientX, y: e.clientY };
            desvio.yaw += dx * 0.006;
            desvio.pitch = Math.max(-PITCH_MAX - PITCH_BASE, Math.min(PITCH_MAX - PITCH_BASE, desvio.pitch + dy * 0.005));
            inercia.yaw = dx * 0.0011;
            inercia.pitch = dy * 0.0007;
        };
        const onUp = (e: PointerEvent) => {
            if (!arrastrando) return;
            arrastrando = false;
            try { canvas.releasePointerCapture(e.pointerId); } catch { /* el puntero ya se fue */ }
            cont.style.cursor = 'grab';
        };

        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointercancel', onUp);
        canvas.addEventListener('pointerleave', onUp);

        let visible = false;
        let raf = 0;
        let anterior = performance.now();
        const io = new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible && !raf) { anterior = performance.now(); raf = requestAnimationFrame(dibujar); }
        }, { rootMargin: '120px' });
        io.observe(cont);

        function rotar(p: { x: number; y: number; z: number }, yaw: number, pitch: number) {
            const cy = Math.cos(yaw), sy = Math.sin(yaw);
            const cx = Math.cos(pitch), sx = Math.sin(pitch);
            const x1 = p.x * cy + p.z * sy;
            const z1 = -p.x * sy + p.z * cy;
            return { x: x1, y: p.y * cx - z1 * sx, z: p.y * sx + z1 * cx };
        }

        function proyectar(p: { x: number; y: number; z: number }, yaw: number, pitch: number) {
            const r = rotar(p, yaw, pitch);
            const persp = PERSPECTIVA / (PERSPECTIVA + r.z);
            return { x: W / 2 + r.x * radio * persp, y: H / 2 + r.y * radio * persp, z: r.z };
        }

        /** Punto de un anillo, ya inclinado y precesado, en coordenadas del mundo. */
        function puntoAnillo(a: typeof ANILLOS[number], th: number, t: number) {
            const base = { x: Math.cos(th) * a.r, y: 0, z: Math.sin(th) * a.r };
            const ci = Math.cos(a.incl), si = Math.sin(a.incl);
            const y1 = base.y * ci - base.z * si;
            const z1 = base.y * si + base.z * ci;
            // La precesión gira el PLANO del anillo con el tiempo: es lo que va
            // trayendo al frente los satélites que estaban atrás, sin que el
            // visitante tenga que arrastrar nada.
            const g = a.giro + (reducido ? 0 : t * a.precesion * Math.PI * 2);
            const cg = Math.cos(g), sg = Math.sin(g);
            return { x: base.x * cg + z1 * sg, y: y1, z: -base.x * sg + z1 * cg };
        }

        function dibujar(ahora: number) {
            if (!visible) { raf = 0; return; }
            const dt = Math.min((ahora - anterior) / 1000, 0.05);
            anterior = ahora;
            const t = ahora / 1000;

            if (!reducido) base.yaw += 0.09 * dt;

            if (arrastrando) {
                // Nada: el desvío ya lo mueve el puntero.
            } else {
                // Al soltar: primero termina de correr la inercia, y enseguida el
                // desvío se apaga solo hasta volver a la posición de base.
                desvio.yaw += inercia.yaw;
                desvio.pitch += inercia.pitch;
                inercia.yaw *= 0.90;
                inercia.pitch *= 0.90;
                const vuelta = 1 - Math.pow(0.055, dt); // ~independiente del framerate
                desvio.yaw += -desvio.yaw * vuelta;
                desvio.pitch += -desvio.pitch * vuelta;
            }

            const yaw = base.yaw + desvio.yaw;
            const pitch = PITCH_BASE + desvio.pitch;

            ctx!.clearRect(0, 0, W, H);

            // Halo
            const halo = ctx!.createRadialGradient(W / 2, H / 2, radio * 0.5, W / 2, H / 2, radio * 2.6);
            halo.addColorStop(0, isDark ? 'rgba(59,130,246,.20)' : 'rgba(37,99,235,.10)');
            halo.addColorStop(1, 'rgba(59,130,246,0)');
            ctx!.fillStyle = halo;
            ctx!.fillRect(0, 0, W, H);

            // Anillos
            ANILLOS.forEach((a, i) => {
                ctx!.beginPath();
                for (let k = 0; k <= 96; k++) {
                    const pr = proyectar(puntoAnillo(a, (k / 96) * Math.PI * 2, t), yaw, pitch);
                    if (k === 0) ctx!.moveTo(pr.x, pr.y); else ctx!.lineTo(pr.x, pr.y);
                }
                ctx!.strokeStyle = isDark ? `rgba(147,197,253,${0.24 - i * 0.04})` : `rgba(37,99,235,${0.20 - i * 0.04})`;
                ctx!.lineWidth = 1;
                ctx!.stroke();
            });

            // Esfera de puntos, de atrás hacia adelante
            const proyectados = puntos.map(p => proyectar(p, yaw, pitch)).sort((a, b) => b.z - a.z);
            for (const p of proyectados) {
                const frente = 1 - (p.z + 1) / 2;
                const alpha = 0.10 + frente * 0.52;
                ctx!.fillStyle = isDark ? `rgba(191,219,254,${alpha.toFixed(3)})` : `rgba(30,58,138,${alpha.toFixed(3)})`;
                ctx!.beginPath();
                ctx!.arc(p.x, p.y, 0.6 + frente * 1.3, 0, Math.PI * 2);
                ctx!.fill();
            }

            // Satélites: se dibujan de atrás hacia adelante para que los de
            // adelante tapen a los de atrás, como corresponde.
            const sats = MODULOS.map(m => {
                const a = ANILLOS[m.anillo];
                const th = m.fase * Math.PI * 2 + (reducido ? 0 : t * a.velocidad);
                return { label: m.label, pr: proyectar(puntoAnillo(a, th, t), yaw, pitch) };
            }).sort((x, y2) => y2.pr.z - x.pr.z);

            for (const s of sats) {
                const frente = 1 - (s.pr.z + 1) / 2;
                const alpha = 0.22 + frente * 0.78;

                const g = ctx!.createRadialGradient(s.pr.x, s.pr.y, 0, s.pr.x, s.pr.y, 9);
                g.addColorStop(0, isDark ? `rgba(226,240,255,${alpha})` : `rgba(37,99,235,${alpha})`);
                g.addColorStop(1, 'rgba(147,197,253,0)');
                ctx!.fillStyle = g;
                ctx!.beginPath();
                ctx!.arc(s.pr.x, s.pr.y, 9, 0, Math.PI * 2);
                ctx!.fill();

                ctx!.fillStyle = isDark ? `rgba(255,255,255,${alpha})` : `rgba(15,23,42,${alpha})`;
                ctx!.beginPath();
                ctx!.arc(s.pr.x, s.pr.y, 2.4, 0, Math.PI * 2);
                ctx!.fill();

                // La etiqueta solo cuando el satélite está del lado de acá:
                // leerla "a través" del planeta se veía sucio.
                if (frente > 0.58) {
                    const op = Math.min((frente - 0.58) * 2.6, 1);
                    ctx!.font = '600 11px ui-sans-serif, system-ui, sans-serif';
                    ctx!.textAlign = 'center';
                    ctx!.fillStyle = isDark ? `rgba(226,232,240,${op})` : `rgba(15,23,42,${op})`;
                    ctx!.fillText(s.label.toUpperCase(), s.pr.x, s.pr.y - 14);
                }
            }

            raf = requestAnimationFrame(dibujar);
        }

        raf = requestAnimationFrame(dibujar);

        return () => {
            cancelAnimationFrame(raf);
            io.disconnect();
            ro.disconnect();
            canvas.removeEventListener('pointerdown', onDown);
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('pointercancel', onUp);
            canvas.removeEventListener('pointerleave', onUp);
        };
    }, [isDark]);

    return (
        <Seccion id="orbita">
            <Encabezado
                eyebrow="Tu negocio en el centro"
                titulo="Todo gira"
                resalte="alrededor de lo que vendés."
                bajada="Catálogo, ventas, stock, pedidos, clientes y reportes no son programas sueltos: son el mismo negocio mirado desde distintos lados."
            />

            <Reveal desde="escala" className="mt-12">
                <div
                    ref={contRef}
                    className="relative mx-auto w-full overflow-hidden rounded-2xl"
                    style={{
                        maxWidth: 820, height: 'min(520px, 86vw)', cursor: 'grab',
                        background: 'var(--oc-card-bg)', border: '1px solid var(--oc-card-bd)',
                        touchAction: 'none', // el dedo gira el planeta, no scrollea la página
                    }}
                >
                    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" role="img" aria-label="Planeta con los módulos de Órbita girando a su alrededor" />
                    <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Arrastralo para girarlo
                    </span>
                </div>
            </Reveal>
        </Seccion>
    );
}
