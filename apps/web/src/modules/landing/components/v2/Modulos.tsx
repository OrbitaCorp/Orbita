// "Qué incluye" — mostrado, no explicado (pedido del dueño, 18/11: «el home es todo texto, reemplazar la parte
// teórica por la práctica»).
//
// Una VITRINA: a un lado, las funciones (título + una línea); al otro, un clip corto y sin voz de esa función
// funcionando de verdad en la demo (ClipLoop.tsx). Los clips pasan solos uno detrás del otro y también se eligen
// con un clic. Lo que no tiene clip va abajo como una fila de chips, sin párrafos.
//
// El contenido sale del producto, no de imaginar features. Si algo de acá deja de existir, hay que sacarlo.
// Turnos y agenda NO van (el módulo todavía no existe; ver Rubros → «Próximamente»).

import { useCallback, useState, type ReactNode } from 'react';
import { Reveal, Seccion, Encabezado } from './Reveal';
import { ClipVideo, ModalClip, Pantalla } from './ClipLoop';

interface Funcion { clip: string; titulo: string; texto: string; nota?: string; icon: ReactNode }

const FUNCIONES: Funcion[] = [
    {
        clip: 'pedido', titulo: 'Pedidos de punta a punta', texto: 'Del pago a la entrega, con el seguimiento del envío.',
        icon: <><path d="M3 3h2l2.4 12.6a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 7H6" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></>,
    },
    {
        clip: 'cobros-h', titulo: 'Cobrás a tu manera', texto: 'Mercado Pago, efectivo, o lo coordinás por WhatsApp.',
        icon: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
    },
    {
        clip: 'orbi-foto', titulo: 'Orbi carga el producto', texto: 'Subís una foto y completa nombre, categoría y descripción.', nota: 'Con el paquete Avanzado',
        icon: <><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2M20 14h2M15 13v2M9 13v2" /></>,
    },
    {
        clip: 'whatsapp', titulo: 'Tus mensajes, en el panel', texto: 'WhatsApp con tu número y respuestas guardadas.',
        icon: <><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z" /></>,
    },
    {
        clip: 'descuentos', titulo: 'Descuentos que se aplican solos', texto: '2x1, 3x2, por categoría, y hasta por día y horario.',
        icon: <><path d="m19 5-14 14" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
    },
    {
        clip: 'inicio', titulo: 'Tus números de un vistazo', texto: 'Ventas, pedidos, visitas y lo que hay que resolver hoy.',
        icon: <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" /></>,
    },
];

const TAMBIEN = ['Tu dominio propio', 'Stock por variante', 'Equipo con permisos', 'Reportes', 'Fotos sin fondo', 'Orbi, tu asistente', 'Clientes y emails'];

function Icono({ children, activa }: { children: ReactNode; activa: boolean }) {
    return (
        <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-200"
            style={{ background: activa ? 'var(--oc-accent-soft)' : 'var(--oc-ghost-bg)', border: `1px solid ${activa ? 'var(--oc-accent-bd)' : 'var(--oc-card-bd)'}` }}
        >
            <svg viewBox="0 0 24 24" fill="none" stroke={activa ? 'var(--oc-accent)' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }} aria-hidden="true">
                {children}
            </svg>
        </span>
    );
}

