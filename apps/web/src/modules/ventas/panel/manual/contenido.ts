// ─── Manual de uso · TODO el contenido ───────────────────────────────────────
//
// Fuente única del manual: el shell (Manual.tsx) no tiene ni una línea de
// texto, solo dibuja esto. Así, cuando una pantalla cambia, se corrige acá y
// listo — igual que tutoriales/copy.ts, que es el hermano corto de este
// archivo (el tutorial guía una acción; el manual explica la pantalla entera).
//
// El contenido está escrito contra lo que el panel REALMENTE hace hoy: cada
// label, estado y botón que se nombra acá existe con ese nombre en el código
// (Dashboard.tsx, PedidoLista.tsx, ProductoLista.tsx, ConfigGeneral.tsx,
// ConfigSidebar.tsx, Avanzado.tsx, LinkCompartibleModal.tsx, etc.). Si se
// renombra algo en una pantalla, se renombra acá también.
//
// Dos marcas en el texto, y nada más (las resuelve TextoRico en piezas.tsx):
//   **negrita**         para la palabra que importa del renglón.
//   [[Publicar tienda]] para el NOMBRE DE UN BOTÓN o acción concreta de la
//                       pantalla: se dibuja como un chip que se parece al
//                       botón real, así el lector lo reconoce de un vistazo.
//                       Solo para botones y acciones — los estados
//                       ("publicado"), los nombres de sección
//                       ("Configuración → Pagos"), los interruptores y los
//                       ejemplos van en texto plano o entre comillas.

import {
    Rocket, Compass, LayoutDashboard, ShoppingBag, Users, Package, MessageSquare,
    Tag, BarChart3, Settings, Sparkles, UserCircle, LifeBuoy,
} from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import type { IlustracionId } from './ilustraciones'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; color?: string; style?: CSSProperties }>

/** Link profundo a una pantalla del panel. `seccion` es la del catch-all
 *  /admin/{moduloPadre}/{seccion} (ver AdminSeccionShell.tsx). */
export interface Destino {
    label: string
    seccion: string
    query?: Record<string, string>
}

export type Bloque =
    /** Texto corrido. Admite **negrita** y [[botón]] (los resuelve piezas.tsx). */
    | { tipo: 'parrafo'; texto: string }
    /** Bullets sueltos. */
    | { tipo: 'lista'; items: string[] }
    /** Pasos numerados: es una receta, se sigue en orden. */
    | { tipo: 'pasos'; items: { titulo: string; texto: string }[] }
    /** Definiciones: "este número / este campo significa esto". */
    | { tipo: 'campos'; titulo?: string; items: { label: string; texto: string }[] }
    /** Chips de estado con su color real de la pantalla y qué quiere decir. */
    | { tipo: 'estados'; items: { label: string; color: string; texto: string }[] }
    /** Recuadro destacado. */
    | { tipo: 'nota'; variante: 'tip' | 'aviso' | 'dato'; texto: string }

export interface Tema {
    id: string
    titulo: string
    bloques: Bloque[]
    /** Esquema de la pantalla. Solo en los temas donde la FORMA de la
     *  pantalla es parte de la explicación — no uno por tema, que convierte
     *  el manual en un álbum de figuritas. */
    ilustracion?: IlustracionId
    /** Botón "Ir a…" al pie del tema. */
    ir?: Destino
}

export interface Capitulo {
    id: string
    titulo: string
    /** Una frase: de qué va el capítulo. Se lee en el índice y en la portada. */
    resumen: string
    Icon: IconType
    /** Esquema de la pantalla del capítulo, arriba de todo. */
    ilustracion?: IlustracionId
    ir?: Destino
    temas: Tema[]
}

export const CAPITULOS: Capitulo[] = [

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Arranque
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'arranque', titulo: 'Arranque', Icon: Rocket, ilustracion: 'panel-tienda',
    resumen: 'Qué es el panel, qué es tu tienda, y los siete pasos para salir a vender.',
    temas: [
        {
            id: 'panel-y-tienda', titulo: 'El panel y tu tienda son dos cosas distintas',
            bloques: [
                { tipo: 'parrafo', texto: 'Órbita te da **dos pantallas**, y conviene tenerlas separadas en la cabeza desde el día uno.' },
                { tipo: 'campos', items: [
                    { label: 'El panel (acá)', texto: 'Tu trastienda. Entrás con tu usuario y contraseña, y es donde cargás productos, atendés pedidos, respondés mensajes y mirás tus números. No lo ve nadie más que vos y tu equipo.' },
                    { label: 'La tienda', texto: 'Lo que ve tu cliente: la portada, el catálogo, el carrito y el checkout. Vive en tu dirección web y es pública.' },
                ] },
                { tipo: 'parrafo', texto: 'Todo lo que tocás en el panel se refleja en la tienda **al instante**: no hay que publicar cambios uno por uno. Para verla como la ve un cliente, abrí tu avatar arriba a la derecha y tocá [[Ir a la tienda]].' },
                { tipo: 'nota', variante: 'aviso', texto: 'La única excepción es la primera vez: hasta que no toques [[Publicar tienda]] en el Inicio, tu tienda no está online y nadie te puede comprar.' },
            ],
        },
        {
            id: 'siete-pasos', titulo: 'Los siete pasos para salir a vender',
            bloques: [
                { tipo: 'parrafo', texto: 'Este es el camino corto, en orden. Cada paso tiene su capítulo propio más abajo con el detalle completo.' },
                { tipo: 'pasos', items: [
                    { titulo: 'Confirmá tu email', texto: 'Mi perfil → te mandamos un código de 6 números y lo pegás ahí. Es lo que nos deja devolverte la cuenta si alguna vez perdés el acceso. Tenés 7 días desde que creaste la tienda.' },
                    { titulo: 'Completá los datos del negocio', texto: 'Configuración → Negocio: nombre, rubro y dirección. Es lo que ven tus clientes y lo que usa el envío para calcular distancias.' },
                    { titulo: 'Elegí cómo cobrás', texto: 'Configuración → Pagos: efectivo, transferencia o Mercado Pago. Conectar Mercado Pago ([[Conectar cuenta]]) es opcional, pero conviene si querés que paguen con tarjeta desde la tienda. Son dos minutos y lo podés hacer más adelante.' },
                    { titulo: 'Armá tus categorías', texto: 'Productos → Categorías. Con 2 a 6 alcanza. Hacelo ANTES del primer producto, así cada uno nace en su lugar y no queda todo en "Sin categoría".' },
                    { titulo: 'Cargá tu primer producto', texto: 'Productos → [[Crear producto]]: fotos, precio, stock y categoría. Es el paso que hace que la tienda exista.' },
                    { titulo: 'Definí cómo entregás', texto: 'Configuración → Envíos: envío a domicilio, retiro en el local, o los dos, con sus costos y zonas.' },
                    { titulo: 'Publicá la tienda', texto: 'Inicio → botón [[Publicar tienda]], arriba a la derecha. Ahí recién estás online.' },
                ] },
                { tipo: 'nota', variante: 'tip', texto: 'Si preferís que te lleven de la mano, el tutorial de Primeros pasos hace exactamente esta lista con el cursor guiándote pantalla por pantalla. Aparece solo la primera vez, y cuando lo terminás se abre una segunda tanda que recorre el resto del panel.' },
            ],
            ir: { label: 'Ir al Inicio', seccion: 'dashboard' },
        },
        {
            id: 'publicar', titulo: 'Publicar la tienda',
            bloques: [
                { tipo: 'parrafo', texto: 'El botón vive arriba a la derecha del **Inicio**. Mientras diga [[Publicar tienda]], tu tienda está apagada: podés cargar todo tranquilo sin que nadie vea un catálogo a medio armar.' },
                { tipo: 'parrafo', texto: 'Cuando lo tocás, pasa a decir [[✓ Tienda online]] y tu dirección web empieza a responder. Podés seguir editando todo lo que quieras después: publicar no congela nada.' },
                { tipo: 'nota', variante: 'dato', texto: 'Tu tienda ya tiene su dirección de Órbita desde el primer día y funciona perfecto. Comprar un dominio propio (tunegocio.com) es opcional y se hace desde Configuración → Dominios.' },
            ],
            ir: { label: 'Ir al Inicio', seccion: 'dashboard' },
        },
    ],
},

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Moverte por el panel
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'navegacion', titulo: 'Moverte por el panel', Icon: Compass, ilustracion: 'layout-panel',
    resumen: 'El menú de la izquierda, la barra de arriba y por qué no todos ven lo mismo.',
    temas: [
        {
            id: 'menu-lateral', titulo: 'El menú de la izquierda',
            bloques: [
                { tipo: 'parrafo', texto: 'Es la navegación principal. Cada módulo se despliega y muestra sus sub-secciones — Pedidos, por ejemplo, abre Lista, Historial, Cancelaciones y devoluciones, y Nuevo +.' },
                { tipo: 'lista', items: [
                    'Arriba de todo, el **selector de espacio**: tu negocio y su rubro.',
                    'Abajo, el **buscador del menú**: escribís y te muestra pedidos, clientes, productos y secciones que coinciden, sin salir de ahí.',
                    'El ícono de **colapsar**, arriba a la derecha del menú, lo achica a una franja de íconos para ganar pantalla. En Configuración se colapsa solo, porque esa sección trae su propio menú adentro.',
                    'Los **puntitos y números** al lado de un módulo son cosas que te esperan: mensajes sin leer, por ejemplo.',
                ] },
                { tipo: 'nota', variante: 'tip', texto: 'En el celular el menú está detrás del botón de las tres rayas, arriba a la izquierda.' },
            ],
        },
        {
            id: 'barra-superior', titulo: 'La barra de arriba',
            bloques: [
                { tipo: 'parrafo', texto: 'Te sigue por todo el panel, estés en la pantalla que estés.' },
                { tipo: 'campos', items: [
                    { label: 'Búsqueda global', texto: 'Encontrá un pedido por número, un cliente por nombre o email, un producto, o una sección del panel. Escribís y los resultados aparecen en vivo.' },
                    { label: 'Campana', texto: 'Junta lo que pasó mientras no estabas: pedidos nuevos, pagos acreditados, stock crítico, avisos del sistema. El número es lo que falta leer. Qué llega acá y qué llega por mail se elige en Configuración → Notificaciones.' },
                    { label: 'Modo oscuro', texto: 'Un toque y el panel entero cambia de claro a oscuro. Queda guardado en tu cuenta, así que te sigue a cualquier dispositivo.' },
                    { label: 'Orbi', texto: 'El asistente. Se abre con Ctrl+K (Cmd+K en Mac) desde cualquier lado: le preguntás por tus números, por un pedido, o cómo se hace algo, y contesta con datos de TU negocio.' },
                    { label: 'Tu avatar', texto: 'Mi perfil, [[Ir a la tienda]] para verla como cliente, y Cerrar sesión.' },
                ] },
            ],
        },
        {
            id: 'permisos', titulo: 'Por qué tu equipo no ve lo mismo que vos',
            bloques: [
                { tipo: 'parrafo', texto: 'El panel se adapta al rol de cada persona: **nada visible que no se pueda usar**. Si invitaste a alguien como Empleado, hay módulos enteros que directamente no le aparecen en el menú.' },
                { tipo: 'parrafo', texto: 'Así que si un compañero te dice "a mí no me figura Descuentos", no es un error: es su rol. Los roles se manejan en Configuración → Equipo.' },
            ],
            ir: { label: 'Ir a Equipo', seccion: 'configuracion', query: { vista: 'equipo' } },
        },
    ],
},

