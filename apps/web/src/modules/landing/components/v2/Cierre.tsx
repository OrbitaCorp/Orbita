// Precio, preguntas frecuentes y cierre.
//
// El precio y la lista de beneficios NO son inventados: salen de la pantalla de
// pago real del onboarding (pages/onboarding/plan.tsx — "$1.667 por mes · Sin
// renovación automática", cobrado por packs de 3 meses). Si eso cambia allá, hay
// que cambiarlo acá también.

import { Reveal, Seccion, Encabezado, Card } from './Reveal';

const INCLUYE = [
    'Panel de administración completo',
    'Subdominio .orbita.site incluido',
    'Sin comisiones por venta',
    'Soporte prioritario por WhatsApp',
    'Cancelá cuando quieras, sin penalidad',
];

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
        q: '¿Y si doy turnos o tengo un restaurante?',
        a: 'Hoy Órbita resuelve tiendas con productos y stock. Turnos y agenda, gastronomía, servicios, turismo, educación y eventos están en construcción: cuando lleguen, tu cuenta los va a tener sin que migres nada.',
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
                titulo="Un solo plan,"
                resalte="sin letra chica."
                bajada="Todo incluido desde el primer día. Sin comisiones por venta, sin costos por módulo y sin permanencia."
            />

            <div className="mt-14 flex justify-center">
                <Reveal desde="escala" className="w-full max-w-[440px]">
                    <Card destacada className="relative overflow-hidden p-8">
                        {/* Eco del planeta del hero: un arco de luz asomando abajo */}
                        <div
                            className="pointer-events-none absolute left-1/2 -bottom-[220px] h-[300px] w-[560px] -translate-x-1/2 rounded-[50%]"
                            style={{ background: '#000', boxShadow: '0 0 40px 4px rgba(226,240,255,.55), 0 0 120px 30px rgba(99,102,241,.42)' }}
                            aria-hidden="true"
                        />
                        <div className="relative">
                            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300/80">Plan Órbita</span>
                            <div className="mt-4 flex items-end gap-2">
                                <span className="font-black tracking-[-0.04em] text-white" style={{ fontSize: 52, lineHeight: 1 }}>$1.667</span>
                                <span className="pb-2 text-[14px] text-slate-400">/ mes</span>
                            </div>
                            <p className="mt-2 text-[12.5px] text-slate-400">
                                Se abona por períodos de 3 meses · Sin renovación automática
                            </p>

                            <ul className="mt-7 space-y-3">
                                {INCLUYE.map(t => (
                                    <li key={t} className="flex gap-2.5 text-[13.5px] text-slate-200">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                                            className="mt-[3px] shrink-0" aria-hidden="true">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        {t}
                                    </li>
                                ))}
                            </ul>

                            <a
                                href="/onboarding/rubro"
                                className="oc-cta mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-bold text-slate-900 transition-colors duration-200 hover:bg-blue-50 cursor-pointer"
                                style={{ minHeight: 50 }}
                            >
                                Empezar ahora
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </a>
                        </div>
                    </Card>
                </Reveal>
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
                                style={{ background: 'rgba(255,255,255,.028)', border: '1px solid rgba(255,255,255,.075)' }}
                            >
                                {f.q}
                                <svg
                                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
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
                    <span style={{ color: '#7c869b' }}>Falta ponerlo en órbita.</span>
                </h2>
                <p className="mx-auto mt-5 max-w-[500px] text-[15px] leading-relaxed text-slate-400">
                    Creá tu espacio, cargá lo que vendés y empezá a recibir pedidos hoy mismo.
                </p>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                    <a
                        href="/onboarding/rubro"
                        className="oc-cta inline-flex items-center gap-2 rounded-xl bg-white px-7 text-[15px] font-bold text-slate-900 transition-colors duration-200 hover:bg-blue-50 cursor-pointer"
                        style={{ minHeight: 50, boxShadow: '0 10px 40px rgba(147,197,253,.22)' }}
                    >
                        Crear mi tienda gratis
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </a>
                    <a
                        href="#precios"
                        className="oc-ghost inline-flex items-center rounded-xl px-7 text-[15px] font-semibold text-white/90 transition-colors duration-200 hover:bg-white/10 cursor-pointer"
                        style={{ minHeight: 50, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.04)' }}
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
