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

import { Reveal, Seccion, Encabezado, Card } from './Reveal';
// Las tarjetas y sus montos viven en planesDatos.ts desde que existe /planes
// (la comparación detallada): son los mismos datos en las dos pantallas, así
// que se declaran una sola vez. Acá quedan solo el precio y las preguntas.
import { TARJETAS, fmt } from './planesDatos';

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

export function Precios() {
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
                                    {/* 42px fijo se veía desproporcionado en celular: en la única
                                        columna angosta (<640px) el número ocupaba casi todo el
                                        ancho de la tarjeta ("$10.900" pegado al tachado), muy por
                                        encima de la jerarquía del resto del contenido (bullets a
                                        13px, botón). De sm en adelante la grilla pasa a 2 columnas
                                        y ahí sí entra cómodo al tamaño original. */}
                                    <span className="font-black tracking-[-0.04em] text-white text-[30px] sm:text-[42px]" style={{ lineHeight: 1 }}>
                                        {fmt(t.precioBienvenida)}
                                    </span>
                                    {/* "por 3 meses" solo, pegado al número grande, se leía como
                                        una tarifa periódica ("$5.500 por [cada] 3 meses") — reportado
                                        con captura: daba a entender que se pagaba $5.500 POR MES
                                        durante 3 meses ($16.500 en total), exactamente lo contrario
                                        de lo que es (un total único, bien por debajo del precio de
                                        lista). "en total" delante mata esa lectura. */}
                                    <span className="pb-1.5 text-[13px] text-slate-400">en total · 3 meses</span>
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

                                {/* Antes esto abría un modal comparador acá mismo. En una
                                    ventana de 720px con scroll interno no entraba el detalle
                                    real (en celular ni siquiera se veía la descripción de
                                    cada prestación), así que pasó a ser una página propia:
                                    /planes. */}
                                <a
                                    href="/planes"
                                    className="mt-3 inline-flex cursor-pointer items-center gap-1 self-start text-[12.5px] font-semibold text-blue-300/80 underline decoration-dotted transition-colors duration-200 hover:text-blue-200"
                                >
                                    Ver más detalle
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </a>

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
        <section className="relative z-10 overflow-hidden px-6 pb-28 pt-14 sm:pb-40 sm:pt-20">
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
                <div className="mx-auto mt-9 flex w-full max-w-[320px] flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
                    <a
                        href="/onboarding/rubro"
                        className="oc-cta inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-7 text-[15px] font-bold transition-colors duration-200 sm:w-auto"
                        style={{ minHeight: 50 }}
                    >
                        Crear tu espacio
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </a>
                    <a
                        href="#precios"
                        className="oc-ghost inline-flex w-full items-center justify-center rounded-xl px-7 text-[15px] font-semibold text-white/90 transition-colors duration-200 hover:bg-white/10 cursor-pointer sm:w-auto"
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
