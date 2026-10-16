// ─── Los recorridos: el tutorial de cada módulo ──────────────────────────────
//
// Cada módulo tiene un recorrido corto (2 a 4 pasos) que señala cosas reales de
// la pantalla y explica, en dos renglones, qué significan y cómo se hace lo
// principal. Está pensado para el celular: poco texto, nada que leer de más.
//
// Lo que se señala se escribe como la persona lo ve en pantalla (ver ubicar.ts).
// recorridos.test.ts comprueba que cada texto señalado exista en el código: si
// una pantalla cambia un rótulo, el test avisa en vez de dejar un paso sin foco.
// El detalle largo vive en el manual (manual/contenido.ts), no acá.

import type { Donde } from './ubicar'

export interface PasoRecorrido {
    /** Qué se resalta. Sin esto el paso es solo la explicación. */
    donde?: Donde
    titulo: string
    texto: string
    /** Se salta solo si lo señalado no está en la pantalla (botones que dependen de los datos). */
    opcional?: boolean
}

export interface Recorrido {
    /** Cómo se nombra: "¿Querés ver cómo funciona X?". */
    titulo: string
    pasos: PasoRecorrido[]
}

const GUARDAR: PasoRecorrido = {
    donde: { boton: 'Guardar cambios' },
    titulo: 'Guardá los cambios',
    texto: 'Cada pantalla de Configuración se guarda por separado con este botón.',
    opcional: true,
}

