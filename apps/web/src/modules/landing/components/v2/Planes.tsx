// Comparación detallada de los dos planes — página propia (/planes).
//
// Reemplaza al modal "Comparar los dos planes" que vivía adentro de
// Cierre.tsx: en una ventana de 720px con scroll interno no entraba el detalle
// real (en celular el modal directamente escondía la descripción de cada
// prestación), y encima competía con el scroll de la home. Acá hay lugar para
// las 18 prestaciones con su texto, agrupadas, más los períodos y las
// preguntas de plan.
//
// ─── Por qué el precio de arriba NO lo manda el selector de período ─────────
//
// Es la decisión de diseño que más condiciona esta página. En el alta solo se
// puede elegir 'mensual' o 'mensualAvanzado' — lo valida el backend
// (StartPendingCheckoutDto, @IsIn) — y las dos arrancan con el beneficio de
// bienvenida: 3 meses por $5.500 o $10.900. Semestral y Anual NO se pueden
// contratar desde acá: son un cambio de plan desde el panel, después.
//
// Entonces el selector de período no puede mandar el precio del encabezado sin
// mentir sobre lo que se cobra hoy. Vive en su propia sección ("cuando
// terminan los 3 meses"), que es exactamente el momento en el que esa
// elección existe de verdad.
//
// Misma razón por la que la tarjeta de Avanzado muestra siempre "mes a mes":
// hoy no hay semestral/anual con Avanzado (PlanKey en subscriptions.service.ts
// — el único con Avanzado es 'mensualAvanzado').

import { useState } from 'react';
import { Reveal, Seccion, Encabezado, Card } from './Reveal';
import {
    PRESTACIONES, GRUPOS, TARJETAS, PERIODOS, AVANZADO_POR_MES, fmt,
    type PeriodoKey, type Prestacion,
} from './planesDatos';

const PREGUNTAS = [
    {
        q: '¿Puedo empezar con Base y sumar Avanzado después?',
        a: 'Sí. Desde el panel, en Configuración → Suscripción, tenés el botón para activarlo cuando quieras. Reemplaza tu suscripción por la de Base + Avanzado: es un solo cargo combinado, el paquete nunca se factura aparte.',
    },
    {
        q: '¿Y si activo Avanzado y después no lo uso?',
        a: 'Volvés a Base cuando quieras, desde el mismo lugar. Es un cambio de plan más, sin penalidad ni llamado de por medio.',
    },
    {
        q: '¿Cómo paso a Semestral o Anual?',
        a: 'Desde el panel, cuando termina el beneficio de bienvenida. En el alta se arranca siempre mes a mes: los períodos largos aparecen después, ya siendo cliente, y son del plan Base.',
    },
    {
        q: '¿Se renueva solo?',
        a: 'No. No hay renovación automática: cuando termina tu período te avisamos por mail y vos activás el siguiente desde el panel, cuando quieras. Si no lo activás, no se te cobra de nuevo.',
    },
    {
        q: '¿Órbita se queda con una parte de mis ventas?',
        a: 'No. La comisión por venta es 0%, en los dos planes: cobrás vos, en tu cuenta de Mercado Pago. Lo único que pagás es la suscripción del panel.',
    },
];

