// "Qué incluye" — grilla tipo bento con lo que Órbita HACE HOY.
//
// El contenido salió de recorrer el producto, no de imaginar features: los
// módulos del panel (apps/web/src/modules/ventas/panel/*), los módulos del
// backend (apps/api/src/*) y el paquete Avanzado (panel/avanzado/Avanzado.tsx).
// Si algo de acá deja de existir, hay que sacarlo de esta lista.
//
// OJO con lo que NO está: turnos y agenda. En el onboarding, todos los rubros de
// la categoría "turnos" figuran como `disponible: false` — el módulo todavía no
// existe. Va en la sección "Próximamente", no acá.

import type { ReactNode } from 'react';
import { Reveal, Seccion, Encabezado, Card } from './Reveal';

interface Modulo { titulo: string; texto: string; icon: ReactNode; ancho: 1 | 2 }

const MODULOS: Modulo[] = [
    {
        titulo: 'Tu tienda online, publicada hoy', ancho: 2,
        texto: 'Catálogo con categorías, buscador, carrito y checkout. Variantes según lo que vendas: talles y colores, número de serie o IMEI, o venta por metro, kilo y litro. Sale publicada en tu propio subdominio apenas terminás.',
        icon: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>,
    },
    {
        titulo: 'Cobros con Mercado Pago', ancho: 1,
        texto: 'Se conecta con TU cuenta: la plata entra directo, sin comisión de Órbita por venta.',
        icon: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
    },
    {
        titulo: 'Pedidos de punta a punta', ancho: 1,
        texto: 'Estados, historial, cancelaciones, devoluciones y notas de crédito. Todo con su registro.',
        icon: <><path d="M3 3h2l2.4 12.6a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 7H6" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></>,
    },
    {
        titulo: 'Stock que se descuenta solo', ancho: 1,
        texto: 'Inventario por variante, alertas de faltante y movimientos con su historial.',
        icon: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
    },
    {
        titulo: 'Clientes y mensajes', ancho: 1,
        texto: 'Quién te compra y cuánto, más una bandeja de conversaciones con plantillas listas.',
        icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
    },
    {
        titulo: 'Orbi, tu asistente adentro del panel', ancho: 2,
        texto: 'Un asistente con IA que conoce tu negocio: te responde sobre tus ventas, tu stock y tus pedidos, y te ayuda a hacer cosas en el panel sin buscar dónde estaba cada pantalla.',
        icon: <><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2M20 14h2M15 13v2M9 13v2" /></>,
    },
    {
        titulo: 'Reportes que se entienden', ancho: 1,
        texto: 'Ventas, productos, clientes, inventario y pagos. Números para decidir, no un tablero para estudiar.',
        icon: <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" /></>,
    },
    {
        titulo: 'Descuentos y cupones', ancho: 1,
        texto: 'Códigos, promociones y precios especiales, con sus límites y vencimientos.',
        icon: <><path d="M9 9h.01M15 15h.01M16 8l-8 8" /><path d="M21.5 12a3.5 3.5 0 0 0-2.5-3.35V5a2 2 0 0 0-2-2h-3.65A3.5 3.5 0 0 0 10 .5" /><rect x="2.5" y="8.5" width="19" height="12" rx="2" /></>,
    },
    {
        titulo: 'Fotos sin fondo, en un clic', ancho: 1,
        texto: 'Le sacás el fondo a la foto del producto desde el panel, sin Photoshop ni apps de por medio.',
        icon: <><path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9" /><circle cx="9" cy="9" r="2" /><path d="m3 19 6-6 3 3 4-4 5 5" /></>,
    },
    {
        titulo: 'Equipo con permisos', ancho: 1,
        texto: 'Sumás empleados con roles: cada uno ve y toca solo lo que le corresponde.',
        icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    },
    {
        titulo: 'Tu dominio propio', ancho: 1,
        texto: 'Conectá el que ya tenés, sin importar dónde lo compraste, o comprá uno nuevo desde el panel y queda vinculado solo.',
        icon: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
    },
];

export function Modulos() {
    return (
        <Seccion id="modulos">
            <Encabezado
                eyebrow="Qué incluye"
                titulo="Todo tu negocio,"
                resalte="en un solo panel."
                bajada="No es un carrito por un lado y una planilla por el otro. Es un solo lugar donde la venta, el stock y el cliente son la misma información."
            />

            <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MODULOS.map((m, i) => (
                    <Reveal
                        key={m.titulo}
                        delay={(i % 3) * 80}
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
