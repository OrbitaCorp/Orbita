// Paquete "Avanzado" — desde el rediseño "Base"/"Base + Avanzado" (RBT, 2026-09) se cobra JUNTO con la suscripción,
// un solo cargo combinado (ver Cierre.tsx#Precios y subscriptions.service.ts) — ya no es un add-on aparte.
//
// MOSTRADO, no explicado (pedido del dueño, 18/11): UN solo video que recorre el paquete (grabado en la demo, sin voz)
// y al lado la lista de lo que se ve; la función que está en pantalla se resalta sola y con un clic se salta a esa
// parte. Mismo lenguaje que la vitrina de «Qué incluye». Los tiempos de cada parte salen del montaje
// (~/orbita-videos/un-dia/home/web/avanzado-capitulos.json): si se rehace el video, actualizarlos.
//
// Todo lo de acá existe de verdad (panel/avanzado/Avanzado.tsx). La «Oferta relámpago» es un tipo más de Descuentos,
// con el reloj en la tienda. El «Aviso de salida» (exit-intent) se eliminó del producto el 2026-09-09: no se promete.

import { useRef, useState, type ReactNode } from 'react';
import { Reveal, Seccion, Encabezado } from './Reveal';
import { ClipVideo, ModalClip, Pantalla } from './ClipLoop';

interface Parte { titulo: string; texto: string; desde: number; icon: ReactNode }

const PARTES: Parte[] = [
    { titulo: 'Plantillas de portada', texto: 'Dieciséis diseños para la portada de tu tienda.', desde: 0,
      icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></> },
    { titulo: 'Juegos con premio', texto: 'Tu cliente juega, gana un descuento y el cupón se crea solo.', desde: 6.0,
      icon: <><path d="M6 11h4M8 9v4M15 12h.01M18 10h.01" /><rect x="2" y="6" width="20" height="12" rx="4" /></> },
    { titulo: 'Anuncios en la tienda', texto: 'Promos y bienvenidas, en el momento justo.', desde: 12.0,
      icon: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></> },
    { titulo: 'Oferta relámpago', texto: 'Un reloj en tu portada que cuenta lo que falta.', desde: 18.0,
      icon: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2" /><path d="M9 3h6" /></> },
    { titulo: 'Orbi atiende tu WhatsApp', texto: 'Contesta, muestra productos y toma pedidos. También en Instagram.', desde: 24.0,
      icon: <><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z" /></> },
    { titulo: 'Carga con Orbi e importación Excel', texto: 'Subís una foto y Orbi completa todo, o importás tu Excel con fotos sugeridas.', desde: 30.0,
      icon: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></> },
];
const DURACION = 36.0;
const ADEMAS = ['2x1 y 3x2 sin código', 'Prueba social con pedidos reales', 'Fondo de fotos con IA'];

export function Avanzado() {
    const video = useRef<HTMLVideoElement | null>(null);
    const [t, setT] = useState(0);
    const [ampliado, setAmpliado] = useState(false);
    let activa = 0;
    PARTES.forEach((p, i) => { if (t >= p.desde - .05) activa = i });
    const ir = (i: number) => { const v = video.current; if (!v) return; v.currentTime = PARTES[i].desde + .05; v.play().catch(() => {}); setT(PARTES[i].desde + .05) };

    return (
        <Seccion id="avanzado">
            <Encabezado
                eyebrow="Paquete avanzado"
                titulo="Para cuando quieras"
                resalte="el siguiente nivel."
                bajada="Un paquete opcional con las herramientas que empujan la conversión. Así se ve en tu tienda y en tu panel:"
            />
            <style>{`
                .av-item:hover { background: var(--oc-ghost-hover, rgba(255,255,255,.04)); }
                .av-item:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
            `}</style>

            <Reveal>
                <div className="mt-12 grid grid-cols-1 items-center gap-8 lg:mt-14 lg:grid-cols-[minmax(0,8fr)_minmax(0,5fr)] lg:gap-12">
                    <Pantalla aspecto="16 / 9" onAmpliar={() => setAmpliado(true)} etiqueta="Paquete Avanzado">
                        <ClipVideo nombre="avanzado" videoRef={video} onAvance={(u) => setT(u * DURACION)} etiqueta="El paquete Avanzado: plantillas, juegos con premio, anuncios, oferta relámpago, Orbi en WhatsApp y carga con foto o Excel" />
                    </Pantalla>

                    <ul className="space-y-1" aria-label="Lo que incluye el paquete Avanzado">
                        {PARTES.map((p, i) => {
                            const on = i === activa;
                            const fin = PARTES[i + 1]?.desde ?? DURACION;
                            const u = on ? Math.min(1, Math.max(0, (t - p.desde) / (fin - p.desde))) : 0;
                            return (
                                <li key={p.titulo}>
                                    <button
                                        type="button" onClick={() => ir(i)} aria-current={on ? 'true' : undefined}
                                        className="av-item relative flex w-full cursor-pointer items-start gap-3.5 overflow-hidden rounded-xl px-4 py-2.5 text-left transition-colors duration-200"
                                        style={{ border: `1px solid ${on ? 'var(--oc-card-alt-bd, var(--oc-accent-bd))' : 'transparent'}`, background: on ? 'var(--oc-card-bg)' : 'transparent' }}
                                    >
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-200"
                                            style={{ background: on ? 'var(--oc-accent-soft)' : 'var(--oc-ghost-bg)', border: `1px solid ${on ? 'var(--oc-accent-bd)' : 'var(--oc-card-bd)'}` }}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--oc-accent)' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }} aria-hidden="true">{p.icon}</svg>
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-[15px] font-bold" style={{ color: on ? 'var(--oc-text)' : 'var(--oc-text-2)' }}>{p.titulo}</span>
                                            <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: 'var(--oc-text-3)' }}>{p.texto}</span>
                                        </span>
                                        {on && <span aria-hidden="true" className="absolute bottom-0 left-0 h-[2px]" style={{ width: `${Math.round(u * 1000) / 10}%`, background: 'var(--oc-accent)' }} />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                    <span className="mr-1 text-[12.5px] font-semibold" style={{ color: 'var(--oc-text-4)' }}>Y también:</span>
                    {ADEMAS.map(x => (
                        <span key={x} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium" style={{ border: '1px solid var(--oc-card-bd)', background: 'var(--oc-panel)', color: 'var(--oc-text-2)' }}>{x}</span>
                    ))}
                </div>
            </Reveal>
            {ampliado && <ModalClip nombre="avanzado" titulo="Paquete Avanzado" onCerrar={() => setAmpliado(false)} />}
        </Seccion>
    );
}
