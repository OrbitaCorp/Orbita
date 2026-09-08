// "Qué incluye" — lo que Órbita HACE HOY, agrupado en tres bloques.
//
// Antes esto eran once tarjetas sueltas en una grilla bento: cada una decía algo
// cierto, pero juntas no se leían — el ojo no encontraba jerarquía y todo pesaba
// lo mismo. Ahora se agrupa por el momento del negocio al que responde cada cosa
// (vender / administrar / crecer), que es como el dueño de la tienda lo piensa.
//
// El contenido salió de recorrer el producto, no de imaginar features: los
// módulos del panel (apps/web/src/modules/ventas/panel/*) y los del backend
// (apps/api/src/*). Si algo de acá deja de existir, hay que sacarlo.
//
// OJO con lo que NO está: turnos y agenda. En el onboarding, todos los rubros de
// la categoría "turnos" figuran como `disponible: false` — el módulo todavía no
// existe. Va en "Próximamente" (sección Rubros), no acá.

import type { ReactNode } from 'react';
import { Reveal, Seccion, Encabezado, Card } from './Reveal';

interface Item { titulo: string; texto: string; icon: ReactNode }
interface Grupo { clave: string; titulo: string; acento: string; items: Item[] }

const GRUPOS: Grupo[] = [
    {
        clave: 'vender', titulo: 'Para vender', acento: '#93c5fd',
        items: [
            {
                titulo: 'Catálogo que entiende tu rubro',
                texto: 'Variantes por talle y color, número de serie o IMEI, o venta por metro, kilo y litro. Con buscador y categorías.',
                icon: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>,
            },
            {
                titulo: 'Cobrás a tu manera',
                texto: 'Con tu Mercado Pago, por transferencia o coordinando el pago aparte con tu cliente: vos elegís cómo cobrar cada venta.',
                icon: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
            },
            {
                titulo: 'Tu dominio propio',
                texto: 'Comprá uno nuevo desde el panel y se vincula solo, o conectá el que ya tenés sin importar dónde lo compraste.',
                icon: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
            },
        ],
    },
    {
        clave: 'administrar', titulo: 'Para administrar', acento: '#86efac',
        items: [
            {
                titulo: 'Pedidos de punta a punta',
                texto: 'Estados, historial y notas de crédito. Cada movimiento queda con su propio registro.',
                icon: <><path d="M3 3h2l2.4 12.6a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 7H6" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></>,
            },
            {
                titulo: 'Stock siempre al día',
                texto: 'Inventario por variante, alertas cuando queda poco y movimientos con su historial.',
                icon: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
            },
            {
                titulo: 'Clientes, mensajes y equipo',
                texto: 'Quién te compra y cuánto, bandeja de conversaciones con plantillas, y empleados con permisos por rol.',
                icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
            },
        ],
    },
    {
        clave: 'crecer', titulo: 'Para crecer', acento: '#d8b4fe',
        items: [
            {
                titulo: 'Orbi, tu asistente con IA',
                texto: 'Conoce tu negocio: te responde sobre tus ventas, tu stock, tus pedidos y más, y te ayuda a resolver cosas en el panel.',
                icon: <><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2M20 14h2M15 13v2M9 13v2" /></>,
            },
            {
                titulo: 'Reportes que se entienden',
                texto: 'Ventas, productos, clientes, inventario y pagos. Números para decidir, no un tablero para estudiar.',
                icon: <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" /></>,
            },
            {
                titulo: 'Descuentos y fotos sin fondo',
                texto: 'Cupones con sus límites y vencimientos, y un clic para sacarle el fondo a la foto del producto.',
                icon: <><path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9" /><circle cx="9" cy="9" r="2" /><path d="m3 19 6-6 3 3 4-4 5 5" /></>,
            },
        ],
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

            <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3">
                {GRUPOS.map((g, gi) => (
                    <Reveal key={g.clave} delay={gi * 110}>
                        <Card className="h-full p-6 sm:p-7">
                            <div className="flex items-baseline gap-2.5">
                                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: g.acento, boxShadow: `0 0 12px ${g.acento}` }} />
                                <h3 className="text-[17px] font-black tracking-[-0.01em] text-white">{g.titulo}</h3>
                            </div>

                            <ul className="mt-6 space-y-5">
                                {g.items.map(it => (
                                    <li key={it.titulo} className="flex gap-3.5">
                                        <span
                                            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                                            style={{ background: 'var(--oc-ghost-bg)', border: '1px solid var(--oc-card-bd)' }}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke={g.acento} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                                                style={{ width: 17, height: 17 }} aria-hidden="true">
                                                {it.icon}
                                            </svg>
                                        </span>
                                        <span>
                                            <span className="block text-[14px] font-bold text-white">{it.titulo}</span>
                                            <span className="mt-1 block text-[12.5px] leading-relaxed text-slate-400">{it.texto}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    </Reveal>
                ))}
            </div>
        </Seccion>
    );
}