/** Clave = la sección de la URL (/admin/ventas/<seccion>), o `configuracion/<vista>`. */
export const RECORRIDOS: Record<string, Recorrido> = {
    dashboard: {
        titulo: 'el Inicio',
        pasos: [
            { donde: { boton: 'Hoy' }, titulo: 'Elegí el período', texto: 'Hoy, Semana, Mes o Personalizado. Todo lo de abajo cambia según lo que elijas.' },
            { donde: { texto: 'Ventas', tarjeta: true }, titulo: 'Tus números', texto: 'Cada tarjeta muestra el valor del período y cómo viene contra el anterior.', opcional: true },
            { donde: { texto: 'Limpiar todas', tarjeta: true }, titulo: 'Alertas', texto: 'Lo que hay que resolver hoy. Tocá "Ir" y te lleva directo. Si todo está al día, no aparece.', opcional: true },
            { donde: { texto: 'Ventas de la semana', tarjeta: true }, titulo: 'Cómo venís', texto: 'Las ventas de los últimos siete días, para ver si subís o bajás.', opcional: true },
        ],
    },
    pedidos: {
        titulo: 'Pedidos',
        pasos: [
            { donde: { boton: 'Nuevo pedido' }, titulo: 'Cargá una venta a mano', texto: 'Para lo que vendés por fuera de la tienda: mostrador, WhatsApp o Instagram. Las ventas de la tienda entran solas.' },
            { donde: { texto: 'Pendientes', parcial: true }, titulo: 'Los estados', texto: 'Cada pedido avanza de pestaña: Pendientes, Confirmados, En preparación, Enviados y Entregados. Tu cliente ve ese avance.', opcional: true },
            { donde: { boton: 'Exportar' }, titulo: 'Llevátelo a Excel', texto: 'Descargá la lista de pedidos para guardarla o trabajarla afuera.', opcional: true },
        ],
    },
    catalogo: {
        titulo: 'Productos',
        pasos: [
            { donde: { boton: 'Crear producto' }, titulo: 'Creá un producto', texto: 'Nombre, fotos, precio, stock y categoría. Mientras cargás, ves cómo queda en tu tienda.' },
            { donde: { texto: 'Publicados', parcial: true }, titulo: 'Los números de arriba', texto: 'Cuántos productos tenés, cuántos están publicados y cuáles se quedaron sin stock.', opcional: true },
            { donde: { boton: 'Importar Excel' }, titulo: 'Muchos de una vez', texto: 'Si ya tenés tu lista en Excel, subila y se cargan todos juntos.', opcional: true },
        ],
    },
    categorias: {
        titulo: 'Categorías',
        pasos: [
            { donde: { boton: 'Nueva categoría' }, titulo: 'Armá tus categorías', texto: 'Son los rubros con los que tu cliente recorre la tienda. Con 2 a 6 alcanza, y podés sumar subcategorías.' },
        ],
    },
    clientes: {
        titulo: 'Clientes',
        pasos: [
            { titulo: 'Se llena solo', texto: 'No hay nada que cargar: cada venta suma o actualiza a su cliente, con lo que gastó y cuándo compró por última vez.' },
            { donde: { boton: 'Exportar' }, titulo: 'Tu base de clientes', texto: 'Descargala cuando quieras para usarla en tus campañas.', opcional: true },
        ],
    },
    mensajes: {
        titulo: 'Mensajes',
        pasos: [
            { titulo: 'La bandeja', texto: 'Acá te escriben tus clientes desde la tienda: las conversaciones a la izquierda y el chat a la derecha.' },
            { donde: { boton: 'Nueva plantilla' }, titulo: 'Respuestas guardadas', texto: 'Escribí una vez lo que te preguntan siempre ("¿hacen envíos?") y mandalo con un toque desde el chat.', opcional: true },
        ],
    },
    descuentos: {
        titulo: 'Descuentos',
        pasos: [
            { donde: { boton: 'Crear descuento' }, titulo: 'Un descuento automático', texto: 'Se aplica solo en el carrito, sin código: un porcentaje, un monto fijo, un 2x1…', opcional: true },
            { titulo: 'Descuento o cupón', texto: 'El descuento se aplica solo. El cupón necesita que tu cliente escriba un código; esos se crean en Cupones.' },
        ],
    },
    cupones: {
        titulo: 'Cupones',
        pasos: [
            { donde: { boton: 'Crear cupón' }, titulo: 'Un cupón', texto: 'Un código más un descuento. Podés limitar los usos, pedir un monto mínimo y ponerle vigencia.', opcional: true },
            { titulo: 'Compartilo', texto: 'Cada cupón se puede compartir por link o mandar por email a tus clientes.' },
        ],
    },
    reportes: {
        titulo: 'Reportes',
        pasos: [
            { titulo: 'Cómo viene el negocio', texto: 'Cinco pestañas: Ventas, Productos, Clientes, Inventario y Pagos. Todas se filtran por el período que elijas.' },
            { donde: { boton: 'Exportar' }, titulo: 'Bajalo a Excel', texto: 'Cada reporte se puede descargar tal como lo ves.', opcional: true },
        ],
    },
    difusion: {
        titulo: 'Difusión',
        pasos: [
            { titulo: 'Tu Instagram, acá adentro', texto: 'Conectá la cuenta profesional de tu negocio para responder mensajes y comentarios, publicar y ver estadísticas sin salir del panel.' },
            { titulo: 'Con Instagram conectado', texto: 'El tablero te muestra tu semana, lo que tenés pendiente y lo que podés publicar.' },
        ],
    },
    avanzado: {
        titulo: 'el paquete Avanzado',
        pasos: [
            { titulo: 'Herramientas extra', texto: 'Juegos con premio, anuncios, 2x1 y 3x2, plantillas de portada y prueba social. Se paga aparte de la suscripción.' },
            { donde: { boton: 'Ver qué incluye' }, titulo: 'Mirá antes de activar', texto: 'Tocá acá para ver qué trae cada herramienta.', opcional: true },
        ],
    },
    perfil: {
        titulo: 'Mi perfil',
        pasos: [
            { donde: { boton: 'Enviarme el código' }, titulo: 'Confirmá tu correo', texto: 'Te mandamos un código de 6 números. Es lo que nos deja devolverte la cuenta si alguna vez perdés el acceso.', opcional: true },
            { titulo: 'Tu cuenta', texto: 'Desde acá también cambiás tu contraseña y elegís el tema claro u oscuro.' },
        ],
    },

    // Configuración: una pantalla por vista.
    'configuracion/negocio': {
        titulo: 'los datos del Negocio',
        pasos: [
            { titulo: 'Los datos de tu negocio', texto: 'Nombre, rubro y dirección del local. Es lo que ven tus clientes y lo que usa el envío para calcular distancias.' },
            GUARDAR,
        ],
    },
    'configuracion/contacto': {
        titulo: 'Contacto',
        pasos: [
            { titulo: 'Cómo te encuentran', texto: 'WhatsApp, email y horarios. Por acá te escribe quien está por comprar y tiene una duda.' },
            GUARDAR,
        ],
    },
    'configuracion/pagos': {
        titulo: 'Pagos',
        pasos: [
            { titulo: 'Cómo te pagan', texto: 'Elegí qué medios acepta tu tienda: efectivo, transferencia o Mercado Pago.' },
            { donde: { boton: 'Conectar cuenta' }, titulo: 'Mercado Pago', texto: 'Conectar tu cuenta permite cobrar con tarjeta desde la tienda. Es opcional y lleva dos minutos.', opcional: true },
        ],
    },
    'configuracion/envios': {
        titulo: 'Envíos',
        pasos: [
            { titulo: 'Cómo entregás', texto: 'Elegí los transportes que ofrecés de verdad, cuánto cobrás y desde cuánto es gratis. También el retiro en tu local.' },
            GUARDAR,
        ],
    },
    'configuracion/redes': {
        titulo: 'las Redes sociales',
        pasos: [
            { titulo: 'Tus redes', texto: 'Instagram, TikTok y Facebook. Se muestran en tu tienda para que te sigan.' },
            GUARDAR,
        ],
    },
    'configuracion/postventa': {
        titulo: 'Cambios y devoluciones',
        pasos: [
            { titulo: 'Tus reglas', texto: 'Definí si aceptás cancelaciones y devoluciones y cómo devolvés: con nota de crédito, por Mercado Pago o las dos.' },
            GUARDAR,
        ],
    },
    // Apariencia es larga: no se explica sección por sección. Tres pasos para
    // orientarse (qué mirar primero, cómo ver el resultado, cómo guardar); cada
    // sección ya trae su propia ayuda al lado.
    'configuracion/apariencia': {
        titulo: 'Apariencia',
        pasos: [
            { donde: { texto: 'Identidad de marca', tarjeta: true }, titulo: 'Empezá por tu marca', texto: 'Subí tu logo y listo: con eso tu tienda ya se ve tuya. Esta pantalla tiene muchas secciones, pero no hace falta tocarlas todas.' },
            { donde: { texto: 'Paleta de colores', tarjeta: true }, titulo: 'Después, los colores', texto: 'Elegí los colores de tu tienda. Cada sección tiene su ayudita al lado si querés saber qué cambia.', opcional: true },
            { donde: { boton: 'Ver mi tienda' }, titulo: 'Mirá cómo queda', texto: 'Tocá acá para ver tu tienda con los cambios antes de guardarlos.', opcional: true },
            GUARDAR,
        ],
    },
    'configuracion/equipo': {
        titulo: 'tu Equipo',
        pasos: [
            { titulo: 'Quién entra al panel', texto: 'Cada persona entra con su propio usuario. El Propietario lo ve todo; el Empleado, solo el trabajo del día a día.' },
            { donde: { boton: 'Invitar miembro' }, titulo: 'Sumá a tu gente', texto: 'Los invitás por email y les llega la invitación al correo.', opcional: true },
        ],
    },
    'configuracion/notificaciones': {
        titulo: 'Notificaciones',
        pasos: [
            { titulo: 'Qué avisos recibís', texto: 'Evento por evento elegís dónde querés el aviso: en el panel, por email, los dos o ninguno.' },
            GUARDAR,
        ],
    },
    'configuracion/suscripcion': {
        titulo: 'tu Suscripción',
        pasos: [
            { titulo: 'Tu plan', texto: 'Qué plan tenés, qué incluye, cuándo se renueva y cómo cambiarlo. Acá también se activa el paquete Avanzado.' },
        ],
    },
    'configuracion/dominios': {
        titulo: 'Dominios',
        pasos: [
            { titulo: 'Tu propia dirección', texto: 'Tu tienda ya tiene su dirección de Órbita y funciona igual. Acá podés comprar o conectar la tuya (tunegocio.com).' },
        ],
    },
    'configuracion/soporte': {
        titulo: 'Soporte',
        pasos: [
            { titulo: 'Escribinos', texto: 'Si algo no cierra, contanos acá. Lo puede usar cualquiera que tenga acceso al panel.' },
        ],
    },
    'configuracion/actividad': {
        titulo: 'el Registro de actividad',
        pasos: [
            { titulo: 'Quién hizo qué', texto: 'Si trabajás con equipo, acá se contesta "¿quién cambió este precio?" sin tener que preguntarle a nadie.' },
        ],
    },
}

/** La clave del recorrido para donde está parado el usuario. */
export function claveDeAyuda(seccion: string, vista?: string): string {
    if (seccion === 'configuracion') {
        // Sin vista (o con la vieja 'general'), Configuración abre en Negocio.
        const v = !vista || vista === 'general' ? 'negocio' : vista
        return RECORRIDOS[`configuracion/${v}`] ? `configuracion/${v}` : seccion
    }
    return seccion
}

/** El recorrido de esa clave, o null si no tiene (manual, zona peligrosa…). */
export function recorridoDe(clave: string): Recorrido | null {
    return RECORRIDOS[clave] ?? null
}