// ═══════════════════════════════════════════════════════════════════════════
// 3 · Inicio (Dashboard)
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'inicio', titulo: 'Inicio', Icon: LayoutDashboard, ilustracion: 'kpis',
    resumen: 'Los cinco números grandes, las alertas, el gráfico de la semana y el top de productos.',
    ir: { label: 'Ir al Inicio', seccion: 'dashboard' },
    temas: [
        {
            id: 'periodo', titulo: 'Elegir el período',
            bloques: [
                { tipo: 'parrafo', texto: 'Arriba de todo hay una tira de botones: **Hoy, Semana, Mes** y **Personalizado**. Todo lo que ves abajo — los números, el gráfico, el top, las alertas — responde a ese período.' },
                { tipo: 'parrafo', texto: '[[Personalizado]] abre un calendario donde elegís un desde y un hasta a mano. Sirve para mirar una fecha puntual: un fin de semana largo, el día de una promo, el mes pasado completo.' },
                { tipo: 'nota', variante: 'dato', texto: 'Cada número se compara SIEMPRE contra el período anterior del mismo largo. Si estás mirando 7 días, la flechita verde o roja compara contra los 7 días previos.' },
            ],
        },
        {
            id: 'kpis', titulo: 'Los cinco números grandes, uno por uno',
            bloques: [
                { tipo: 'parrafo', texto: 'Son la fila de tarjetas de arriba. Cada una muestra el valor del período elegido y, abajo, cuánto subió o bajó respecto del anterior.' },
                { tipo: 'campos', items: [
                    { label: 'Ventas', texto: 'La plata que entró, **neta de devoluciones**: a lo vendido se le restan las devoluciones ya aprobadas del período. Es lo que realmente quedó, no lo que se facturó bruto.' },
                    { label: 'Pedidos', texto: 'Cuántas compras entraron. Si hay pedidos esperando, abajo del número te avisa cuántos están pendientes.' },
                    { label: 'Ticket promedio', texto: 'Cuánto gasta en promedio cada compra (Ventas dividido Pedidos). Es el número que mirás cuando querés que cada cliente se lleve más: si sube, las promos por monto mínimo o los 2x1 están funcionando.' },
                    { label: 'Clientes nuevos', texto: 'Cuántas personas te compraron por primera vez en el período. Mide si estás llegando a gente nueva o vendiéndole siempre a los mismos.' },
                    { label: 'Comisión MP', texto: 'Cuánto se llevó Mercado Pago de tus cobros en el período. Acá el color está al revés a propósito: que SUBA es malo, así que sube en rojo. Mercado Pago no cobra un porcentaje fijo — varía según el medio de pago y las cuotas —, por eso este número se calcula sobre los cobros reales.' },
                ] },
            ],
        },
        {
            id: 'alertas', titulo: 'Alertas: lo que hay que resolver hoy', ilustracion: 'alertas',
            bloques: [
                { tipo: 'parrafo', texto: 'Debajo de los números aparece una tira de alertas **solo si hay algo que resolver**. Si tu negocio está al día, no aparece nada: no es una sección vacía esperándote, es un aviso.' },
                { tipo: 'campos', items: [
                    { label: 'Pedidos que necesitan tu atención', texto: 'Compras pendientes: hay que confirmar el pago y moverlas a preparación.' },
                    { label: 'Pedidos sin atender +2hs', texto: 'Entraron hace más de dos horas y siguen sin tocarse. Es la alerta más urgente de todas.' },
                    { label: 'Productos con stock crítico', texto: 'Llegaron al mínimo que definiste en el producto. Te lleva a Productos para reponer.' },
                    { label: 'Pagos por confirmar', texto: 'Transferencias o pagos coordinados que todavía no validaste.' },
                ] },
                { tipo: 'parrafo', texto: 'Cada alerta tiene su botón [[Ir →]] que te deja parado en la pantalla donde se resuelve. Y si ya las viste todas, [[Limpiar todas]] las saca de la vista hasta que vuelva a pasar algo.' },
            ],
            ir: { label: 'Ir a Pedidos', seccion: 'pedidos' },
        },
        {
            id: 'grafico-semana', titulo: 'Ventas de la semana',
            bloques: [
                { tipo: 'parrafo', texto: 'El gráfico de línea del medio: cuánto vendiste cada día. Sirve para ver tu ritmo real — qué días tirás y qué días se te muere el negocio — y para decidir cuándo conviene lanzar una promo.' },
                { tipo: 'parrafo', texto: 'El ícono de expandir, arriba a la derecha de la tarjeta, lo abre grande en una ventana aparte.' },
            ],
        },
        {
            id: 'top', titulo: 'Top: productos, categorías y canal',
            bloques: [
                { tipo: 'parrafo', texto: 'Al lado del gráfico hay una tarjeta con tres pestañas.' },
                { tipo: 'campos', items: [
                    { label: 'Productos', texto: 'Lo más vendido del período, con su barra de participación. Lo que aparece acá es lo que conviene tener siempre con stock y destacado en la portada.' },
                    { label: 'Categorías', texto: 'Lo mismo pero agrupado por categoría: te dice qué rubro tuyo tracciona de verdad.' },
                    { label: 'Canal', texto: 'Una torta que separa las ventas que entraron solas por la tienda online de las que cargaste vos a mano (mostrador, WhatsApp). Es la forma de medir cuánto te está aportando la tienda además de lo de siempre.' },
                ] },
                { tipo: 'nota', variante: 'dato', texto: 'Si el período elegido no tuvo ventas, cada pestaña te lo dice en vez de mostrar un gráfico vacío.' },
            ],
        },
        {
            id: 'actividad', titulo: 'Actividad reciente',
            bloques: [
                { tipo: 'parrafo', texto: 'La lista de abajo: los últimos pedidos, con número, cliente, qué compró, monto y estado. Clickeás cualquier fila y caés directo en el detalle de ese pedido.' },
                { tipo: 'parrafo', texto: '[[Ver todos →]] te lleva a la lista completa de Pedidos.' },
            ],
            ir: { label: 'Ir a Pedidos', seccion: 'pedidos' },
        },
    ],
},

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Pedidos
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'pedidos', titulo: 'Pedidos', Icon: ShoppingBag, ilustracion: 'pedidos',
    resumen: 'El día a día: estados, confirmar pagos, ventas manuales, historial y devoluciones.',
    ir: { label: 'Ir a Pedidos', seccion: 'pedidos' },
    temas: [
        {
            id: 'estados', titulo: 'Los estados y sus pestañas',
            bloques: [
                { tipo: 'parrafo', texto: 'Arriba de la lista hay siete pestañas con el contador real de cada una. Un pedido va avanzando de una a la otra a medida que pasa de verdad, y eso es lo que ve tu cliente en su cuenta.' },
                { tipo: 'estados', items: [
                    { label: 'Pendientes', color: '#F59E0B', texto: 'Entró la compra pero todavía no confirmaste el pago. Acá es donde empieza tu trabajo.' },
                    { label: 'Confirmados', color: '#10B981', texto: 'El pago está y el pedido es tuyo para preparar.' },
                    { label: 'En prep.', color: '#8B5CF6', texto: 'Lo estás armando.' },
                    { label: 'Enviados', color: '#3B82F6', texto: 'Salió para el cliente o está listo para que lo retire.' },
                    { label: 'Entregados', color: '#94A3B8', texto: 'Llegó. El ciclo se cerró. Las ventas de mostrador ya cobradas entran directo acá.' },
                    { label: 'Cancelados', color: '#EF4444', texto: 'No se concretó. Quedan registrados, no desaparecen.' },
                ] },
                { tipo: 'nota', variante: 'tip', texto: 'En el celular las pestañas se convierten en una tira de chips que se desliza con el dedo.' },
            ],
        },
        {
            id: 'detalle-pedido', titulo: 'Abrir un pedido',
            bloques: [
                { tipo: 'parrafo', texto: 'Clickeás la fila y se abre el detalle: los productos con sus cantidades, el total, los datos del cliente, cómo pagó y cómo lo recibe.' },
                { tipo: 'parrafo', texto: 'Desde ahí lo movés al estado que corresponde. Cada cambio queda registrado y, según lo que hayas configurado en Notificaciones, dispara el aviso al cliente.' },
                { tipo: 'nota', variante: 'dato', texto: 'Si el pago fue con Mercado Pago, en el detalle ves la comisión que se llevó esa venta puntual. Ese mismo número, sumado por período, es el KPI "Comisión MP" del Inicio.' },
            ],
        },
        {
            id: 'nuevo-pedido', titulo: 'Cargar una venta a mano',
            bloques: [
                { tipo: 'parrafo', texto: 'El botón [[Nuevo pedido]] sirve para todo lo que vendés por fuera de la tienda: mostrador, WhatsApp, Instagram, un pedido por teléfono.' },
                { tipo: 'pasos', items: [
                    { titulo: 'Buscá los productos', texto: 'Escribís en el buscador, elegís y ponés cantidades. Usa tu catálogo real, así que descuenta stock igual que una venta online.' },
                    { titulo: 'Cargá el cliente', texto: 'Si ya existe, lo encontrás; si no, lo creás ahí mismo y queda para siempre en tu base.' },
                    { titulo: 'Elegí cómo se cobró y cerrá la venta', texto: 'Y el pedido entra a tus números como cualquier otro.' },
                ] },
                { tipo: 'nota', variante: 'tip', texto: 'Cargar las ventas de mostrador acá es lo que hace que el Inicio te muestre tu negocio COMPLETO y no solo la parte online. También es lo que alimenta la pestaña "Canal" del top.' },
            ],
            ir: { label: 'Crear un pedido', seccion: 'pedidos', query: { vista: 'nuevo' } },
        },
        {
            id: 'lote-exportar', titulo: 'Trabajar en lote y exportar',
            bloques: [
                { tipo: 'lista', items: [
                    'Tildá varios pedidos de la lista y **confirmalos de una**: si te entraron diez transferencias juntas, no hay que abrir diez pantallas.',
                    'El **filtro por fecha** y la búsqueda achican la lista antes de operar.',
                    '**Exportar a CSV** baja lo que estás viendo, con los filtros aplicados. Se abre en Excel o Google Sheets: sirve para la contadora, para cruzar con tu caja, o para guardarte un cierre de mes.',
                ] },
            ],
        },
        {
            id: 'historial', titulo: 'Historial',
            bloques: [
                { tipo: 'parrafo', texto: 'La lista viva muestra lo que está en juego. El **Historial** es el archivo completo: todo lo que pasó, con su fecha y su estado final, para consultar hacia atrás sin que te estorbe en el día a día.' },
            ],
            ir: { label: 'Ver el historial', seccion: 'pedidos', query: { vista: 'historial' } },
        },
        {
            id: 'postventa', titulo: 'Cancelaciones, devoluciones y notas de crédito',
            bloques: [
                { tipo: 'parrafo', texto: 'Viven en la sub-sección **Cancelaciones y devoluciones** de este mismo módulo, cada una con sus pestañas por estado.' },
                { tipo: 'campos', items: [
                    { label: 'Cancelaciones', texto: 'Cuando un cliente pide cancelar un pedido que ya estaba confirmado. Vos aprobás o rechazás.' },
                    { label: 'Devoluciones', texto: 'Cuando ya recibió el producto y quiere devolverlo. Mismo circuito: entra el pedido, lo revisás, lo resolvés.' },
                    { label: 'Notas de crédito', texto: 'Si en vez de devolver la plata preferís dejarle saldo a favor para su próxima compra, se emite una nota de crédito y el cliente la usa en el checkout.' },
                ] },
                { tipo: 'nota', variante: 'aviso', texto: 'Qué puede pedir tu cliente y con qué tipo de reembolso lo definís vos en Configuración → Cancelaciones y devoluciones. Aprobar cada caso puntual sigue siendo decisión tuya, siempre.' },
                { tipo: 'parrafo', texto: 'Las devoluciones aprobadas se le restan al KPI **Ventas** del Inicio: por eso ese número dice "neto de devoluciones".' },
            ],
            ir: { label: 'Ver devoluciones', seccion: 'pedidos', query: { vista: 'devoluciones' } },
        },
    ],
},

