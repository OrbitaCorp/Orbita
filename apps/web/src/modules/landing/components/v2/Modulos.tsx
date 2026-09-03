// "Todo el negocio, en un solo panel" — grilla tipo bento con los módulos REALES
// del panel de Órbita (los mismos que orbitan el planeta en el hero).

import type { ReactNode } from 'react';
import { Reveal, Seccion, Encabezado, Card } from './Reveal';

interface Modulo { titulo: string; texto: string; icon: ReactNode; ancho: 1 | 2 }

const MODULOS: Modulo[] = [
    {
        titulo: 'Tienda online propia', ancho: 2,
        texto: 'Catálogo, carrito y checkout con Mercado Pago. Tu tienda vive en tu propio subdominio desde el minuto cero, y podés conectarle un dominio .com cuando quieras.',
        icon: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>,
    },
    {
        titulo: 'Turnos online', ancho: 1,
        texto: 'Tus clientes reservan solos desde el celular, con tus horarios y tus servicios.',
        icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    },
    {
        titulo: 'Pedidos y caja', ancho: 1,
        texto: 'Cada venta entra al panel con su estado, su comprobante y su historial.',
        icon: <><path d="M3 3h2l2.4 12.6a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 7H6" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></>,
    },
    {
        titulo: 'Clientes', ancho: 1,
        texto: 'Quién te compra, cuánto y hace cuánto que no vuelve. Sin planillas.',
        icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
    },
    {
        titulo: 'Stock real', ancho: 1,
        texto: 'El stock baja solo con cada venta y te avisa antes de que te quedes sin nada.',
        icon: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
    },
    {
        titulo: 'Métricas que se entienden', ancho: 2,
        texto: 'Cuánto vendiste hoy, qué producto se mueve, qué día trabajás más. Números claros para decidir, no un tablero que hay que estudiar.',
        icon: <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" /></>,
    },
];

export function Modulos() {
    return (
        <Seccion id="modulos">
            <Encabezado
                eyebrow="Módulos"
                titulo="Todo tu negocio,"
                resalte="en un solo panel."
                bajada="No es una tienda por un lado y una agenda por el otro. Es un solo lugar donde la venta, el turno, el stock y el cliente son la misma información."
            />

            <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MODULOS.map((m, i) => (
                    <Reveal
                        key={m.titulo}
                        delay={i * 80}
                        className={m.ancho === 2 ? 'sm:col-span-2' : ''}
                    >
                        <Card className="oc-card-hover h-full p-6">
                            <span
                                className="mb-4 grid h-11 w-11 place-items-center rounded-xl"
                                style={{ background: 'rgba(59,130,246,.12)', border: '1px solid rgba(147,197,253,.20)' }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ width: 20, height: 20 }} aria-hidden="true">
                                    {m.icon}
                                </svg>
                            </span>
                            <h3 className="text-[16.5px] font-bold text-white">{m.titulo}</h3>
                            <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">{m.texto}</p>
                        </Card>
                    </Reveal>
                ))}
            </div>
        </Seccion>
    );
}