export function Modulos() {
    const [activa, setActiva] = useState(0);
    const [avance, setAvance] = useState(0);
    const [ampliado, setAmpliado] = useState(false);
    const f = FUNCIONES[activa];
    const siguiente = useCallback(() => { setAvance(0); setActiva(a => (a + 1) % FUNCIONES.length) }, []);
    const elegir = (i: number) => { setAvance(0); setActiva(i) };

    return (
        <Seccion id="modulos">
            <Encabezado
                eyebrow="Qué incluye"
                titulo="Todo tu negocio,"
                resalte="en un solo panel."
                bajada="Mirá cómo se usa: son pantallas reales de una tienda de prueba."
            />

            <style>{`
                .vit-item { color: var(--oc-text-2); }
                .vit-item:hover { background: var(--oc-ghost-hover, rgba(255,255,255,.04)); }
                .vit-item:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
                .vit-tabs::-webkit-scrollbar { display: none; }
                @media (prefers-reduced-motion: reduce) { .vit-pantalla { transition: none !important; } }
            `}</style>

            <Reveal>
                {/* Celular: pestañas deslizables arriba del clip */}
                <div className="vit-tabs -mx-6 mt-10 flex gap-2 overflow-x-auto px-6 pb-1 lg:hidden" role="tablist" aria-label="Funciones de Órbita" style={{ scrollbarWidth: 'none' }}>
                    {FUNCIONES.map((x, i) => (
                        <button
                            key={x.clip} type="button" role="tab" aria-selected={i === activa} onClick={() => elegir(i)}
                            className="shrink-0 cursor-pointer whitespace-nowrap rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors duration-200"
                            style={{ minHeight: 44, border: `1px solid ${i === activa ? 'var(--oc-accent-bd)' : 'var(--oc-card-bd)'}`, background: i === activa ? 'var(--oc-accent-soft)' : 'var(--oc-panel)', color: i === activa ? 'var(--oc-text)' : 'var(--oc-text-2)' }}
                        >
                            {x.titulo}
                        </button>
                    ))}
                </div>

                <div className="mt-6 grid grid-cols-1 items-center gap-8 lg:mt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-12">
                    {/* Escritorio: la lista de funciones, con la barrita de avance del clip */}
                    <ul className="hidden space-y-1.5 lg:block" role="tablist" aria-label="Funciones de Órbita">
                        {FUNCIONES.map((x, i) => {
                            const on = i === activa;
                            return (
                                <li key={x.clip}>
                                    <button
                                        type="button" role="tab" aria-selected={on} onClick={() => elegir(i)}
                                        className="vit-item relative flex w-full cursor-pointer items-start gap-3.5 overflow-hidden rounded-xl px-4 py-3.5 text-left transition-colors duration-200"
                                        style={{ border: `1px solid ${on ? 'var(--oc-card-alt-bd, var(--oc-accent-bd))' : 'transparent'}`, background: on ? 'var(--oc-card-bg)' : 'transparent' }}
                                    >
                                        <Icono activa={on}>{x.icon}</Icono>
                                        <span className="min-w-0">
                                            <span className="block text-[15px] font-bold" style={{ color: on ? 'var(--oc-text)' : 'var(--oc-text-2)' }}>{x.titulo}</span>
                                            <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: 'var(--oc-text-3)' }}>
                                                {x.texto}{x.nota && <span style={{ color: 'var(--oc-text-4)' }}> · {x.nota}</span>}
                                            </span>
                                        </span>
                                        {on && (
                                            <span aria-hidden="true" className="absolute bottom-0 left-0 h-[2px]" style={{ width: `${Math.round(avance * 1000) / 10}%`, background: 'var(--oc-accent)' }} />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {/* El clip de la función elegida */}
                    <div className="vit-pantalla" role="tabpanel" aria-label={f.titulo}>
                        {/* Los 6 clips quedan montados y precargados, uno encima del otro: al tocar una función, la suya
                            ya está lista y arranca de cero al instante (solo se ve y corre la activa). */}
                        <Pantalla onAmpliar={() => setAmpliado(true)} etiqueta={f.titulo}>
                            {FUNCIONES.map((x, i) => (
                                <div key={x.clip} className="absolute inset-0 transition-opacity duration-300" style={{ opacity: i === activa ? 1 : 0 }} aria-hidden={i !== activa}>
                                    <ClipVideo nombre={x.clip} activo={i === activa} loop={false} onFin={siguiente} onAvance={setAvance} etiqueta={`${x.titulo}: ${x.texto}`} />
                                </div>
                            ))}
                        </Pantalla>
                        {/* Celular: la línea de la función, debajo del clip */}
                        <p className="mt-4 text-center text-[14px] lg:hidden" style={{ color: 'var(--oc-text-2)' }}>
                            {f.texto}{f.nota && <span style={{ color: 'var(--oc-text-4)' }}> · {f.nota}</span>}
                        </p>
                    </div>
                </div>

                <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
                    <span className="mr-1 text-[12.5px] font-semibold" style={{ color: 'var(--oc-text-4)' }}>Y además:</span>
                    {TAMBIEN.map(t => (
                        <span key={t} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium" style={{ border: '1px solid var(--oc-card-bd)', background: 'var(--oc-panel)', color: 'var(--oc-text-2)' }}>
                            {t}
                        </span>
                    ))}
                </div>
            </Reveal>
            {ampliado && <ModalClip nombre={f.clip} titulo={f.titulo} onCerrar={() => setAmpliado(false)} />}
        </Seccion>
    );
}