// ═══════════════════════════════════════════════════════════════════════════
// 5 · Clientes
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'clientes', titulo: 'Clientes', Icon: Users, ilustracion: 'clientes',
    resumen: 'La base que se arma sola con cada venta, y cómo escribirles.',
    ir: { label: 'Ir a Clientes', seccion: 'clientes' },
    temas: [
        {
            id: 'lista-clientes', titulo: 'La lista y lo que dice de cada uno',
            bloques: [
                { tipo: 'parrafo', texto: 'Acá no hay que cargar nada: **la base se llena sola** con cada venta, sea de la tienda o cargada a mano. Por cada persona vas a ver:' },
                { tipo: 'campos', items: [
                    { label: 'Pedidos', texto: 'Cuántas veces te compró. Distingue de un vistazo al que vino una vez del que ya es cliente.' },
                    { label: 'Total gastado', texto: 'Cuánta plata dejó en tu negocio desde el día uno.' },
                    { label: 'Ticket promedio', texto: 'Cuánto gasta por compra. El que compra seguido pero poco necesita otra promo que el que compra una vez y fuerte.' },
                    { label: 'Última compra', texto: 'Cuándo fue la última vez. Es tu lista de "a quién hay que despertar".' },
                ] },
                { tipo: 'parrafo', texto: 'La flechita de cada fila despliega sus últimos pedidos sin salir de la lista, y desde ahí entrás a [[Ver perfil completo →]].' },
            ],
        },
        {
            id: 'escribirles', titulo: 'Escribirles por email',
            bloques: [
                { tipo: 'campos', items: [
                    { label: 'El sobre de cada fila', texto: 'Le escribe a esa persona sola.' },
                    { label: 'Email masivo', texto: 'Le escribe a **toda la lista que estés viendo**, con los filtros aplicados. Ahí está la gracia: filtrás primero (por ejemplo, los que no compran hace tiempo) y después escribís, en vez de mandarle lo mismo a todos.' },
                ] },
                { tipo: 'nota', variante: 'tip', texto: 'Combinalo con un cupón: creás el cupón, filtrás la lista, y les mandás el código en el mismo mail. Eso se mide después en Descuentos → Rendimiento.' },
            ],
        },
        {
            id: 'exportar-clientes', titulo: 'Exportar la base',
            bloques: [
                { tipo: 'parrafo', texto: '[[Exportar]] baja toda tu base en CSV, con los datos de contacto. Es tuya: la abrís en Excel, la subís a una herramienta de mailing, la guardás de respaldo.' },
                { tipo: 'nota', variante: 'aviso', texto: 'Son datos personales de gente real. Tratá el archivo con el mismo cuidado que tratarías una agenda de clientes en papel.' },
            ],
        },
    ],
},

