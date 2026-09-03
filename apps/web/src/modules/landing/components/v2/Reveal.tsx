// Animaciones de entrada por scroll para el home nuevo.
//
// IntersectionObserver puro, sin librería: el resto del proyecto ya resuelve así
// (ver PresentationSections.tsx del home viejo) y sumar framer-motion solo para
// esto serían ~50 kB de JS para lo que son cuatro líneas de CSS.
//
// Regla de oro acá: SIEMPRE se anima con transform + opacity (nunca width/height
// ni top/left), y todo se apaga con prefers-reduced-motion.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type Desde = 'abajo' | 'izquierda' | 'derecha' | 'escala';

const DESPLAZAMIENTO: Record<Desde, string> = {
    abajo: 'translate3d(0, 34px, 0)',
    izquierda: 'translate3d(-34px, 0, 0)',
    derecha: 'translate3d(34px, 0, 0)',
    escala: 'scale(.94)',
};

export function useVisible<T extends HTMLElement>(margen = '0px 0px -12% 0px') {
    const ref = useRef<T>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVisible(true); return; }

        const obs = new IntersectionObserver(
            entradas => entradas.forEach(e => {
                // Una sola vez: que las secciones vuelvan a desaparecer al subir
                // marea y hace que la página se sienta rota.
                if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
            }),
            { rootMargin: margen, threshold: 0.05 },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [margen]);

    return { ref, visible };
}

export function Reveal({
    children, desde = 'abajo', delay = 0, className, style,
}: {
    children: ReactNode;
    desde?: Desde;
    delay?: number;
    className?: string;
    style?: CSSProperties;
}) {
    const { ref, visible } = useVisible<HTMLDivElement>();

    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : DESPLAZAMIENTO[desde],
                transition: 'opacity 800ms cubic-bezier(.16,1,.3,1), transform 800ms cubic-bezier(.16,1,.3,1)',
                transitionDelay: `${delay}ms`,
                willChange: 'transform, opacity',
                ...style,
            }}
        >
            {children}
        </div>
    );
}

// ── Piezas de composición compartidas por todas las secciones ────────────────

export function Seccion({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
    return (
        <section id={id} className={`relative z-10 mx-auto w-full max-w-6xl px-6 py-24 sm:py-32 ${className}`}>
            {children}
        </section>
    );
}

export function Encabezado({
    eyebrow, titulo, resalte, bajada, centrado = true,
}: {
    eyebrow: string;
    titulo: string;
    resalte?: string;
    bajada?: string;
    centrado?: boolean;
}) {
    return (
        <Reveal className={centrado ? 'text-center' : ''}>
            <span className="inline-flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.22em] text-blue-300/70">
                <span aria-hidden="true" style={{ width: 18, height: 1, background: 'rgba(147,197,253,.5)' }} />
                {eyebrow}
            </span>
            <h2
                className="mt-4 font-black tracking-[-0.035em] text-white"
                style={{ fontSize: 'clamp(28px, 4.6vw, 52px)', lineHeight: 1.04 }}
            >
                {titulo}{resalte && <> <span style={{ color: '#7c869b' }}>{resalte}</span></>}
            </h2>
            {bajada && (
                <p className={`mt-5 text-[15px] leading-relaxed text-slate-400 sm:text-base ${centrado ? 'mx-auto max-w-[620px]' : 'max-w-[620px]'}`}>
                    {bajada}
                </p>
            )}
        </Reveal>
    );
}

/** Tarjeta base del tema: vidrio muy oscuro, borde tenue, realce azul al hover. */
export function Card({
    children, className = '', destacada = false, style,
}: {
    children: ReactNode;
    className?: string;
    destacada?: boolean;
    style?: CSSProperties;
}) {
    return (
        <div
            className={`oc-card rounded-2xl ${className}`}
            style={{
                background: destacada ? 'rgba(30,58,138,.16)' : 'rgba(255,255,255,.028)',
                border: `1px solid ${destacada ? 'rgba(147,197,253,.36)' : 'rgba(255,255,255,.075)'}`,
                // Sin backdrop-filter a propósito: hay ~20 tarjetas de estas en la
                // página y cada blur de fondo obliga al navegador a re-muestrear lo
                // que hay detrás. Con el fondo casi opaco no se nota la diferencia,
                // y sí se nota el costo.
                boxShadow: destacada ? '0 0 60px rgba(59,130,246,.16)' : 'none',
                transition: 'border-color 220ms ease, background-color 220ms ease',
                ...style,
            }}
        >
            {children}
        </div>
    );
}
