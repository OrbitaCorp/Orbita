// Comparación de los dos planes — página propia (/planes), a la que se llega
// desde el "Ver más detalle" de las tarjetas de precio del home.
//
// ─── Por qué NO arranca con las tarjetas de bienvenida ──────────────────────
//
// La primera versión de esta página abría con las mismas dos tarjetas que la
// sección de precios del home (mismo precio grande de bienvenida, misma
// bajada, mismo layout). Reportado con captura: "parecen iguales, da la
// sensación de que nunca me redirige a una vista nueva". Tenían razón — era
// la misma pantalla dos veces.
//
// Ahora abre por donde el home NO puede: el SELECTOR DE PERÍODO y el precio
// recurrente de cada plan. El home vende el arranque (3 meses de bienvenida);
// esta página responde "¿y después, cuánto?" y "¿qué trae cada uno?". La
// bienvenida queda como una línea de contexto arriba, no como el titular.
//
// El período se elige desde el panel, no en el alta: el checkout solo acepta
// 'mensual' y 'mensualAvanzado' (StartPendingCheckoutDto lo valida con @IsIn).
// Por eso el CTA dice "Crear tu espacio" y no "Contratar semestral".

import { useState } from 'react';
import { Reveal, Seccion, Encabezado, Card } from './Reveal';
import {
    PRESTACIONES_BASE, PRESTACIONES_AVANZADO, PERIODOS, TARJETAS, fmt,
    type PeriodoKey, type PlanTarjeta,
} from './planesDatos';