// ═══════════════════════════════════════════════════════════════════════════
// 6 · Productos
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'productos', titulo: 'Productos', Icon: Package, ilustracion: 'productos',
    resumen: 'Tu catálogo: alta de productos, fotos, variantes, stock y categorías.',
    ir: { label: 'Ir a Productos', seccion: 'catalogo' },
    temas: [
        {
            id: 'numeros-catalogo', titulo: 'Los cinco números de arriba',
            bloques: [
                { tipo: 'campos', items: [
                    { label: 'Total', texto: 'Cuántos productos tenés cargados, publicados o no.' },
                    { label: 'Publicados', texto: 'Los que tu cliente ve en la tienda ahora mismo.' },
                    { label: 'Sin stock', texto: 'Se quedaron en cero. Es tu lista de reposición.' },
                    { label: 'No publicados', texto: 'Todo lo que NO está publicado: los borradores de verdad más los que se quedaron sin stock.' },
                    { label: 'Valor de inventario', texto: 'Cuánta plata tenés parada en mercadería, sumando precio por stock de cada producto.' },
                ] },
            ],
        },
        {
            id: 'crear-producto', titulo: 'Crear un producto',
            bloques: [
                { tipo: 'parrafo', texto: 'El botón [[Crear producto]] abre el alta. Lo importante, en orden:' },
                { tipo: 'pasos', items: [
                    { titulo: 'Nombre', texto: 'Cómo lo busca tu cliente, no cómo lo llamás vos internamente.' },
                    { titulo: 'Fotos', texto: 'Lo que más vende. La primera es la que se ve en el catálogo; el resto, al abrir el producto.' },
                    { titulo: 'Precio', texto: 'El que ve el cliente.' },
                    { titulo: 'Stock', texto: 'Cuántas unidades tenés. Se descuenta solo con cada venta, incluidas las que cargás a mano.' },
                    { titulo: 'Categoría', texto: 'Dónde vive dentro de tu catálogo.' },
                    { titulo: 'Publicado o borrador', texto: 'Borrador lo deja invisible hasta que esté listo.' },
                ] },
                { tipo: 'nota', variante: 'tip', texto: 'Escribí el nombre y tocá [[Generar con Orbi]]: te escribe la descripción y te sugiere categoría y etiquetas al toque. Después la editás si querés — es un punto de partida, no una imposición.' },
            ],
            ir: { label: 'Crear un producto', seccion: 'catalogo', query: { vista: 'nuevo' } },
        },
        {
            id: 'ficha-tecnica', titulo: 'Ficha técnica: las características del producto',
            bloques: [
                { tipo: 'parrafo', texto: 'Al cargar o editar un producto hay un interruptor **"Especificaciones técnicas"**, apagado por defecto. Sirve para lo que se compra mirando datos — tecnología, electrodomésticos, herramientas — y necesita ver "RAM: 8GB", "Pantalla: 6.5\"" antes de decidir.' },
                { tipo: 'parrafo', texto: 'Cada fila es un par **etiqueta / valor** (por ejemplo "Procesador" → "Snapdragon 665"). Se van agregando con [[+ Agregar característica]], en el orden en que querés que aparezcan.' },
                { tipo: 'parrafo', texto: 'En la tienda se ven bajo el título **"Características"**, al lado de los botones de compra. Si son muchas y no entran ahí, la tabla se recorta sola a lo que cabe y suma un link [[Ver más detalles →]] que abre el resto en una ventana aparte — no hay que calcular cuántas cargar, nunca queda desprolijo.' },
                { tipo: 'nota', variante: 'tip', texto: 'Si no cargás ninguna, la sección de Características directamente no aparece en la tienda: no hay nada genérico que rellenar de más.' },
            ],
        },
        {
            id: 'variantes', titulo: 'Variantes y stock',
            bloques: [
                { tipo: 'parrafo', texto: 'Si el mismo producto viene en talles o colores, se cargan como **variantes**: es un solo producto en la tienda, con sus opciones adentro, y cada variante lleva su propio stock.' },
                { tipo: 'parrafo', texto: 'También podés definir un **stock mínimo**: cuando un producto baja de ahí, dispara la alerta de "stock crítico" en el Inicio y, si lo activaste, el aviso por la campana o por mail.' },
            ],
        },
        {
            id: 'stock-rapido', titulo: 'Editar el stock rápido, sin abrir el producto',
            bloques: [
                { tipo: 'parrafo', texto: 'En la lista de Productos (grilla, tabla o las cards del celular), el número de stock tiene un subrayado punteado: es clickeable. Tocalo y se abre una ventana chica para actualizarlo ahí mismo, sin entrar al editor completo.' },
                { tipo: 'parrafo', texto: 'Si el producto tiene **variantes**, la ventana lista cada una con su propio campo — no hay un stock único para pisar, cada combinación mantiene el suyo.' },
                { tipo: 'nota', variante: 'dato', texto: 'El cambio queda guardado igual que si lo hubieras editado desde el producto completo: afecta al mismo stock que ven el Inicio, los Reportes y la tienda.' },
            ],
        },
        {
            id: 'estados-producto', titulo: 'En qué estado está cada producto',
            bloques: [
                { tipo: 'estados', items: [
                    { label: 'Publicado', color: '#10B981', texto: 'Visible y comprable en tu tienda.' },
                    { label: 'Borrador', color: '#64748B', texto: 'Cargado pero invisible. Para lo que estás preparando.' },
                    { label: 'Sin stock', color: '#F59E0B', texto: 'Se quedó en cero. Pesa más que "publicado": aunque esté publicado, si no hay stock el cliente no lo puede comprar.' },
                ] },
                { tipo: 'parrafo', texto: 'Los filtros de arriba de la lista te dejan ver solo uno de estos grupos, buscar por nombre y ordenar la lista.' },
            ],
        },
        {
            id: 'categorias', titulo: 'Categorías',
            bloques: [
                { tipo: 'parrafo', texto: 'Es el árbol con el que tu cliente navega la tienda. Se arman con [[Nueva categoría]], admiten subcategorías, y cada una lleva su ícono y su color.' },
                { tipo: 'nota', variante: 'tip', texto: 'Menos es más: 2 a 6 categorías bien pensadas se navegan mejor que veinte. Siempre podés abrir subcategorías después, cuando el catálogo crezca.' },
            ],
            ir: { label: 'Ir a Categorías', seccion: 'categorias' },
        },
        {
            id: 'exportar-catalogo', titulo: 'Exportar el catálogo',
            bloques: [
                { tipo: 'parrafo', texto: '[[Exportar Excel]] baja el catálogo completo en .xlsx: sirve para revisar precios en planilla, pasarle la lista a alguien, o tener un respaldo antes de un cambio grande.' },
            ],
        },
    ],
},

