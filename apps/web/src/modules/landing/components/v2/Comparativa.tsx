// Comparativas: el "antes y después" y el cuadro contra las alternativas.
//
// OJO con el contenido de esta sección: son afirmaciones de marketing sobre
// terceros. Las columnas de la tabla se dejaron GENÉRICAS a propósito ("solo
// redes", "otra plataforma") en vez de nombrar competidores, y todo lo que se
// afirma de Órbita sale de features que ya existen de verdad (comisión 0%,
// subdominio incluido, dominio propio, turnos + productos en el mismo panel).
// Antes de publicar esto, que lo lea el dueño.

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
    'Cada pedido entra al panel con su estado y su comprobante',
    'Los turnos se reservan solos, sin superponerse',
    'El stock baja con cada venta y te avisa cuando queda poco',
    'Cobrás con Mercado Pago y queda registrado automáticamente',
    'Tenés una tienda real, con buscador, categorías y carrito',
    'Ves qué se vende, cuándo y a quién, sin armar una planilla',
];

type Celda = true | false | string;
interface Fila { que: string; cuaderno: Celda; redes: Celda; orbita: Celda }

const FILAS: Fila[] = [
    { que: 'Catálogo con carrito y checkout',      cuaderno: false,          redes: false,           orbita: true },
    { que: 'Turnos con reserva automática',        cuaderno: false,          redes: false,           orbita: true },
    { que: 'Cobro online integrado',               cuaderno: false,          redes: 'Por afuera',    orbita: true },
    { que: 'Stock que se actualiza solo',          cuaderno: false,          redes: false,           orbita: true },
    { que: 'Historial de clientes',                cuaderno: 'A mano',       redes: false,           orbita: true },
    { que: 'Métricas de venta',                    cuaderno: 'A mano',       redes: 'De alcance',    orbita: true },
    { que: 'Dominio propio',                       cuaderno: false,          redes: false,           orbita: true },
    { que: 'Comisión por venta',                   cuaderno: '—',            redes: '—',             orbita: '0%' },
    { que: 'Listo para usar en',                   cuaderno: '—',            redes: '—',             orbita: 'Una tarde' },
];

const COLUMNAS = ['Cuaderno o Excel', 'Solo redes sociales', 'Órbita'] as const;

export function Comparativa() {
    return (
        <Seccion id="comparativa">
            <Encabezado
                eyebrow="Antes y después"
                titulo="Lo mismo que hacés hoy,"
                resalte="sin la parte tediosa."
                bajada="Órbita no te pide cambiar cómo trabajás. Te saca de encima la parte que se hace a mano y se pierde."
            />

            {/* ── Dos columnas: sin Órbita / con Órbita ─────────────────────── */}
            <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Reveal desde="izquierda">
                    <Card className="h-full p-6 sm:p-8" style={{ background: 'rgba(255,255,255,.02)' }}>
                        <h3 className="flex items-center gap-2.5 text-[15px] font-bold text-slate-300">
                            <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: 'rgba(148,163,184,.14)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                            </span>
                            Como viene siendo hasta ahora
                        </h3>
                        <ul className="mt-5 space-y-3.5">
                            {SIN.map(t => (
                                <li key={t} className="flex gap-3 text-[13.5px] leading-relaxed text-slate-500">
                                    <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-slate-600" />
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
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </span>
                            Con Órbita
                        </h3>
                        <ul className="mt-5 space-y-3.5">
                            {CON.map(t => (
                                <li key={t} className="flex gap-3 text-[13.5px] leading-relaxed text-slate-200">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
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

                {/* overflow-x propio: la tabla no puede empujar el ancho de la
                    página en celular (regla de responsive del proyecto). */}
                <div className="overflow-x-auto rounded-2xl" style={{ border: '1px solid rgba(255,255,255,.075)' }}>
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
                                                color: esOrbita ? '#fff' : '#94a3b8',
                                                background: esOrbita ? 'rgba(30,58,138,.20)' : 'transparent',
                                                borderTop: esOrbita ? '1px solid rgba(147,197,253,.34)' : 'none',
                                                borderLeft: esOrbita ? '1px solid rgba(147,197,253,.34)' : 'none',
                                                borderRight: esOrbita ? '1px solid rgba(147,197,253,.34)' : 'none',
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
                                <tr key={f.que} style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
                                    <th scope="row" className="p-4 text-[13.5px] font-medium text-slate-300">{f.que}</th>
                                    <Celdita valor={f.cuaderno} />
                                    <Celdita valor={f.redes} />
                                    <Celdita valor={f.orbita} destacada ultima={i === FILAS.length - 1} />
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-3 text-[11.5px] text-slate-600">
                    Comparación general con las formas más comunes de resolverlo, no con un proveedor puntual.
                </p>
            </Reveal>
        </Seccion>
    );
}

function Celdita({ valor, destacada = false, ultima = false }: { valor: Celda; destacada?: boolean; ultima?: boolean }) {
    return (
        <td
            className="p-4 text-center text-[13px]"
            style={{
                background: destacada ? 'rgba(30,58,138,.20)' : 'transparent',
                borderLeft: destacada ? '1px solid rgba(147,197,253,.34)' : 'none',
                borderRight: destacada ? '1px solid rgba(147,197,253,.34)' : 'none',
                borderBottom: destacada && ultima ? '1px solid rgba(147,197,253,.34)' : 'none',
            }}
        >
            {valor === true ? (
                <>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                        className="mx-auto" role="img" aria-label="Sí">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </>
            ) : valor === false ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.4" strokeLinecap="round"
                    className="mx-auto" role="img" aria-label="No">
                    <path d="M18 6 6 18M6 6l12 12" />
                </svg>
            ) : (
                <span className={destacada ? 'font-bold text-blue-200' : 'text-slate-500'}>{valor}</span>
            )}
        </td>
    );
}
