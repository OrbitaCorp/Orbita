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
    /** Clave del recorrido que sigue si la persona toca lo señalado (ej.: "Crear descuento" → la guía del formulario). */
    alTocar?: string
}

export interface Recorrido {
    /** Cómo se nombra: "¿Querés ver cómo funciona X?". */
    titulo: string
    /** La pregunta completa del aviso, si "cómo funciona X" no suena bien (formularios de creación). */
    pregunta?: string
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
            { donde: { boton: 'Nuevo pedido' }, alTocar: 'pedidos/nuevo', titulo: 'Cargá una venta a mano', texto: 'Para lo que vendés por fuera de la tienda: mostrador, WhatsApp o Instagram. Las ventas de la tienda entran solas.' },
            { donde: { texto: 'Pendientes', parcial: true }, titulo: 'Los estados', texto: 'Cada pedido avanza de pestaña: Pendientes, Confirmados, En preparación, Enviados y Entregados. Tu cliente ve ese avance.', opcional: true },
            { donde: { boton: 'Exportar' }, titulo: 'Llevátelo a Excel', texto: 'Descargá la lista de pedidos para guardarla o trabajarla afuera.', opcional: true },
        ],
    },
    catalogo: {
        titulo: 'Productos',
        pasos: [
            { donde: { boton: 'Crear producto' }, alTocar: 'catalogo/nuevo', titulo: 'Creá un producto', texto: 'Nombre, fotos, precio, stock y categoría. Mientras cargás, ves cómo queda en tu tienda.' },
            { donde: { texto: 'Publicados', parcial: true }, titulo: 'Los números de arriba', texto: 'Cuántos productos tenés, cuántos están publicados y cuáles se quedaron sin stock.', opcional: true },
            { donde: { boton: 'Importar Excel' }, titulo: 'Muchos de una vez', texto: 'Si ya tenés tu lista en Excel, subila y se cargan todos juntos.', opcional: true },
        ],
    },
    categorias: {
        titulo: 'Categorías',
        pasos: [
            { donde: { boton: 'Nueva categoría' }, alTocar: 'categorias/nueva', titulo: 'Armá tus categorías', texto: 'Son los rubros con los que tu cliente recorre la tienda. Con 2 a 6 alcanza, y podés sumar subcategorías.' },
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
            { donde: { boton: 'Nueva plantilla' }, alTocar: 'mensajes/plantilla', titulo: 'Respuestas guardadas', texto: 'Escribí una vez lo que te preguntan siempre ("¿hacen envíos?") y mandalo con un toque desde el chat.', opcional: true },
        ],
    },
    descuentos: {
        titulo: 'Descuentos',
        pasos: [
            { donde: { boton: 'Crear descuento' }, alTocar: 'descuentos/crear', titulo: 'Un descuento automático', texto: 'Se aplica solo en el carrito, sin código: un porcentaje, un monto fijo, un 2x1…', opcional: true },
            { titulo: 'Descuento o cupón', texto: 'El descuento se aplica solo. El cupón necesita que tu cliente escriba un código; esos se crean en Cupones.' },
        ],
    },
    cupones: {
        titulo: 'Cupones',
        pasos: [
            { donde: { boton: 'Crear cupón' }, alTocar: 'cupones/crear', titulo: 'Un cupón', texto: 'Un código más un descuento. Podés limitar los usos, pedir un monto mínimo y ponerle vigencia.', opcional: true },
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
            { donde: { boton: 'Invitar miembro' }, alTocar: 'configuracion/equipo/invitar', titulo: 'Sumá a tu gente', texto: 'Los invitás por email y les llega la invitación al correo.', opcional: true },
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

    // ── Formularios de creación: guían campo por campo, sobre el formulario real ──
    // Se abren solos al tocar el botón señalado en el recorrido del módulo, o con
    // "Ver tutorial" desde el formulario. La categoría, la plantilla y la invitación
    // son ventanas (no una pantalla): solo se piden por su clave.
    'descuentos/crear': {
        titulo: 'crear un descuento',
        pregunta: '¿Querés ver cómo se crea un descuento?',
        pasos: [
            { donde: { texto: 'Nombre del descuento' }, titulo: 'Poneles un nombre', texto: 'Elegí uno que te ayude a reconocerlo después, por ejemplo "Promo invierno".' },
            { donde: { texto: 'Tipo de descuento' }, titulo: 'Elegí cómo descuenta', texto: 'Un porcentaje o un monto fijo, sobre productos elegidos o sobre el total del ticket. A la derecha ves cómo queda.' },
            { donde: { texto: 'Vigencia y condiciones', tarjeta: true }, titulo: 'Cuándo vale', texto: 'Desde cuándo y hasta cuándo, qué días y en qué horario. Sin fecha final, no vence.', opcional: true },
            { donde: { texto: 'Resumen', tarjeta: true }, titulo: 'Revisá y creá', texto: 'Acá ves todo junto. Cuando esté bien, tocá "Crear descuento" al final de la página.', opcional: true },
        ],
    },
    'cupones/crear': {
        titulo: 'crear un cupón',
        pregunta: '¿Querés ver cómo se crea un cupón?',
        pasos: [
            { donde: { texto: 'Código del cupón' }, titulo: 'El código', texto: 'Es lo que tu cliente escribe en la tienda para usarlo. Lo podés escribir vos o generarlo.' },
            { donde: { texto: 'Configuración', tarjeta: true }, titulo: 'Qué descuento da', texto: 'Un porcentaje o un monto fijo, y si pedís una compra mínima.', opcional: true },
            { donde: { texto: 'Límites de uso', tarjeta: true }, titulo: 'Cuántas veces', texto: 'Cuántas veces se puede usar en total y cuántas por cada cliente.', opcional: true },
            { donde: { texto: 'Vigencia', tarjeta: true }, titulo: 'Cuándo vale', texto: 'Desde cuándo y hasta cuándo se puede usar el cupón.', opcional: true },
        ],
    },
    'catalogo/nuevo': {
        titulo: 'crear un producto',
        pregunta: '¿Querés ver cómo se crea un producto?',
        pasos: [
            { donde: { texto: 'Fotos' }, titulo: 'Empezá por las fotos', texto: 'La primera es la que se ve en el catálogo. Arrastralas o tocá para subirlas.' },
            { donde: { texto: 'Nombre' }, titulo: 'El nombre', texto: 'Poné cómo lo buscaría tu cliente, por ejemplo "Remera oversize negra".' },
            { donde: { texto: 'Precio' }, titulo: 'Precio y stock', texto: 'El precio es lo que paga tu cliente. El stock baja solo con cada venta.', opcional: true },
            { donde: { texto: 'Categoría' }, titulo: 'Dónde va', texto: 'Elegí en qué categoría aparece dentro de tu tienda.', opcional: true },
            { donde: { boton: 'Publicar' }, titulo: 'Publicalo', texto: 'Publicar lo muestra ya en tu tienda. Con "Guardar borrador" queda oculto hasta que lo termines.', opcional: true },
        ],
    },
    'pedidos/nuevo': {
        titulo: 'cargar una venta',
        pregunta: '¿Querés ver cómo se carga una venta?',
        pasos: [
            { donde: { ayuda: 'pedido-buscar' }, titulo: 'Elegí los productos', texto: 'Buscalos y tocá cada uno para sumarlo al ticket.' },
            { donde: { ayuda: 'pedido-cliente' }, titulo: 'Poné el cliente', texto: 'Elegí uno que ya tengas o cargá uno nuevo con su nombre y email.', opcional: true },
            { donde: { ayuda: 'pedido-cobro' }, titulo: 'Cómo se cobró', texto: 'Efectivo, transferencia o las dos. Queda registrado en tus números.', opcional: true },
            { donde: { ayuda: 'pedido-confirmar' }, titulo: 'Registrala', texto: 'Cuando esté todo, tocá acá: la venta entra a tus pedidos y descuenta el stock.', opcional: true },
        ],
    },
    'categorias/nueva': {
        titulo: 'crear una categoría',
        pregunta: '¿Querés ver cómo se crea una categoría?',
        pasos: [
            { donde: { ayuda: 'cat-nombre' }, titulo: 'El nombre', texto: 'Por ejemplo "Remeras" o "Zapatillas". Es lo que tu cliente ve en el menú de la tienda.' },
            { donde: { ayuda: 'cat-icono' }, titulo: 'Un ícono', texto: 'Elegí uno. Si tenés una foto, se ve mejor: subila arriba, en Imagen.', opcional: true },
            { donde: { ayuda: 'cat-crear' }, titulo: 'Creala', texto: 'Tocá Crear y listo: ya podés cargar productos en ella.', opcional: true },
        ],
    },
    'mensajes/plantilla': {
        titulo: 'crear una plantilla',
        pregunta: '¿Querés ver cómo se crea una plantilla de respuesta?',
        pasos: [
            { donde: { ayuda: 'plantilla-nombre' }, titulo: 'Un nombre', texto: 'Para encontrarla rápido cuando estés chateando, por ejemplo "Horarios".' },
            { donde: { ayuda: 'plantilla-mensaje' }, titulo: 'El mensaje', texto: 'Escribí la respuesta. Con {nombre} o {id} se completa sola con los datos de cada cliente.', opcional: true },
        ],
    },
    'configuracion/equipo/invitar': {
        titulo: 'invitar a alguien',
        pregunta: '¿Querés ver cómo se invita a alguien del equipo?',
        pasos: [
            { donde: { texto: 'Nombre completo' }, titulo: 'Quién es', texto: 'Su nombre y su email: ahí le llega la invitación.' },
            { titulo: 'Qué puede hacer', texto: 'Elegí su rol. El Empleado ve el trabajo del día a día; el Propietario, todo.' },
        ],
    },
}

/** Sección → la vista (?vista=) que abre su formulario de creación. */
const CREACION: Record<string, string> = { descuentos: 'crear', cupones: 'crear', catalogo: 'nuevo', pedidos: 'nuevo' }

/** La clave del recorrido para donde está parado el usuario. */
export function claveDeAyuda(seccion: string, vista?: string): string {
    // Los formularios de creación tienen su propia guía.
    if (vista && CREACION[seccion] === vista) return `${seccion}/${vista}`
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
