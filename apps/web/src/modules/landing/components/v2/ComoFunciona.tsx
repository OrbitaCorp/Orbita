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

const PASOS = [
    { n: '01', titulo: 'Elegís tu rubro', texto: 'Indumentaria, ferretería, pet shop, electrónica y más. El panel se arma según lo que vendés: talles y colores, número de serie, o venta por kilo y metro.' },
    { n: '02', titulo: 'Cargás tus productos', texto: 'Precios, fotos, stock y categorías por producto. Desde el mismo panel podés quitarle el fondo a las fotos, sin depender de otra herramienta.' },
    { n: '03', titulo: 'Compartís tu link', texto: 'Tu tienda queda publicada en tu subdominio de Órbita, o en tu propio dominio si ya tenés uno. La compartís en Instagram, WhatsApp o donde ya te escriben tus clientes.' },
    { n: '04', titulo: 'Cobrás y gestionás', texto: 'Los pedidos entran solos al panel, con su estado y el detalle de cada uno. Cobrás a tu manera, despachás y revisás tus reportes de ventas.' },
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
    const { ref, visible } = useVisible<HTMLDivElement>();

    return (
        <Seccion id="como-funciona">
            <Encabezado
                eyebrow="Cómo funciona"
                titulo="Tu tienda,"
                resalte="lista en tres pasos."
                bajada="Sin instalar nada, sin contratar a nadie y sin tener que entender de tecnología."
            />

            <style>{`
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
                    .oc-paso-punto { animation: none !important; opacity: 0 !important; }
                }
            `}</style>

            <div ref={ref} className="mt-16 grid grid-cols-1 gap-x-4 gap-y-12 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-4">
                {/* h-full en toda la cadena (columna → Reveal → interior → Card): si
                    alguno se queda sin altura completa, la tarjeta se encoge a su
                    contenido y las cuatro quedan desparejas. */}
                {PASOS.map((p, i) => (
                    <div key={p.n} className="relative h-full">
                        {/* La línea vertical cuelga de la columna y NO del Reveal: si
                            estuviera adentro heredaría el fade de la tarjeta y se
                            cargaría junto con ella en vez de después. */}
                        {i < PASOS.length - 1 && <ConectorVertical />}

                        <Reveal delay={i * 130} className="relative h-full">
                            {/* Tramo de la línea que sale de ESTE número hacia el
                                siguiente. Al colgar de cada paso, siempre arranca y
                                termina exactamente en el centro de los círculos, sin
                                importar cuántas columnas entren en la pantalla. */}
                            {i < PASOS.length - 1 && (
                                <span
                                    className="absolute hidden lg:block"
                                    style={{
                                        left: 'calc(50% + 28px)', width: 'calc(100% - 56px + 1rem)', top: 21, height: 1,
                                        backgroundImage: 'linear-gradient(90deg, var(--oc-linea) 0 6px, transparent 6px 13px)',
                                        backgroundSize: '13px 1px',
                                        transformOrigin: 'left center',
                                        transform: visible ? 'scaleX(1)' : 'scaleX(0)',
                                        transition: `transform 700ms cubic-bezier(.22,1,.36,1) ${340 + i * 170}ms`,
                                    }}
                                    aria-hidden="true"
                                />
                            )}

                            <div className="flex h-full flex-col items-center text-center">
                                <span
                                    className="grid h-[42px] w-[42px] place-items-center rounded-full text-[12.5px] font-black text-blue-200"
                                    style={{ background: 'var(--oc-panel)', border: '1px solid var(--oc-accent-bd)', boxShadow: '0 0 26px var(--oc-accent-soft)' }}
                                >
                                    {p.n}
                                </span>

                                <Card className="oc-card-hover mt-5 h-full w-full p-6 text-left">
                                    <h3 className="text-[16px] font-bold text-white">{p.titulo}</h3>
                                    <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">{p.texto}</p>
                                </Card>
                            </div>
                        </Reveal>
                    </div>
                ))}
            </div>
        </Seccion>
    );
}