function Tilde() {
    return (
        <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--oc-ok)"
            strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"
            className="mt-[3px] shrink-0" aria-hidden="true"
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

export function Planes() {
    const [periodo, setPeriodo] = useState<PeriodoKey>('mensual');
    const p = PERIODOS.find(x => x.key === periodo) ?? PERIODOS[0];

    const bienvenida = (key: PlanTarjeta) => TARJETAS.find(t => t.key === key)!.precioBienvenida;

    return (
        <Seccion id="planes">
            <Encabezado
                eyebrow="Comparar planes"
                titulo="Qué trae cada plan,"
                resalte="y cuánto sale cada período."
                bajada="Los dos traen Órbita completo: el mismo panel, el mismo catálogo, los mismos cobros y 0% de comisión. Avanzado suma las herramientas para vender más."
            />

            {/* Contexto: estos precios son los de DESPUÉS. Va arriba y en chico
                a propósito — el titular de esta página es el período, no la
                bienvenida (que ya es el titular del home). */}
            <Reveal className="mx-auto mt-8 max-w-[560px]">
                <p
                    className="rounded-xl px-5 py-3.5 text-center text-[12.5px] leading-relaxed text-slate-300"
                    style={{ background: 'var(--oc-card-bg)', border: '1px solid var(--oc-card-bd)' }}
                >
                    Todos arrancan con <strong className="font-bold text-white">3 meses de bienvenida</strong>
                    {' '}— {fmt(bienvenida('base'))} en Base o {fmt(bienvenida('avanzado'))} en Base + Avanzado.
                    Estos son los precios de después, que elegís desde tu panel.
                </p>
            </Reveal>

            {/* Selector de período */}
            <Reveal className="mt-8 flex justify-center">
                <div
                    role="group"
                    aria-label="Período de facturación"
                    className="flex w-full max-w-[400px] rounded-full p-1"
                    style={{ background: 'var(--oc-card-bg)', border: '1px solid var(--oc-card-bd)' }}
                >
                    {PERIODOS.map(op => {
                        const activo = op.key === periodo;
                        return (
                            <button
                                key={op.key}
                                type="button"
                                onClick={() => setPeriodo(op.key)}
                                aria-pressed={activo}
                                className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-full px-2 transition-colors duration-200"
                                style={{
                                    minHeight: 46,
                                    background: activo ? 'var(--oc-cta-bg)' : 'transparent',
                                    color: activo ? 'var(--oc-cta-fg)' : 'var(--oc-text-3)',
                                }}
                            >
                                <span className="text-[13px] font-bold leading-none">{op.nombre}</span>
                                {op.ahorro !== null && (
                                    <span
                                        className="mt-1 text-[10px] font-bold leading-none"
                                        style={{ color: activo ? 'var(--oc-cta-fg)' : 'var(--oc-ok)' }}
                                    >
                                        −{op.ahorro}%
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </Reveal>

            {/* Las dos columnas */}
            <div className="mx-auto mt-8 grid max-w-[820px] grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Base */}
                <Reveal desde="escala">
                    <Card className="flex h-full flex-col p-7">
                        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300/80">Base</span>

                        <div className="mt-4 flex items-end gap-1.5">
                            <span className="text-[34px] font-black tracking-[-0.04em] text-white sm:text-[40px]" style={{ lineHeight: 1 }}>
                                {fmt(p.porMes.base)}
                            </span>
                            <span className="pb-1.5 text-[13px] text-slate-400">/mes</span>
                        </div>
                        <p className="mt-2 text-[12.5px] text-slate-400">
                            {p.key === 'mensual'
                                ? 'Se cobra mes a mes, sin compromiso'
                                : `${fmt(p.total.base)} ${p.cada}`}
                        </p>

                        <ul className="mt-6 flex-1 space-y-2.5">
                            {PRESTACIONES_BASE.map(f => (
                                <li key={f.titulo} className="flex gap-2.5 text-[13px] text-slate-200">
                                    <Tilde />
                                    {f.titulo}
                                </li>
                            ))}
                        </ul>

                        <a
                            href="/onboarding/rubro"
                            className="oc-ghost mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[14.5px] font-bold transition-colors duration-200"
                            style={{ minHeight: 48, border: '1px solid var(--oc-ghost-bd)' }}
                        >
                            Crear tu espacio
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </a>
                    </Card>
                </Reveal>

                {/* Base + Avanzado */}
                <Reveal desde="escala" delay={90}>
                    <Card destacada className="relative flex h-full flex-col p-7">
                        <span
                            className="absolute right-5 top-5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.10em] text-blue-200"
                            style={{ background: 'rgba(59,130,246,.18)', border: '1px solid var(--oc-accent-bd)' }}
                        >
                            Más elegido
                        </span>

                        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300/80">Base + Avanzado</span>

                        <div className="mt-4 flex items-end gap-1.5">
                            <span className="text-[34px] font-black tracking-[-0.04em] text-white sm:text-[40px]" style={{ lineHeight: 1 }}>
                                {fmt(p.porMes.avanzado)}
                            </span>
                            <span className="pb-1.5 text-[13px] text-slate-400">/mes</span>
                        </div>
                        <p className="mt-2 text-[12.5px] text-slate-400">
                            {p.key === 'mensual'
                                ? 'Se cobra mes a mes, sin compromiso'
                                : `${fmt(p.total.avanzado)} ${p.cada}`}
                        </p>

                        {/* "Todo lo del plan Base" primero, como en cualquier
                            comparativa de planes: evita repetir las once líneas de
                            Base y deja a la vista que la diferencia son las siete
                            de abajo. */}
                        <p className="mt-6 text-[13px] font-bold text-white">Todo lo del plan Base, más:</p>

                        <ul className="mt-3 flex-1 space-y-2.5">
                            {PRESTACIONES_AVANZADO.map(f => (
                                <li key={f.titulo} className="flex gap-2.5 text-[13px] text-slate-200">
                                    <Tilde />
                                    {f.titulo}
                                </li>
                            ))}
                        </ul>

                        <a
                            href="/onboarding/rubro"
                            className="oc-cta mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[14.5px] font-bold transition-colors duration-200"
                            style={{ minHeight: 48 }}
                        >
                            Crear tu espacio
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </a>
                    </Card>
                </Reveal>
            </div>

            <Reveal className="mx-auto mt-8 max-w-[620px] text-center">
                <p className="text-[12.5px] leading-relaxed text-slate-400">
                    Sin renovación automática: cuando termina tu período te avisamos por mail y lo renovás vos.
                    Podés cambiar de período, o sumar y sacar el paquete Avanzado, cuando quieras desde el panel.
                </p>
            </Reveal>
        </Seccion>
    );
}
