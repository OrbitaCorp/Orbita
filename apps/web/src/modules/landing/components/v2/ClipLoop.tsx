// Clips cortos SIN VOZ del home: Órbita funcionando de verdad (tomas reales de la demo), en vez de explicarla con texto.
//
// - Viven en Cloudflare R2 (bucket de producción, carpeta home/clips/): <nombre>.mp4 (30 fps, sin audio, ~1 MB) y
//   <nombre>.jpg (portada). Se generan en ~/orbita-videos/un-dia (clips-home.mjs + render-clips.sh).
// - No se descarga nada hasta que el clip entra en pantalla (preload="none" + src recién al verse).
// - Con «reducir movimiento» no arrancan solos: se ve la portada con un botón de play.
// - Se muestran en una «Pantalla» limpia (sin marcos de navegador ni de dispositivo) con «Ampliar» → ModalClip.

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const R2 = 'https://pub-4c590787fd69461f8d464b91d826c1b4.r2.dev/home/clips';
// ?v=: subirlo cuando se rehacen los clips con el mismo nombre (R2 los sirve con caché)
const V = 2
export const clipSrc = (n: string) => ({ video: `${R2}/${n}.mp4?v=${V}`, portada: `${R2}/${n}.jpg?v=${V}` });

// «Reducir movimiento» del sistema, sin setState dentro de un efecto (regla react-hooks/set-state-in-effect).
const MQ = '(prefers-reduced-motion: reduce)'
function useMovimientoReducido() {
    return useSyncExternalStore(
        (avisar) => { const m = window.matchMedia(MQ); m.addEventListener('change', avisar); return () => m.removeEventListener('change', avisar) },
        () => window.matchMedia(MQ).matches,
        () => false,
    );
}

/**
 * Video del clip. `loop` lo repite; sin loop avisa con `onFin` (la vitrina pasa a la siguiente función) y
 * reporta el avance (0–1) con `onAvance` para la barrita.
 */
export function ClipVideo({ nombre, loop = true, onFin, onAvance, etiqueta, ajuste = 'cover', videoRef }: {
    nombre: string; loop?: boolean; onFin?: () => void; onAvance?: (u: number) => void; etiqueta: string;
    ajuste?: 'cover' | 'contain'; videoRef?: { current: HTMLVideoElement | null };
}) {
    const propio = useRef<HTMLVideoElement>(null);
    const ref = videoRef ?? propio;
    const [enPantalla, setEnPantalla] = useState(false);
    const [visto, setVisto] = useState(false);
    const [error, setError] = useState(false);
    const [quieto, setQuieto] = useState(false);
    const reducido = useMovimientoReducido();
    const { video, portada } = clipSrc(nombre);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(([e]) => { setEnPantalla(e.isIntersecting); if (e.isIntersecting) setVisto(true) }, { rootMargin: '500px 0px' });
        io.observe(el);
        return () => io.disconnect();
    }, [ref]);

    // Reproduce solo mientras se ve (y si no pidieron menos movimiento); al cambiar de clip arranca de cero.
    useEffect(() => {
        const el = ref.current;
        if (!el || error) return;
        if (enPantalla && visto && !reducido) { el.play().catch(() => setQuieto(true)) } else el.pause();
    }, [enPantalla, visto, reducido, nombre, error, ref]);

    useEffect(() => {
        const el = ref.current;
        if (!el || !onAvance) return;
        let raf = 0;
        const tick = () => { if (el.duration) onAvance(el.currentTime / el.duration); raf = requestAnimationFrame(tick) };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [onAvance, nombre, ref]);

    if (error) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={portada} alt={etiqueta} className="block h-full w-full object-cover" />;
    }
    return (
        <div className="relative h-full w-full">
            <video
                ref={ref}
                key={nombre}
                src={visto ? video : undefined}
                poster={portada}
                muted
                playsInline
                loop={loop}
                preload="none"
                aria-label={etiqueta}
                onEnded={onFin}
                onError={() => setError(true)}
                className={`block h-full w-full ${ajuste === 'contain' ? 'object-contain' : 'object-cover'}`}
                style={{ background: ajuste === 'contain' ? '#060B1E' : '#fff' }}
            />
            {(reducido || quieto) && (
                <button
                    type="button"
                    onClick={() => { setQuieto(false); ref.current?.play().catch(() => {}) }}
                    aria-label={`Reproducir: ${etiqueta}`}
                    className="absolute inset-0 grid cursor-pointer place-items-center"
                    style={{ background: 'rgba(2,6,23,.18)', border: 'none' }}
                >
                    <span className="grid place-items-center rounded-full" style={{ width: 64, height: 64, background: '#fff', color: '#0F172A', paddingLeft: 4, boxShadow: '0 10px 30px rgba(2,6,23,.35)' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.29-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" /></svg>
                    </span>
                </button>
            )}
        </div>
    );
}

const IconoAmpliar = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
);

