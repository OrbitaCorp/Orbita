// Paquete "Avanzado" — el add-on que se paga aparte de la suscripción.
//
// Las cuatro features son las que YA tienen pantalla real en el panel
// (CON_PANTALLA en panel/avanzado/Avanzado.tsx: juegos, modales, plantillas y
// prueba social). "Countdown y exit-intent" existe como tarjeta pero todavía no
// está construida, así que no se promete acá.
//
// Los textos son los mismos que ve el dueño adentro del panel, para que lo que
// promete la landing y lo que encuentra después sean la misma cosa.

import type { ReactNode } from 'react';
import { Reveal, Seccion, Encabezado, Card } from './Reveal';

interface Feature { titulo: string; texto: string; icon: ReactNode }

const FEATURES: Feature[] = [
    {
        titulo: 'Plantillas de portada',
        texto: 'Veinte diseños distintos para la portada de tu tienda. Cambiás el look sin tocar el catálogo ni el checkout.',
        icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
    },
    {
        titulo: 'Modales de anuncios',
        texto: 'Promos, bienvenida con descuento y avisos que aparecen en el momento justo de la visita.',
        icon: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
    },
    {
        titulo: 'Juegos con premio',
        texto: 'Mini-juegos donde tu cliente se gana un descuento. Vos ponés cuánto se gana y el tope; el descuento se crea solo.',
        icon: <><path d="M6 11h4M8 9v4M15 12h.01M18 10h.01" /><rect x="2" y="6" width="20" height="12" rx="4" /></>,
    },
    {
        titulo: 'Prueba social',
        texto: 'Avisos de "alguien acaba de comprar esto" armados con pedidos reales de tu tienda, nunca con datos inventados.',
        icon: <><path d="M20 6 9 17l-5-5" /><circle cx="12" cy="12" r="10" /></>,
    },
];

export function Avanzado() {
    return (
        <Seccion id="avanzado">
            <Encabezado
                eyebrow="Paquete avanzado"
                titulo="Y cuando quieras vender más,"
                resalte="hay otra marcha."
                bajada="Un paquete opcional con las herramientas que empujan la conversión. Se activa cuando lo necesitás, no viene forzado desde el día uno."
            />

            <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {FEATURES.map((f, i) => (
                    <Reveal key={f.titulo} delay={(i % 2) * 90}>
                        <Card className="oc-card-hover h-full p-6">
                            <span
                                className="mb-4 grid h-11 w-11 place-items-center rounded-xl"
                                style={{ background: 'rgba(168,85,247,.13)', border: '1px solid rgba(216,180,254,.22)' }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="#d8b4fe" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ width: 20, height: 20 }} aria-hidden="true">
                                    {f.icon}
                                </svg>
                            </span>
                            <h3 className="text-[16.5px] font-bold text-white">{f.titulo}</h3>
                            <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">{f.texto}</p>
                        </Card>
                    </Reveal>
                ))}
            </div>
        </Seccion>
    );
}
