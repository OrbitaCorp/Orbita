// ─── Copy compartido de las 5 variantes de tutorial (demo interna) ───────────
//
// TODO el texto que ve el usuario en cualquiera de las variantes sale de acá:
// una sola fuente de verdad para que las 5 propuestas cuenten lo mismo y la
// comparación en la demo sea justa (misma información, distinta forma).
//
// El contenido está escrito contra lo que las pantallas REALMENTE hacen hoy
// (labels y flujos verificados en el código de cada sección) — si una sección
// cambia, esto se actualiza a mano.

export type SeccionId =
    | 'dashboard' | 'pedidos' | 'clientes' | 'catalogo' | 'mensajes'
    | 'descuentos' | 'configuracion' | 'avanzado'

export interface SeccionCopy {
    id: SeccionId
    /** Label EXACTO del item en el sidebar (para anclar y para navegar). */
    sidebarTexto: string
    titulo: string
    /** Qué es, en una frase corta. */
    queEs: string
    /** Para qué la vas a usar, 1-2 frases. */
    paraQue: string
    /** Bullets con lo más importante que tiene adentro (labels reales). */
    claves: string[]
    /** La primera acción de más valor para una cuenta nueva. */
    accionClave: string
    /** Ruta del panel: moduloPadre/seccion (se arma con adminPath). */
    ruta: [string, string]
    /** Tipo de mini-ilustración para la variante Bienvenida. */
    mock: 'kpis' | 'tabla' | 'chat' | 'grilla' | 'config' | 'cards'
}