/**
 * Pantalla limpia para un clip: un rectángulo redondeado, sin barras ni controles de reproductor (que no parezca
 * «un video»), con un botón chico de «Ampliar» que abre el clip grande en un modal.
 */
export function Pantalla({ children, aspecto = '16 / 10', onAmpliar, etiqueta }: { children: ReactNode; aspecto?: string; onAmpliar?: () => void; etiqueta?: string }) {
    return (
        <div
            className="pantalla group relative overflow-hidden"
            style={{ aspectRatio: aspecto, borderRadius: 18, border: '1px solid var(--oc-card-bd)', background: '#fff', boxShadow: '0 30px 80px rgba(2,6,23,.38), 0 2px 0 rgba(255,255,255,.04) inset' }}
        >
            <style>{`
                .pantalla-ampliar { opacity: 0; transform: translateY(-4px); transition: opacity 180ms ease, transform 180ms ease, background 180ms ease; }
                .pantalla:hover .pantalla-ampliar, .pantalla-ampliar:focus-visible { opacity: 1; transform: none; }
                .pantalla-ampliar:hover { background: rgba(15,23,42,.86) !important; }
                .pantalla-ampliar:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
                @media (hover: none) { .pantalla-ampliar { opacity: 1; transform: none; } }
            `}</style>
            {children}
            {onAmpliar && (
                <button
                    type="button" onClick={onAmpliar} aria-label={`Ver en grande${etiqueta ? ': ' + etiqueta : ''}`}
                    className="pantalla-ampliar absolute right-3 top-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-white"
                    style={{ height: 34, background: 'rgba(15,23,42,.66)', border: '1px solid rgba(255,255,255,.18)', backdropFilter: 'blur(6px)' }}
                >
                    <IconoAmpliar /> Ampliar
                </button>
            )}
        </div>
    );
}

/** El clip (o el video completo) en grande, con controles. Esc / clic afuera / ✕ cierran. */
export function ModalClip({ nombre, titulo, onCerrar }: { nombre: string; titulo: string; onCerrar: () => void }) {
    const { video, portada } = clipSrc(nombre);
    const cerrarRef = useRef<HTMLButtonElement>(null);
    // onCerrar en una ref: el padre se vuelve a dibujar seguido (la barrita de avance) y el efecto no debe repetirse
    const alCerrar = useRef(onCerrar);
    useEffect(() => { alCerrar.current = onCerrar });
    useEffect(() => {
        const previo = document.activeElement;
        const scroll = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        cerrarRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') alCerrar.current(); };
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = scroll; if (previo instanceof HTMLElement) previo.focus(); };
    }, []);
    return createPortal(
        <div role="dialog" aria-modal="true" aria-label={titulo} onClick={onCerrar} className="fixed inset-0 flex items-center justify-center px-4"
            style={{ zIndex: 1000, background: 'rgba(2,6,23,.84)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
            <div className="w-full" style={{ maxWidth: 1180 }} onClick={(e) => e.stopPropagation()}>
                <div className="mb-3 flex items-center justify-between gap-4">
                    <p className="text-[15px] font-semibold text-white">{titulo}</p>
                    <button ref={cerrarRef} type="button" onClick={onCerrar} aria-label="Cerrar"
                        className="inline-flex cursor-pointer items-center justify-center rounded-full text-white"
                        style={{ width: 40, height: 40, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                </div>
                <video src={video} poster={portada} controls autoPlay muted playsInline className="block w-full rounded-2xl"
                    style={{ background: '#060B1E', maxHeight: '80vh', boxShadow: '0 30px 90px rgba(0,0,0,.55)' }} />
            </div>
        </div>,
        document.body,
    );
}