// ═══════════════════════════════════════════════════════════════════════════
// 7 · Mensajes
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'mensajes', titulo: 'Mensajes', Icon: MessageSquare, ilustracion: 'chat',
    resumen: 'El chat con tus clientes, con el contexto de sus pedidos a mano.',
    ir: { label: 'Ir a Mensajes', seccion: 'mensajes' },
    temas: [
        {
            id: 'bandeja', titulo: 'La bandeja',
            bloques: [
                { tipo: 'parrafo', texto: 'Tus clientes te escriben desde la tienda y todo cae acá. A la izquierda la lista de conversaciones, con los no leídos marcados; a la derecha, el chat abierto.' },
                { tipo: 'parrafo', texto: 'Cuando hay algo sin leer, aparece un punto rojo en **Mensajes** en el menú de la izquierda: no hace falta entrar a chequear.' },
            ],
        },
        {
            id: 'chat', titulo: 'Responder',
            bloques: [
                { tipo: 'lista', items: [
                    'Escribí **#** para mencionar un pedido dentro del mensaje: queda linkeado y los dos saben exactamente de cuál están hablando.',
                    'Desde el chat entrás al **perfil del cliente** o al **pedido** que están discutiendo, sin perder la conversación.',
                    'Cuando el tema se cerró, **archivás** la conversación y te queda la bandeja limpia. No se borra: se guarda.',
                ] },
            ],
        },
        {
            id: 'plantillas', titulo: 'Plantillas de respuesta',
            bloques: [
                { tipo: 'parrafo', texto: 'Lo que te preguntan siempre — "¿hacen envíos?", "¿cuándo llega?", "¿tenés talle M?" — lo dejás escrito una vez y lo mandás con un toque desde el chat.' },
                { tipo: 'nota', variante: 'tip', texto: 'Es la mejora más grande por menos trabajo de todo el módulo. Con cinco plantillas te sacás de encima la mitad de los mensajes del día.' },
            ],
            ir: { label: 'Ir a Plantillas', seccion: 'mensajes', query: { vista: 'plantillas' } },
        },
    ],
},

// ═══════════════════════════════════════════════════════════════════════════
// 8 · Descuentos y cupones
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'descuentos', titulo: 'Descuentos y cupones', Icon: Tag, ilustracion: 'cupon',
    resumen: 'Promos que se aplican solas, códigos para el checkout, cómo compartirlos y cómo medirlos.',
    ir: { label: 'Ir a Descuentos', seccion: 'descuentos' },
    temas: [
        {
            id: 'diferencia', titulo: 'Descuento o cupón: cuál va',
            bloques: [
                { tipo: 'campos', items: [
                    { label: 'Descuento', texto: 'Se aplica **solo**, sin que el cliente haga nada, cuando se cumple la condición que pusiste. Es la promo de vidriera: "20% en camperas", "2x1 en remeras".' },
                    { label: 'Cupón', texto: 'Es un **código** que el cliente escribe en el checkout. Sirve para lo dirigido: un descuento para tus seguidores de Instagram, uno para que vuelva un cliente dormido, uno para compensar un problema con un pedido.' },
                ] },
                { tipo: 'nota', variante: 'dato', texto: 'Los dos viven en este módulo, en pestañas distintas, y los dos se comparten por link y se miden en Rendimiento.' },
            ],
        },
        {
            id: 'tipos-descuento', titulo: 'Los tipos de descuento',
            bloques: [
                { tipo: 'campos', items: [
                    { label: 'Porcentaje sobre producto', texto: 'Un % en los productos o categorías que elijas. La promo clásica.' },
                    { label: 'Monto fijo sobre producto', texto: '"$2.000 menos" en productos elegidos. Se entiende más rápido que un porcentaje cuando el número es grande.' },
                    { label: 'Porcentaje sobre el ticket', texto: 'Un % sobre el total de la compra. Con un monto mínimo, es la forma directa de subir el ticket promedio.' },
                    { label: 'Monto fijo sobre el ticket', texto: 'Una rebaja fija sobre el total.' },
                    { label: 'Llevá X, pagá Y', texto: 'El 2x1 y el 3x2 de toda la vida: se arma solo en el carrito, sin código.' },
                    { label: 'Comprá X, obtenés Z', texto: 'Compra un producto y se lleva otro gratis, con % o con monto fijo. Sirve para mover algo que no rota o para hacer probar un producto nuevo.' },
                    { label: 'Por volumen', texto: 'Escalas: de 3 a 5 unidades tanto, de 6 en adelante más. Para mayoristas o productos de consumo.' },
                    { label: 'Oferta relámpago', texto: 'Un % que termina a una hora exacta y se muestra en tu portada con un reloj en cuenta regresiva. Requiere el paquete Avanzado.' },
                ] },
            ],
        },
        {
            id: 'alcance-condiciones', titulo: 'Alcance, condiciones y vigencia',
            bloques: [
                { tipo: 'parrafo', texto: 'Cualquiera sea el tipo, un descuento se define con tres cosas más:' },
                { tipo: 'campos', items: [
                    { label: 'Alcance', texto: 'A qué le pega: a **productos** puntuales, a una **categoría** entera, o al **ticket** completo.' },
                    { label: 'Condición', texto: 'Qué tiene que pasar para que se active: una cantidad mínima de unidades o un monto mínimo de compra.' },
                    { label: 'Vigencia', texto: 'Desde cuándo y hasta cuándo. Podés dejarlo sin vencimiento, o afinarlo a **días de la semana y franja horaria** — por ejemplo, un descuento que corre solo los martes de 14 a 18.' },
                ] },
                { tipo: 'parrafo', texto: 'También podés ponerle un **límite de usos** total, y una **prioridad** para cuando dos promos podrían pisarse: la de prioridad más alta es la que gana.' },
            ],
        },
        {
            id: 'cupones', titulo: 'Cupones: el código y sus límites',
            bloques: [
                { tipo: 'parrafo', texto: 'Un cupón es un código más un descuento (porcentaje o monto fijo, sobre producto o sobre el ticket). Lo que lo hace distinto son sus controles:' },
                { tipo: 'campos', items: [
                    { label: 'Código', texto: 'Lo que escribe el cliente. Corto y fácil de dictar funciona mejor que uno largo.' },
                    { label: 'Usos máximos totales', texto: 'Cuántas veces se puede canjear en total. Vacío es ilimitado.' },
                    { label: 'Usos por cliente', texto: 'Para que una misma persona no lo use diez veces.' },
                    { label: 'Monto mínimo', texto: 'Recién se puede usar a partir de cierta compra.' },
                    { label: 'Privado', texto: 'No aparece listado en la tienda: solo lo canjea quien conoce el código. Es la opción para un cupón que le mandás a una persona o a un grupo puntual.' },
                    { label: 'Vigencia', texto: 'Desde cuándo y hasta cuándo, o sin vencimiento.' },
                ] },
                { tipo: 'parrafo', texto: 'En el listado, cada cupón muestra su estado:' },
                { tipo: 'estados', items: [
                    { label: 'Activo', color: '#10B981', texto: 'Se puede canjear ahora.' },
                    { label: 'Programado', color: '#3B82F6', texto: 'Ya está creado pero todavía no arrancó su fecha de inicio.' },
                    { label: 'Inactivo', color: '#64748B', texto: 'Lo apagaste vos. Se vuelve a prender cuando quieras.' },
                    { label: 'Expirado', color: '#94A3B8', texto: 'Se le pasó la fecha.' },
                    { label: 'Agotado', color: '#F59E0B', texto: 'Llegó a su límite de usos.' },
                ] },
                { tipo: 'parrafo', texto: 'Desde el menú de tres puntitos de cada fila: activar, desactivar, **duplicar** (para armar uno nuevo parecido sin empezar de cero), editar, eliminar y **Compartir**.' },
            ],
            ir: { label: 'Ir a Cupones', seccion: 'cupones' },
        },
        {
            id: 'compartir', titulo: 'Compartir un cupón: link y envío por email', ilustracion: 'compartir',
            bloques: [
                { tipo: 'parrafo', texto: 'Esta es la parte que más se aprovecha poco. En el menú de tres puntitos de cualquier cupón, [[Compartir]] abre una ventana con dos formas de hacerlo llegar.' },
                { tipo: 'campos', titulo: '1 · El link', items: [
                    { label: 'URL del link', texto: 'Una dirección propia del cupón. El que la abre entra a tu tienda **con el descuento ya aplicado**: no tiene que acordarse del código ni tipearlo. El botón [[Copiar]] te la deja en el portapapeles para pegarla en Instagram, en un story, en WhatsApp o donde quieras.' },
                    { label: 'Activo / Inactivo', texto: 'El link tiene su propio interruptor, aparte del cupón. Si está inactivo, tocá [[Activar link]] y queda funcionando. Apagarlo después corta el link sin tener que dar de baja el cupón.' },
                ] },
                { tipo: 'campos', titulo: '2 · Enviar por email', items: [
                    { label: 'Email del destinatario', texto: 'Ponés la dirección — **una casilla de Gmail, de Outlook, la que sea**, no hace falta que la persona sea cliente registrado tuyo — y Órbita le manda el mail.' },
                    { label: 'Nombre (opcional)', texto: 'Si lo cargás, el mail lo saluda por su nombre.' },
                    { label: 'Enviar', texto: 'Listo. El mail sale con el valor del cupón, el saludo y un botón que lleva directo a tu tienda con el descuento puesto.' },
                ] },
                { tipo: 'nota', variante: 'dato', texto: 'El mail lo arma y lo manda Órbita: no se abre tu Gmail ni hace falta que configures nada. Vos solo escribís la dirección.' },
                { tipo: 'nota', variante: 'tip', texto: 'Para mandarle el mismo cupón a MUCHA gente de una, no uses esta ventana una por una: creá el cupón, andá a Clientes, filtrá la lista que querés y usá [[Email masivo]] con el código adentro.' },
                { tipo: 'parrafo', texto: 'Los descuentos también se comparten por link, con la misma ventana, salvo los que aplican sobre el ticket completo: esos no tienen una página propia a la que llevar.' },
            ],
            ir: { label: 'Ir a Cupones', seccion: 'cupones' },
        },
        {
            id: 'rendimiento', titulo: 'Rendimiento: qué promo funcionó',
            bloques: [
                { tipo: 'parrafo', texto: 'La pestaña **Rendimiento** contesta la única pregunta que importa después de lanzar algo: ¿sirvió? Cuántas veces se usó cada promo, cuánta plata movió y cuánto descuento regalaste.' },
                { tipo: 'nota', variante: 'tip', texto: 'Miralo junto al Ticket promedio del Inicio. Una promo que se usa mucho pero te baja el ticket promedio te está haciendo trabajar más para ganar lo mismo.' },
            ],
            ir: { label: 'Ver Rendimiento', seccion: 'descuentos', query: { vista: 'metricas' } },
        },
    ],
},