export const SECCIONES: SeccionCopy[] = [
    {
        id: 'dashboard', sidebarTexto: 'Dashboard', titulo: 'Inicio',
        queEs: 'El resumen del negocio: cómo venís hoy, esta semana o este mes.',
        paraQue: 'Es la primera pantalla del día: ves ventas, pedidos y alertas de un vistazo, y desde cada alerta saltás directo a resolverla.',
        claves: [
            'Cinco números grandes: Ventas, Pedidos, Ticket promedio, Clientes nuevos y Comisión MP — siempre comparados con el período anterior.',
            'Alertas accionables: pedidos sin atender, stock crítico, pagos por confirmar. Cada una tiene su botón "Ir →".',
            'El botón "Publicar tienda": hasta que no lo toques, tu tienda no está online.',
        ],
        accionClave: 'Publicar la tienda cuando esté todo listo; después, entrar cada día y atender las alertas.',
        ruta: ['ventas', 'dashboard'], mock: 'kpis',
    },
    {
        id: 'pedidos', sidebarTexto: 'Pedidos', titulo: 'Pedidos',
        queEs: 'Todo lo que te compraron, ordenado por estado.',
        paraQue: 'Acá vivís el día a día: confirmás pagos, movés pedidos de Pendiente a Entregado y cargás ventas hechas por fuera de la tienda.',
        claves: [
            'Pestañas por estado con contador: Pendientes, Confirmados, En prep., Enviados, Entregados, Cancelados.',
            '"Nuevo pedido" carga una venta manual (mostrador, WhatsApp).',
            'El Historial y las Cancelaciones y devoluciones viven en este mismo módulo.',
            'Podés confirmar en lote, imprimir etiquetas y exportar a CSV.',
        ],
        accionClave: 'Cuando entre el primer pedido, abrir "Pendientes" y confirmarlo. Mientras tanto, probar "Nuevo pedido".',
        ruta: ['ventas', 'pedidos'], mock: 'tabla',
    },
    {
        id: 'clientes', sidebarTexto: 'Clientes', titulo: 'Clientes',
        queEs: 'La base de quién te compra, armada sola con cada venta.',
        paraQue: 'Por cada cliente ves cuántos pedidos hizo, cuánto gastó, su ticket promedio y cuándo compró por última vez. Y les escribís desde acá.',
        claves: [
            'La flechita de cada fila despliega sus últimos pedidos; desde ahí, "Ver perfil completo →".',
            '"Email masivo" le escribe a toda la lista filtrada; el sobre de cada fila, a uno solo.',
            '"Exportar" baja toda la base en CSV.',
        ],
        accionClave: 'No hay nada que cargar: se llena sola. Cuando tengas clientes, usá la búsqueda y el email masivo.',
        ruta: ['ventas', 'clientes'], mock: 'tabla',
    },
    {
        id: 'catalogo', sidebarTexto: 'Productos', titulo: 'Productos',
        queEs: 'Tu catálogo: lo que la gente ve y compra en la tienda.',
        paraQue: 'Acá cargás productos con fotos, precio, stock y variantes, y los ordenás en categorías para que el catálogo se navegue bien.',
        claves: [
            '"Crear producto" es el alta: fotos, precio, stock, variantes, y publicado o borrador.',
            'Arriba, cinco números del catálogo: Total, Publicados, Sin stock, Borradores y Valor de inventario.',
            'En "Categorías" armás el árbol (con subcategorías, ícono y color).',
            '"Exportar Excel" baja el catálogo completo en .xlsx.',
        ],
        accionClave: 'Crear el primer producto. Es el paso que hace que la tienda exista.',
        ruta: ['ventas', 'catalogo'], mock: 'grilla',
    },
    {
        id: 'mensajes', sidebarTexto: 'Mensajes', titulo: 'Mensajes',
        queEs: 'El chat con los clientes de tu tienda.',
        paraQue: 'Los compradores te escriben desde la tienda y les respondés acá, con el contexto de sus pedidos a mano.',
        claves: [
            'Bandeja a la izquierda con los no leídos marcados; el chat a la derecha.',
            'Escribí # para mencionar un pedido en el mensaje.',
            'Las Plantillas guardan respuestas frecuentes para no tipear siempre lo mismo.',
            'Las conversaciones terminadas se archivan.',
        ],
        accionClave: 'Cuando llegue el primer mensaje vas a ver un punto rojo en el menú. Abrilo y respondé desde acá.',
        ruta: ['ventas', 'mensajes'], mock: 'chat',
    },
    {
        id: 'descuentos', sidebarTexto: 'Descuentos', titulo: 'Descuentos',
        queEs: 'Promos y cupones para vender más.',
        paraQue: 'Los Descuentos se aplican solos cuando se cumple la condición; los Cupones son códigos que el cliente escribe en el checkout.',
        claves: [
            'Cuatro tipos de descuento: porcentaje o monto fijo, por producto o sobre el total del ticket.',
            'Cada uno se activa, desactiva, duplica o comparte por link.',
            'En "Rendimiento" ves cuánto se usó cada promo y qué resultado dio.',
        ],
        accionClave: 'Crear el primer descuento o cupón y compartir el link.',
        ruta: ['ventas', 'descuentos'], mock: 'cards',
    },
    {
        id: 'configuracion', sidebarTexto: 'Configuración', titulo: 'Configuración',
        queEs: 'Los datos que hacen funcionar la tienda.',
        paraQue: 'Es la sección más importante de la primera semana: sin datos del negocio y sin Mercado Pago conectado, el checkout no puede cobrar online.',
        claves: [
            'Negocio: nombre, rubro y dirección (con mapa).',
            'Pagos: conectar Mercado Pago, efectivo con descuento, coordinar por WhatsApp.',
            'Envíos: cómo entregás y cuánto cobrás.',
            'Equipo: invitá gente con roles y permisos — cada uno ve solo lo suyo.',
            'También: dominios, notificaciones, apariencia y tu suscripción.',
        ],
        accionClave: 'Completar "Información del negocio" y conectar Mercado Pago. Ese es EL paso uno.',
        ruta: ['ventas', 'configuracion'], mock: 'config',
    },
    {
        id: 'avanzado', sidebarTexto: 'Avanzado', titulo: 'Avanzado',
        queEs: 'El paquete de extras pago, aparte de tu suscripción.',
        paraQue: 'Herramientas para vender más fuerte: juegos con premio, modales de anuncios, plantillas de Home para cambiar la portada, y countdown con prueba social.',
        claves: [
            'Juegos con premio: el cliente juega y gana un descuento.',
            'Modales de anuncios: avisos grandes al entrar a la tienda.',
            'Plantillas de Home: veinte portadas distintas para tu tienda.',
            'Si no tenés el paquete, "Ver qué incluye" te muestra el detalle en Suscripción.',
        ],
        accionClave: 'Entrar a "Plantillas de Home" y tocar "Ver cómo queda" en una portada.',
        ruta: ['ventas', 'avanzado'], mock: 'grilla',
    },
]

