// "Cómo funciona" — los cuatro pasos reales del onboarding, con una línea de
// órbita que se va dibujando a medida que la sección entra en pantalla (misma
// idea visual que los anillos del hero, ahora como hilo conductor del recorrido).

import { Reveal, Seccion, Encabezado, Card } from './Reveal';
import { useVisible } from './Reveal';

const PASOS = [
    { n: '01', titulo: 'Elegís tu rubro', texto: 'Barbería, tienda de ropa, pet shop, gastronomía. El panel se arma según lo que vendés: productos, turnos o las dos cosas.' },
    { n: '02', titulo: 'Cargás lo tuyo', texto: 'Productos o servicios, precios, horarios y formas de cobro. Con foto y descripción, o lo mínimo para arrancar hoy.' },
    { n: '03', titulo: 'Compartís tu link', texto: 'Tu tienda queda publicada en tu propio subdominio. La pegás en Instagram, en WhatsApp o donde ya te escriben tus clientes.' },
    { n: '04', titulo: 'Cobrás y gestionás', texto: 'Los pedidos y turnos entran solos al panel. Vos mirás la agenda, despachás y ves cómo viene el mes.' },
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

            <div ref={ref} className="relative mt-16">
                {/* Línea de órbita que conecta los pasos: se dibuja sola cuando la
                    sección entra en pantalla (stroke-dashoffset animado). */}
                <svg
                    className="pointer-events-none absolute inset-x-0 top-[46px] hidden lg:block"
                    viewBox="0 0 1000 60" preserveAspectRatio="none" style={{ height: 60 }} aria-hidden="true"
                >
                    <path
                        d="M 60 42 C 260 -6, 740 -6, 940 42"
                        fill="none" stroke="rgba(147,197,253,.34)" strokeWidth="1.5" strokeDasharray="6 7"
                        style={{
                            strokeDashoffset: visible ? 0 : 1400,
                            // 1400 ≈ largo del path; se anima el offset para que la
                            // línea "viaje" de izquierda a derecha al aparecer.
                            transition: 'stroke-dashoffset 2200ms cubic-bezier(.22,1,.36,1) 200ms',
                        }}
                    />
                </svg>

                <ol className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {PASOS.map((p, i) => (
                        <Reveal key={p.n} delay={i * 130} desde="abajo">
                            <Card className="oc-card-hover h-full p-6">
                                <span
                                    className="mb-4 grid h-9 w-9 place-items-center rounded-full text-[12px] font-black text-blue-200"
                                    style={{ background: 'rgba(2,6,23,.9)', border: '1px solid rgba(147,197,253,.35)', boxShadow: '0 0 22px rgba(59,130,246,.30)' }}
                                >
                                    {p.n}
                                </span>
                                <h3 className="text-[16px] font-bold text-white">{p.titulo}</h3>
                                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">{p.texto}</p>
                            </Card>
                        </Reveal>
                    ))}
                </ol>
            </div>
        </Seccion>
    );
}
