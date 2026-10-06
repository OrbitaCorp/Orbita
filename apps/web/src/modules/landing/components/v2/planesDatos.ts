// Fuente única de los planes: la usan las dos tarjetas de precio del home
// (Cierre.tsx#Precios) y la página de comparación (/planes).
//
// Los montos SON los reales (PLANES en subscriptions.service.ts — si cambian
// de un lado, cambian del otro) y ya incluyen la comisión de Mercado Pago
// sobre Suscripciones.
//
// Lo que NO está acá es el precio promocional: desde 2026-10 no hay un
// "beneficio de bienvenida" fijo, sino campañas de precio congelado que se
// prenden y editan desde el superadmin. Las pantallas lo leen con useOferta().

// ─── Prestaciones ───────────────────────────────────────────────────────────

// `soloAvanzado` marca las que no entran en Base. De ese flag salen las DOS
// listas de /planes (lo que trae Base, y lo que Avanzado le suma encima), así
// que alcanza con tocarlo para que las dos cambien juntas.
//
// Los textos son los mismos de Modulos.tsx y Avanzado.tsx, para que lo que
// promete la comparación y lo que dice el resto de la home sean la misma cosa.
// El "Aviso de salida" (viejo exit-intent) se eliminó del producto el
// 2026-09-09, por eso no aparece.
// OJO con un ítem: Modulos.tsx tiene "Descuentos y fotos sin fondo", que
// mezcla dos cosas — cupones (sí, de Base) y sacarle el fondo a la foto
// (`removeBackground`, gateado por el addon ADVANCED en products.service.ts).
// Acá van separados a propósito.
export interface Prestacion {
    titulo: string;
    texto: string;
    soloAvanzado?: boolean;
}

export const PRESTACIONES: Prestacion[] = [
    { titulo: 'Catálogo que entiende tu rubro', texto: 'Variantes por talle y color, número de serie o IMEI, o venta por metro, kilo y litro.' },
    { titulo: 'Cobrás a tu manera', texto: 'Con tu Mercado Pago, por transferencia o coordinando el pago aparte con tu cliente.' },
    { titulo: 'Tu dominio propio', texto: 'Comprá uno nuevo desde el panel, o conectá el que ya tenés sin importar dónde lo compraste.' },
    { titulo: 'Pedidos de punta a punta', texto: 'Estados, historial y notas de crédito. Cada movimiento queda con su propio registro.' },
    { titulo: 'Stock siempre al día', texto: 'Inventario por variante, alertas cuando queda poco y movimientos con su historial.' },
    { titulo: 'Clientes, mensajes y equipo', texto: 'Quién te compra y cuánto, bandeja de conversaciones, y empleados con permisos por rol.' },
    { titulo: 'Orbi, tu asistente con IA', texto: 'Te responde sobre tus ventas, tu stock y tus pedidos, y te ayuda a resolver cosas en el panel.' },
    { titulo: 'Reportes que se entienden', texto: 'Ventas, productos, clientes, inventario y pagos. Números para decidir, no un tablero para estudiar.' },
    { titulo: 'Descuentos y cupones', texto: 'Cupones con sus límites y vencimientos, aplicados solos en el carrito.' },
    { titulo: 'Sin comisiones por venta', texto: 'Cobrás vos, en tu propia cuenta. Órbita no se queda con nada de lo que vendés.' },
    { titulo: 'Soporte prioritario por WhatsApp', texto: 'Te respondemos directo, sin tickets ni esperas largas.' },
    { titulo: 'Plantillas de portada', texto: 'Dieciséis diseños distintos para la portada de tu tienda, sin tocar el catálogo ni el checkout.', soloAvanzado: true },
    { titulo: 'Modales de anuncios', texto: 'Promos, bienvenida con descuento y avisos que aparecen en el momento justo de la visita.', soloAvanzado: true },
    { titulo: 'Juegos con premio', texto: 'Mini-juegos donde tu cliente se gana un descuento. Vos ponés el tope; el descuento se crea solo.', soloAvanzado: true },
    { titulo: 'Prueba social', texto: 'Avisos de "alguien acaba de comprar esto" armados con pedidos reales de tu tienda.', soloAvanzado: true },
    { titulo: '2x1 y 3x2', texto: 'Promo "llevá X, pagá Y" que se aplica sola en el carrito, sin código.', soloAvanzado: true },
    { titulo: 'Oferta relámpago', texto: 'Un descuento que dura poco, con un reloj en tu tienda que muestra el tiempo que falta.', soloAvanzado: true },
    { titulo: 'Fotos sin fondo automáticas', texto: 'Sacale el fondo a la foto de tu producto con un clic, sin depender de otra herramienta.', soloAvanzado: true },
];