// ═══════════════════════════════════════════════════════════════════════════
// 9 · Reportes
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'reportes', titulo: 'Reportes', Icon: BarChart3, ilustracion: 'reportes',
    resumen: 'Cinco miradas largas de tu negocio, por el período que elijas.',
    ir: { label: 'Ir a Reportes', seccion: 'reportes' },
    temas: [
        {
            id: 'las-cinco-pestanas', titulo: 'Las cinco pestañas',
            bloques: [
                { tipo: 'parrafo', texto: 'El Inicio te dice cómo venís hoy. Los Reportes te dicen cómo viene el negocio. Cada pestaña se filtra por el período que elijas.' },
                { tipo: 'campos', items: [
                    { label: 'Ventas', texto: 'Tu facturación en el tiempo, con su evolución. Es el reporte del cierre de mes.' },
                    { label: 'Productos', texto: 'Qué se vende de verdad y qué está ahí sin moverse. Lo que no aparece nunca es plata parada.' },
                    { label: 'Clientes', texto: 'Quiénes compran, cuánto y cada cuánto. Separa al que vuelve del que compró una sola vez.' },
                    { label: 'Inventario', texto: 'Cómo está parado tu stock: qué se está por acabar y cuánta plata tenés en mercadería.' },
                    { label: 'Pagos', texto: 'Por dónde te pagan y **cuánto te queda después de comisiones**. Es el reporte que más sorprende la primera vez que se mira.' },
                ] },
                { tipo: 'nota', variante: 'tip', texto: 'Los reportes de Productos y de Clientes también se abren directo desde el menú de la izquierda, adentro de Productos y de Clientes.' },
            ],
        },
    ],
},

