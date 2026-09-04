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

import { useEffect, useRef } from 'react';
import { Reveal, Seccion, Encabezado } from './Reveal';
import { useTheme } from '@/modules/landing/context/ThemeContext';

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

const MODULOS = [
    { label: 'Ventas',   anillo: 0, fase: 0.00 },
    { label: 'Stock',    anillo: 1, fase: 0.35 },
    { label: 'Pedidos',  anillo: 0, fase: 0.55 },
    { label: 'Clientes', anillo: 2, fase: 0.15 },
    { label: 'Reportes', anillo: 1, fase: 0.80 },
];

// Inclinación de cada anillo, para que no se superpongan en el mismo plano.
const ANILLOS = [
    { r: 1.42, incl: 0.30, giro: 0.0 },
    { r: 1.70, incl: -0.45, giro: 0.9 },
    { r: 1.98, incl: 0.16, giro: -0.6 },
];

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
        const puntos = puntosEsfera(420);

        let W = 0, H = 0, dpr = 1;
        const medir = () => {
            const r = cont.getBoundingClientRect();
            W = r.width; H = r.height;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = W * dpr; canvas.height = H * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        medir();
        const ro = new ResizeObserver(medir);
        ro.observe(cont);

        // Estado de la rotación: `vel` es la inercia que queda al soltar.
        const rot = { yaw: 0.5, pitch: -0.35 };
        const vel = { yaw: reducido ? 0 : 0.0016, pitch: 0 };
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
            rot.yaw += dx * 0.006;
            rot.pitch = Math.max(-1.2, Math.min(1.2, rot.pitch + dy * 0.005));
            vel.yaw = dx * 0.0009;
            vel.pitch = dy * 0.0006;
        };
        const onUp = (e: PointerEvent) => {
            arrastrando = false;
            try { canvas.releasePointerCapture(e.pointerId); } catch { /* el puntero ya se fue */ }
            cont.style.cursor = 'grab';
        };

        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointercancel', onUp);
        canvas.addEventListener('pointerleave', onUp);

        // El bucle solo corre con la pieza en pantalla.
        let visible = false;
        let raf = 0;
        const io = new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible && !raf) raf = requestAnimationFrame(dibujar);
        }, { rootMargin: '120px' });
        io.observe(cont);

        function proyectar(p: { x: number; y: number; z: number }, radio: number) {
            // Rotación en Y (yaw) y después en X (pitch).
            const cy = Math.cos(rot.yaw), sy = Math.sin(rot.yaw);
            const cx = Math.cos(rot.pitch), sx = Math.sin(rot.pitch);
            const x1 = p.x * cy + p.z * sy;
            const z1 = -p.x * sy + p.z * cy;
            const y2 = p.y * cx - z1 * sx;
            const z2 = p.y * sx + z1 * cx;
            // Perspectiva suave: lo de atrás se achica y se apaga.
            const persp = 2.6 / (2.6 + z2);
            return { x: W / 2 + x1 * radio * persp, y: H / 2 + y2 * radio * persp, z: z2, persp };
        }

        function dibujar() {
            if (!visible) { raf = 0; return; }
            if (!arrastrando) {
                rot.yaw += vel.yaw;
                rot.pitch += vel.pitch;
                // Rozamiento: la inercia se apaga y vuelve al giro lento de base.
                vel.yaw += ((reducido ? 0 : 0.0016) - vel.yaw) * 0.03;
                vel.pitch *= 0.92;
            }

            const radio = Math.min(W, H) * 0.27;
            ctx!.clearRect(0, 0, W, H);

            // Halo del planeta
            const halo = ctx!.createRadialGradient(W / 2, H / 2, radio * 0.6, W / 2, H / 2, radio * 1.9);
            halo.addColorStop(0, isDark ? 'rgba(59,130,246,.22)' : 'rgba(37,99,235,.10)');
            halo.addColorStop(1, 'rgba(59,130,246,0)');
            ctx!.fillStyle = halo;
            ctx!.fillRect(0, 0, W, H);

            // Anillos: se dibujan como polilíneas de puntos proyectados, así se
            // ven en perspectiva de verdad y no como elipses dibujadas a mano.
            ANILLOS.forEach((a, i) => {
                ctx!.beginPath();
                for (let k = 0; k <= 90; k++) {
                    const th = (k / 90) * Math.PI * 2;
                    const base = { x: Math.cos(th) * a.r, y: 0, z: Math.sin(th) * a.r };
                    // Inclinar el anillo antes de rotarlo con la escena.
                    const ci = Math.cos(a.incl), si = Math.sin(a.incl);
                    const cg = Math.cos(a.giro), sg = Math.sin(a.giro);
                    const y1 = base.y * ci - base.z * si;
                    const z1 = base.y * si + base.z * ci;
                    const x2 = base.x * cg + z1 * sg;
                    const z2 = -base.x * sg + z1 * cg;
                    const pr = proyectar({ x: x2, y: y1, z: z2 }, radio);
                    if (k === 0) ctx!.moveTo(pr.x, pr.y); else ctx!.lineTo(pr.x, pr.y);
                }
                ctx!.strokeStyle = isDark ? `rgba(147,197,253,${0.26 - i * 0.05})` : `rgba(37,99,235,${0.22 - i * 0.05})`;
                ctx!.lineWidth = 1;
                ctx!.stroke();
            });

            // Puntos de la esfera, ordenados de atrás hacia adelante.
            const proyectados = puntos
                .map(p => proyectar(p, radio))
                .sort((a, b) => b.z - a.z);

            for (const p of proyectados) {
                const frente = (1 - (p.z + 1) / 2);
                const alpha = 0.12 + frente * 0.55;
                const size = 0.7 + frente * 1.4;
                ctx!.fillStyle = isDark ? `rgba(191,219,254,${alpha.toFixed(3)})` : `rgba(30,58,138,${alpha.toFixed(3)})`;
                ctx!.beginPath();
                ctx!.arc(p.x, p.y, size, 0, Math.PI * 2);
                ctx!.fill();
            }

            // Módulos girando sobre los anillos.
            const ahora = performance.now() / 1000;
            for (const m of MODULOS) {
                const a = ANILLOS[m.anillo];
                const th = m.fase * Math.PI * 2 + (reducido ? 0 : ahora * 0.16);
                const base = { x: Math.cos(th) * a.r, y: 0, z: Math.sin(th) * a.r };
                const ci = Math.cos(a.incl), si = Math.sin(a.incl);
                const cg = Math.cos(a.giro), sg = Math.sin(a.giro);
                const y1 = base.y * ci - base.z * si;
                const z1 = base.y * si + base.z * ci;
                const x2 = base.x * cg + z1 * sg;
                const z2 = -base.x * sg + z1 * cg;
                const pr = proyectar({ x: x2, y: y1, z: z2 }, radio);

                const frente = 1 - (pr.z + 1) / 2;
                const alpha = 0.25 + frente * 0.75;

                const g = ctx!.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, 9);
                g.addColorStop(0, isDark ? `rgba(226,240,255,${alpha})` : `rgba(37,99,235,${alpha})`);
                g.addColorStop(1, 'rgba(147,197,253,0)');
                ctx!.fillStyle = g;
                ctx!.beginPath();
                ctx!.arc(pr.x, pr.y, 9, 0, Math.PI * 2);
                ctx!.fill();

                ctx!.fillStyle = isDark ? `rgba(255,255,255,${alpha})` : `rgba(15,23,42,${alpha})`;
                ctx!.beginPath();
                ctx!.arc(pr.x, pr.y, 2.4, 0, Math.PI * 2);
                ctx!.fill();

                // La etiqueta solo cuando el módulo está del lado de acá: leerla
                // "a través" del planeta se veía sucio.
                if (frente > 0.55) {
                    ctx!.font = '600 11px ui-sans-serif, system-ui, sans-serif';
                    ctx!.fillStyle = isDark ? `rgba(226,232,240,${(frente - 0.55) * 2.2})` : `rgba(15,23,42,${(frente - 0.55) * 2.2})`;
                    ctx!.textAlign = 'center';
                    ctx!.fillText(m.label.toUpperCase(), pr.x, pr.y - 14);
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
                bajada="Ventas, stock, pedidos, clientes y reportes no son cinco programas sueltos: son el mismo negocio mirado desde distintos lados."
            />

            <Reveal desde="escala" className="mt-12">
                <div
                    ref={contRef}
                    className="relative mx-auto w-full overflow-hidden rounded-2xl"
                    style={{
                        maxWidth: 760, height: 'min(460px, 74vw)', cursor: 'grab',
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
