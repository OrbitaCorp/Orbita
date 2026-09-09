// Precio, preguntas frecuentes y cierre.
//
// Los montos de acá SON los reales (subscriptions.service.ts,
// BIENVENIDA_TIERS y PLANES — si cambian de un lado, cambian del otro). Ya
// incluyen la comisión real de Mercado Pago sobre Suscripciones (6,29% + IVA
// "al instante" en la mayoría de las provincias, 7,61% efectivo — confirmado
// contra la documentación oficial de MP el 2026-09-07): el número de lista es
// lo que Órbita recibe LIMPIO, no lo que se cobra.
//
// Rediseño "Base"/"Base + Avanzado" (RBT, 2026-09): antes había 3 planes
// (Mensual/Semestral/Anual) más un cartel de "beneficio de bienvenida" con un
// monto fijo que NO dependía de cuál elegías — justamente la raíz de la queja
// de que el checkout real era confuso. Ahora hay 2 tarjetas nomás, y elegir
// una determina DIRECTAMENTE cuánto se cobra hoy (bienvenida) y qué se activa
// después. Semestral/Anual siguen existiendo, pero solo como cambio de plan
// desde el panel (Configuración → Suscripción) para quien ya es cliente — ver
// el comentario de diseño al principio de subscriptions.service.ts.
//
// El checkout real (pages/onboarding/plan.tsx) cobra la bienvenida de la
// tarjeta elegida con un pago único; el plan real se activa recién cuando esa
// bienvenida termina, desde el panel — sin renovación automática (mail +
// botón "Activar mi plan").

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Reveal, Seccion, Encabezado, Card } from './Reveal';

// Una sola lista de prestaciones para las DOS tarjetas: `soloAvanzado` marca
// las que no entran en Base. Así el comparador de abajo se arma solo y no hay
// forma de que las dos listas se desincronicen entre sí.
//
// Los textos son los mismos de Modulos.tsx y Avanzado.tsx, para que lo que
// promete el comparador y lo que dice el resto de la home sean la misma cosa.
// OJO con un ítem: Modulos.tsx tiene "Descuentos y fotos sin fondo", que
// mezcla dos cosas — cupones (sí, de Base) y sacarle el fondo a la foto
// (`removeBackground`, gateado por el addon ADVANCED en products.service.ts).
// Acá van separados a propósito.
interface Prestacion { titulo: string; texto: string; soloAvanzado?: boolean }
const PRESTACIONES: Prestacion[] = [
    { titulo: 'Catálogo que entiende tu rubro', texto: 'Variantes por talle y color, número de serie o IMEI, o venta por metro, kilo y litro.' },
    { titulo: 'Cobrás a tu manera', texto: 'Con tu Mercado Pago, por transferencia o coordinando el pago aparte con tu cliente.' },
    { titulo: 'Tu dominio propio', texto: 'Comprá uno nuevo desde el panel, o conectá el que ya tenés sin importar dónde lo compraste.' },
    { titulo: 'Pedidos de punta a punta', texto: 'Estados, historial y notas de crédito. Cada movimiento queda con su propio registro.' },
    { titulo: 'Stock siempre al día', texto: 'Inventario por variante, alertas cuando queda poco y movimientos con su historial.' },
    { titulo: 'Clientes, mensajes y equipo', texto: 'Quién te compra y cuánto, bandeja de conversaciones, y empleados con permisos por rol.' },
    { titulo: 'Orbi, tu asistente con IA', texto: 'Te responde sobre tus ventas, tu stock y tus pedidos, y te ayuda a resolver cosas en el panel.' },
    { titulo: 'Reportes que se entienden', texto: 'Ventas, productos, clientes, inventario y pagos. Números para decidir, no un tablero para estudiar.' },
    { titulo: 'Descuentos y cupones', texto: 'Cupones con sus límites y vencimientos, aplicados solos en el carrito.' },
    { titulo: 'Sin comisiones por venta', texto: 'Cobrás vos, en tu propia cuenta. Órbita no se queda con nada de lo que vendés.' },
    { titulo: 'Soporte prioritario por WhatsApp', texto: 'Te respondemos directo, sin tickets ni esperas largas.' },
    { titulo: 'Plantillas de portada', texto: 'Veinte diseños distintos para la portada de tu tienda, sin tocar el catálogo ni el checkout.', soloAvanzado: true },
    { titulo: 'Modales de anuncios', texto: 'Promos, bienvenida con descuento y avisos que aparecen en el momento justo de la visita.', soloAvanzado: true },
    { titulo: 'Juegos con premio', texto: 'Mini-juegos donde tu cliente se gana un descuento. Vos ponés el tope; el descuento se crea solo.', soloAvanzado: true },
    { titulo: 'Prueba social', texto: 'Avisos de "alguien acaba de comprar esto" armados con pedidos reales de tu tienda.', soloAvanzado: true },
    { titulo: '2x1 y 3x2', texto: 'Promo "llevá X, pagá Y" que se aplica sola en el carrito, sin código.', soloAvanzado: true },
    { titulo: 'Countdown y exit-intent', texto: 'Cuenta regresiva de ofertas y un aviso cuando alguien está por irse sin comprar.', soloAvanzado: true },
    { titulo: 'Fotos sin fondo automáticas', texto: 'Sacale el fondo a la foto de tu producto con un clic, sin depender de otra herramienta.', soloAvanzado: true },
];

