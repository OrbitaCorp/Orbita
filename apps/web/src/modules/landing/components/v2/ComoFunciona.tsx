// "Cómo funciona" — los cuatro pasos reales del onboarding.
//
// Los números viven AFUERA de las tarjetas, en su propia fila, y la línea
// punteada los cruza a la altura de su centro. Antes la línea era un <svg> con
// una curva encima de las tarjetas y no coincidía con ningún punto: quedaba
// flotando en diagonal y se notaba enseguida que no conectaba nada.
//
// En celular las tarjetas se apilan, así que la línea también se apila: cada
// paso baja un tramo vertical hasta el número del siguiente, y ese tramo "se
// carga" antes de que aparezca la próxima tarjeta. Punteado = lo que falta,
// sólido = lo recorrido, más un punto de luz que viaja hasta el paso que sigue.
//
// El tramo vertical se dibuja SOLO con una columna. Apenas entran dos (sm), el
// paso 01 ya no tiene abajo al 02 sino al 03, y la línea estaría uniendo pasos
// que no van uno detrás del otro.

import { Reveal, Seccion, Encabezado, Card, useVisible } from './Reveal';
import { useState } from 'react';
import { ClipVideo, ModalClip } from './ClipLoop';

// Cada paso se MUESTRA con su clip (tomas reales: el alta, el alta de un producto con Orbi, la tienda en el
// computadora y un pedido que entra, de punta a punta) y una sola línea de texto. Clic → el video completo en grande (pedido del dueño, 18/11: menos teoría, más práctica).
const PASOS = [
    { n: '01', clip: 'paso-rubro', titulo: 'Elegís tu rubro', texto: 'El panel se arma según lo que vendés: talles y colores, número de serie, kilo o metro.' },
    { n: '02', clip: 'paso-producto', titulo: 'Cargás tus productos', texto: 'Fotos, precio y stock. Con el paquete Avanzado, Orbi completa la ficha con una foto.' },
    { n: '03', clip: 'paso-tienda', titulo: 'Compartís tu link', texto: 'Tu tienda queda lista en tu link de Órbita o en tu propio dominio.' },
    { n: '04', clip: 'paso-pedido', titulo: 'Cobrás y gestionás', texto: 'Los pedidos entran solos al panel y los despachás desde ahí.' },
];

/** Alto del tramo vertical entre dos pasos, en px. El hueco de la grilla en
 *  celular (gap-y-12 = 48px) le deja 5px de aire arriba y abajo, así la línea
 *  no queda pegada ni al borde de la tarjeta ni al círculo del número. */
const TRAMO = 38;

/** Un tramo de línea que baja del paso actual al siguiente, con su propio
 *  observador: se carga cuando ESE tramo entra en pantalla, no cuando entra la
 *  sección entera. Es lo que hace que en celular la cosa vaya paso por paso en
 *  vez de dispararse todo junto al llegar a la primera tarjeta. */
function ConectorVertical() {
    // Margen inferior POSITIVO (las tarjetas usan -12%): el tramo se dispara
    // ~22vh de scroll antes que la tarjeta de abajo, que es lo que deja lugar a
    // que la línea se cargue y recién después aparezca el paso siguiente. Con el
    // margen por defecto los dos entraban casi juntos y se pisaban.
    const { ref, visible } = useVisible<HTMLSpanElement>('0px 0px 10% 0px');

    return (
        <span
            ref={ref}
            aria-hidden="true"
            className="absolute left-1/2 sm:hidden"
            style={{ top: 'calc(100% + 5px)', height: TRAMO, width: 1, marginLeft: -0.5 }}
        >
            {/* Lo que falta: el mismo punteado que conecta los pasos en escritorio. */}
            <span
                className="oc-paso-linea"
                style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'linear-gradient(180deg, var(--oc-linea) 0 5px, transparent 5px 11px)',
                    backgroundSize: '1px 11px',
                    opacity: visible ? 0.5 : 0,
                    transition: 'opacity 320ms ease',
                }}
            />
            {/* Lo recorrido: sólido, crece de arriba hacia abajo tapando el punteado.
                Se anima con scaleY y no con height a propósito (misma regla que
                Reveal). Sólido y no punteado justamente porque al escalar, un
                punteado estira sus puntos y se ve el achatado durante el viaje. */}
            <span
                className="oc-paso-linea"
                style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, var(--oc-accent-bd), var(--oc-accent))',
                    transformOrigin: 'top center',
                    transform: visible ? 'scaleY(1)' : 'scaleY(0)',
                    transition: 'transform 620ms cubic-bezier(.65,0,.35,1) 160ms',
                }}
            />
            {/* El punto de luz que baja hasta el paso siguiente. Se monta recién
                cuando el tramo es visible: así la animación arranca sola una vez
                y no hace falta prenderla y apagarla a mano. */}
            {visible && <span className="oc-paso-punto" />}
        </span>
    );
}

