// «Un día con Órbita» en el hero del home: un acceso discreto debajo de los dos botones
// principales («Crear tu espacio» / «Probá la demo») que abre el video en un modal.
//
// El video vive en Cloudflare R2 (bucket de producción, carpeta home/videos/), no en
// YouTube: carga rápido, sin marca ajena y con el reproductor nativo. Nada se descarga
// hasta que la persona lo abre (solo la portada, y recién al abrir el modal).
// Si el archivo no carga, el modal lo dice en vez de mostrar un reproductor roto.
//
// Guion y producción: docs/marketing/GUION-UN-DIA-CON-ORBITA.md y VIDEOS-MARKETING.md.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const R2 = 'https://pub-4c590787fd69461f8d464b91d826c1b4.r2.dev/home/videos';
export const VIDEO_UN_DIA = {
    src: `${R2}/un-dia-con-orbita.mp4`,
    portada: `${R2}/un-dia-con-orbita.jpg`,
    titulo: 'Un día con Órbita',
    duracion: '4 min',
};

function IconoPlay({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.29-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" />
        </svg>
    );
}

export function BotonVideoUnDia() {
    const [abierto, setAbierto] = useState(false);
    return (
        <>
            <style>{`
                .vud-btn { color: var(--oc-text-2, rgba(255,255,255,.78)); }
                .vud-btn:hover { color: var(--oc-text, #fff); }
                .vud-btn:hover .vud-circulo { background: var(--oc-ghost-hover, rgba(255,255,255,.16)); border-color: var(--oc-accent-bd, rgba(255,255,255,.42)); }
                .vud-btn:focus-visible { outline: 2px solid #93c5fd; outline-offset: 4px; border-radius: 999px; }
            `}</style>
            <button
                type="button"
                onClick={() => setAbierto(true)}
                className="vud-btn mt-6 inline-flex cursor-pointer items-center gap-3 rounded-full py-1 pl-1 pr-3 text-[14px] font-medium transition-colors duration-200"
                style={{ background: 'transparent', border: 'none' }}
                aria-haspopup="dialog"
            >
                <span
                    className="vud-circulo inline-flex items-center justify-center rounded-full transition-colors duration-200"
                    style={{ width: 36, height: 36, border: '1px solid var(--oc-ghost-bd, rgba(255,255,255,.26))', background: 'var(--oc-ghost-bg, rgba(255,255,255,.08))', color: 'var(--oc-text, #fff)', paddingLeft: 2 }}
                >
                    <IconoPlay />
                </span>
                <span>
                    Mirá cómo es un día con Órbita
                    <span style={{ color: 'var(--oc-text-4, rgba(255,255,255,.5))' }}> · {VIDEO_UN_DIA.duracion}</span>
                </span>
            </button>
            {abierto && <ModalVideo onCerrar={() => setAbierto(false)} />}
        </>
    );
}

function ModalVideo({ onCerrar }: { onCerrar: () => void }) {
    const [reproduciendo, setReproduciendo] = useState(false);
    const [error, setError] = useState(false);
    const [visible, setVisible] = useState(false);
    const cerrarRef = useRef<HTMLButtonElement>(null);
    const previo = useRef<Element | null>(null);

    const cerrar = useCallback(() => onCerrar(), [onCerrar]);

    useEffect(() => {
        previo.current = document.activeElement;
        const scroll = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        cerrarRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
        window.addEventListener('keydown', onKey);
        const raf = requestAnimationFrame(() => setVisible(true));
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = scroll;
            if (previo.current instanceof HTMLElement) previo.current.focus();
        };
    }, [cerrar]);

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={VIDEO_UN_DIA.titulo}
            onClick={cerrar}
            className="fixed inset-0 flex items-center justify-center px-4"
            style={{
                zIndex: 1000,
                background: 'rgba(2,6,23,.82)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                opacity: visible ? 1 : 0,
                transition: 'opacity 200ms ease',
            }}
        >
            <style>{`
                .vud-cerrar:hover { background: rgba(255,255,255,.18); }
                .vud-cerrar:focus-visible, .vud-portada:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
                .vud-portada:hover .vud-play { transform: scale(1.06); }
                @media (prefers-reduced-motion: reduce) { .vud-caja, .vud-play { transition: none !important; } }
            `}</style>
            <div
                className="vud-caja relative w-full"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: 1100,
                    transform: visible ? 'none' : 'translateY(12px) scale(.985)',
                    transition: 'transform 260ms cubic-bezier(.16,1,.3,1)',
                }}
            >
                <div className="mb-3 flex items-center justify-between gap-4">
                    <p className="text-[15px] font-semibold text-white">
                        {VIDEO_UN_DIA.titulo}
                        <span className="font-normal" style={{ color: 'rgba(255,255,255,.55)' }}> · {VIDEO_UN_DIA.duracion}</span>
                    </p>
                    <button
                        ref={cerrarRef}
                        type="button"
                        onClick={cerrar}
                        aria-label="Cerrar el video"
                        className="vud-cerrar inline-flex cursor-pointer items-center justify-center rounded-full transition-colors duration-200"
                        style={{ width: 40, height: 40, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', color: '#fff' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div
                    className="relative w-full overflow-hidden rounded-2xl"
                    style={{ aspectRatio: '16 / 9', background: '#060B1E', boxShadow: '0 30px 90px rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.08)' }}
                >
                    {error ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
                            <p className="text-[15px] font-semibold text-white">No pudimos cargar el video.</p>
                            <p className="text-[14px]" style={{ color: 'rgba(255,255,255,.6)' }}>Probá de nuevo en un rato, o entrá a la demo para recorrer Órbita por tu cuenta.</p>
                        </div>
                    ) : reproduciendo ? (
                        <video
                            src={VIDEO_UN_DIA.src}
                            poster={VIDEO_UN_DIA.portada}
                            controls
                            autoPlay
                            playsInline
                            preload="auto"
                            onError={() => setError(true)}
                            className="h-full w-full"
                            style={{ display: 'block', background: '#060B1E' }}
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setReproduciendo(true)}
                            className="vud-portada group relative block h-full w-full cursor-pointer"
                            aria-label={`Reproducir ${VIDEO_UN_DIA.titulo}`}
                            style={{ border: 'none', padding: 0, background: 'transparent' }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={VIDEO_UN_DIA.portada}
                                alt=""
                                onError={() => setError(true)}
                                className="h-full w-full object-cover"
                                style={{ display: 'block' }}
                            />
                            <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(2,6,23,0) 40%, rgba(2,6,23,.55) 100%)' }} />
                            <span
                                className="vud-play absolute left-1/2 top-1/2 inline-flex items-center justify-center rounded-full"
                                style={{
                                    width: 84, height: 84, marginLeft: -42, marginTop: -42, paddingLeft: 5,
                                    background: '#fff', color: '#0F172A', boxShadow: '0 12px 40px rgba(2,6,23,.45)',
                                    transition: 'transform 200ms ease',
                                }}
                            >
                                <IconoPlay size={30} />
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
