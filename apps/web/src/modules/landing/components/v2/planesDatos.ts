// Fuente única de los planes: la usan las dos tarjetas de precio del home
// (Cierre.tsx#Precios) y la página de comparación detallada (/planes).
//
// Antes esta lista vivía adentro de Cierre.tsx, donde la leían las tarjetas y
// el modal comparador. Con la página /planes (2026-09) pasaron a existir DOS
// pantallas mostrando lo mismo, así que los datos salieron acá: una sola
// lista, sin forma de que se desincronicen entre sí.
//
// Los montos SON los reales (subscriptions.service.ts, BIENVENIDA_TIERS y
// PLANES — si cambian de un lado, cambian del otro). Ya incluyen la comisión
// real de Mercado Pago sobre Suscripciones: el número de lista es lo que
// Órbita recibe LIMPIO, no lo que se cobra.

// ─── Prestaciones ───────────────────────────────────────────────────────────

// `soloAvanzado` marca las que no entran en Base — de ahí sale tanto la
// comparación como la lista de "lo que suma Avanzado", así que alcanza con
// tocar este flag para que las dos cambien juntas.
//
// `grupo` es solo para /planes: ordena la comparación en bloques temáticos en
// vez de una lista corrida de 18 filas. El home no lo usa.
//
// Los textos son los mismos de Modulos.tsx y Avanzado.tsx, para que lo que
// promete la comparación y lo que dice el resto de la home sean la misma cosa.
// El "Aviso de salida" (viejo exit-intent) se eliminó del producto el
// 2026-09-09, por eso no aparece.
// OJO con un ítem: Modulos.tsx tiene "Descuentos y fotos sin fondo", que
// mezcla dos cosas — cupones (sí, de Base) y sacarle el fondo a la foto
// (`removeBackground`, gateado por el addon ADVANCED en products.service.ts).
// Acá van separados a propósito.
export type GrupoPrestacion =
    | 'Tu tienda online'
    | 'Catálogo y stock'
    | 'Ventas y cobros'
    | 'Herramientas para vender más'
    | 'Gestión, equipo y soporte';

export interface Prestacion {
    titulo: string;
    texto: string;
    grupo: GrupoPrestacion;
    soloAvanzado?: boolean;
}

export const PRESTACIONES: Prestacion[] = [
    { grupo: 'Tu tienda online', titulo: 'Tu dominio propio', texto: 'Comprá uno nuevo desde el panel, o conectá el que ya tenés sin importar dónde lo compraste.' },
    { grupo: 'Tu tienda online', titulo: 'Sin comisiones por venta', texto: 'Cobrás vos, en tu propia cuenta. Órbita no se queda con nada de lo que vendés.' },
    { grupo: 'Tu tienda online', titulo: 'Plantillas de portada', texto: 'Dieciséis diseños distintos para la portada de tu tienda, sin tocar el catálogo ni el checkout.', soloAvanzado: true },

    { grupo: 'Catálogo y stock', titulo: 'Catálogo que entiende tu rubro', texto: 'Variantes por talle y color, número de serie o IMEI, o venta por metro, kilo y litro.' },
    { grupo: 'Catálogo y stock', titulo: 'Stock siempre al día', texto: 'Inventario por variante, alertas cuando queda poco y movimientos con su historial.' },
    { grupo: 'Catálogo y stock', titulo: 'Fotos sin fondo automáticas', texto: 'Sacale el fondo a la foto de tu producto con un clic, sin depender de otra herramienta.', soloAvanzado: true },

    { grupo: 'Ventas y cobros', titulo: 'Cobrás a tu manera', texto: 'Con tu Mercado Pago, por transferencia o coordinando el pago aparte con tu cliente.' },
    { grupo: 'Ventas y cobros', titulo: 'Pedidos de punta a punta', texto: 'Estados, historial y notas de crédito. Cada movimiento queda con su propio registro.' },
    { grupo: 'Ventas y cobros', titulo: 'Descuentos y cupones', texto: 'Cupones con sus límites y vencimientos, aplicados solos en el carrito.' },
    { grupo: 'Ventas y cobros', titulo: '2x1 y 3x2', texto: 'Promo "llevá X, pagá Y" que se aplica sola en el carrito, sin código.', soloAvanzado: true },
    { grupo: 'Ventas y cobros', titulo: 'Oferta relámpago', texto: 'Un descuento que dura poco, con un reloj en tu tienda que muestra el tiempo que falta.', soloAvanzado: true },

    { grupo: 'Herramientas para vender más', titulo: 'Modales de anuncios', texto: 'Promos, bienvenida con descuento y avisos que aparecen en el momento justo de la visita.', soloAvanzado: true },
    { grupo: 'Herramientas para vender más', titulo: 'Juegos con premio', texto: 'Mini-juegos donde tu cliente se gana un descuento. Vos ponés el tope; el descuento se crea solo.', soloAvanzado: true },
    { grupo: 'Herramientas para vender más', titulo: 'Prueba social', texto: 'Avisos de "alguien acaba de comprar esto" armados con pedidos reales de tu tienda.', soloAvanzado: true },

    { grupo: 'Gestión, equipo y soporte', titulo: 'Clientes, mensajes y equipo', texto: 'Quién te compra y cuánto, bandeja de conversaciones, y empleados con permisos por rol.' },
    { grupo: 'Gestión, equipo y soporte', titulo: 'Orbi, tu asistente con IA', texto: 'Te responde sobre tus ventas, tu stock y tus pedidos, y te ayuda a resolver cosas en el panel.' },
    { grupo: 'Gestión, equipo y soporte', titulo: 'Reportes que se entienden', texto: 'Ventas, productos, clientes, inventario y pagos. Números para decidir, no un tablero para estudiar.' },
    { grupo: 'Gestión, equipo y soporte', titulo: 'Soporte prioritario por WhatsApp', texto: 'Te respondemos directo, sin tickets ni esperas largas.' },
];