export const seccionPorId = (id: SeccionId): SeccionCopy =>
    SECCIONES.find(s => s.id === id) as SeccionCopy

// ─── Herramientas del header (las cubren Recorrido y Bienvenida) ─────────────

export interface HerramientaCopy {
    id: 'buscador' | 'campana' | 'tema' | 'orbi' | 'usuario'
    titulo: string
    texto: string
}

export const HERRAMIENTAS: HerramientaCopy[] = [
    { id: 'buscador', titulo: 'Búsqueda global', texto: 'Buscá un pedido, un cliente, un producto o una sección desde cualquier pantalla. Escribí y listo.' },
    { id: 'campana', titulo: 'Notificaciones', texto: 'La campana junta lo que pasó mientras no estabas: pedidos nuevos, avisos del sistema. El número es lo sin leer.' },
    { id: 'tema', titulo: 'Modo oscuro', texto: 'Un toque y el panel entero cambia de claro a oscuro. Queda guardado en tu cuenta.' },
    { id: 'orbi', titulo: 'Orbi, el asistente', texto: 'Orbi responde preguntas sobre tu negocio y te ayuda a operar el panel. Se abre con Ctrl+K desde cualquier lado.' },
    { id: 'usuario', titulo: 'Tu cuenta', texto: 'Desde tu avatar: "Mi perfil" (tus datos, tema y contraseña), "Ir a la tienda" para verla como cliente, y "Cerrar sesión".' },
]

// ─── Variante: Checklist de primeros pasos ───────────────────────────────────

export interface TareaChecklist {
    id: string
    titulo: string
    detalle: string
    /** Consejo puntual (se muestra resaltado, con la estética de Orbi si aplica). */
    tip?: string
    /** Adónde lleva el botón "Ir": [moduloPadre, seccion, query?] */
    destino: [string, string, Record<string, string>?]
    destinoLabel: string
    /** Segmento de sección donde vive la tarea (para el recuadro azul guía). */
    seccionDestino?: string
    /** Ancla del elemento a resaltar al llegar (sintaxis de anclas.ts, admite "a || b"). */
    anclaDestino?: string
    /** Qué dice el cartelito cuando el cursor aterriza en el elemento — la
        ACCIÓN concreta, no un "es acá" genérico. */
    guiaLabel?: string
}

