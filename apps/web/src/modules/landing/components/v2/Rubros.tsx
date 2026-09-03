// Casos de uso por rubro. Los rubros son los mismos que ya maneja el onboarding
// y el carrusel del home viejo (RubrosCarousel.tsx) — no se inventan verticales
// que el producto no contemple.

import type { ReactNode } from 'react';
import { Reveal, Seccion, Encabezado, Card } from './Reveal';

interface Rubro { nombre: string; usa: string; detalle: string; icon: ReactNode }

const RUBROS: Rubro[] = [
    {
        nombre: 'Barbería y estética', usa: 'Turnos',
        detalle: 'Agenda por profesional, servicios con duración propia y recordatorio al cliente.',
        icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    },
    {
        nombre: 'Indumentaria', usa: 'Tienda',
        detalle: 'Talles y colores como variantes, stock por variante y envíos configurables.',
        icon: <><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" /></>,
    },
    {
        nombre: 'Gastronomía', usa: 'Pedidos',
        detalle: 'Carta online, pedidos con retiro o delivery y estados que el cliente ve en vivo.',
        icon: <><path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-3 9v11" /></>,
    },
    {
        nombre: 'Pet shop', usa: 'Tienda + Turnos',
        detalle: 'Vendés alimento y a la vez agendás la peluquería. Los dos módulos en el mismo panel.',
        icon: <><circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 0 1 5 5v3a3 3 0 0 1-6 0v-3a5 5 0 0 1 1-3z" /></>,
    },
    {
        nombre: 'Ferretería y corralón', usa: 'Stock',
        detalle: 'Catálogo largo con buscador, precios por unidad y control de lo que queda.',
        icon: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>,
    },
    {
        nombre: 'Gimnasios y clases', usa: 'Turnos',
        detalle: 'Cupos por horario, clases recurrentes y quién viene esta semana.',
        icon: <><path d="M6.5 6.5h11v11h-11zM2 9v6M22 9v6" /></>,
    },
];

export function Rubros() {
    return (
        <Seccion id="rubros">
            <Encabezado
                eyebrow="Rubros"
                titulo="Mismo panel,"
                resalte="distinto negocio."
                bajada="Órbita se acomoda a lo que vendés: productos, turnos, o las dos cosas a la vez."
            />

            <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {RUBROS.map((r, i) => (
                    <Reveal key={r.nombre} delay={i * 70}>
                        <Card className="oc-card-hover h-full p-6">
                            <div className="flex items-start justify-between gap-3">
                                <span
                                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                                    style={{ background: 'rgba(59,130,246,.12)', border: '1px solid rgba(147,197,253,.20)' }}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                                        style={{ width: 20, height: 20 }} aria-hidden="true">
                                        {r.icon}
                                    </svg>
                                </span>
                                <span
                                    className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-200"
                                    style={{ background: 'rgba(59,130,246,.10)', border: '1px solid rgba(147,197,253,.18)' }}
                                >
                                    {r.usa}
                                </span>
                            </div>
                            <h3 className="mt-4 text-[16px] font-bold text-white">{r.nombre}</h3>
                            <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">{r.detalle}</p>
                        </Card>
                    </Reveal>
                ))}
            </div>
        </Seccion>
    );
}