// ═══════════════════════════════════════════════════════════════════════════
// 10 · Configuración
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'configuracion', titulo: 'Configuración', Icon: Settings, ilustracion: 'config',
    resumen: 'Todo lo que hace funcionar la tienda: datos, pagos, envíos, apariencia, equipo y tu plan.',
    ir: { label: 'Ir a Configuración', seccion: 'configuracion' },
    temas: [
        {
            id: 'como-se-navega', titulo: 'Cómo se navega',
            bloques: [
                { tipo: 'parrafo', texto: 'Configuración tiene **su propio menú adentro**, a la izquierda. Cuando entrás, el menú principal del panel se colapsa solo a una franja de íconos para hacerle lugar. Cada ítem de ese menú es una pantalla distinta, y cada una se guarda por separado con su botón [[Guardar cambios]].' },
            ],
        },
        {
            id: 'cfg-negocio', titulo: 'Negocio',
            bloques: [
                { tipo: 'parrafo', texto: 'Nombre, rubro y dirección del local, con mapa para marcar el punto exacto. Es lo que ven tus clientes y lo que usa el sistema de envíos para calcular distancias.' },
            ],
            ir: { label: 'Abrir Negocio', seccion: 'configuracion', query: { vista: 'negocio' } },
        },
        {
            id: 'cfg-contacto', titulo: 'Contacto',
            bloques: [
                { tipo: 'parrafo', texto: 'WhatsApp, email y horarios de atención. Es por donde te escribe el que está por comprar y todavía tiene una duda — el canal que más ventas salva.' },
            ],
            ir: { label: 'Abrir Contacto', seccion: 'configuracion', query: { vista: 'contacto' } },
        },
        {
            id: 'cfg-pagos', titulo: 'Pagos',
            bloques: [
                { tipo: 'parrafo', texto: 'Qué medios de pago acepta tu tienda.' },
                { tipo: 'campos', items: [
                    { label: 'Mercado Pago', texto: 'Pagos online con tarjeta, débito y cuotas. Se conecta con [[Conectar cuenta]]: te lleva a Mercado Pago, autorizás, y volvés. Es opcional: sin Mercado Pago igual podés cobrar por transferencia o en efectivo; lo que no vas a tener es el pago con tarjeta desde la tienda.' },
                    { label: 'Coordinar por WhatsApp', texto: 'El cliente cierra la compra y vos arreglás el pago por WhatsApp. No se le muestra ningún CBU ni alias en la tienda.' },
                    { label: 'Retiro en local', texto: 'Si lo activás, el cliente puede retirar. Ahí se habilitan los medios de pago que aceptás en el mostrador: efectivo, débito, crédito o Mercado Pago.' },
                    { label: 'Descuento por pagar con Mercado Pago', texto: 'Un % opcional para empujar el pago online.' },
                ] },
                { tipo: 'nota', variante: 'dato', texto: 'Mercado Pago te cobra una comisión por cada cobro, y no es un % fijo: cambia según el medio de pago y las cuotas. La ves en el detalle de cada pedido y sumada por período en el Inicio.' },
                { tipo: 'nota', variante: 'aviso', texto: 'Si activás "Retiro en local" pero no cargaste la dirección, la tienda le avisa al cliente que se la vas a pasar por WhatsApp. Conviene cargarla en Negocio.' },
            ],
            ir: { label: 'Abrir Pagos', seccion: 'configuracion', query: { vista: 'pagos' } },
        },
        {
            id: 'cfg-envios', titulo: 'Envíos',
            bloques: [
                { tipo: 'parrafo', texto: 'Cómo entregás y cuánto cobrás. Elegís qué transportes ofrecés de verdad — **Correo Argentino, OCA, Andreani, Vía Cargo, delivery local (moto o app), u otro a coordinar** — y le ponés un costo a cada uno.' },
                { tipo: 'parrafo', texto: 'También podés definir un **umbral de envío gratis**: a partir de cierto monto, no se cobra. Es de las formas más simples de subir el ticket promedio.' },
            ],
            ir: { label: 'Abrir Envíos', seccion: 'configuracion', query: { vista: 'envios' } },
        },
        {
            id: 'cfg-redes', titulo: 'Redes sociales',
            bloques: [
                { tipo: 'parrafo', texto: 'Instagram, TikTok y Facebook. Se muestran en tu tienda: el que te compró una vez te sigue, y el que te sigue vuelve.' },
            ],
            ir: { label: 'Abrir Redes sociales', seccion: 'configuracion', query: { vista: 'redes' } },
        },
        {
            id: 'cfg-dominios', titulo: 'Dominios',
            bloques: [
                { tipo: 'parrafo', texto: 'Tu tienda ya tiene su dirección de Órbita y funciona igual. Si querés la tuya propia (tunegocio.com), acá la **comprás desde el panel** o **conectás una que ya tengas**.' },
            ],
            ir: { label: 'Abrir Dominios', seccion: 'configuracion', query: { vista: 'dominios' } },
        },
        {
            id: 'cfg-postventa', titulo: 'Cancelaciones y devoluciones',
            bloques: [
                { tipo: 'parrafo', texto: 'Acá definís las reglas: si aceptás devoluciones y cancelaciones, y con qué tipo de reembolso — **nota de crédito**, **plata de vuelta por Mercado Pago**, o los dos.' },
                { tipo: 'parrafo', texto: 'Lo que elijas es lo que tu cliente puede pedir desde la tienda. Aprobar cada caso puntual sigue siendo tuyo, y se hace en Pedidos.' },
            ],
            ir: { label: 'Abrir Cancelaciones y devoluciones', seccion: 'configuracion', query: { vista: 'postventa' } },
        },
        {
            id: 'cfg-apariencia', titulo: 'Apariencia',
            bloques: [
                { tipo: 'parrafo', texto: 'Cómo se ve tu tienda. Es la pantalla más larga de Configuración, con su propio índice de secciones:' },
                { tipo: 'lista', items: [
                    '**Identidad de marca**: logo y favicon.',
                    '**Paleta de colores** y **Tipografía**: los colores y la letra de toda tu tienda, incluida la escala de texto.',
                    '**Diseño y layout**: cómo se acomoda el contenido.',
                    '**Banner con efecto parallax** y **Video en tu tienda**: las piezas grandes de la portada.',
                    '**Marcas con las que trabajás**: los logos de tus proveedores o marcas.',
                    '**¿Qué ven tus clientes?**: qué secciones se muestran y cuáles no.',
                    '**Textos de tu tienda**: los títulos y frases de la portada.',
                    '**Barra de estadísticas** y **Pie de página**.',
                ] },
                { tipo: 'nota', variante: 'dato', texto: 'Si activaste una plantilla de Home (paquete Avanzado), la Apariencia clásica queda bloqueada: la portada la manda la plantilla. Se puede volver a la apariencia original desde la galería de plantillas.' },
            ],
            ir: { label: 'Abrir Apariencia', seccion: 'configuracion', query: { vista: 'apariencia' } },
        },
        {
            id: 'cfg-equipo', titulo: 'Equipo',
            bloques: [
                { tipo: 'parrafo', texto: 'Invitás gente por email y cada uno entra con su propio usuario. Le llega un mail con la invitación.' },
                { tipo: 'campos', items: [
                    { label: 'Propietario', texto: 'Acceso total al panel, incluida la configuración, el equipo y el plan.' },
                    { label: 'Empleado', texto: 'Acceso al trabajo del día a día, sin las secciones sensibles del negocio. Le aparecen menos módulos en el menú, y eso está bien.' },
                ] },
                { tipo: 'nota', variante: 'dato', texto: 'Cada persona tiene su propia contraseña, y las credenciales son exclusivas de este negocio.' },
            ],
            ir: { label: 'Abrir Equipo', seccion: 'configuracion', query: { vista: 'equipo' } },
        },
        {
            id: 'cfg-notificaciones', titulo: 'Notificaciones',
            bloques: [
                { tipo: 'parrafo', texto: 'Una grilla donde elegís, evento por evento, si querés el aviso **en el panel** (la campana), **por email** (a tu correo y al de tu equipo), los dos, o ninguno.' },
                { tipo: 'campos', titulo: 'Ventas', items: [
                    { label: 'Nuevo pedido', texto: 'Cada vez que entra un pedido nuevo.' },
                    { label: 'Pago confirmado', texto: 'Se acreditó un pago que estaba pendiente.' },
                    { label: 'Pedido cancelado', texto: 'Un pedido se canceló.' },
                    { label: 'Cancelación pedida', texto: 'Un cliente pidió cancelar un pedido ya confirmado.' },
                    { label: 'Devolución', texto: 'Un cliente inició una devolución.' },
                ] },
                { tipo: 'campos', titulo: 'Stock y clientes', items: [
                    { label: 'Stock crítico', texto: 'Un producto llegó a su stock mínimo.' },
                    { label: 'Cliente nuevo', texto: 'Se registró un cliente nuevo.' },
                ] },
                { tipo: 'campos', titulo: 'Resúmenes', items: [
                    { label: 'Resumen diario', texto: 'Cómo cerró el día, todas las noches.' },
                    { label: 'Reporte semanal', texto: 'Los números de la semana, los lunes.' },
                ] },
                { tipo: 'nota', variante: 'tip', texto: 'Si recién arrancás, dejá "Nuevo pedido" por mail: es el aviso que no querés perderte. El resto lo vas afinando cuando el volumen crezca.' },
            ],
            ir: { label: 'Abrir Notificaciones', seccion: 'configuracion', query: { vista: 'notificaciones' } },
        },
        {
            id: 'cfg-actividad', titulo: 'Registro de actividad',
            bloques: [
                { tipo: 'parrafo', texto: 'Quién hizo qué y cuándo. Si trabajás con equipo, es donde se contesta "¿quién cambió este precio?" sin tener que preguntarle a nadie.' },
            ],
            ir: { label: 'Abrir Registro de actividad', seccion: 'configuracion', query: { vista: 'actividad' } },
        },
        {
            id: 'cfg-suscripcion', titulo: 'Suscripción',
            bloques: [
                { tipo: 'parrafo', texto: 'Qué plan tenés, qué incluye, cuándo se renueva y cómo cambiarlo. Acá también se activa el **paquete Avanzado**, que se paga aparte de la suscripción mensual.' },
            ],
            ir: { label: 'Abrir Suscripción', seccion: 'configuracion', query: { vista: 'suscripcion' } },
        },
        {
            id: 'cfg-soporte', titulo: 'Soporte',
            bloques: [
                { tipo: 'parrafo', texto: 'Cómo escribirnos cuando algo no cierra. Lo puede usar cualquiera que tenga acceso al panel, no solo el propietario.' },
            ],
            ir: { label: 'Abrir Soporte', seccion: 'configuracion', query: { vista: 'soporte' } },
        },
        {
            id: 'cfg-peligro', titulo: 'Zona peligrosa',
            bloques: [
                { tipo: 'parrafo', texto: 'Las acciones que no tienen vuelta atrás, como dar de baja el negocio. Está separada del resto y con avisos claros justamente para que nadie la toque de pasada.' },
                { tipo: 'nota', variante: 'aviso', texto: 'Antes de tocar algo de acá, leé el botón "¿Qué pasa si...?": te explica exactamente qué se pierde.' },
            ],
        },
    ],
},