// El orden en que se muestran los bloques en /planes. Se declara aparte (en
// vez de derivarlo del orden de PRESTACIONES) para que agregar una prestación
// en el medio no reordene la página sin querer.
export const GRUPOS: GrupoPrestacion[] = [
    'Tu tienda online',
    'Catálogo y stock',
    'Ventas y cobros',
    'Herramientas para vender más',
    'Gestión, equipo y soporte',
];

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
    /** Precio mensual regular de ESTA tarjeta — se muestra tachado, como ancla. */
    precioTachado: number;
    /** Lo que se cobra hoy, por 3 meses (beneficio de bienvenida). */
    precioBienvenida: number;
    incluye: string[];
    destacada?: boolean;
}

// Dos tarjetas nomás. Los montos son BIENVENIDA_TIERS/PLANES de
// subscriptions.service.ts.
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

// Ojo con esto antes de tocarlo: en el ALTA no se pueden elegir. El checkout
// solo acepta 'mensual' y 'mensualAvanzado' (StartPendingCheckoutDto lo valida
// con @IsIn) — Semestral y Anual existen únicamente como cambio de plan desde
// el panel, una vez que sos cliente. Por eso en /planes el selector de período
// vive en su propia sección ("cuando terminan los 3 meses") y no manda el
// precio del encabezado: el precio que se paga HOY es el de bienvenida.
//
// Y son los tres de Base: hoy no existe un semestral/anual CON Avanzado
// (subscriptions.service.ts, PlanKey — el único con Avanzado es
// 'mensualAvanzado'). Si algún día se suma, va acá y en ese archivo.
export type PeriodoKey = 'mensual' | 'semestral' | 'anual';

export interface Periodo {
    key: PeriodoKey;
    nombre: string;
    /** Lo que termina costando cada mes, prorrateado. */
    porMes: number;
    /** Lo que se cobra de una vez. null = se cobra mes a mes. */
    total: number | null;
    cada: string;
    /** Cuánto más barato que el mensual, en %. null en el mensual. */
    ahorro: number | null;
}

// $14.667 = 88.000 / 6 y $13.000 = 156.000 / 12, los mismos valores que
// muestra el panel (configuracion/Suscripcion.tsx, PLANES).
export const PERIODOS: Periodo[] = [
    { key: 'mensual', nombre: 'Mensual', porMes: 16500, total: null, cada: 'Sin compromiso', ahorro: null },
    { key: 'semestral', nombre: 'Semestral', porMes: 14667, total: 88000, cada: 'cada 6 meses', ahorro: 11 },
    { key: 'anual', nombre: 'Anual', porMes: 13000, total: 156000, cada: 'por año', ahorro: 21 },
];

/** Precio del plan con Avanzado. Uno solo: hoy es siempre mes a mes. */
export const AVANZADO_POR_MES = 21700;

export const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`;
