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
            'Podés confirmar en lote y exportar a CSV.',
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
        paraQue: 'Es la sección más importante de la primera semana: acá cargás los datos del negocio y elegís cómo cobrás. Conectar Mercado Pago es opcional, pero conviene si querés que tus clientes paguen con tarjeta.',
        claves: [
            'Negocio: nombre, rubro y dirección (con mapa).',
            'Pagos: efectivo, transferencia, coordinar por WhatsApp y, si querés cobrar con tarjeta, Mercado Pago.',
            'Envíos: cómo entregás y cuánto cobrás.',
            'Equipo: invitá gente con roles y permisos — cada uno ve solo lo suyo.',
            'También: dominios, notificaciones, apariencia y tu suscripción.',
        ],
        accionClave: 'Completar "Información del negocio" y elegir cómo cobrás. Mercado Pago es una sugerencia, no un requisito.',
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
    { id: 'usuario', titulo: 'Tu cuenta', texto: 'Desde tu avatar: "Mi perfil" (tus datos, tema y contraseña), "Ir a la tienda" para verla como cliente, y "Cerrar sesión". En Mi perfil también confirmás tu email, que es lo que nos deja recuperarte la cuenta.' },
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
    /** Guía en VARIOS pasos dentro de la misma pantalla (reemplaza a
        anclaDestino/guiaLabel cuando está): el recuadro y el cursor van al
        primero y, cuando se cumple su condición, saltan al siguiente. */
    pasos?: PasoGuia[]
    /** Bloque al que pertenece la tarea: se dibuja como encabezado de la
        lista cuando cambia respecto de la anterior. Solo lo usa la etapa 2
        (quince tareas corridas no se leen; tres bloques de cinco, sí). La
        etapa 1 son seis pasos de una sola tirada: no lleva. */
    grupo?: string
}

export interface PasoGuia {
    /** Ancla del elemento (sintaxis de anclas.ts, admite "a || b"). */
    ancla: string
    /** Cartelito pegado al elemento: la acción concreta. */
    label: string
    /** Pasa al paso siguiente cuando el usuario escribe en el elemento (input/textarea). */
    avanzarAlEscribir?: boolean
}