export const TAREAS_CHECKLIST: TareaChecklist[] = [
    {
        id: 'negocio', titulo: 'Completá los datos del negocio',
        detalle: 'Nombre, rubro y dirección del local. Es lo que ven tus clientes y lo que usa el envío para calcular distancias.',
        destino: ['ventas', 'configuracion', { vista: 'negocio' }], destinoLabel: 'Ir a Configuración',
        seccionDestino: 'configuracion', anclaDestino: '.cfg-sidebar-item[title="Negocio"]',
        guiaLabel: 'Tus datos se cargan acá',
    },
    {
        id: 'mp', titulo: 'Conectá Mercado Pago',
        detalle: 'Sin esto la tienda no puede cobrar online. Está en Configuración → Pagos, botón "Conectar cuenta". Lleva dos minutos.',
        destino: ['ventas', 'configuracion', { vista: 'pagos' }], destinoLabel: 'Ir a Pagos',
        seccionDestino: 'configuracion', anclaDestino: 'boton:Conectar cuenta || .cfg-sidebar-item[title="Pagos"]',
        guiaLabel: 'Conectá tu cuenta desde acá',
    },
    // Categorías ANTES que el primer producto (pedido de Ale): así el producto
    // ya nace en su lugar en vez de quedar "Sin categoría".
    {
        id: 'categorias', titulo: 'Creá tus primeras categorías',
        detalle: 'Antes de cargar el primer producto, armá el árbol: con 2-6 categorías alcanza (se pueden anidar). Así cada producto ya nace en su lugar y la tienda se navega sola.',
        destino: ['ventas', 'categorias'], destinoLabel: 'Ir a Categorías',
        seccionDestino: 'categorias', anclaDestino: 'boton:Nueva categoría',
        guiaLabel: 'Creá la primera desde acá',
    },
    {
        id: 'producto', titulo: 'Creá tu primer producto',
        detalle: 'Fotos, precio, stock y su categoría.',
        tip: 'Escribí el nombre y tocá «Generar con Orbi»: te escribe la descripción y te sugiere categoría y etiquetas al toque.',
        destino: ['ventas', 'catalogo', { vista: 'nuevo' }], destinoLabel: 'Crear producto',
        seccionDestino: 'catalogo', anclaDestino: 'boton:Generar con Orbi || boton:Crear producto',
        guiaLabel: 'Empezá por acá',
    },
    {
        id: 'envios', titulo: 'Definí cómo entregás',
        detalle: 'Envío a domicilio, retiro en el local, o los dos. Configurá costos y zonas en Configuración → Envíos.',
        destino: ['ventas', 'configuracion', { vista: 'envios' }], destinoLabel: 'Ir a Envíos',
        seccionDestino: 'configuracion', anclaDestino: '.cfg-sidebar-item[title="Envíos"]',
        guiaLabel: 'Tus envíos se definen acá',
    },
    {
        id: 'publicar', titulo: 'Publicá la tienda',
        detalle: 'El botón "Publicar tienda" está en el Inicio. Hasta que no lo toques, nadie puede comprarte.',
        destino: ['ventas', 'dashboard'], destinoLabel: 'Ir al Inicio',
        seccionDestino: 'dashboard', anclaDestino: 'boton:Publicar tienda|Tienda online',
        guiaLabel: 'Salís a vender con este botón',
    },
]

// ─── Variante: Tooltips progresivos por sección ──────────────────────────────

export interface TipSeccion {
    /** Ancla: selector CSS, o texto de botón con prefijo 'boton:'. */
    ancla: string
    titulo: string
    texto: string
}