const INCLUYE = [
    'Panel de administración completo',
    'Subdominio .orbita.site incluido',
    'Sin comisiones por venta',
    'Soporte prioritario por WhatsApp',
];

interface Tarjeta {
    key: 'base' | 'avanzado';
    nombre: string;
    /** Precio mensual regular de ESTA tarjeta — se muestra tachado, como ancla. */
    precioTachado: number;
    /** Lo que se cobra hoy, por 3 meses (beneficio de bienvenida). */
    precioBienvenida: number;
    incluye: string[];
    destacada?: boolean;
}

// Dos tarjetas nomás (antes 3 planes + un cartel de bienvenida aparte — ver
// comentario de arriba). Los montos son BIENVENIDA_TIERS/PLANES de
// subscriptions.service.ts.
const TARJETAS: Tarjeta[] = [
    {
        key: 'base', nombre: 'Base',
        precioTachado: 16500, precioBienvenida: 5500,
        incluye: INCLUYE,
    },
    {
        key: 'avanzado', nombre: 'Base + Avanzado',
        precioTachado: 21700, precioBienvenida: 10900,
        incluye: [...INCLUYE, 'Paquete Avanzado incluido'],
        destacada: true,
    },
];

const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`;

const FAQS = [
    {
        q: '¿Necesito saber de tecnología?',
        a: 'No. Elegís tu rubro, cargás tus productos o servicios y tu tienda queda publicada. No hay nada que instalar ni servidores que configurar.',
    },
    {
        q: '¿Órbita se queda con una parte de mis ventas?',
        a: 'No. La comisión por venta es 0%: cobrás vos, en tu cuenta de Mercado Pago. Lo único que pagás es la suscripción del panel.',
    },
    {
        q: '¿Puedo usar mi propio dominio?',
        a: 'Sí. Podés conectar un dominio que ya tengas, sin importar dónde lo hayas comprado, o comprar uno nuevo desde el panel y queda vinculado solo.',
    },
    {
        q: '¿Y si doy turnos o tengo un gimnasio?',
        a: 'Hoy Órbita resuelve tiendas con productos y stock. Turnos y agenda (gimnasios incluido) es lo próximo que llega: cuando esté, tu cuenta lo va a tener sin que migres nada.',
    },
    {
        q: '¿Puedo vender productos con talles, números de serie o por peso?',
        a: 'Sí. Al elegir tu rubro, el panel se configura para eso: variantes por talle y color, control por número de serie o IMEI, o venta por metro, kilo y litro, según lo que vendas.',
    },
    {
        q: '¿Qué pasa si quiero dejarlo?',
        a: 'Cancelás cuando quieras, sin penalidad. No hay renovación automática: se abona por períodos y si no renovás, no se te cobra de nuevo.',
    },
];

// Comparador de los dos planes, lado a lado.
//
// Va por PORTAL a <body>, no en el árbol de la sección: `Reveal` anima con
// `transform`, y un ancestro con transform crea un containing block que
// captura a los `position: fixed` de adentro — el overlay quedaba encerrado
// en la sección en vez de cubrir la pantalla (bug real, se vio en pantalla).
//
// El portal sale de `.oc-page`, así que el wrapper la vuelve a declarar: sin
// eso no llegan ni las variables de la paleta ni las reglas de `.oc-cta` /
// `.oc-ghost`, que están todas scopeadas a esa clase (ver PaginaV2.tsx).
//
// El fondo del panel es un color SÓLIDO, no `--oc-card-alt-bg`: esa variable
// es un azul al 16% pensado para tarjetas sobre el fondo espacial — como
// panel de modal dejaba pasar la página entera y el texto quedaba ilegible.
function ComparadorPlanes({ onCerrar }: { onCerrar: () => void }) {
    const [montado, setMontado] = useState(false);
    useEffect(() => setMontado(true), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        window.addEventListener('keydown', onKey);
        // Bloquea el scroll del fondo mientras está abierto: sin esto, la
        // rueda sobre el overlay seguía moviendo la home por detrás.
        const overflowPrevio = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflowPrevio;
        };
    }, [onCerrar]);

    if (!montado) return null;

    const marca = (incluido: boolean) => incluido
        ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--oc-ok)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Incluido">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        )
        : <span aria-label="No incluido" style={{ display: 'block', width: 12, height: 1.5, borderRadius: 1, background: 'var(--oc-text-4)' }} />;

    return createPortal(
        <div
            className="oc-page"
            style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={onCerrar}
        >
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,.82)', backdropFilter: 'blur(10px)' }} aria-hidden="true" />

            <style>{`
                .oc-cmp-fila { display: grid; grid-template-columns: minmax(0,1fr) 86px 86px; align-items: center; }
                @media (max-width: 560px) {
                    .oc-cmp-fila { grid-template-columns: minmax(0,1fr) 56px 56px; }
                    .oc-cmp-texto { display: none; }
                }
            `}</style>

            <div
                role="dialog"
                aria-modal="true"
                aria-label="Comparación de planes"
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'relative', display: 'flex', flexDirection: 'column',
                    width: '100%', maxWidth: 720, maxHeight: '86vh',
                    background: '#060b18', border: '1px solid rgba(147,197,253,.16)',
                    borderRadius: 18, boxShadow: '0 40px 100px rgba(0,0,0,.75)', overflow: 'hidden',
                }}
            >
                {/* Encabezado */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '20px 22px 16px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                    <div>
                        <h3 className="text-white" style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>Qué incluye cada plan</h3>
                        <p className="text-slate-400" style={{ fontSize: 12.5, marginTop: 3 }}>
                            Los dos traen Órbita completo. Avanzado suma las herramientas para vender más.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCerrar}
                        aria-label="Cerrar"
                        className="oc-ghost"
                        style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, border: '1px solid var(--oc-ghost-bd)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Cabecera de columnas */}
                <div className="oc-cmp-fila" style={{ padding: '12px 22px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.015)' }}>
                    <span />
                    {TARJETAS.map(t => (
                        <div key={t.key} style={{ textAlign: 'center', padding: '0 4px' }}>
                            <div className="text-blue-300" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {t.key === 'base' ? 'Base' : 'Avanzado'}
                            </div>
                            <div className="text-white" style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{fmt(t.precioBienvenida)}</div>
                            <div className="text-slate-400" style={{ fontSize: 9.5 }}>3 meses</div>
                        </div>
                    ))}
                </div>

                {/* Filas */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {PRESTACIONES.map(p => (
                        <div key={p.titulo} className="oc-cmp-fila" style={{ padding: '11px 22px', borderBottom: '1px solid rgba(255,255,255,.045)' }}>
                            <div style={{ paddingRight: 12 }}>
                                <div className="text-slate-200" style={{ fontSize: 13, fontWeight: 600 }}>{p.titulo}</div>
                                <div className="oc-cmp-texto text-slate-400" style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.45 }}>{p.texto}</div>
                            </div>
                            <div style={{ display: 'grid', placeItems: 'center' }}>{marca(!p.soloAvanzado)}</div>
                            <div style={{ display: 'grid', placeItems: 'center', background: 'rgba(59,130,246,.05)', alignSelf: 'stretch' }}>{marca(true)}</div>
                        </div>
                    ))}
                </div>

                {/* Pie con las dos acciones */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 22px 16px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
                    {TARJETAS.map(t => (
                        <a
                            key={t.key}
                            href="/onboarding/rubro"
                            className={`${t.destacada ? 'oc-cta' : 'oc-ghost'} flex cursor-pointer items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold transition-colors duration-200`}
                            style={{ minHeight: 44, border: t.destacada ? undefined : '1px solid var(--oc-ghost-bd)' }}
                        >
                            Elegir {t.nombre}
                        </a>
                    ))}
                </div>
            </div>
        </div>,
        document.body,
    );
}

export function Precios() {
    const [comparando, setComparando] = useState(false);

    return (
        <Seccion id="precios">
            <Encabezado
                eyebrow="Precio"
                titulo="Un plan"
                resalte="para cada momento de tu negocio."
                bajada="Mismo panel, mismas funciones, sin comisiones por venta. Elegí si querés el paquete Avanzado desde el arranque o no."
            />

            <div className="mx-auto mt-10 grid max-w-[720px] grid-cols-1 gap-4 sm:grid-cols-2">
                {TARJETAS.map((t, i) => (
                    <Reveal key={t.key} desde="escala" delay={i * 90}>
                        <Card destacada={!!t.destacada} className="relative flex h-full flex-col overflow-hidden p-7">
                            {t.destacada && (
                                <span
                                    className="absolute right-5 top-5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.10em] text-blue-200"
                                    style={{ background: 'rgba(59,130,246,.18)', border: '1px solid var(--oc-accent-bd)' }}
                                >
                                    Más elegido
                                </span>
                            )}

                            {t.destacada && (
                                // Eco del planeta del hero: un arco de luz asomando abajo,
                                // solo en la tarjeta destacada para no repetir el efecto x2.
                                <div
                                    className="pointer-events-none absolute left-1/2 -bottom-[220px] h-[300px] w-[560px] -translate-x-1/2 rounded-[50%]"
                                    style={{ background: '#000', boxShadow: '0 0 40px 4px rgba(226,240,255,.55), 0 0 120px 30px rgba(99,102,241,.42)' }}
                                    aria-hidden="true"
                                />
                            )}

                            <div className="relative flex flex-1 flex-col">
                                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300/80">
                                    {t.nombre}
                                </span>
                                <div className="mt-4 flex flex-wrap items-end gap-2">
                                    <span className="text-[15px] text-slate-500 line-through">{fmt(t.precioTachado)}</span>
                                    <span className="font-black tracking-[-0.04em] text-white" style={{ fontSize: 42, lineHeight: 1 }}>
                                        {fmt(t.precioBienvenida)}
                                    </span>
                                    <span className="pb-1.5 text-[13px] text-slate-400">por 3 meses</span>
                                </div>
                                <p className="mt-2 text-[12.5px] text-slate-400">
                                    Después, {fmt(t.precioTachado)}/mes
                                </p>

                                <ul className="mt-6 flex-1 space-y-2.5">
                                    {t.incluye.map(i2 => (
                                        <li key={i2} className="flex gap-2.5 text-[13px] text-slate-200">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--oc-ok)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                                                className="mt-[3px] shrink-0" aria-hidden="true">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            {i2}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    type="button"
                                    onClick={() => setComparando(true)}
                                    className="mt-3 cursor-pointer self-start text-[12.5px] font-semibold text-blue-300/80 underline decoration-dotted transition-colors duration-200 hover:text-blue-200"
                                >
                                    Comparar los dos planes
                                </button>

                                <a
                                    href="/onboarding/rubro"
                                    className={`mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[14.5px] font-bold transition-colors duration-200 ${t.destacada ? 'oc-cta' : 'oc-ghost'}`}
                                    style={{ minHeight: 48, border: t.destacada ? undefined : '1px solid var(--oc-ghost-bd)' }}
                                >
                                    Crear tu espacio
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </a>
                            </div>
                        </Card>
                    </Reveal>
                ))}
            </div>

            {/* Reemplaza el viejo cartel de "Beneficio de bienvenida" con
                monto fijo: ahora ese número vive en cada tarjeta, esto es
                solo la aclaración de qué pasa DESPUÉS de los 3 meses. */}
            <Reveal className="mx-auto mt-8 max-w-[640px] text-center">
                <p className="text-[12.5px] text-slate-400">
                    Sin renovación automática: cuando terminan los 3 meses no te cobramos solos —
                    te avisamos por mail y vos activás el siguiente período desde el panel, cuando quieras.
                </p>
            </Reveal>

            {comparando && <ComparadorPlanes onCerrar={() => setComparando(false)} />}
        </Seccion>
    );
}

export function Faq() {
    return (
        <Seccion id="faq">
            <Encabezado eyebrow="Preguntas" titulo="Lo que" resalte="todos preguntan." />

            <div className="mx-auto mt-12 max-w-[760px] space-y-3">
                {FAQS.map((f, i) => (
                    <Reveal key={f.q} delay={i * 60}>
                        {/* <details> nativo: accesible por teclado y sin JS de por medio. */}
                        <details className="oc-faq group">
                            <summary
                                className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 text-[14.5px] font-semibold text-white transition-colors duration-200"
                                style={{ background: 'var(--oc-card-bg)', border: '1px solid var(--oc-card-bd)' }}
                            >
                                {f.q}
                                <svg
                                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--oc-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                                    className="oc-faq-chevron shrink-0" aria-hidden="true"
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </summary>
                            <p className="px-5 pb-5 pt-4 text-[13.5px] leading-relaxed text-slate-400">{f.a}</p>
                        </details>
                    </Reveal>
                ))}
            </div>
        </Seccion>
    );
}

export function CierreCta() {
    return (
        <section className="relative z-10 overflow-hidden px-6 pb-40 pt-16 sm:pt-24">
            <Reveal desde="escala" className="mx-auto max-w-3xl text-center">
                <h2
                    className="font-black tracking-[-0.04em] text-white"
                    style={{ fontSize: 'clamp(30px, 5.6vw, 62px)', lineHeight: 1.02 }}
                >
                    Tu negocio ya está listo.<br />
                    <span style={{ color: 'var(--oc-title-2)' }}>Falta ponerlo en órbita.</span>
                </h2>
                <p className="mx-auto mt-5 max-w-[500px] text-[15px] leading-relaxed text-slate-400">
                    Creá tu espacio, cargá lo que vendés y empezá a recibir pedidos hoy mismo.
                </p>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                    <a
                        href="/onboarding/rubro"
                        className="oc-cta inline-flex cursor-pointer items-center gap-2 rounded-xl px-7 text-[15px] font-bold transition-colors duration-200"
                        style={{ minHeight: 50 }}
                    >
                        Crear tu espacio
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </a>
                    <a
                        href="#precios"
                        className="oc-ghost inline-flex items-center rounded-xl px-7 text-[15px] font-semibold text-white/90 transition-colors duration-200 hover:bg-white/10 cursor-pointer"
                        style={{ minHeight: 50, border: '1px solid var(--oc-ghost-bd)' }}
                    >
                        Ver el precio
                    </a>
                </div>
            </Reveal>

            {/* Acá había un segundo planeta "de cierre". Se sacó: tapaba el texto
                de esta misma sección y competía con el planeta real, que ahora es
                una capa fija que acompaña toda la página (EscenaEspacial.tsx). El
                cierre lo da esa escena, no una copia. */}
        </section>
    );
}