export function ComoFunciona() {
    const { ref } = useVisible<HTMLDivElement>();
    const [abierto, setAbierto] = useState<number | null>(null);

    return (
        <Seccion id="como-funciona">
            <Encabezado
                eyebrow="Cómo funciona"
                titulo="Tu tienda,"
                resalte="lista en cuatro pasos."
                bajada="Sin instalar nada, sin contratar a nadie y sin tener que entender de tecnología."
            />

            <style>{`
                .paso-ver { opacity: .0; transform: translateY(4px); transition: opacity 180ms ease, transform 180ms ease; }
                .paso-video:hover .paso-ver, .paso-video:focus-visible .paso-ver { opacity: 1; transform: none; }
                .paso-video:focus-visible { outline: 2px solid #93c5fd; outline-offset: -2px; }
                @media (hover: none) { .paso-ver { opacity: 1; transform: none; } }
                .oc-paso-punto {
                    position: absolute; top: 0; left: 50%;
                    width: 5px; height: 5px; border-radius: 999px;
                    background: var(--oc-accent-fuerte);
                    box-shadow: 0 0 9px var(--oc-accent);
                    animation: ocPasoBaja 620ms cubic-bezier(.65,0,.35,1) 160ms both,
                               ocPasoLuz 620ms linear 160ms both;
                }
                /* Mismo tiempo y misma curva que el tramo sólido: el punto va
                   siempre en la punta de lo que se está cargando. */
                @keyframes ocPasoBaja {
                    from { transform: translate(-50%, -2px); }
                    to   { transform: translate(-50%, ${TRAMO - 2}px); }
                }
                @keyframes ocPasoLuz { 0%, 100% { opacity: 0; } 18%, 74% { opacity: 1; } }

                @media (prefers-reduced-motion: reduce) {
                    .oc-paso-linea { transition: none !important; }
                    .paso-ver { opacity: .0; transform: translateY(4px); transition: opacity 180ms ease, transform 180ms ease; }
                .paso-video:hover .paso-ver, .paso-video:focus-visible .paso-ver { opacity: 1; transform: none; }
                .paso-video:focus-visible { outline: 2px solid #93c5fd; outline-offset: -2px; }
                @media (hover: none) { .paso-ver { opacity: 1; transform: none; } }
                .oc-paso-punto { animation: none !important; opacity: 0 !important; }
                }
            `}</style>

            <div ref={ref} className="mt-14 grid grid-cols-1 gap-x-5 gap-y-12 sm:gap-y-6 md:grid-cols-2">
                {/* En celular van en una columna y la línea punteada baja de un paso al siguiente
                    (ConectorVertical); desde md, grilla de 2×2 con el clip grande en cada tarjeta. */}
                {PASOS.map((p, i) => (
                    <div key={p.n} className="relative h-full">
                        {i < PASOS.length - 1 && <ConectorVertical />}
                        <Reveal delay={i * 120} className="relative h-full">
                            <Card className="oc-card-hover flex h-full w-full flex-col overflow-hidden p-0 text-left">
                                {/* El video del paso, rectangular; clic → completo y en grande */}
                                <button
                                    type="button" onClick={() => setAbierto(i)} aria-label={`Ver completo: ${p.titulo}`}
                                    className="paso-video relative block w-full cursor-pointer overflow-hidden"
                                    style={{ aspectRatio: '16 / 10', background: '#fff', border: 'none', padding: 0, borderBottom: '1px solid var(--oc-card-bd)' }}
                                >
                                    <ClipVideo nombre={p.clip} etiqueta={`${p.titulo}: ${p.texto}`} />
                                    <span className="paso-ver absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-white"
                                        style={{ height: 32, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(255,255,255,.18)', backdropFilter: 'blur(6px)' }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.29-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" /></svg>
                                        Ver completo
                                    </span>
                                </button>
                                <div className="flex items-start gap-4 p-5 sm:p-6">
                                    <span
                                        className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-[12px] font-black text-blue-200"
                                        style={{ background: 'var(--oc-panel)', border: '1px solid var(--oc-accent-bd)', boxShadow: '0 0 22px var(--oc-accent-soft)' }}
                                    >
                                        {p.n}
                                    </span>
                                    <span>
                                        <h3 className="text-[16px] font-bold text-white">{p.titulo}</h3>
                                        <p className="mt-1 text-[13.5px] leading-relaxed text-slate-400">{p.texto}</p>
                                    </span>
                                </div>
                            </Card>
                        </Reveal>
                    </div>
                ))}
            </div>
            {abierto !== null && <ModalClip nombre={PASOS[abierto].clip} titulo={`${PASOS[abierto].n} · ${PASOS[abierto].titulo}`} onCerrar={() => setAbierto(null)} />}
        </Seccion>
    );
}
