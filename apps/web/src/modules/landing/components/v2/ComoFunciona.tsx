// "Cómo funciona" — los cuatro pasos reales del onboarding.
//
// Los números viven AFUERA de las tarjetas, en su propia fila, y la línea
// punteada los cruza a la altura de su centro. Antes la línea era un <svg> con
// una curva encima de las tarjetas y no coincidía con ningún punto: quedaba
// flotando en diagonal y se notaba enseguida que no conectaba nada.

import { Reveal, Seccion, Encabezado, Card, useVisible } from './Reveal';

const PASOS = [
    { n: '01', titulo: 'Elegís tu rubro', texto: 'Indumentaria, ferretería, pet shop, electrónica. El panel se arma según lo que vendés: talles y colores, número de serie, o venta por kilo y metro.' },
    { n: '02', titulo: 'Cargás tus productos', texto: 'Precios, fotos, stock y categorías. Podés sacarle el fondo a las fotos ahí mismo, y arrancar con lo mínimo si querés publicar hoy.' },
    { n: '03', titulo: 'Compartís tu link', texto: 'Tu tienda queda publicada en tu propio subdominio. La pegás en Instagram, en WhatsApp o donde ya te escriben tus clientes.' },
    { n: '04', titulo: 'Cobrás y gestionás', texto: 'Los pedidos entran solos al panel, con su estado y su comprobante. Cobrás con tu Mercado Pago, despachás y ves cómo viene el mes.' },
];

export function ComoFunciona() {
    const { ref, visible } = useVisible<HTMLDivElement>();

    return (
        <Seccion id="como-funciona">
            <Encabezado
                eyebrow="Cómo funciona"
                titulo="De la idea a la primera venta,"
                resalte="en una tarde."
                bajada="Sin instalar nada, sin contratar a nadie y sin tener que entender de tecnología."
            />

            <div ref={ref} className="mt-16 grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                {PASOS.map((p, i) => (
                    <Reveal key={p.n} delay={i * 130} className="relative">
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

                        <div className="flex flex-col items-center text-center">
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
                ))}
            </div>
        </Seccion>
    );
}