export const PRESTACIONES_BASE = PRESTACIONES.filter(p => !p.soloAvanzado);
export const PRESTACIONES_AVANZADO = PRESTACIONES.filter(p => p.soloAvanzado);

// ─── Las dos tarjetas del alta ──────────────────────────────────────────────

const INCLUYE = [
    'Panel de administración completo',
    'Subdominio .orbita.site incluido',
    'Sin comisiones por venta',
    'Soporte prioritario por WhatsApp',
];

export interface Tarjeta {
    key: 'base' | 'avanzado';
    nombre: string;
    /** Precio de lista por mes. Con una campaña prendida se muestra tachado. */
    precioLista: number;
    incluye: string[];
    destacada?: boolean;
}

// Los montos son PLANES.mensual / PLANES.mensualAvanzado de subscriptions.service.ts.
export const TARJETAS: Tarjeta[] = [
    {
        key: 'base', nombre: 'Base',
        precioLista: 16500,
        incluye: INCLUYE,
    },
    {
        key: 'avanzado', nombre: 'Base + Avanzado',
        precioLista: 21700,
        incluye: [...INCLUYE, 'Paquete Avanzado incluido'],
        destacada: true,
    },
];

// ─── Períodos, para después del primer mes ──────────────────────────────────

// Los seis planes de PLANES en subscriptions.service.ts, cruzados: tres
// períodos × dos planes. Semestral y Anual CON Avanzado se sumaron el
// 2026-09-15 (antes Avanzado existía solo mes a mes).
//
// En el ALTA no se eligen: el checkout solo acepta 'mensual' y
// 'mensualAvanzado' (StartPendingCheckoutDto lo valida con @IsIn), y se paga
// el primer mes. El período se elige después, desde el panel (Configuración →
// Suscripción), cuando se autoriza el débito automático.
export type PeriodoKey = 'mensual' | 'semestral' | 'anual';
export type PlanTarjeta = 'base' | 'avanzado';

export interface Periodo {
    key: PeriodoKey;
    nombre: string;
    /** Lo que se cobra de una vez, por plan. */
    total: Record<PlanTarjeta, number>;
    /** Lo que termina costando cada mes, prorrateado. */
    porMes: Record<PlanTarjeta, number>;
    /** Cada cuánto se cobra ese total. */
    cada: string;
    /** Cuánto más barato que el mensual, en %. null en el mensual. */
    ahorro: number | null;
}

// Los "porMes" son el total dividido por los meses del período, redondeado —
// los mismos valores que muestra el panel (configuracion/Suscripcion.tsx).
// El ahorro da igual en los dos planes porque Avanzado lleva exactamente el
// mismo descuento por período que Base.
export const PERIODOS: Periodo[] = [
    {
        key: 'mensual', nombre: 'Mensual', cada: 'por mes', ahorro: null,
        total: { base: 16500, avanzado: 21700 },
        porMes: { base: 16500, avanzado: 21700 },
    },
    {
        key: 'semestral', nombre: 'Semestral', cada: 'cada 6 meses', ahorro: 11,
        total: { base: 88000, avanzado: 116000 },
        porMes: { base: 14667, avanzado: 19333 },
    },
    {
        key: 'anual', nombre: 'Anual', cada: 'por año', ahorro: 21,
        total: { base: 156000, avanzado: 205000 },
        porMes: { base: 13000, avanzado: 17083 },
    },
];

export const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`;

// ─── Precio de una tarjeta según la oferta vigente ──────────────────────────

/** La campaña pública de precio congelado, tal como la devuelve la API. */
export interface Campania {
    name: string;
    priceBase: number;
    priceAdvanced: number;
    months: number;
    maxSlots: number | null;
    slotsLeft: number | null;
}

/** Lo que paga por mes esta tarjeta si entra por la campaña. */
export const precioCongelado = (key: PlanTarjeta, c: Campania) => (key === 'avanzado' ? c.priceAdvanced : c.priceBase);

/** "3 meses" / "1 mes". */
export const meses = (n: number) => (n === 1 ? '1 mes' : `${n} meses`);

/** "Quedan 26 de 30 lugares", o null si la campaña no tiene cupo. */
export function lugares(c: Campania): string | null {
    if (c.maxSlots === null || c.slotsLeft === null) return null;
    return c.slotsLeft === 1 ? `Queda 1 de ${c.maxSlots} lugares` : `Quedan ${c.slotsLeft} de ${c.maxSlots} lugares`;
}