export const TAREAS_CHECKLIST: TareaChecklist[] = [
    // Primera de todas porque es la única con reloj: son 7 días desde que se
    // creó el espacio (hallazgo `alta-sin-verificar-email`). No se pide en el
    // wizard a propósito — ahí suma fricción justo antes de cobrar.
    {
        id: 'verificar-email', titulo: 'Confirmá tu email',
        detalle: 'Es el mail con el que entrás al panel. Te mandamos un código de 6 números y lo pegás en Mi perfil: treinta segundos.',
        tip: 'Confirmarlo es lo que nos deja devolverte la cuenta si alguna vez perdés el acceso. Tenés 7 días desde que creaste la tienda.',
        destino: ['ventas', 'perfil'], destinoLabel: 'Ir a Mi perfil',
        seccionDestino: 'perfil', anclaDestino: 'boton:Enviarme el código || boton:Enviar otro código',
        guiaLabel: 'Pedí el código desde acá',
    },
    {
        id: 'negocio', titulo: 'Completá los datos del negocio',
        detalle: 'Nombre, rubro y dirección del local. Es lo que ven tus clientes y lo que usa el envío para calcular distancias.',
        destino: ['ventas', 'configuracion', { vista: 'negocio' }], destinoLabel: 'Ir a Configuración',
        seccionDestino: 'configuracion', anclaDestino: '.cfg-sidebar-item[title="Negocio"]',
        guiaLabel: 'Tus datos se cargan acá',
    },
    {
        id: 'mp', titulo: 'Conectá Mercado Pago (opcional)',
        detalle: 'Es una sugerencia, no un requisito: con Mercado Pago tus clientes pagan con tarjeta o dinero en cuenta sin salir de la tienda. Si preferís, podés arrancar cobrando por transferencia o en efectivo y conectarlo más adelante. Está en Configuración → Pagos, botón "Conectar cuenta". Lleva dos minutos.',
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
        seccionDestino: 'catalogo',
        // Dos pasos (pedido de Ale): primero el nombre, recién después Orbi.
        // Si no, la guía manda directo a "Generar con Orbi" y no se entiende
        // que Orbi necesita el nombre para escribir la descripción.
        pasos: [
            {
                ancla: '.ds-field:has(> input[placeholder="Ej: Remera oversize negra"]) || boton:Crear producto',
                label: 'Escribí acá el nombre del producto',
                avanzarAlEscribir: true,
            },
            { ancla: 'boton:Generar con Orbi', label: 'Ahora tocá acá: Orbi te escribe la descripción' },
        ],
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

// ─── Checklist, segunda etapa: el resto del panel ────────────────────────────
//
// Arranca cuando se termina la primera (o sola, para los negocios que ya la
// habían terminado: ver ETAPA_2_PARA_QUIEN_YA_TERMINO en estado.ts). Pedido
// de Ale (15/09): "que abarque todo lo que pueda el panel, la mayor parte de
// todo lo que faltó" — así que son quince tareas que recorren lo que la
// primera etapa no toca, en tres bloques (`grupo`) para que la lista se lea:
//
//   · Tu día a día         → pedidos, estados, clientes, plantillas, barra de arriba.
//   · La cara de tu tienda → apariencia, contacto, redes, promos, dominio.
//   · Tu negocio           → equipo, avisos, postventa, reportes, plan.
//
// Rutas, vistas y anclas verificadas contra el código real (15/09):
// Sidebar.tsx (subs con `vista`), AdminSeccionShell.tsx (secciones válidas),
// ConfigSidebar.tsx (title = label exacto de cada ítem), PedidoLista.tsx
// (.ped-tabs-row), ReporteTabs.tsx (.mod-tabs), anclas.ts (header:*).
// Los ids también los conoce la API (businesses.service.ts#getTutorial) para
// el tildado automático; `herramientas`, `reportes` y `plan` son las únicas
// que NO se pueden detectar (mirar una pantalla no deja rastro en la base):
// esas se tildan a mano, como siempre.
//
// Lo único que queda afuera a propósito: Avanzado (paquete pago aparte — una
// tarea que termina en un overlay de "ver qué incluye" no se puede cumplir;
// va como tip de `apariencia`) y la Zona peligrosa de Configuración (borrar
// el negocio no es un paso de onboarding).

const GRUPO_DIA = 'Tu día a día'
const GRUPO_TIENDA = 'La cara de tu tienda'
const GRUPO_NEGOCIO = 'Tu negocio'

export const TAREAS_CHECKLIST_ETAPA2: TareaChecklist[] = [
    {
        id: 'pedidos', grupo: GRUPO_DIA, titulo: 'Cargá tu primer pedido',
        detalle: 'Las ventas de la tienda entran solas a Pedidos. Las de mostrador o WhatsApp las cargás vos con "Nuevo pedido": elegís productos, cómo se cobró, y queda contada en tus números.',
        destino: ['ventas', 'pedidos', { vista: 'nuevo' }], destinoLabel: 'Nuevo pedido',
        seccionDestino: 'pedidos',
        // Dos pasos: primero un producto (sin eso el botón de cerrar la venta
        // está deshabilitado), recién después el botón que la registra.
        pasos: [
            {
                ancla: 'input[placeholder="Buscar producto…"] || boton:Nuevo pedido',
                label: 'Buscá y agregá un producto',
                avanzarAlEscribir: true,
            },
            { ancla: 'boton:Registrar venta|Crear pedido', label: 'Y cerrás la venta acá' },
        ],
    },
    {
        id: 'estados', grupo: GRUPO_DIA, titulo: 'Llevá un pedido hasta "Entregado"',
        detalle: 'Cada pedido avanza por las pestañas de arriba: Pendientes, Confirmados, En prep., Enviados, Entregados. Abrí uno y movelo a medida que pasa de verdad — así tus números y lo que ve el cliente van al día.',
        tip: 'Se puede en lote: tildás varios de la lista y los confirmás de una.',
        destino: ['ventas', 'pedidos'], destinoLabel: 'Ir a Pedidos',
        seccionDestino: 'pedidos', anclaDestino: '.ped-tabs-row',
        guiaLabel: 'Tus pedidos avanzan por estas pestañas',
    },
    {
        id: 'clientes', grupo: GRUPO_DIA, titulo: 'Conocé tu base de clientes',
        detalle: 'Se arma sola con cada venta: cuántos pedidos hizo cada uno, cuánto gastó y cuándo volvió. Buscá por nombre o email, y con "Email masivo" les escribís a todos los de la lista filtrada.',
        destino: ['ventas', 'clientes'], destinoLabel: 'Ir a Clientes',
        seccionDestino: 'clientes', anclaDestino: 'input[placeholder="Buscar por nombre o email…"] || boton:Email masivo',
        guiaLabel: 'Buscá acá; "Email masivo" les escribe a todos',
    },
    {
        id: 'plantillas', grupo: GRUPO_DIA, titulo: 'Armá tus plantillas de respuesta',
        detalle: 'Lo que te preguntan siempre ("¿hacen envíos?", "¿cuándo llega?") lo respondés con un toque. Se crean en Mensajes → Plantillas y se usan desde el chat de la bandeja.',
        destino: ['ventas', 'mensajes', { vista: 'plantillas' }], destinoLabel: 'Ir a Plantillas',
        seccionDestino: 'mensajes', anclaDestino: 'boton:Nueva plantilla || boton:Crear plantilla',
        guiaLabel: 'Creá la primera desde acá',
    },
    {
        id: 'herramientas', grupo: GRUPO_DIA, titulo: 'Usá la barra de arriba',
        detalle: 'Te sigue por todo el panel: el buscador encuentra un pedido, un cliente o un producto desde cualquier pantalla; la campana junta lo que pasó mientras no estabas; y en tu avatar están "Mi perfil", el modo oscuro y "Ir a la tienda".',
        tip: 'Orbi, el asistente, se abre con Ctrl+K desde donde estés: le preguntás por tu negocio y te ayuda a operar el panel.',
        destino: ['ventas', 'dashboard'], destinoLabel: 'Ir al Inicio',
        seccionDestino: 'dashboard', anclaDestino: 'header:buscador || header:usuario',
        guiaLabel: 'Buscá desde acá, estés donde estés',
    },
    {
        id: 'apariencia', grupo: GRUPO_TIENDA, titulo: 'Personalizá cómo se ve tu tienda',
        detalle: 'Logo, colores, tipografía, banner y los textos de la portada. Cambiá algo y tocá "Guardar cambios": la tienda se actualiza al instante.',
        tip: 'Con el paquete Avanzado tenés Plantillas de Home: veinte portadas distintas para tu tienda, en Avanzado → Plantillas de Home.',
        destino: ['ventas', 'configuracion', { vista: 'apariencia' }], destinoLabel: 'Ir a Apariencia',
        seccionDestino: 'configuracion', anclaDestino: '.cfg-sidebar-item[title="Apariencia"]',
        guiaLabel: 'Logo, colores y textos se cambian acá',
    },
    {
        id: 'contacto', grupo: GRUPO_TIENDA, titulo: 'Cargá tus datos de contacto',
        detalle: 'WhatsApp, email y tus horarios de atención. Es por donde te escriben los que están por comprar y todavía tienen una duda.',
        destino: ['ventas', 'configuracion', { vista: 'contacto' }], destinoLabel: 'Ir a Contacto',
        seccionDestino: 'configuracion', anclaDestino: '.cfg-sidebar-item[title="Contacto"]',
        guiaLabel: 'WhatsApp, email y horarios, acá',
    },
    {
        id: 'redes', grupo: GRUPO_TIENDA, titulo: 'Sumá tus redes sociales',
        detalle: 'Instagram, TikTok y Facebook. Se muestran en tu tienda: el que te compró una vez te sigue, y el que te sigue vuelve.',
        destino: ['ventas', 'configuracion', { vista: 'redes' }], destinoLabel: 'Ir a Redes sociales',
        seccionDestino: 'configuracion', anclaDestino: '.cfg-sidebar-item[title="Redes sociales"]',
        guiaLabel: 'Tus perfiles se cargan acá',
    },
    {
        id: 'descuentos', grupo: GRUPO_TIENDA, titulo: 'Creá tu primer descuento o cupón',
        detalle: 'Los descuentos se aplican solos cuando se cumple la condición; los cupones son códigos que el cliente escribe en el checkout. Los dos se comparten por link, y en "Rendimiento" ves cuál funcionó.',
        destino: ['ventas', 'descuentos'], destinoLabel: 'Ir a Descuentos',
        seccionDestino: 'descuentos', anclaDestino: 'boton:Crear descuento',
        guiaLabel: 'Tu primera promo sale de acá',
    },
    {
        id: 'dominio', grupo: GRUPO_TIENDA, titulo: 'Poné tu dirección propia',
        detalle: 'Tu tienda ya tiene su dirección de Órbita y funciona igual. Si querés la tuya (tunegocio.com), en Dominios la comprás desde el panel o conectás una que ya tengas.',
        destino: ['ventas', 'configuracion', { vista: 'dominios' }], destinoLabel: 'Ir a Dominios',
        seccionDestino: 'configuracion', anclaDestino: '.cfg-sidebar-item[title="Dominios"] || .cfg-sidebar',
        guiaLabel: 'Comprá o conectá tu dominio acá',
    },
    {
        id: 'equipo', grupo: GRUPO_NEGOCIO, titulo: 'Invitá a alguien de tu equipo',
        detalle: 'Cada persona entra con su usuario y ve solo lo que su rol permite. Le llega un mail con la invitación.',
        destino: ['ventas', 'configuracion', { vista: 'equipo' }], destinoLabel: 'Ir a Equipo',
        seccionDestino: 'configuracion', anclaDestino: 'boton:Invitar miembro || .cfg-sidebar-item[title="Equipo"]',
        guiaLabel: 'Invitá desde acá: elegís el rol y le llega un mail',
    },
    {
        id: 'notificaciones', grupo: GRUPO_NEGOCIO, titulo: 'Elegí qué avisos recibís',
        detalle: 'Pedido nuevo, pago confirmado, stock crítico, cancelaciones: cada uno por el panel, por mail, o los dos. Ajustá la grilla y guardá.',
        destino: ['ventas', 'configuracion', { vista: 'notificaciones' }], destinoLabel: 'Ir a Notificaciones',
        seccionDestino: 'configuracion', anclaDestino: '.cfg-sidebar-item[title="Notificaciones"]',
        guiaLabel: 'Cada aviso, por panel o por mail: se define acá',
    },
    {
        id: 'postventa', grupo: GRUPO_NEGOCIO, titulo: 'Definí cambios y devoluciones',
        detalle: 'Si aceptás devoluciones y cancelaciones, y con qué reembolso: nota de crédito, plata de vuelta por Mercado Pago, o los dos. Lo que elijas es lo que tu cliente puede pedir — aprobar cada caso sigue siendo tuyo.',
        destino: ['ventas', 'configuracion', { vista: 'postventa' }], destinoLabel: 'Ir a Cancelaciones',
        seccionDestino: 'configuracion', anclaDestino: '.cfg-sidebar-item[title="Cancelaciones y devoluciones"]',
        guiaLabel: 'Tus reglas de postventa, acá',
    },
    {
        id: 'reportes', grupo: GRUPO_NEGOCIO, titulo: 'Mirá tus reportes',
        detalle: 'Ventas, productos, clientes, inventario y pagos, por el período que elijas. Es donde ves qué se vende de verdad, qué no se mueve y cuánto te queda después de comisiones.',
        destino: ['ventas', 'reportes'], destinoLabel: 'Ir a Reportes',
        seccionDestino: 'reportes', anclaDestino: '.mod-tabs',
        guiaLabel: 'Cinco reportes, uno por pestaña',
    },
    {
        id: 'plan', grupo: GRUPO_NEGOCIO, titulo: 'Conocé tu plan',
        detalle: 'En Suscripción ves qué plan tenés, qué incluye, cuándo se renueva y cómo cambiarlo. Justo abajo, en Soporte, está cómo escribirnos si algo no cierra.',
        destino: ['ventas', 'configuracion', { vista: 'suscripcion' }], destinoLabel: 'Ir a Suscripción',
        seccionDestino: 'configuracion', anclaDestino: '.cfg-sidebar-item[title="Suscripción"]',
        guiaLabel: 'Tu plan y tu facturación, acá',
    },
]

/** Tareas de cada etapa de la Checklist. */
export const tareasDeEtapa = (etapa: 1 | 2): TareaChecklist[] =>
    etapa === 2 ? TAREAS_CHECKLIST_ETAPA2 : TAREAS_CHECKLIST

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
        { ancla: '.cfg-sidebar', titulo: 'El menú de Configuración', texto: 'Cada sección guarda por separado. La clave de la primera semana es Negocio (tus datos). En Pagos elegís cómo cobrás; conectar Mercado Pago es opcional, pero conviene si querés aceptar tarjeta.' },
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
        explicacion: 'Los datos que hacen funcionar la tienda. Lo imprescindible de la primera semana: completar "Negocio". En "Pagos" elegís cómo cobrás: efectivo, transferencia y, si conectás Mercado Pago (opcional, pero recomendado), también tarjeta. En "Equipo" invitás gente con permisos.',
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
    cierre: 'Ya conocés el mapa. El mejor primer paso real: Configuración → completar tus datos y elegir cómo cobrás. Después, tu primer producto.',
    // Checklist: acá las 6 tareas están hechas de verdad (o marcadas), no es
    // un "ya viste el mapa" — es "tu tienda quedó lista".
    cierreChecklistTitulo: 'Tu tienda está lista',
    cierreChecklist: 'Datos cargados, formas de cobro elegidas, categorías y productos creados, envíos definidos y tienda publicada. Ya podés vender.',
    // Del cierre de la primera etapa se sigue a la segunda (pedido de Ale:
    // "cuando termina el primero le sale el segundo").
    seguirEtapa2: 'Seguir con la segunda etapa',
    // Segunda etapa: nombre de la tarjeta, presentación y cierre propio.
    etapa1Nombre: 'Primeros pasos',
    etapa2Nombre: 'Segunda etapa',
    etapa2IntroTitulo: 'Segunda etapa',
    etapa2Intro: 'Lo básico ya está: tu tienda vende. Ahora, el resto del panel, en tres bloques: tu día a día, la cara de tu tienda y cómo manejás el negocio. De a una, cuando puedas.',
    etapa2Empezar: 'Empezar',
    etapa2AhoraNo: 'Ahora no',
    cierreEtapa2Titulo: 'Ya le sacás el jugo al panel',
    cierreEtapa2: 'Pedidos, clientes, plantillas, promos, equipo, apariencia, avisos, postventa, reportes y tu plan: ya no te queda rincón del panel sin conocer. De acá en más es todo tuyo.',
}
