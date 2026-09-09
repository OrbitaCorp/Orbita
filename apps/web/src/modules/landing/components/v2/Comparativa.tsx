// Comparativas: el "antes y después" y el cuadro contra las alternativas.
//
// OJO con el contenido de esta sección: son afirmaciones de marketing sobre
// terceros. Las columnas de la tabla se dejaron GENÉRICAS a propósito ("solo
// redes", "otra plataforma") en vez de nombrar competidores, y todo lo que se
// afirma de Órbita sale de features que ya existen de verdad (comisión 0%,
// subdominio incluido, dominio propio, stock por variante en el mismo panel).
// Antes de publicar esto, que lo lea el dueño.

import { useEffect, useRef, useState } from 'react';

import { Reveal, Seccion, Encabezado, Card } from './Reveal';

const SIN = [
    'Los pedidos llegan por WhatsApp y se pierden entre mensajes',
    'La agenda es un cuaderno, y dos clientes caen a la misma hora',
    'El stock lo sabés de memoria… hasta que no',
    'Cobrás por transferencia y anotás quién pagó a mano',
    'Tu catálogo es un carrusel de Instagram de hace tres meses',
    'No sabés qué producto te deja plata y cuál no',
];

const CON = [
    'Cada pedido entra al panel con su estado y el detalle de cada uno',
    'El catálogo tiene buscador, categorías y variantes por talle o color',
    'El stock baja con cada venta y te avisa cuando queda poco',
    'Cobrás a tu manera y queda registrado automáticamente',
    'Elegís vidriera digital o tienda online completa, con buscador y categorías',
    'Ves qué se vende, cuándo y a quién, sin armar una planilla',
];

type Celda = true | false | string;
interface Fila { que: string; cuaderno: Celda; redes: Celda; orbita: Celda }

const FILAS: Fila[] = [
    { que: 'Catálogo con carrito y checkout',      cuaderno: false,          redes: false,           orbita: true },
    { que: 'Variantes por talle, color o serie',   cuaderno: 'A mano',       redes: false,           orbita: true },
    { que: 'Cobro online integrado',               cuaderno: false,          redes: 'Por afuera',    orbita: true },
    { que: 'Stock que se actualiza solo',          cuaderno: false,          redes: false,           orbita: true },
    { que: 'Historial de clientes',                cuaderno: 'A mano',       redes: false,           orbita: true },
    { que: 'Métricas de venta',                    cuaderno: 'A mano',       redes: 'De alcance',    orbita: true },
    { que: 'Dominio propio',                       cuaderno: false,          redes: false,           orbita: true },
    { que: 'Comisión por venta',                   cuaderno: 'N/A',          redes: 'N/A',           orbita: '0%' },
    { que: 'Listo para usar en',                   cuaderno: 'N/A',          redes: 'N/A',           orbita: 'Una tarde' },
];

const COLUMNAS = ['Cuaderno o Excel', 'Solo redes sociales', 'Órbita'] as const;