// ═══════════════════════════════════════════════════════════════════════════
// 11 · Avanzado
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'avanzado', titulo: 'Avanzado', Icon: Sparkles, ilustracion: 'avanzado',
    resumen: 'El paquete pago aparte: juegos con premio, anuncios, 2x1, plantillas de portada y prueba social.',
    ir: { label: 'Ir a Avanzado', seccion: 'avanzado' },
    temas: [
        {
            id: 'que-es-avanzado', titulo: 'Qué es el paquete Avanzado',
            bloques: [
                { tipo: 'parrafo', texto: 'Es un paquete de herramientas que **se paga aparte de tu suscripción mensual**. Si todavía no lo tenés, vas a ver las tarjetas con un candado y un botón [[Ver qué incluye]] que te lleva a Suscripción.' },
                { tipo: 'parrafo', texto: 'Configurar estas funciones es decisión del propietario: a un Empleado no le aparece el módulo.' },
            ],
        },
        {
            id: 'funciones-avanzado', titulo: 'Qué trae',
            bloques: [
                { tipo: 'campos', items: [
                    { label: 'Juegos con premio', texto: 'Mini-juegos de habilidad (encestar, meter un gol). Vos definís cuánto descuento se gana por acierto y el tope. El descuento se crea solo, sin pasar por el módulo de Descuentos.' },
                    { label: 'Modales de anuncios', texto: 'Avisos grandes que aparecen en el momento justo en tu tienda: una bienvenida con descuento, un anuncio de temporada.' },
                    { label: '2x1 y 3x2', texto: 'La promo "llevá X, pagá Y" aplicada sola en el carrito, sin código, con un cartel en la tarjeta del producto.' },
                    { label: 'Plantillas de Home', texto: 'Diseños alternativos para la **portada** de tu tienda. El resto — catálogo, checkout, perfil — queda igual. Se prueban con [[Ver cómo queda]] antes de aplicar.' },
                    { label: 'Prueba social', texto: 'Notificaciones tipo "Fulano compró tal producto", armadas con pedidos **reales** de tu tienda. Nunca con datos inventados.' },
                    { label: 'Oferta relámpago', texto: 'Un descuento que dura poco y se muestra en tu tienda con un reloj en cuenta regresiva. Se arma desde Descuentos, como cualquier otro, y se prende o apaga desde acá.' },
                ] },
            ],
        },
    ],
},

// ═══════════════════════════════════════════════════════════════════════════
// 12 · Tu cuenta
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'cuenta', titulo: 'Tu cuenta', Icon: UserCircle, ilustracion: 'perfil',
    resumen: 'Mi perfil, confirmar el email, cambiar la contraseña y ver la tienda como cliente.',
    ir: { label: 'Ir a Mi perfil', seccion: 'perfil' },
    temas: [
        {
            id: 'mi-perfil', titulo: 'Mi perfil',
            bloques: [
                { tipo: 'parrafo', texto: 'Se abre desde tu avatar, arriba a la derecha. Ahí están tus datos, el tema claro u oscuro y tu contraseña.' },
                { tipo: 'campos', items: [
                    { label: 'Confirmar tu email', texto: 'Tocás [[Enviarme el código]], te llega uno de 6 números y lo pegás. Es lo que nos deja devolverte la cuenta si perdés el acceso. Tenés 7 días desde que creaste la tienda.' },
                    { label: 'Cambiar la contraseña', texto: 'Desde la misma pantalla, sin pasar por "olvidé mi contraseña".' },
                    { label: 'Tema', texto: 'Claro u oscuro. Queda guardado en tu cuenta, no en el navegador: te sigue a cualquier dispositivo.' },
                ] },
            ],
            ir: { label: 'Ir a Mi perfil', seccion: 'perfil' },
        },
        {
            id: 'ver-tienda', titulo: 'Ver tu tienda como cliente',
            bloques: [
                { tipo: 'parrafo', texto: 'En el mismo menú del avatar, [[Ir a la tienda]] te abre el storefront tal cual lo ve un comprador. Es el chequeo que conviene hacer cada vez que tocás precios, fotos o apariencia.' },
            ],
        },
    ],
},

// ═══════════════════════════════════════════════════════════════════════════
// 13 · Si te trabás
// ═══════════════════════════════════════════════════════════════════════════
{
    id: 'ayuda', titulo: 'Si te trabás', Icon: LifeBuoy, ilustracion: 'orbi',
    resumen: 'Orbi, el tutorial guiado y cómo escribirnos.',
    temas: [
        {
            id: 'orbi', titulo: 'Preguntale a Orbi',
            bloques: [
                { tipo: 'parrafo', texto: 'Se abre con **Ctrl+K** (Cmd+K en Mac) desde cualquier pantalla del panel, o desde el botón **Orbi AI** al pie del menú de la izquierda.' },
                { tipo: 'parrafo', texto: 'No es un buscador de ayuda genérica: contesta con los datos de **tu** negocio. "¿Cuánto vendí esta semana?", "¿qué pedidos tengo pendientes?", "¿cómo creo un cupón?" son todas preguntas válidas.' },
            ],
        },
        {
            id: 'tutorial', titulo: 'El tutorial guiado',
            bloques: [
                { tipo: 'parrafo', texto: 'Los **Primeros pasos** son la versión activa de este manual: en vez de contarte dónde está algo, te lleva hasta ahí con el cursor y te espera a que lo hagas.' },
                { tipo: 'parrafo', texto: 'Tiene dos tandas: la primera son los siete pasos para salir a vender; la segunda recorre el resto del panel, agrupada en "Tu día a día", "La cara de tu tienda" y "Tu negocio". Se tildan solos a medida que vas cumpliendo.' },
            ],
            ir: { label: 'Ir al Inicio', seccion: 'dashboard' },
        },
        {
            id: 'escribinos', titulo: 'Escribinos',
            bloques: [
                { tipo: 'parrafo', texto: 'Si algo no cierra, en **Configuración → Soporte** está el canal para contarnos qué pasó. Lo puede usar cualquiera de tu equipo con acceso al panel.' },
            ],
            ir: { label: 'Abrir Soporte', seccion: 'configuracion', query: { vista: 'soporte' } },
        },
    ],
},

]

/** Total de temas: lo usa la portada del manual ("N temas, M capítulos"). */
export const TOTAL_TEMAS = CAPITULOS.reduce((n, c) => n + c.temas.length, 0)

/** Texto plano de un tema — para el buscador del índice (y el de Soporte).
 *  Sin las marcas de negrita ni de botón: buscar "publicar tienda" tiene que
 *  matchear aunque en el texto esté escrito [[Publicar tienda]]. */
export function textoPlano(tema: Tema): string {
    const partes: string[] = [tema.titulo]
    for (const b of tema.bloques) {
        if (b.tipo === 'parrafo' || b.tipo === 'nota') partes.push(b.texto)
        else if (b.tipo === 'lista') partes.push(...b.items)
        else if (b.tipo === 'pasos') partes.push(...b.items.map(i => `${i.titulo} ${i.texto}`))
        else if (b.tipo === 'campos') partes.push(b.titulo ?? '', ...b.items.map(i => `${i.label} ${i.texto}`))
        else if (b.tipo === 'estados') partes.push(...b.items.map(i => `${i.label} ${i.texto}`))
    }
    return partes.join(' ').replace(/\*\*|\[\[|\]\]/g, '')
}