/** Tips que aparecen la PRIMERA vez que entrás a cada sección. */
export const TIPS_POR_SECCION: Partial<Record<string, TipSeccion[]>> = {
    dashboard: [
        { ancla: '.dash-kpis', titulo: 'Tus números', texto: 'Ventas, pedidos, ticket promedio, clientes nuevos y comisión de MP — comparados con el período anterior.' },
        { ancla: '.dash-alerts', titulo: 'Alertas', texto: 'Lo que necesita tu atención: pedidos sin atender, stock crítico, pagos por confirmar. Cada una tiene su "Ir →".' },
        { ancla: 'boton:Publicar tienda|Tienda online', titulo: 'Publicar', texto: 'Cuando esté todo listo, este botón pone tu tienda online. Antes de eso, nadie la ve.' },
    ],
    pedidos: [
        { ancla: '.ped-tabs-row', titulo: 'Estados', texto: 'Cada pedido avanza por estas pestañas: de Pendiente a Entregado. El contador te dice cuántos hay en cada una.' },
        { ancla: 'boton:Nuevo pedido', titulo: 'Venta manual', texto: '¿Vendiste por WhatsApp o en el mostrador? Cargalo acá para que cuente en tus números.' },
        { ancla: '.ped-search', titulo: 'Buscar', texto: 'Encontrá cualquier pedido por número o por nombre del cliente.' },
    ],
    catalogo: [
        { ancla: '.prod-kpis', titulo: 'Tu catálogo en números', texto: 'Total, publicados, sin stock, borradores y el valor de tu inventario.' },
        { ancla: 'boton:Crear producto', titulo: 'El alta', texto: 'Fotos, precio, stock y variantes. Con el primer producto publicado, tu tienda ya vende.' },
        { ancla: '.prod-filter-row', titulo: 'Filtros', texto: 'Buscá por nombre o SKU, filtrá por categoría o estado, y cambiá entre vista de grilla y tabla.' },
    ],
    categorias: [
        { ancla: '.cat-grid', titulo: 'El árbol', texto: 'Las categorías ordenan tu catálogo. Creá raíces y subcategorías; el editor de la derecha cambia nombre, ícono y color.' },
    ],
    clientes: [
        { ancla: '.cli-header', titulo: 'Tu base de clientes', texto: 'Se arma sola con cada venta. "Email masivo" le escribe a la lista filtrada; "Exportar" baja todo en CSV.' },
        { ancla: '.cli-table-wrap', titulo: 'Cada cliente', texto: 'Pedidos, gastado, ticket promedio y última compra. La flechita despliega sus últimos pedidos.' },
    ],
    mensajes: [
        { ancla: '.msg-list', titulo: 'La bandeja', texto: 'Los clientes de tu tienda te escriben acá. El punto azul marca lo no leído.' },
        { ancla: 'boton-title:Usar plantilla', titulo: 'Plantillas', texto: 'Respuestas guardadas para lo que te preguntan siempre. Se administran en Mensajes → Plantillas.' },
    ],
    descuentos: [
        { ancla: '.dl-actions', titulo: 'Crear promos', texto: '"Crear descuento" arma promos que se aplican solas; en la pestaña Cupones creás códigos canjeables. "Métricas" muestra el rendimiento.' },
        { ancla: '.df-root', titulo: 'Filtros', texto: 'Filtrá por estado (activo, programado, expirado) o por tipo de promo.' },
    ],
    cupones: [
        { ancla: '.dl-actions', titulo: 'Cupones', texto: 'Códigos que el cliente escribe en el checkout. Se pueden limitar por usos totales o por cliente.' },
    ],
    configuracion: [
        { ancla: '.cfg-sidebar', titulo: 'El menú de Configuración', texto: 'Cada sección guarda por separado. Las dos claves de la primera semana: Negocio (tus datos) y Pagos (conectar Mercado Pago).' },
    ],
    avanzado: [
        { ancla: 'centro', titulo: 'El paquete Avanzado', texto: 'Extras pagos aparte de tu suscripción: juegos con premio, modales de anuncios, plantillas de Home y countdown. Si no lo tenés, "Ver qué incluye" te muestra el detalle.' },
    ],
}

// ─── Variante: Asistente lateral (hacelo vos) ────────────────────────────────

export interface MisionAsistente {
    id: string
    /** Instrucción corta de lo que tiene que HACER el usuario. */
    pedido: string
    /** Qué contarle cuando llega (o al mostrar el paso, si no requiere acción). */
    explicacion: string
    /** Sección esperada (seccion del path) para auto-avanzar; null = avanza a mano. */
    esperaSeccion: string | null
    /** Item del sidebar a resaltar mientras espera. */
    resaltaSidebar?: string
}

