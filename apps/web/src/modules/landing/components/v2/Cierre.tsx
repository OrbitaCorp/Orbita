// Precio, preguntas frecuentes y cierre.
//
// ⚠ ESTA SECCIÓN VA ADELANTADA AL CHECKOUT REAL — decisión explícita del dueño
// (2026-09-07), no un olvido. El único plan que hoy cobra de verdad
// (pages/onboarding/plan.tsx, "Órbita Starter") es $5.000 por 3 meses, sin
// distinguir primera vez de renovación, y dice literalmente "sin renovación
// automática" — no existe en el checkout ningún plan mensual, semestral ni
// anual, ni una lógica de "primeros 3 meses vs. después".
//
// El dueño pidió mostrar acá el esquema que va a cobrarse eventualmente:
//   · Beneficio de bienvenida (solo la primera vez): $5.000 los primeros 3
//     meses (esto SÍ es el precio real de hoy).
//   · Renovación / plan mensual sin ese beneficio: $15.000 por mes.
//   · Semestral y anual CON DESCUENTO: los montos de estos dos son una
//     PROPUESTA mía, no confirmada — ver el comentario junto a PLANES.
//
// Hasta que el checkout implemente esta lógica (backend + onboarding/plan.tsx),
// el botón de acá lleva al mismo /onboarding/rubro de siempre, que hoy solo va
// a cobrar $5.000 / 3 meses sin importar qué tarjeta se haya mirado. Cuando se
// arme la lógica real, hay que volver a este archivo y sacar esta nota.

import { Reveal, Seccion, Encabezado, Card } from './Reveal';

const INCLUYE = [
    'Panel de administración completo',
    'Subdominio .orbita.site incluido',
    'Sin comisiones por venta',
    'Soporte prioritario por WhatsApp',
];

/**
 * Tres formas de pagar el mismo plan. `destacado` es el semestral: ni el más
 * barato de entrada (mensual) ni el de mayor compromiso (anual), así que es el
 * que suele convenirle a alguien que recién está probando pero ya sabe que se
 * queda.
 *
 * ⚠ Los montos de semestral y anual son una PROPUESTA (descuento parejo del
 * 10% y 20% sobre el mensual, redondeado a un número entero de miles) para que
 * el dueño los confirme o los reemplace — no salen de ningún lado del código,
 * porque ese descuento todavía no existe en el checkout. El mensual ($15.000)
 * y el beneficio de bienvenida ($5.000 / 3 meses) sí fueron los montos que dio
 * el dueño.
 */
const PLANES = [
    {
        nombre: 'Mensual', duracion: '1 mes', precioMes: 15000,
        total: null as number | null, cada: '', ahorro: null as number | null,
        nota: 'Sin compromiso, cancelás cuando quieras',
    },
    {
        nombre: 'Semestral', duracion: '6 meses', precioMes: 13500,
        total: 81000, cada: 'cada 6 meses', ahorro: 10,
        nota: 'Se abona por adelantado, sin renovación automática',
        destacado: true,
    },
    {
        nombre: 'Anual', duracion: '12 meses', precioMes: 12000,
        total: 144000, cada: 'por año', ahorro: 20,
        nota: 'Se abona por adelantado, sin renovación automática',
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

export function Precios() {
    return (
        <Seccion id="precios">
            <Encabezado
                eyebrow="Precio"
                titulo="Elegí cómo pagar,"
                resalte="ahorrá si te quedás más tiempo."
                bajada="Mismo panel, mismas funciones, sin comisiones por venta. Cuanto más largo el período, menor el precio por mes."
            />

            {/* Beneficio de bienvenida: es el único precio de esta sección que
                el checkout cobra de verdad hoy (onboarding/plan.tsx, "Órbita
                Starter"). Va separado de las tarjetas de planes para que no se
                lea como una cuarta opción más: es lo que paga TODA cuenta
                nueva en sus primeros 3 meses, sea cual sea el plan al que
                despues se cambie. */}
            <Reveal className="mx-auto mt-10 max-w-[720px]">
                <div
                    className="flex flex-col items-center gap-1.5 rounded-2xl px-6 py-5 text-center sm:flex-row sm:justify-center sm:gap-3 sm:text-left"
                    style={{ background: 'var(--oc-accent-soft)', border: '1px solid var(--oc-accent-bd)' }}
                >
                    <span className="text-[13px] font-bold text-white">Beneficio de bienvenida:</span>
                    <span className="text-[13px] text-slate-300">
                        tus primeros 3 meses salen <strong className="text-white">$5.000 en total</strong>, elijas el plan que elijas después.
                    </span>
                </div>
            </Reveal>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {PLANES.map((p, i) => (
                    <Reveal key={p.nombre} desde="escala" delay={i * 90}>
                        <Card destacada={!!p.destacado} className="relative flex h-full flex-col overflow-hidden p-7">
                            {p.destacado && (
                                <span
                                    className="absolute right-5 top-5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.10em] text-blue-200"
                                    style={{ background: 'rgba(59,130,246,.18)', border: '1px solid var(--oc-accent-bd)' }}
                                >
                                    Más elegido
                                </span>
                            )}

                            {p.destacado && (
                                // Eco del planeta del hero: un arco de luz asomando abajo,
                                // solo en la tarjeta destacada para no repetir el efecto x3.
                                <div
                                    className="pointer-events-none absolute left-1/2 -bottom-[220px] h-[300px] w-[560px] -translate-x-1/2 rounded-[50%]"
                                    style={{ background: '#000', boxShadow: '0 0 40px 4px rgba(226,240,255,.55), 0 0 120px 30px rgba(99,102,241,.42)' }}
                                    aria-hidden="true"
                                />
                            )}

                            <div className="relative flex flex-1 flex-col">
                                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300/80">
                                    {p.nombre} · {p.duracion}
                                </span>
                                <div className="mt-4 flex items-end gap-2">
                                    <span className="font-black tracking-[-0.04em] text-white" style={{ fontSize: 42, lineHeight: 1 }}>
                                        {fmt(p.precioMes)}
                                    </span>
                                    <span className="pb-1.5 text-[13px] text-slate-400">/ mes</span>
                                </div>
                                <p className="mt-2 text-[12.5px] text-slate-400">
                                    {p.total ? `${fmt(p.total)} ${p.cada} · ${p.nota}` : p.nota}
                                </p>
                                {p.ahorro && (
                                    <p className="mt-1 text-[12.5px] font-semibold" style={{ color: 'var(--oc-ok)' }}>
                                        Ahorrás {p.ahorro}% contra el mensual
                                    </p>
                                )}

                                <ul className="mt-6 flex-1 space-y-2.5">
                                    {INCLUYE.map(t => (
                                        <li key={t} className="flex gap-2.5 text-[13px] text-slate-200">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--oc-ok)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                                                className="mt-[3px] shrink-0" aria-hidden="true">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            {t}
                                        </li>
                                    ))}
                                </ul>

                                <a
                                    href="/onboarding/rubro"
                                    className={`mt-7 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[14.5px] font-bold transition-colors duration-200 ${p.destacado ? 'oc-cta' : 'oc-ghost'}`}
                                    style={{ minHeight: 48, border: p.destacado ? undefined : '1px solid var(--oc-ghost-bd)' }}
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
