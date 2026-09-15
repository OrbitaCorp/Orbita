// Fuente única de los planes: la usan las dos tarjetas de precio del home
// (Cierre.tsx#Precios) y la página de comparación (/planes).
//
// Los montos SON los reales (subscriptions.service.ts, BIENVENIDA_TIERS y
// PLANES — si cambian de un lado, cambian del otro). Ya incluyen la comisión
// real de Mercado Pago sobre Suscripciones: el número de lista es lo que
// Órbita recibe LIMPIO, no lo que se cobra.

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

// ─── Las dos tarjetas del alta (beneficio de bienvenida) ────────────────────

const INCLUYE = [
    'Panel de administración completo',
    'Subdominio .orbita.site incluido',
    'Sin comisiones por venta',
    'Soporte prioritario por WhatsApp',
];

export interface Tarjeta {
    key: 'base' | 'avanzado';
    nombre: string;
    /** Precio mensual regular de ESTA tarjeta — se muestra tachado, como ancla. */
    precioTachado: number;
    /** Lo que se cobra hoy, por 3 meses (beneficio de bienvenida). */
    precioBienvenida: number;
    incluye: string[];
    destacada?: boolean;
}

// Los montos son BIENVENIDA_TIERS/PLANES de subscriptions.service.ts.
export const TARJETAS: Tarjeta[] = [
    {
        key: 'base', nombre: 'Base',
        precioTachado: 16500, precioBienvenida: 5500,
        incluye: INCLUYE,
    },
    {
        key: 'avanzado', nombre: 'Base + Avanzado',
        precioTachado: 21700, precioBienvenida: 10900,
        incluye: [...INCLUYE, 'Paquete Avanzado incluido'],
        destacada: true,
    },
];

// ─── Períodos, para DESPUÉS del beneficio de bienvenida ─────────────────────

// Los seis planes de PLANES en subscriptions.service.ts, cruzados: tres
// períodos × dos planes. Semestral y Anual CON Avanzado se sumaron el
// 2026-09-15 (antes Avanzado existía solo mes a mes).
//
// En el ALTA no se eligen: el checkout solo acepta 'mensual' y
// 'mensualAvanzado' (StartPendingCheckoutDto lo valida con @IsIn), y las dos
// arrancan con el beneficio de bienvenida de TARJETAS. El período se elige
// después, desde el panel (Configuración → Suscripción). Por eso /planes
// muestra estos precios como "lo que pagás después", con la bienvenida
// aclarada arriba.
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