export const MISIONES_ASISTENTE: MisionAsistente[] = [
    {
        id: 'bienvenida', esperaSeccion: null,
        pedido: 'Este es tu panel. Te lo muestro haciendo, no leyendo: te voy pidiendo que toques cosas de verdad y te cuento qué es cada una. Son 8 paradas, dos minutos.',
        explicacion: '',
    },
    {
        id: 'pedidos', esperaSeccion: 'pedidos', resaltaSidebar: 'Pedidos',
        pedido: 'Abrí **Pedidos** en el menú de la izquierda.',
        explicacion: 'Acá cae todo lo que te compran. Cada pedido avanza por las pestañas de arriba: de Pendiente a Entregado. Y "Nuevo pedido" carga una venta hecha por fuera (mostrador, WhatsApp).',
    },
    {
        id: 'catalogo', esperaSeccion: 'catalogo', resaltaSidebar: 'Productos',
        pedido: 'Ahora entrá a **Productos**.',
        explicacion: 'Tu catálogo: lo que la gente ve y compra. "Crear producto" da el alta con fotos, precio, stock y variantes; en Categorías se arma el árbol que ordena la tienda.',
    },
    {
        id: 'clientes', esperaSeccion: 'clientes', resaltaSidebar: 'Clientes',
        pedido: 'Seguimos: abrí **Clientes**.',
        explicacion: 'Esta base se llena sola con cada venta: cuántos pedidos hizo cada uno, cuánto gastó, cuándo volvió. Desde acá también les mandás emails, individuales o masivos.',
    },
    {
        id: 'mensajes', esperaSeccion: 'mensajes', resaltaSidebar: 'Mensajes',
        pedido: 'Entrá a **Mensajes**.',
        explicacion: 'El chat con los clientes de tu tienda. Cuando alguien te escriba vas a ver un punto rojo en el menú. Tip: escribí # en el chat para mencionar un pedido.',
    },
    {
        id: 'descuentos', esperaSeccion: 'descuentos', resaltaSidebar: 'Descuentos',
        pedido: 'Abrí **Descuentos**.',
        explicacion: 'Promos que se aplican solas y cupones con código para el checkout. Todo se activa, desactiva o comparte por link, y en Rendimiento ves qué funcionó.',
    },
    {
        id: 'configuracion', esperaSeccion: 'configuracion', resaltaSidebar: 'Configuración',
        pedido: 'Vamos a la más importante: **Configuración**.',
        explicacion: 'Los datos que hacen funcionar la tienda. Los dos imprescindibles de la primera semana: completar "Negocio" y conectar Mercado Pago en "Pagos" — sin eso no podés cobrar online. En "Equipo" invitás gente con permisos.',
    },
    {
        id: 'avanzado', esperaSeccion: 'avanzado', resaltaSidebar: 'Avanzado',
        pedido: 'Una más: **Avanzado**.',
        explicacion: 'El paquete de extras pago: juegos con premio, modales de anuncios, plantillas de Home (veinte portadas para tu tienda) y countdown. Se contrata aparte de la suscripción.',
    },
    {
        id: 'cierre', esperaSeccion: 'dashboard', resaltaSidebar: 'Dashboard',
        pedido: 'Última: volvé al **Dashboard**.',
        explicacion: 'Listo, ya recorriste todo el panel. El Inicio es tu resumen diario: números, alertas y el botón "Publicar tienda" para salir a vender. Por acá se empieza cada mañana.',
    },
]

// ─── Texto común ─────────────────────────────────────────────────────────────

export const TEXTOS = {
    bienvenidaTitulo: (nombre?: string) => nombre ? `¡Hola, ${nombre}!` : '¡Hola!',
    bienvenidaIntro: 'Este es el panel de tu negocio. Un recorrido corto para saber qué es cada cosa — después lo explorás a tu ritmo.',
    saltar: 'Saltar tutorial',
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    entendido: 'Entendido',
    empezar: 'Empezar',
    listo: 'Listo',
    reiniciar: 'Reiniciar tutorial',
    cierreTitulo: 'Eso es todo',
    cierre: 'Ya conocés el mapa. El mejor primer paso real: Configuración → completar tus datos y conectar Mercado Pago. Después, tu primer producto.',
}