/** Tilde o guioncito, según la prestación entre o no en ese plan. */
function Marca({ si }: { si: boolean }) {
    if (!si) {
        return (
            <span
                role="img"
                aria-label="No incluido"
                className="inline-block h-[2px] w-3 rounded-sm align-middle"
                style={{ background: 'var(--oc-text-4)' }}
            />
        );
    }
    return (
        <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--oc-ok)"
            strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"
            className="inline-block align-middle" role="img" aria-label="Incluido"
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

export function Planes() {
    const [periodo, setPeriodo] = useState<PeriodoKey>('mensual');
    const elegido = PERIODOS.find(p => p.key === periodo) ?? PERIODOS[0];
    const soloAvanzado = PRESTACIONES.filter(p => p.soloAvanzado);

    return (
        <Seccion id="planes">
            <style>{`
                /* La columna de Avanzado va apenas teñida en TODA su altura, para
                   que se lea como una columna y no como celdas sueltas. */
                .oc-pl-av { background: rgba(59,130,246,.055); }
                .oc-pl-tabla tbody tr:last-child th,
                .oc-pl-tabla tbody tr:last-child td { border-bottom: 0; }
            `}</style>

            <Encabezado
                eyebrow="Planes"
                titulo="Base o Base + Avanzado:"
                resalte="la diferencia, en detalle."
                bajada="Los dos traen Órbita completo — el mismo panel, el mismo catálogo, los mismos cobros y 0% de comisión. Avanzado suma las herramientas para vender más."
            />

            {/* ── 1. Con qué arrancás ─────────────────────────────────────── */}

            <div className="mx-auto mt-12 grid max-w-[760px] grid-cols-1 gap-4 sm:grid-cols-2">
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

                            <div className="relative flex flex-1 flex-col">
                                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300/80">
                                    {t.nombre}
                                </span>
                                <div className="mt-4 flex flex-wrap items-end gap-2">
                                    <span className="text-[15px] text-slate-500 line-through">{fmt(t.precioTachado)}</span>
                                    <span className="text-[30px] font-black tracking-[-0.04em] text-white sm:text-[42px]" style={{ lineHeight: 1 }}>
                                        {fmt(t.precioBienvenida)}
                                    </span>
                                    <span className="pb-1.5 text-[13px] text-slate-400">en total · 3 meses</span>
                                </div>
                                <p className="mt-2 text-[12.5px] text-slate-400">
                                    Después, {fmt(t.precioTachado)}/mes
                                </p>

                                <ul className="mt-6 flex-1 space-y-2.5">
                                    {t.incluye.map(item => (
                                        <li key={item} className="flex gap-2.5 text-[13px] text-slate-200">
                                            <span className="mt-[3px] shrink-0"><Marca si /></span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>

                                <a
                                    href="/onboarding/rubro"
                                    className={`mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[14.5px] font-bold transition-colors duration-200 ${t.destacada ? 'oc-cta' : 'oc-ghost'}`}
                                    style={{ minHeight: 48, border: t.destacada ? undefined : '1px solid var(--oc-ghost-bd)' }}
                                >
                                    Empezar con {t.nombre}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </a>
                            </div>
                        </Card>
                    </Reveal>
                ))}
            </div>

            {/* ── 2. Después de los 3 meses: el selector de período ────────── */}

            <Reveal className="mx-auto mt-16 max-w-[760px]">
                <Card className="p-6 sm:p-8">
                    <h3 className="text-[19px] font-black tracking-[-0.02em] text-white sm:text-[22px]">
                        Cuando terminan los 3 meses
                    </h3>
                    <p className="mt-2 max-w-[560px] text-[13.5px] leading-relaxed text-slate-400">
                        Elegís desde el panel con qué período seguir. Cuanto más largo, más barato te sale el mes.
                        Sin renovación automática: te avisamos por mail y lo activás vos.
                    </p>

                    {/* Segmentado. `aria-pressed` y no radios: son tres botones que
                        cambian lo que se muestra abajo, no un campo de formulario. */}
                    <div
                        role="group"
                        aria-label="Período de facturación"
                        className="mt-6 flex w-full max-w-[420px] rounded-full p-1"
                        style={{ background: 'var(--oc-card-bg)', border: '1px solid var(--oc-card-bd)' }}
                    >
                        {PERIODOS.map(p => {
                            const activo = p.key === periodo;
                            return (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => setPeriodo(p.key)}
                                    aria-pressed={activo}
                                    className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-full px-2 transition-colors duration-200"
                                    style={{
                                        minHeight: 44,
                                        background: activo ? 'var(--oc-cta-bg)' : 'transparent',
                                        color: activo ? 'var(--oc-cta-fg)' : 'var(--oc-text-3)',
                                    }}
                                >
                                    <span className="text-[13px] font-bold leading-none">{p.nombre}</span>
                                    {p.ahorro !== null && (
                                        <span
                                            className="mt-1 text-[10px] font-bold leading-none"
                                            style={{ color: activo ? 'var(--oc-cta-fg)' : 'var(--oc-ok)' }}
                                        >
                                            −{p.ahorro}%
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {/* Base: es el único que cambia con el selector. */}
                        <div className="rounded-xl p-5" style={{ background: 'var(--oc-card-bg)', border: '1px solid var(--oc-card-bd)' }}>
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-blue-300/80">Base</span>
                            <div className="mt-3 flex items-end gap-1.5">
                                <span className="text-[28px] font-black tracking-[-0.03em] text-white" style={{ lineHeight: 1 }}>
                                    {fmt(elegido.porMes)}
                                </span>
                                <span className="pb-0.5 text-[13px] text-slate-400">/mes</span>
                            </div>
                            <p className="mt-2 text-[12.5px] text-slate-400">
                                {elegido.total ? `${fmt(elegido.total)} ${elegido.cada}` : elegido.cada}
                            </p>
                        </div>

                        {/* Avanzado: hoy siempre mes a mes — ver el comentario de
                            arriba del archivo. */}
                        <div className="rounded-xl p-5" style={{ background: 'var(--oc-card-alt-bg)', border: '1px solid var(--oc-card-alt-bd)' }}>
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-blue-300/80">Base + Avanzado</span>
                            <div className="mt-3 flex items-end gap-1.5">
                                <span className="text-[28px] font-black tracking-[-0.03em] text-white" style={{ lineHeight: 1 }}>
                                    {fmt(AVANZADO_POR_MES)}
                                </span>
                                <span className="pb-0.5 text-[13px] text-slate-400">/mes</span>
                            </div>
                            <p className="mt-2 text-[12.5px] text-slate-400">
                                Mes a mes, sin compromiso
                            </p>
                        </div>
                    </div>

                    {elegido.key !== 'mensual' && (
                        <p className="mt-4 text-[12px] leading-relaxed text-slate-500">
                            Semestral y Anual son del plan Base. El paquete Avanzado hoy se cobra mes a mes,
                            así que podés prenderlo y apagarlo cuando quieras.
                        </p>
                    )}
                </Card>
            </Reveal>

            {/* ── 3. Lo que suma Avanzado ──────────────────────────────────── */}

            <Reveal className="mx-auto mt-16 max-w-[760px]">
                <h3 className="text-center text-[19px] font-black tracking-[-0.02em] text-white sm:text-[22px]">
                    Lo que suma el paquete Avanzado
                </h3>
                <p className="mx-auto mt-2 max-w-[520px] text-center text-[13.5px] leading-relaxed text-slate-400">
                    Siete herramientas que Base no trae. Todo lo demás ya viene en los dos planes.
                </p>

                <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {soloAvanzado.map(p => (
                        <div
                            key={p.titulo}
                            className="rounded-xl p-4"
                            style={{ background: 'var(--oc-card-alt-bg)', border: '1px solid var(--oc-card-alt-bd)' }}
                        >
                            <div className="flex gap-2.5">
                                <span className="mt-[3px] shrink-0"><Marca si /></span>
                                <div className="min-w-0">
                                    <span className="block text-[13.5px] font-bold text-white">{p.titulo}</span>
                                    <span className="mt-1 block text-[12px] leading-relaxed text-slate-400">{p.texto}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Reveal>

            {/* ── 4. Comparación completa, por bloques ─────────────────────── */}

            <div className="mx-auto mt-16 max-w-[820px]">
                <Reveal>
                    <h3 className="text-center text-[19px] font-black tracking-[-0.02em] text-white sm:text-[22px]">
                        Todo lo que trae cada plan
                    </h3>
                    <p className="mx-auto mt-2 max-w-[520px] text-center text-[13.5px] leading-relaxed text-slate-400">
                        Las {PRESTACIONES.length} prestaciones, una por una.
                    </p>
                </Reveal>

                <div className="mt-7 space-y-4">
                    {GRUPOS.map((grupo, i) => (
                        <Reveal key={grupo} delay={i * 60}>
                            <TablaGrupo grupo={grupo} filas={PRESTACIONES.filter(p => p.grupo === grupo)} />
                        </Reveal>
                    ))}
                </div>
            </div>

            {/* ── 5. Preguntas de plan ─────────────────────────────────────── */}

            <div className="mx-auto mt-16 max-w-[760px]">
                <Reveal>
                    <h3 className="text-center text-[19px] font-black tracking-[-0.02em] text-white sm:text-[22px]">
                        Sobre los planes
                    </h3>
                </Reveal>

                <div className="mt-7 space-y-3">
                    {PREGUNTAS.map((f, i) => (
                        <Reveal key={f.q} delay={i * 60}>
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
            </div>

            {/* ── 6. Cierre ────────────────────────────────────────────────── */}

            <Reveal desde="escala" className="mx-auto mt-16 max-w-[640px] text-center">
                <h3 className="text-[22px] font-black tracking-[-0.03em] text-white sm:text-[28px]">
                    ¿Seguís sin decidirte?
                </h3>
                <p className="mx-auto mt-3 max-w-[460px] text-[14px] leading-relaxed text-slate-400">
                    Arrancá con Base. Si después querés las herramientas de Avanzado, las activás
                    desde el panel en dos clics — y también las sacás cuando quieras.
                </p>
                <div className="mx-auto mt-7 flex w-full max-w-[320px] flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
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
                        href="/#precios"
                        className="oc-ghost inline-flex w-full cursor-pointer items-center justify-center rounded-xl px-7 text-[15px] font-semibold text-white/90 transition-colors duration-200 sm:w-auto"
                        style={{ minHeight: 50, border: '1px solid var(--oc-ghost-bd)' }}
                    >
                        Volver al precio
                    </a>
                </div>
            </Reveal>
        </Seccion>
    );
}

/**
 * Un bloque de la comparación: tabla de verdad (no divs) para que un lector de
 * pantalla anuncie "Stock siempre al día, Avanzado, incluido" al recorrerla.
 * El `<caption>` es el nombre del grupo, y las cabeceras Base/Avanzado se
 * repiten en cada bloque: así no hace falta que la fila de columnas quede
 * pegada arriba mientras se scrollea para saber qué columna es cuál.
 */
function TablaGrupo({ grupo, filas }: { grupo: string; filas: Prestacion[] }) {
    return (
        <Card className="overflow-hidden p-0">
            <table className="oc-pl-tabla w-full table-fixed border-collapse text-left">
                <caption className="px-5 pt-5 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300/80 sm:px-6">
                    {grupo}
                </caption>
                <colgroup>
                    <col />
                    <col className="w-[62px] sm:w-[110px]" />
                    <col className="w-[62px] sm:w-[110px]" />
                </colgroup>
                <thead>
                    <tr>
                        <th scope="col" className="sr-only">Prestación</th>
                        <th
                            scope="col"
                            className="px-1 pb-3 pt-4 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400"
                        >
                            Base
                        </th>
                        <th
                            scope="col"
                            className="oc-pl-av px-1 pb-3 pt-4 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-blue-200"
                        >
                            Avanzado
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {filas.map(p => (
                        <tr key={p.titulo}>
                            <th
                                scope="row"
                                className="border-t px-5 py-3.5 text-left font-normal align-top sm:px-6"
                                style={{ borderColor: 'rgba(255,255,255,.05)' }}
                            >
                                <span className="block text-[13.5px] font-semibold text-slate-100">{p.titulo}</span>
                                <span className="mt-1 block text-[11.5px] leading-relaxed text-slate-400">{p.texto}</span>
                            </th>
                            <td
                                className="border-t px-1 py-3.5 text-center align-middle"
                                style={{ borderColor: 'rgba(255,255,255,.05)' }}
                            >
                                <Marca si={!p.soloAvanzado} />
                            </td>
                            <td
                                className="oc-pl-av border-t px-1 py-3.5 text-center align-middle"
                                style={{ borderColor: 'rgba(255,255,255,.05)' }}
                            >
                                <Marca si />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Card>
    );
}