export function Comparativa() {
    return (
        <Seccion id="comparativa">
            <Encabezado
                eyebrow="Antes y después"
                titulo="Lo mismo que ya hacés,"
                resalte="pero más simple."
                bajada="Es el mismo proceso de vender y gestionar tu negocio, pero sin la parte manual que se pierde o se olvida."
            />

            {/* ── Dos columnas: sin Órbita / con Órbita ─────────────────────── */}
            <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Reveal desde="izquierda">
                    {/* Antes esta card era gris apagado de punta a punta (icono,
                        título y texto): al lado de la card verde de "Con Órbita"
                        quedaba tan tenue que costaba leerla. Ahora tiene su propio
                        acento en rojo — icono, borde y viñetas — para que el
                        contraste entre "el problema" y "la solución" se lea de un
                        vistazo, y el texto sube de slate-500 a slate-300 para que
                        no compita en legibilidad con el de la derecha. */}
                    <Card
                        className="h-full p-6 sm:p-8"
                        style={{ background: 'var(--oc-card-bg)', border: '1px solid rgba(248,113,113,.22)' }}
                    >
                        <h3 className="flex items-center gap-2.5 text-[15px] font-bold text-white">
                            <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: 'rgba(248,113,113,.16)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                            </span>
                            Sin Órbita
                        </h3>
                        <ul className="mt-5 space-y-3.5">
                            {SIN.map(t => (
                                <li key={t} className="flex gap-3 text-[13.5px] leading-relaxed text-slate-300">
                                    <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full" style={{ background: '#f87171' }} />
                                    {t}
                                </li>
                            ))}
                        </ul>
                    </Card>
                </Reveal>

                <Reveal desde="derecha" delay={120}>
                    <Card destacada className="h-full p-6 sm:p-8">
                        <h3 className="flex items-center gap-2.5 text-[15px] font-bold text-white">
                            <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: 'rgba(74,222,128,.14)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--oc-ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </span>
                            Con Órbita
                        </h3>
                        <ul className="mt-5 space-y-3.5">
                            {CON.map(t => (
                                <li key={t} className="flex gap-3 text-[13.5px] leading-relaxed text-slate-200">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--oc-ok)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                                        className="mt-[3px] shrink-0" aria-hidden="true">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    {t}
                                </li>
                            ))}
                        </ul>
                    </Card>
                </Reveal>
            </div>

            {/* ── Cuadro comparativo ───────────────────────────────────────── */}
            <Reveal delay={80} className="mt-16">
                <h3 className="mb-6 text-center text-[15px] font-bold text-white sm:text-left">
                    Cómo se compara con las otras formas de resolverlo
                </h3>

                {/* En celular la tabla de 3 columnas obligaba a scrollear de
                    costado. Se reemplaza por un selector: elegís contra qué
                    comparar y ves esa columna sola como lista. El escritorio
                    sigue con la tabla completa. */}
                <ComparativaMovil />

                {/* overflow-x propio como red de seguridad: de md en adelante la
                    tabla entra sin empujar el ancho de la página. */}
                <div className="hidden overflow-x-auto rounded-2xl md:block" style={{ border: '1px solid var(--oc-card-bd)' }}>
                    <table className="w-full min-w-[620px] border-collapse text-left">
                        <thead>
                            <tr>
                                <th className="p-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                    <span className="sr-only">Función</span>
                                </th>
                                {COLUMNAS.map(c => {
                                    const esOrbita = c === 'Órbita';
                                    return (
                                        <th
                                            key={c}
                                            className="p-4 text-center text-[12px] font-bold"
                                            style={{
                                                color: esOrbita ? 'var(--oc-text)' : 'var(--oc-text-4)',
                                                background: esOrbita ? 'var(--oc-card-alt-bg)' : 'transparent',
                                                borderTop: esOrbita ? '1px solid var(--oc-card-alt-bd)' : 'none',
                                                borderLeft: esOrbita ? '1px solid var(--oc-card-alt-bd)' : 'none',
                                                borderRight: esOrbita ? '1px solid var(--oc-card-alt-bd)' : 'none',
                                            }}
                                        >
                                            {c}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {FILAS.map((f, i) => (
                                <tr key={f.que} style={{ borderTop: '1px solid var(--oc-card-bd)' }}>
                                    <th scope="row" className="p-4 text-[13.5px] font-medium text-slate-300">{f.que}</th>
                                    <Celdita valor={f.cuaderno} />
                                    <Celdita valor={f.redes} />
                                    <Celdita valor={f.orbita} destacada ultima={i === FILAS.length - 1} />
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Reveal>
        </Seccion>
    );
}

function Celdita({ valor, destacada = false, ultima = false }: { valor: Celda; destacada?: boolean; ultima?: boolean }) {
    return (
        <td
            className="p-4 text-center text-[13px]"
            style={{
                background: destacada ? 'var(--oc-card-alt-bg)' : 'transparent',
                borderLeft: destacada ? '1px solid var(--oc-card-alt-bd)' : 'none',
                borderRight: destacada ? '1px solid var(--oc-card-alt-bd)' : 'none',
                borderBottom: destacada && ultima ? '1px solid var(--oc-card-alt-bd)' : 'none',
            }}
        >
            <ValorCelda valor={valor} destacada={destacada} />
        </td>
    );
}

/** El valor de una celda (✓ / ✗ / texto) sin envoltorio: lo comparten la tabla
 *  de escritorio y la lista de celular. */
function ValorCelda({ valor, destacada = false }: { valor: Celda; destacada?: boolean }) {
    if (valor === true) {
        return (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--oc-ok)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                className="mx-auto" role="img" aria-label="Sí">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        );
    }
    if (valor === false) {
        // Mismo rojo que el acento de la card "Sin Órbita": une visualmente las
        // dos formas en que la página dice "esto no lo tenés".
        return (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.4" strokeLinecap="round"
                className="mx-auto" role="img" aria-label="No">
                <path d="M18 6 6 18M6 6l12 12" />
            </svg>
        );
    }
    return <span className={destacada ? 'font-bold text-blue-200' : 'text-slate-500'}>{valor}</span>;
}

// ── Versión celular del cuadro: selector + una columna como lista ────────────
//
// En vez de una tabla de 3 columnas con scroll horizontal, se elige contra qué
// comparar ("Cuaderno o Excel", "Solo redes" u "Órbita") y se ve esa columna
// sola. Arranca en Órbita porque es la que interesa que se lea primero.
//
// El selector va rotando solo (cada 2,2 s — rápido para que alguien que va
// scrolleando alcance a ver el cambio, sin marear) para que quede claro que se
// puede tocar y que hay tres columnas para ver. Reglas del auto-rotado:
//   · solo en celular (es la única vista donde aparece) y solo con la sección a
//     la vista — un IntersectionObserver lo prende/apaga;
//   · se apaga con prefers-reduced-motion;
//   · si el usuario toca un segmento, se frena y no vuelve hasta 10 s sin que
//     toque nada.
const INTERVALO_MS = 2200;
const PAUSA_TRAS_TOCAR_MS = 10_000;

function ComparativaMovil() {
    const [sel, setSel] = useState(2);
    const [visible, setVisible] = useState(false);
    const [esMovil, setEsMovil] = useState(false);
    const [pausado, setPausado] = useState(false);

    const contRef = useRef<HTMLDivElement>(null);
    const pausaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const valores = (f: Fila): Celda[] => [f.cuaderno, f.redes, f.orbita];
    const esOrbita = sel === 2;

    // ¿estamos en el ancho donde se muestra esta vista? (< md)
    useEffect(() => {
        const mm = window.matchMedia('(max-width: 767px)');
        const upd = () => setEsMovil(mm.matches);
        upd();
        mm.addEventListener('change', upd);
        return () => mm.removeEventListener('change', upd);
    }, []);

    // solo rota mientras la sección está en pantalla
    useEffect(() => {
        const el = contRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.4 });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    // auto-rotado
    useEffect(() => {
        if (!visible || !esMovil || pausado) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const id = setInterval(() => setSel(s => (s + 1) % COLUMNAS.length), INTERVALO_MS);
        return () => clearInterval(id);
    }, [visible, esMovil, pausado]);

    useEffect(() => () => { if (pausaTimer.current) clearTimeout(pausaTimer.current); }, []);

    // al tocar un segmento: fijar esa columna y frenar el rotado 10 s
    const elegir = (i: number) => {
        setSel(i);
        setPausado(true);
        if (pausaTimer.current) clearTimeout(pausaTimer.current);
        pausaTimer.current = setTimeout(() => setPausado(false), PAUSA_TRAS_TOCAR_MS);
    };

    return (
        <div className="md:hidden">
            <style>{`
                .oc-compara-ind  { transition: transform 300ms cubic-bezier(.16,1,.3,1); }
                .oc-compara-lista { animation: ocComparaIn 340ms cubic-bezier(.16,1,.3,1); }
                @keyframes ocComparaIn {
                    from { opacity: .3; transform: translateY(6px); }
                    to   { opacity: 1; transform: none; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .oc-compara-ind   { transition: none; }
                    .oc-compara-lista { animation: none; }
                }
            `}</style>

            <div
                ref={contRef}
                role="group"
                aria-label="Comparar Órbita con"
                className="relative flex rounded-xl p-1.5"
                style={{ border: '1px solid var(--oc-card-bd)', background: 'var(--oc-card-bg)' }}
            >
                {/* pastilla que se desliza al segmento activo */}
                <span
                    aria-hidden="true"
                    className="oc-compara-ind pointer-events-none absolute rounded-lg"
                    style={{
                        top: 6,
                        bottom: 6,
                        left: 6,
                        width: 'calc((100% - 12px) / 3)',
                        transform: `translateX(calc(${sel} * 100%))`,
                        background: 'var(--oc-card-alt-bg)',
                        border: '1px solid var(--oc-card-alt-bd)',
                    }}
                />
                {COLUMNAS.map((c, i) => {
                    const activo = i === sel;
                    return (
                        <button
                            key={c}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => elegir(i)}
                            className="relative z-[1] flex flex-1 items-center justify-center rounded-lg px-1.5 py-2 text-center text-[11.5px] font-bold leading-tight transition-colors"
                            style={{ minHeight: 44, color: activo ? 'var(--oc-text)' : 'var(--oc-text-4)' }}
                        >
                            {c}
                        </button>
                    );
                })}
            </div>

            <ul
                key={sel}
                className="oc-compara-lista mt-3 overflow-hidden rounded-2xl"
                style={{
                    border: `1px solid ${esOrbita ? 'var(--oc-card-alt-bd)' : 'var(--oc-card-bd)'}`,
                    background: esOrbita ? 'var(--oc-card-alt-bg)' : 'transparent',
                }}
            >
                {FILAS.map((f, i) => (
                    <li
                        key={f.que}
                        className="flex items-center justify-between gap-4 px-4 py-3.5"
                        style={{ borderTop: i === 0 ? 'none' : '1px solid var(--oc-card-bd)' }}
                    >
                        <span className="text-[13px] font-medium text-slate-300">{f.que}</span>
                        <span className="shrink-0 text-right text-[13px]">
                            <ValorCelda valor={valores(f)[sel]} destacada={esOrbita} />
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
