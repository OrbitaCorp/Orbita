// GENERADO — no editar a mano.
//
// Sale del manual del panel (apps/web/src/modules/ventas/panel/manual/contenido.ts),
// de los primeros pasos (tutoriales/copy.ts) y de los permisos del menú
// (apps/web/src/layouts/components/permisosDelMenu.ts). Para regenerarlo:
//   cd apps/web && pnpm manual:generar
// apps/web/src/modules/ventas/panel/manual/paraOrbi.test.ts falla en CI si quedó viejo.

import type { ManualGenerado } from './manual.types';

export const MANUAL_GENERADO: ManualGenerado = {
  "version": "24f29ccc15471f90",
  "temas": [
    {
      "id": "panel-y-tienda",
      "capitulo": "Arranque",
      "titulo": "El panel y tu tienda son dos cosas distintas",
      "texto": "Órbita te da dos pantallas, y conviene tenerlas separadas en la cabeza desde el día uno.\n\n- El panel (acá): Tu trastienda. Entrás con tu usuario y contraseña, y es donde cargás productos, atendés pedidos, respondés mensajes y mirás tus números. No lo ve nadie más que vos y tu equipo.\n- La tienda: Lo que ve tu cliente: la portada, el catálogo, el carrito y el checkout. Vive en tu dirección web y es pública.\n\nTodo lo que tocás en el panel se refleja en la tienda al instante: no hay que publicar cambios uno por uno. Para verla como la ve un cliente, abrí tu avatar arriba a la derecha y tocá \"Ir a la tienda\".\n\nOjo: La única excepción es la primera vez: hasta que no toques \"Publicar tienda\" en el Inicio, tu tienda no está online y nadie te puede comprar."
    },
    {
      "id": "siete-pasos",
      "capitulo": "Arranque",
      "titulo": "Los siete pasos para salir a vender",
      "texto": "Este es el camino corto, en orden. Cada paso tiene su capítulo propio más abajo con el detalle completo.\n\n1. Confirmá tu email: Mi perfil → te mandamos un código de 6 números y lo pegás ahí. Es lo que nos deja devolverte la cuenta si alguna vez perdés el acceso. Tenés 7 días desde que creaste la tienda.\n2. Completá los datos del negocio: Configuración → Negocio: nombre, rubro y dirección. Es lo que ven tus clientes y lo que usa el envío para calcular distancias.\n3. Elegí cómo cobrás: Configuración → Pagos: efectivo, transferencia o Mercado Pago. Conectar Mercado Pago (\"Conectar cuenta\") es opcional, pero conviene si querés que paguen con tarjeta desde la tienda. Son dos minutos y lo podés hacer más adelante.\n4. Armá tus categorías: Productos → Categorías. Con 2 a 6 alcanza. Hacelo ANTES del primer producto, así cada uno nace en su lugar y no queda todo en \"Sin categoría\".\n5. Cargá tu primer producto: Productos → \"Crear producto\": fotos, precio, stock y categoría. Es el paso que hace que la tienda exista.\n6. Definí cómo entregás: Configuración → Envíos: envío a domicilio, retiro en el local, o los dos, con sus costos y zonas.\n7. Publicá la tienda: Inicio → botón \"Publicar tienda\", arriba a la derecha. Ahí recién estás online.\n\nConsejo: Si preferís que te lleven de la mano, el tutorial de Primeros pasos hace exactamente esta lista con el cursor guiándote pantalla por pantalla. Aparece solo la primera vez, y cuando lo terminás se abre una segunda tanda que recorre el resto del panel.",
      "destino": {
        "seccion": "dashboard",
        "label": "Ir al Inicio"
      }
    },
    {
      "id": "publicar",
      "capitulo": "Arranque",
      "titulo": "Publicar la tienda",
      "texto": "El botón vive arriba a la derecha del Inicio. Mientras diga \"Publicar tienda\", tu tienda está apagada: podés cargar todo tranquilo sin que nadie vea un catálogo a medio armar.\n\nCuando lo tocás, pasa a decir \"✓ Tienda online\" y tu dirección web empieza a responder. Podés seguir editando todo lo que quieras después: publicar no congela nada.\n\nDato: Tu tienda ya tiene su dirección de Órbita desde el primer día y funciona perfecto. Comprar un dominio propio (tunegocio.com) es opcional y se hace desde Configuración → Dominios.",
      "destino": {
        "seccion": "dashboard",
        "label": "Ir al Inicio"
      }
    },
    {
      "id": "menu-lateral",
      "capitulo": "Moverte por el panel",
      "titulo": "El menú de la izquierda",
      "texto": "Es la navegación principal. Cada módulo se despliega y muestra sus sub-secciones — Pedidos, por ejemplo, abre Lista, Historial, Cancelaciones y devoluciones, y Nuevo +.\n\n- Arriba de todo, el selector de espacio: tu negocio y su rubro.\n- Abajo, el buscador del menú: escribís y te muestra pedidos, clientes, productos y secciones que coinciden, sin salir de ahí.\n- El ícono de colapsar, arriba a la derecha del menú, lo achica a una franja de íconos para ganar pantalla.\n- Los puntitos y números al lado de un módulo son cosas que te esperan: mensajes sin leer, por ejemplo.\n\nConsejo: En el celular el menú está detrás del botón de las tres rayas, arriba a la izquierda."
    },
    {
      "id": "barra-superior",
      "capitulo": "Moverte por el panel",
      "titulo": "La barra de arriba",
      "texto": "Te sigue por todo el panel, estés en la pantalla que estés.\n\n- Búsqueda global: Encontrá un pedido por número, un cliente por nombre o email, un producto, o una sección del panel. Escribís y los resultados aparecen en vivo.\n- Campana: Junta lo que pasó mientras no estabas: pedidos nuevos, pagos acreditados, stock crítico, avisos del sistema. El número es lo que falta leer. Qué llega acá y qué llega por mail se elige en Configuración → Notificaciones.\n- Modo oscuro: Un toque y el panel entero cambia de claro a oscuro. Queda guardado en tu cuenta, así que te sigue a cualquier dispositivo.\n- Orbi: El asistente, al lado de la búsqueda: el botón con la mascota, que toma la forma de la pantalla en la que estás. También se abre con Ctrl+K (Cmd+K en Mac) desde cualquier lado: le preguntás por tus números, por un pedido, o cómo se hace algo, y contesta con datos de TU negocio.\n- Tu avatar: El círculo con tus iniciales, a la derecha de todo: tu nombre y tu rol, Mi perfil, \"Ir a la tienda\" para verla como cliente, y Cerrar sesión."
    },
    {
      "id": "permisos",
      "capitulo": "Moverte por el panel",
      "titulo": "Por qué tu equipo no ve lo mismo que vos",
      "texto": "El panel se adapta al rol de cada persona: nada visible que no se pueda usar. Si invitaste a alguien como Empleado, hay módulos enteros que directamente no le aparecen en el menú.\n\nAsí que si un compañero te dice \"a mí no me figura Descuentos\", no es un error: es su rol. Los roles se manejan en Configuración → Equipo.",
      "destino": {
        "seccion": "configuracion",
        "vista": "equipo",
        "label": "Ir a Equipo"
      }
    },
    {
      "id": "periodo",
      "capitulo": "Inicio",
      "titulo": "Elegir el período",
      "texto": "Arriba de todo hay una tira de botones: Hoy, Semana, Mes y Personalizado. Todo lo que ves abajo — los números, el gráfico, el top, las alertas — responde a ese período.\n\n\"Personalizado\" abre un calendario donde elegís un desde y un hasta a mano. Sirve para mirar una fecha puntual: un fin de semana largo, el día de una promo, el mes pasado completo.\n\nDato: Cada número se compara SIEMPRE contra el período anterior del mismo largo. Si estás mirando 7 días, la flechita verde o roja compara contra los 7 días previos.",
      "destino": {
        "seccion": "dashboard",
        "label": "Ir al Inicio"
      }
    },
    {
      "id": "kpis",
      "capitulo": "Inicio",
      "titulo": "Los cinco números grandes, uno por uno",
      "texto": "Son la fila de tarjetas de arriba. Cada una muestra el valor del período elegido y, abajo, cuánto subió o bajó respecto del anterior.\n\n- Ventas: La plata que entró, neta de devoluciones: a lo vendido se le restan las devoluciones ya aprobadas del período. Es lo que realmente quedó, no lo que se facturó bruto.\n- Pedidos: Cuántas compras entraron. Si hay pedidos esperando, abajo del número te avisa cuántos están pendientes.\n- Ticket promedio: Cuánto gasta en promedio cada compra (Ventas dividido Pedidos). Es el número que mirás cuando querés que cada cliente se lleve más: si sube, las promos por monto mínimo o los 2x1 están funcionando.\n- Clientes nuevos: Cuántas personas te compraron por primera vez en el período. Mide si estás llegando a gente nueva o vendiéndole siempre a los mismos.\n- Comisión MP: Cuánto se llevó Mercado Pago de tus cobros en el período. Acá el color está al revés a propósito: que SUBA es malo, así que sube en rojo. Mercado Pago no cobra un porcentaje fijo — varía según el medio de pago y las cuotas —, por eso este número se calcula sobre los cobros reales.",
      "destino": {
        "seccion": "dashboard",
        "label": "Ir al Inicio"
      }
    },
    {
      "id": "alertas",
      "capitulo": "Inicio",
      "titulo": "Alertas: lo que hay que resolver hoy",
      "texto": "Debajo de los números aparece una tira de alertas solo si hay algo que resolver. Si tu negocio está al día, no aparece nada: no es una sección vacía esperándote, es un aviso.\n\n- Pedidos que necesitan tu atención: Compras pendientes: hay que confirmar el pago y moverlas a preparación.\n- Pedidos sin atender +2hs: Entraron hace más de dos horas y siguen sin tocarse. Es la alerta más urgente de todas.\n- Productos con stock crítico: Llegaron al mínimo que definiste en el producto. Te lleva a Productos para reponer.\n- Pagos por confirmar: Transferencias o pagos coordinados que todavía no validaste.\n\nCada alerta tiene su botón \"Ir →\" que te deja parado en la pantalla donde se resuelve. Y si ya las viste todas, \"Limpiar todas\" las saca de la vista hasta que vuelva a pasar algo.",
      "destino": {
        "seccion": "pedidos",
        "label": "Ir a Pedidos"
      }
    },
    {
      "id": "grafico-semana",
      "capitulo": "Inicio",
      "titulo": "Ventas de la semana",
      "texto": "El gráfico de línea del medio: cuánto vendiste cada día. Sirve para ver tu ritmo real — qué días tirás y qué días se te muere el negocio — y para decidir cuándo conviene lanzar una promo.\n\nEl ícono de expandir, arriba a la derecha de la tarjeta, lo abre grande en una ventana aparte.",
      "destino": {
        "seccion": "dashboard",
        "label": "Ir al Inicio"
      }
    },
    {
      "id": "top",
      "capitulo": "Inicio",
      "titulo": "Top: productos, categorías y canal",
      "texto": "Al lado del gráfico hay una tarjeta con tres pestañas.\n\n- Productos: Lo más vendido del período, con su barra de participación. Lo que aparece acá es lo que conviene tener siempre con stock y destacado en la portada.\n- Categorías: Lo mismo pero agrupado por categoría: te dice qué rubro tuyo tracciona de verdad.\n- Canal: Una torta que separa las ventas que entraron solas por la tienda online de las que cargaste vos a mano (mostrador, WhatsApp). Es la forma de medir cuánto te está aportando la tienda además de lo de siempre.\n\nDato: Si el período elegido no tuvo ventas, cada pestaña te lo dice en vez de mostrar un gráfico vacío.",
      "destino": {
        "seccion": "dashboard",
        "label": "Ir al Inicio"
      }
    },
    {
      "id": "actividad",
      "capitulo": "Inicio",
      "titulo": "Actividad reciente",
      "texto": "La lista de abajo: los últimos pedidos, con número, cliente, qué compró, monto y estado. Clickeás cualquier fila y caés directo en el detalle de ese pedido.\n\n\"Ver todos →\" te lleva a la lista completa de Pedidos.",
      "destino": {
        "seccion": "pedidos",
        "label": "Ir a Pedidos"
      }
    },
    {
      "id": "estados",
      "capitulo": "Pedidos",
      "titulo": "Los estados y sus pestañas",
      "texto": "Arriba de la lista hay siete pestañas con el contador real de cada una. Un pedido va avanzando de una a la otra a medida que pasa de verdad, y eso es lo que ve tu cliente en su cuenta.\n\n- Pendientes: Entró la compra pero todavía no confirmaste el pago. Acá es donde empieza tu trabajo.\n- Confirmados: El pago está y el pedido es tuyo para preparar.\n- En prep.: Lo estás armando.\n- Enviados: Salió para el cliente o está listo para que lo retire.\n- Entregados: Llegó. El ciclo se cerró. Las ventas de mostrador ya cobradas entran directo acá.\n- Cancelados: No se concretó. Quedan registrados, no desaparecen.\n\nConsejo: En el celular las pestañas se convierten en una tira de chips que se desliza con el dedo.",
      "destino": {
        "seccion": "pedidos",
        "label": "Ir a Pedidos"
      }
    },
    {
      "id": "detalle-pedido",
      "capitulo": "Pedidos",
      "titulo": "Abrir un pedido",
      "texto": "Clickeás la fila y se abre el detalle: los productos con sus cantidades, el total, los datos del cliente, cómo pagó y cómo lo recibe.\n\nDesde ahí lo movés al estado que corresponde. Cada cambio queda registrado y, según lo que hayas configurado en Notificaciones, dispara el aviso al cliente.\n\nDato: Si el pago fue con Mercado Pago, en el detalle ves la comisión que se llevó esa venta puntual. Ese mismo número, sumado por período, es el KPI \"Comisión MP\" del Inicio.",
      "destino": {
        "seccion": "pedidos",
        "label": "Ir a Pedidos"
      }
    },
    {
      "id": "nuevo-pedido",
      "capitulo": "Pedidos",
      "titulo": "Cargar una venta a mano",
      "texto": "El botón \"Nuevo pedido\" sirve para todo lo que vendés por fuera de la tienda: mostrador, WhatsApp, Instagram, un pedido por teléfono.\n\n1. Buscá los productos: Escribís en el buscador, elegís y ponés cantidades. Usa tu catálogo real, así que descuenta stock igual que una venta online.\n2. Cargá el cliente: Si ya existe, lo encontrás; si no, lo creás ahí mismo y queda para siempre en tu base.\n3. Elegí cómo se cobró y cerrá la venta: Y el pedido entra a tus números como cualquier otro.\n\nConsejo: Cargar las ventas de mostrador acá es lo que hace que el Inicio te muestre tu negocio COMPLETO y no solo la parte online. También es lo que alimenta la pestaña \"Canal\" del top.",
      "destino": {
        "seccion": "pedidos",
        "vista": "nuevo",
        "label": "Crear un pedido"
      }
    },
    {
      "id": "lote-exportar",
      "capitulo": "Pedidos",
      "titulo": "Trabajar en lote y exportar",
      "texto": "- Tildá varios pedidos de la lista y confirmalos de una: si te entraron diez transferencias juntas, no hay que abrir diez pantallas.\n- El filtro por fecha y la búsqueda achican la lista antes de operar.\n- Exportar a CSV baja lo que estás viendo, con los filtros aplicados. Se abre en Excel o Google Sheets: sirve para la contadora, para cruzar con tu caja, o para guardarte un cierre de mes.",
      "destino": {
        "seccion": "pedidos",
        "label": "Ir a Pedidos"
      }
    },
    {
      "id": "historial",
      "capitulo": "Pedidos",
      "titulo": "Historial",
      "pista": "los pedidos viejos: ya cerrados, entregados o cancelados",
      "texto": "La lista viva muestra lo que está en juego. El Historial es el archivo completo: todo lo que pasó, con su fecha y su estado final, para consultar hacia atrás sin que te estorbe en el día a día.",
      "destino": {
        "seccion": "pedidos",
        "vista": "historial",
        "label": "Ver el historial"
      }
    },
    {
      "id": "postventa",
      "capitulo": "Pedidos",
      "titulo": "Cancelaciones, devoluciones y notas de crédito",
      "texto": "Viven en la sub-sección Cancelaciones y devoluciones de este mismo módulo, cada una con sus pestañas por estado.\n\n- Cancelaciones: Cuando un cliente pide cancelar un pedido que ya estaba confirmado. Vos aprobás o rechazás.\n- Devoluciones: Cuando ya recibió el producto y quiere devolverlo. Mismo circuito: entra el pedido, lo revisás, lo resolvés.\n- Notas de crédito: Si en vez de devolver la plata preferís dejarle saldo a favor para su próxima compra, se emite una nota de crédito y el cliente la usa en el checkout.\n\nOjo: Qué puede pedir tu cliente y con qué tipo de reembolso lo definís vos en Configuración → Cancelaciones y devoluciones. Aprobar cada caso puntual sigue siendo decisión tuya, siempre.\n\nLas devoluciones aprobadas se le restan al KPI Ventas del Inicio: por eso ese número dice \"neto de devoluciones\".",
      "destino": {
        "seccion": "pedidos",
        "vista": "devoluciones",
        "label": "Ver devoluciones"
      }
    },
    {
      "id": "lista-clientes",
      "capitulo": "Clientes",
      "titulo": "La lista y lo que dice de cada uno",
      "texto": "Acá no hay que cargar nada: la base se llena sola con cada venta, sea de la tienda o cargada a mano. Por cada persona vas a ver:\n\n- Pedidos: Cuántas veces te compró. Distingue de un vistazo al que vino una vez del que ya es cliente.\n- Total gastado: Cuánta plata dejó en tu negocio desde el día uno.\n- Ticket promedio: Cuánto gasta por compra. El que compra seguido pero poco necesita otra promo que el que compra una vez y fuerte.\n- Última compra: Cuándo fue la última vez. Es tu lista de \"a quién hay que despertar\".\n\nLa flechita de cada fila despliega sus últimos pedidos sin salir de la lista, y desde ahí entrás a \"Ver perfil completo →\".",
      "destino": {
        "seccion": "clientes",
        "label": "Ir a Clientes"
      }
    },
    {
      "id": "escribirles",
      "capitulo": "Clientes",
      "titulo": "Escribirles por email",
      "texto": "- El sobre de cada fila: Le escribe a esa persona sola.\n- Email masivo: Le escribe a toda la lista que estés viendo, con los filtros aplicados. Ahí está la gracia: filtrás primero (por ejemplo, los que no compran hace tiempo) y después escribís, en vez de mandarle lo mismo a todos.\n\nConsejo: Combinalo con un cupón: creás el cupón, filtrás la lista, y les mandás el código en el mismo mail. Eso se mide después en Descuentos → Rendimiento.",
      "destino": {
        "seccion": "clientes",
        "label": "Ir a Clientes"
      }
    },
    {
      "id": "exportar-clientes",
      "capitulo": "Clientes",
      "titulo": "Exportar la base",
      "texto": "\"Exportar\" baja toda tu base en CSV, con los datos de contacto. Es tuya: la abrís en Excel, la subís a una herramienta de mailing, la guardás de respaldo.\n\nOjo: Son datos personales de gente real. Tratá el archivo con el mismo cuidado que tratarías una agenda de clientes en papel.",
      "destino": {
        "seccion": "clientes",
        "label": "Ir a Clientes"
      }
    },
    {
      "id": "numeros-catalogo",
      "capitulo": "Productos",
      "titulo": "Los cinco números de arriba",
      "texto": "- Total: Cuántos productos tenés cargados, publicados o no.\n- Publicados: Los que tu cliente ve en la tienda ahora mismo.\n- Sin stock: Se quedaron en cero. Es tu lista de reposición.\n- No publicados: Todo lo que NO está publicado: los borradores de verdad más los que se quedaron sin stock.\n- Valor de inventario: Cuánta plata tenés invertida en la mercadería que hay en stock: el costo de cada producto por sus unidades disponibles. Solo suma los productos que tienen el costo cargado.",
      "destino": {
        "seccion": "catalogo",
        "label": "Ir a Productos"
      }
    },
    {
      "id": "crear-producto",
      "capitulo": "Productos",
      "titulo": "Crear un producto",
      "texto": "El botón \"Crear producto\" abre el alta. Lo importante, en orden:\n\n1. Nombre: Cómo lo busca tu cliente, no cómo lo llamás vos internamente.\n2. Fotos: Lo que más vende. La primera es la que se ve en el catálogo; el resto, al abrir el producto.\n3. Precio: El que ve el cliente.\n4. Stock: Cuántas unidades tenés. Se descuenta solo con cada venta, incluidas las que cargás a mano.\n5. Categoría: Dónde vive dentro de tu catálogo.\n6. Publicado o borrador: Borrador lo deja invisible hasta que esté listo.\n\nConsejo: Escribí el nombre y tocá \"Redactar con Orbi\": te escribe la descripción y te sugiere categoría y etiquetas al toque. Después la editás si querés — es un punto de partida, no una imposición.",
      "destino": {
        "seccion": "catalogo",
        "vista": "nuevo",
        "label": "Crear un producto"
      }
    },
    {
      "id": "ficha-tecnica",
      "capitulo": "Productos",
      "titulo": "Ficha técnica: las características del producto",
      "texto": "Al cargar o editar un producto hay un interruptor \"Especificaciones técnicas\", apagado por defecto. Sirve para lo que se compra mirando datos — tecnología, electrodomésticos, herramientas — y necesita ver \"RAM: 8GB\", \"Pantalla: 6.5\"\" antes de decidir.\n\nCada fila es un par etiqueta / valor (por ejemplo \"Procesador\" → \"Snapdragon 665\"). Se van agregando con \"Agregar especificación\", en el orden en que querés que aparezcan.\n\nEn la tienda se ven en una sección propia, \"Características\", debajo de los botones de compra y a todo el ancho: completas y en dos columnas, sin importar cuántas cargues.\n\nConsejo: Si no cargás ninguna, la sección de Características directamente no aparece en la tienda: no hay nada genérico que rellenar de más.",
      "destino": {
        "seccion": "catalogo",
        "label": "Ir a Productos"
      }
    },
    {
      "id": "variantes",
      "capitulo": "Productos",
      "titulo": "Variantes y stock",
      "texto": "Si el mismo producto viene en talles o colores, se cargan como variantes: es un solo producto en la tienda, con sus opciones adentro, y cada variante lleva su propio stock.\n\nTambién podés definir un stock mínimo: cuando un producto baja de ahí, dispara la alerta de \"stock crítico\" en el Inicio y, si lo activaste, el aviso por la campana o por mail.",
      "destino": {
        "seccion": "catalogo",
        "label": "Ir a Productos"
      }
    },
    {
      "id": "stock-rapido",
      "capitulo": "Productos",
      "titulo": "Editar el stock rápido, sin abrir el producto",
      "texto": "En la lista de Productos (grilla, tabla o las cards del celular), el número de stock tiene un subrayado punteado: es clickeable. Tocalo y se abre una ventana chica para actualizarlo ahí mismo, sin entrar al editor completo.\n\nSi el producto tiene variantes, la ventana lista cada una con su propio campo — no hay un stock único para pisar, cada combinación mantiene el suyo.\n\nDato: El cambio queda guardado igual que si lo hubieras editado desde el producto completo: afecta al mismo stock que ven el Inicio, los Reportes y la tienda.",
      "destino": {
        "seccion": "catalogo",
        "label": "Ir a Productos"
      }
    },
    {
      "id": "estados-producto",
      "capitulo": "Productos",
      "titulo": "En qué estado está cada producto",
      "texto": "- Publicado: Visible y comprable en tu tienda.\n- Borrador: Cargado pero invisible. Para lo que estás preparando.\n- Sin stock: Se quedó en cero. Pesa más que \"publicado\": aunque esté publicado, si no hay stock el cliente no lo puede comprar.\n\nLos filtros de arriba de la lista te dejan ver solo uno de estos grupos, buscar por nombre y ordenar la lista.",
      "destino": {
        "seccion": "catalogo",
        "label": "Ir a Productos"
      }
    },
    {
      "id": "categorias",
      "capitulo": "Productos",
      "titulo": "Categorías",
      "texto": "Es el árbol con el que tu cliente navega la tienda. Se arman con \"Nueva categoría\", admiten subcategorías, y cada una lleva su ícono y su color.\n\nConsejo: Menos es más: 2 a 6 categorías bien pensadas se navegan mejor que veinte. Siempre podés abrir subcategorías después, cuando el catálogo crezca.",
      "destino": {
        "seccion": "categorias",
        "label": "Ir a Categorías"
      }
    },
    {
      "id": "exportar-catalogo",
      "capitulo": "Productos",
      "titulo": "Exportar el catálogo",
      "texto": "\"Exportar Excel\" baja el catálogo completo en .xlsx: sirve para revisar precios en planilla, pasarle la lista a alguien, o tener un respaldo antes de un cambio grande.",
      "destino": {
        "seccion": "catalogo",
        "label": "Ir a Productos"
      }
    },
    {
      "id": "bandeja",
      "capitulo": "Mensajes",
      "titulo": "La bandeja",
      "texto": "Tus clientes te escriben desde la tienda y todo cae acá. A la izquierda la lista de conversaciones, con los no leídos marcados; a la derecha, el chat abierto.\n\nCuando hay algo sin leer, aparece un punto rojo en Mensajes en el menú de la izquierda: no hace falta entrar a chequear.",
      "destino": {
        "seccion": "mensajes",
        "label": "Ir a Mensajes"
      }
    },
    {
      "id": "chat",
      "capitulo": "Mensajes",
      "titulo": "Responder",
      "texto": "- Escribí # para mencionar un pedido dentro del mensaje: queda linkeado y los dos saben exactamente de cuál están hablando.\n- Desde el chat entrás al perfil del cliente o al pedido que están discutiendo, sin perder la conversación.\n- Cuando el tema se cerró, archivás la conversación y te queda la bandeja limpia. No se borra: se guarda.",
      "destino": {
        "seccion": "mensajes",
        "label": "Ir a Mensajes"
      }
    },
    {
      "id": "plantillas",
      "capitulo": "Mensajes",
      "titulo": "Plantillas de respuesta",
      "texto": "Lo que te preguntan siempre — \"¿hacen envíos?\", \"¿cuándo llega?\", \"¿tenés talle M?\" — lo dejás escrito una vez y lo mandás con un toque desde el chat.\n\nConsejo: Es la mejora más grande por menos trabajo de todo el módulo. Con cinco plantillas te sacás de encima la mitad de los mensajes del día.",
      "destino": {
        "seccion": "mensajes",
        "vista": "plantillas",
        "label": "Ir a Plantillas"
      }
    },
    {
      "id": "diferencia",
      "capitulo": "Descuentos y cupones",
      "titulo": "Descuento o cupón: cuál va",
      "texto": "- Descuento: Se aplica solo, sin que el cliente haga nada, cuando se cumple la condición que pusiste. Es la promo de vidriera: \"20% en camperas\", \"2x1 en remeras\".\n- Cupón: Es un código que el cliente escribe en el checkout. Sirve para lo dirigido: un descuento para tus seguidores de Instagram, uno para que vuelva un cliente dormido, uno para compensar un problema con un pedido.\n\nDato: Los dos viven en este módulo, en pestañas distintas, y los dos se comparten por link y se miden en Rendimiento.",
      "destino": {
        "seccion": "descuentos",
        "label": "Ir a Descuentos"
      }
    },
    {
      "id": "tipos-descuento",
      "capitulo": "Descuentos y cupones",
      "titulo": "Los tipos de descuento",
      "texto": "- Porcentaje sobre producto: Un % en los productos o categorías que elijas. La promo clásica.\n- Monto fijo sobre producto: \"$2.000 menos\" en productos elegidos. Se entiende más rápido que un porcentaje cuando el número es grande.\n- Porcentaje sobre el ticket: Un % sobre el total de la compra. Con un monto mínimo, es la forma directa de subir el ticket promedio.\n- Monto fijo sobre el ticket: Una rebaja fija sobre el total.\n- Llevá X, pagá Y: El 2x1 y el 3x2 de toda la vida: se arma solo en el carrito, sin código.\n- Comprá X, obtenés Z: Compra un producto y se lleva otro gratis, con % o con monto fijo. Sirve para mover algo que no rota o para hacer probar un producto nuevo.\n- Por volumen: Escalas: de 3 a 5 unidades tanto, de 6 en adelante más. Para mayoristas o productos de consumo.\n- Oferta relámpago: Un % que termina a una hora exacta y se muestra en tu portada con un reloj en cuenta regresiva. Requiere el paquete Avanzado.",
      "destino": {
        "seccion": "descuentos",
        "label": "Ir a Descuentos"
      }
    },
    {
      "id": "alcance-condiciones",
      "capitulo": "Descuentos y cupones",
      "titulo": "Alcance, condiciones y vigencia",
      "texto": "Cualquiera sea el tipo, un descuento se define con tres cosas más:\n\n- Alcance: A qué le pega: a productos puntuales, a una categoría entera, o al ticket completo.\n- Condición: Qué tiene que pasar para que se active: una cantidad mínima de unidades o un monto mínimo de compra.\n- Vigencia: Desde cuándo y hasta cuándo. Podés dejarlo sin vencimiento, o afinarlo a días de la semana y franja horaria — por ejemplo, un descuento que corre solo los martes de 14 a 18.\n\nTambién podés ponerle un límite de usos total, y una prioridad para cuando dos promos podrían pisarse: la de prioridad más alta es la que gana.",
      "destino": {
        "seccion": "descuentos",
        "label": "Ir a Descuentos"
      }
    },
    {
      "id": "cupones",
      "capitulo": "Descuentos y cupones",
      "titulo": "Cupones: el código y sus límites",
      "texto": "Un cupón es un código más un descuento (porcentaje o monto fijo, sobre producto o sobre el ticket). Lo que lo hace distinto son sus controles:\n\n- Código: Lo que escribe el cliente. Corto y fácil de dictar funciona mejor que uno largo.\n- Usos máximos totales: Cuántas veces se puede canjear en total. Vacío es ilimitado.\n- Usos por cliente: Para que una misma persona no lo use diez veces.\n- Monto mínimo: Recién se puede usar a partir de cierta compra.\n- Privado: No aparece listado en la tienda: solo lo canjea quien conoce el código. Es la opción para un cupón que le mandás a una persona o a un grupo puntual.\n- Vigencia: Desde cuándo y hasta cuándo, o sin vencimiento.\n\nEn el listado, cada cupón muestra su estado:\n\n- Activo: Se puede canjear ahora.\n- Programado: Ya está creado pero todavía no arrancó su fecha de inicio.\n- Inactivo: Lo apagaste vos. Se vuelve a prender cuando quieras.\n- Expirado: Se le pasó la fecha.\n- Agotado: Llegó a su límite de usos.\n\nDesde el menú de tres puntitos de cada fila: activar, desactivar, duplicar (para armar uno nuevo parecido sin empezar de cero), editar, eliminar y Compartir.",
      "destino": {
        "seccion": "cupones",
        "label": "Ir a Cupones"
      }
    },
    {
      "id": "compartir",
      "capitulo": "Descuentos y cupones",
      "titulo": "Compartir un cupón: link y envío por email",
      "texto": "Esta es la parte que más se aprovecha poco. En el menú de tres puntitos de cualquier cupón, \"Compartir\" abre una ventana con dos formas de hacerlo llegar.\n\n1 · El link:\n- URL del link: Una dirección propia del cupón. El que la abre entra a tu tienda con el descuento ya aplicado: no tiene que acordarse del código ni tipearlo. El botón \"Copiar\" te la deja en el portapapeles para pegarla en Instagram, en un story, en WhatsApp o donde quieras.\n- Activo / Inactivo: El link tiene su propio interruptor, aparte del cupón. Si está inactivo, tocá \"Activar link\" y queda funcionando. Apagarlo después corta el link sin tener que dar de baja el cupón.\n\n2 · Enviar por email:\n- Email del destinatario: Ponés la dirección — una casilla de Gmail, de Outlook, la que sea, no hace falta que la persona sea cliente registrado tuyo — y Órbita le manda el mail.\n- Nombre (opcional): Si lo cargás, el mail lo saluda por su nombre.\n- Enviar: Listo. El mail sale con el valor del cupón, el saludo y un botón que lleva directo a tu tienda con el descuento puesto.\n\nDato: El mail lo arma y lo manda Órbita: no se abre tu Gmail ni hace falta que configures nada. Vos solo escribís la dirección.\n\nConsejo: Para mandarle el mismo cupón a MUCHA gente de una, no uses esta ventana una por una: creá el cupón, andá a Clientes, filtrá la lista que querés y usá \"Email masivo\" con el código adentro.\n\nLos descuentos también se comparten por link, con la misma ventana, salvo los que aplican sobre el ticket completo: esos no tienen una página propia a la que llevar.",
      "destino": {
        "seccion": "cupones",
        "label": "Ir a Cupones"
      }
    },
    {
      "id": "rendimiento",
      "capitulo": "Descuentos y cupones",
      "titulo": "Rendimiento: qué promo funcionó",
      "texto": "La pestaña Rendimiento contesta la única pregunta que importa después de lanzar algo: ¿sirvió? Cuántas veces se usó cada promo, cuánta plata movió y cuánto descuento regalaste.\n\nConsejo: Miralo junto al Ticket promedio del Inicio. Una promo que se usa mucho pero te baja el ticket promedio te está haciendo trabajar más para ganar lo mismo.",
      "destino": {
        "seccion": "descuentos",
        "vista": "metricas",
        "label": "Ver Rendimiento"
      }
    },
    {
      "id": "las-cinco-pestanas",
      "capitulo": "Reportes",
      "titulo": "Las cinco pestañas",
      "texto": "El Inicio te dice cómo venís hoy. Los Reportes te dicen cómo viene el negocio. Cada pestaña se filtra por el período que elijas.\n\n- Ventas: Tu facturación en el tiempo, con su evolución. Es el reporte del cierre de mes.\n- Productos: Qué se vende de verdad y qué está ahí sin moverse. Lo que no aparece nunca es plata parada.\n- Clientes: Quiénes compran, cuánto y cada cuánto. Separa al que vuelve del que compró una sola vez.\n- Inventario: Cómo está parado tu stock: qué se está por acabar y cuánta plata tenés en mercadería.\n- Pagos: Por dónde te pagan y cuánto te queda después de comisiones. Es el reporte que más sorprende la primera vez que se mira.\n\nConsejo: Los reportes de Productos y de Clientes también se abren directo desde el menú de la izquierda, adentro de Productos y de Clientes.",
      "destino": {
        "seccion": "reportes",
        "label": "Ir a Reportes"
      }
    },
    {
      "id": "como-se-navega",
      "capitulo": "Configuración",
      "titulo": "Cómo se navega",
      "texto": "Las pantallas de Configuración están en el menú de la izquierda, debajo de Configuración: al entrar se despliegan Suscripción, Negocio, Contacto, Pagos, Envíos y el resto. Cada una es una pantalla distinta, y cada una se guarda por separado con su botón \"Guardar cambios\". Apariencia, que es la más larga, trae además un índice propio al costado para saltar de una sección a otra.",
      "destino": {
        "seccion": "configuracion",
        "label": "Ir a Configuración"
      }
    },
    {
      "id": "cfg-negocio",
      "capitulo": "Configuración",
      "titulo": "Negocio",
      "texto": "Nombre, rubro y dirección del local, con mapa para marcar el punto exacto. Es lo que ven tus clientes y lo que usa el sistema de envíos para calcular distancias.",
      "destino": {
        "seccion": "configuracion",
        "vista": "negocio",
        "label": "Abrir Negocio"
      }
    },
    {
      "id": "cfg-contacto",
      "capitulo": "Configuración",
      "titulo": "Contacto",
      "texto": "WhatsApp, email y horarios de atención. Es por donde te escribe el que está por comprar y todavía tiene una duda — el canal que más ventas salva.",
      "destino": {
        "seccion": "configuracion",
        "vista": "contacto",
        "label": "Abrir Contacto"
      }
    },
    {
      "id": "cfg-pagos",
      "capitulo": "Configuración",
      "titulo": "Pagos",
      "texto": "Qué medios de pago acepta tu tienda.\n\n- Mercado Pago: Pagos online con tarjeta, débito y cuotas. Se conecta con \"Conectar cuenta\": te lleva a Mercado Pago, autorizás, y volvés. Es opcional: sin Mercado Pago igual podés cobrar por transferencia o en efectivo; lo que no vas a tener es el pago con tarjeta desde la tienda.\n- Coordinar por WhatsApp: El cliente cierra la compra y vos arreglás el pago por WhatsApp. No se le muestra ningún CBU ni alias en la tienda.\n- Retiro en local: Si lo activás, el cliente puede retirar. Ahí se habilitan los medios de pago que aceptás en el mostrador: efectivo, débito, crédito o Mercado Pago.\n- Descuento por pagar con Mercado Pago: Un % opcional para empujar el pago online.\n\nDato: Mercado Pago te cobra una comisión por cada cobro, y no es un % fijo: cambia según el medio de pago y las cuotas. La ves en el detalle de cada pedido y sumada por período en el Inicio.\n\nOjo: Si activás \"Retiro en local\" pero no cargaste la dirección, la tienda le avisa al cliente que se la vas a pasar por WhatsApp. Conviene cargarla en Negocio.",
      "destino": {
        "seccion": "configuracion",
        "vista": "pagos",
        "label": "Abrir Pagos"
      }
    },
    {
      "id": "cfg-envios",
      "capitulo": "Configuración",
      "titulo": "Envíos",
      "texto": "Cómo entregás y cuánto cobrás. Elegís qué transportes ofrecés de verdad — Correo Argentino, OCA, Andreani, Vía Cargo, delivery local (moto o app), u otro a coordinar — y le ponés un costo a cada uno.\n\nTambién podés definir un umbral de envío gratis: a partir de cierto monto, no se cobra. Es de las formas más simples de subir el ticket promedio.",
      "destino": {
        "seccion": "configuracion",
        "vista": "envios",
        "label": "Abrir Envíos"
      }
    },
    {
      "id": "cfg-redes",
      "capitulo": "Configuración",
      "titulo": "Redes sociales",
      "texto": "Instagram, TikTok y Facebook. Se muestran en tu tienda: el que te compró una vez te sigue, y el que te sigue vuelve.",
      "destino": {
        "seccion": "configuracion",
        "vista": "redes",
        "label": "Abrir Redes sociales"
      }
    },
    {
      "id": "cfg-dominios",
      "capitulo": "Configuración",
      "titulo": "Dominios",
      "texto": "Tu tienda ya tiene su dirección de Órbita y funciona igual. Si querés la tuya propia (tunegocio.com), acá la comprás desde el panel o conectás una que ya tengas.",
      "destino": {
        "seccion": "configuracion",
        "vista": "dominios",
        "label": "Abrir Dominios"
      }
    },
    {
      "id": "cfg-postventa",
      "capitulo": "Configuración",
      "titulo": "Cancelaciones y devoluciones",
      "texto": "Acá definís las reglas: si aceptás devoluciones y cancelaciones, y con qué tipo de reembolso — nota de crédito, plata de vuelta por Mercado Pago, o los dos.\n\nLo que elijas es lo que tu cliente puede pedir desde la tienda. Aprobar cada caso puntual sigue siendo tuyo, y se hace en Pedidos.",
      "destino": {
        "seccion": "configuracion",
        "vista": "postventa",
        "label": "Abrir Cancelaciones y devoluciones"
      }
    },
    {
      "id": "cfg-apariencia",
      "capitulo": "Configuración",
      "titulo": "Apariencia",
      "texto": "Cómo se ve tu tienda. Es la pantalla más larga de Configuración, con su propio índice de secciones:\n\n- Identidad de marca: logo y favicon.\n- Paleta de colores y Tipografía: los colores y la letra de toda tu tienda, incluida la escala de texto.\n- Diseño y layout: cómo se acomoda el contenido.\n- Banner con efecto parallax y Video en tu tienda: las piezas grandes de la portada.\n- Marcas con las que trabajás: los logos de tus proveedores o marcas.\n- ¿Qué ven tus clientes?: qué secciones se muestran y cuáles no.\n- Textos de tu tienda: los títulos y frases de la portada.\n- Barra de estadísticas y Pie de página.\n\nDato: Si activaste una plantilla de Home (paquete Avanzado), la Apariencia clásica queda bloqueada: la portada la manda la plantilla. Se puede volver a la apariencia original desde la galería de plantillas.",
      "destino": {
        "seccion": "configuracion",
        "vista": "apariencia",
        "label": "Abrir Apariencia"
      }
    },
    {
      "id": "cfg-equipo",
      "capitulo": "Configuración",
      "titulo": "Equipo",
      "texto": "Invitás gente por email y cada uno entra con su propio usuario. Le llega un mail con la invitación.\n\n- Propietario: Acceso total al panel, incluida la configuración, el equipo y el plan.\n- Empleado: Acceso al trabajo del día a día, sin las secciones sensibles del negocio. Le aparecen menos módulos en el menú, y eso está bien.\n\nDato: Cada persona tiene su propia contraseña, y las credenciales son exclusivas de este negocio.",
      "destino": {
        "seccion": "configuracion",
        "vista": "equipo",
        "label": "Abrir Equipo"
      }
    },
    {
      "id": "cfg-notificaciones",
      "capitulo": "Configuración",
      "titulo": "Notificaciones",
      "texto": "Una grilla donde elegís, evento por evento, si querés el aviso en el panel (la campana), por email (a tu correo y al de tu equipo), los dos, o ninguno.\n\nVentas:\n- Nuevo pedido: Cada vez que entra un pedido nuevo.\n- Pago confirmado: Se acreditó un pago que estaba pendiente.\n- Pedido cancelado: Un pedido se canceló.\n- Cancelación pedida: Un cliente pidió cancelar un pedido ya confirmado.\n- Devolución: Un cliente inició una devolución.\n\nStock y clientes:\n- Stock crítico: Un producto llegó a su stock mínimo.\n- Cliente nuevo: Se registró un cliente nuevo.\n\nResúmenes:\n- Resumen diario: Cómo cerró el día, todas las noches.\n- Reporte semanal: Los números de la semana, los lunes.\n\nConsejo: Si recién arrancás, dejá \"Nuevo pedido\" por mail: es el aviso que no querés perderte. El resto lo vas afinando cuando el volumen crezca.",
      "destino": {
        "seccion": "configuracion",
        "vista": "notificaciones",
        "label": "Abrir Notificaciones"
      }
    },
    {
      "id": "cfg-actividad",
      "capitulo": "Configuración",
      "titulo": "Registro de actividad",
      "texto": "Quién hizo qué y cuándo. Si trabajás con equipo, es donde se contesta \"¿quién cambió este precio?\" sin tener que preguntarle a nadie.",
      "destino": {
        "seccion": "configuracion",
        "vista": "actividad",
        "label": "Abrir Registro de actividad"
      }
    },
    {
      "id": "cfg-suscripcion",
      "capitulo": "Configuración",
      "titulo": "Suscripción",
      "texto": "Qué plan tenés, qué incluye, cuándo se renueva y cómo cambiarlo. Acá también se activa el paquete Avanzado, que se paga aparte de la suscripción mensual.",
      "destino": {
        "seccion": "configuracion",
        "vista": "suscripcion",
        "label": "Abrir Suscripción"
      }
    },
    {
      "id": "cfg-soporte",
      "capitulo": "Configuración",
      "titulo": "Soporte",
      "texto": "Cómo escribirnos cuando algo no cierra. Lo puede usar cualquiera que tenga acceso al panel, no solo el propietario.",
      "destino": {
        "seccion": "configuracion",
        "vista": "soporte",
        "label": "Abrir Soporte"
      }
    },
    {
      "id": "cfg-peligro",
      "capitulo": "Configuración",
      "titulo": "Zona peligrosa",
      "texto": "Lo que cambia la tienda entera. Está separada del resto y con avisos claros justamente para que nadie la toque de pasada. La ve quien tiene el permiso Editar configuración, pero las tres acciones las hace solo el propietario.\n\n- Pausar tienda: nadie la ve ni te compra hasta que la reactivás. Tus datos, productos y pedidos quedan intactos, y vos seguís entrando al panel. Mientras está pausada, el mismo lugar dice Reactivar tienda.\n- Pasar a vidriera digital: la tienda queda como catálogo, sin carrito ni pago online; tus clientes te consultan por WhatsApp. Se vuelve con Pasar a tienda online completa. No se puede si tenés pedidos online sin resolver.\n- Eliminar espacio: la tienda se pausa al instante y tenés 60 días para arrepentirte con Reactivar espacio. Pasado ese plazo se borra todo y no hay vuelta atrás.\n\nOjo: Antes de tocar algo de acá, abrí el \"¿Qué pasa si…?\" de cada opción: te explica exactamente qué cambia y qué se pierde.",
      "destino": {
        "seccion": "configuracion",
        "vista": "peligro",
        "label": "Abrir Zona peligrosa"
      }
    },
    {
      "id": "que-es-avanzado",
      "capitulo": "Avanzado",
      "titulo": "Qué es el paquete Avanzado",
      "texto": "Es un paquete de herramientas que se paga aparte de tu suscripción mensual. Si todavía no lo tenés, vas a ver las tarjetas con un candado y un botón \"Ver qué incluye\" que te lleva a Suscripción.\n\nConfigurar estas funciones es decisión del propietario: a un Empleado no le aparece el módulo.",
      "destino": {
        "seccion": "avanzado",
        "label": "Ir a Avanzado"
      }
    },
    {
      "id": "funciones-avanzado",
      "capitulo": "Avanzado",
      "titulo": "Qué trae",
      "texto": "- Juegos con premio: Mini-juegos de habilidad (encestar, meter un gol). Vos definís cuánto descuento se gana por acierto y el tope. El descuento se crea solo, sin pasar por el módulo de Descuentos.\n- Modales de anuncios: Avisos grandes que aparecen en el momento justo en tu tienda: una bienvenida con descuento, un anuncio de temporada.\n- 2x1 y 3x2: La promo \"llevá X, pagá Y\" aplicada sola en el carrito, sin código, con un cartel en la tarjeta del producto.\n- Plantillas de Home: Diseños alternativos para la portada de tu tienda. El resto — catálogo, checkout, perfil — queda igual. Se prueban con \"Ver cómo queda\" antes de aplicar.\n- Prueba social: Notificaciones tipo \"Fulano compró tal producto\", armadas con pedidos reales de tu tienda. Nunca con datos inventados.\n- Oferta relámpago: Un descuento que dura poco y se muestra en tu tienda con un reloj en cuenta regresiva. Se arma desde Descuentos, como cualquier otro, y se prende o apaga desde acá.",
      "destino": {
        "seccion": "avanzado",
        "label": "Ir a Avanzado"
      }
    },
    {
      "id": "mi-perfil",
      "capitulo": "Tu cuenta",
      "titulo": "Mi perfil",
      "texto": "Se abre desde tu avatar, arriba a la derecha. Ahí están tus datos, el tema claro u oscuro y tu contraseña.\n\n- Confirmar tu email: Tocás \"Enviarme el código\", te llega uno de 6 números y lo pegás. Es lo que nos deja devolverte la cuenta si perdés el acceso. Tenés 7 días desde que creaste la tienda.\n- Cambiar la contraseña: Desde la misma pantalla, sin pasar por \"olvidé mi contraseña\".\n- Tema: Claro u oscuro. Queda guardado en tu cuenta, no en el navegador: te sigue a cualquier dispositivo.",
      "destino": {
        "seccion": "perfil",
        "label": "Ir a Mi perfil"
      }
    },
    {
      "id": "ver-tienda",
      "capitulo": "Tu cuenta",
      "titulo": "Ver tu tienda como cliente",
      "texto": "En el mismo menú del avatar, \"Ir a la tienda\" te abre el storefront tal cual lo ve un comprador. Es el chequeo que conviene hacer cada vez que tocás precios, fotos o apariencia.",
      "destino": {
        "seccion": "perfil",
        "label": "Ir a Mi perfil"
      }
    },
    {
      "id": "orbi",
      "capitulo": "Si te trabás",
      "titulo": "Preguntale a Orbi",
      "texto": "Se abre con Ctrl+K (Cmd+K en Mac) desde cualquier pantalla del panel, desde el botón Orbi de la barra de arriba (al lado de la búsqueda) o desde Orbi AI al pie del menú de la izquierda.\n\nNo es un buscador de ayuda genérica: contesta con los datos de tu negocio. \"¿Cuánto vendí esta semana?\", \"¿qué pedidos tengo pendientes?\", \"¿cómo creo un cupón?\" son todas preguntas válidas."
    },
    {
      "id": "tutorial",
      "capitulo": "Si te trabás",
      "titulo": "El tutorial guiado",
      "texto": "Los Primeros pasos son la versión activa de este manual: en vez de contarte dónde está algo, te lleva hasta ahí con el cursor y te espera a que lo hagas.\n\nTiene dos tandas: la primera son los siete pasos para salir a vender; la segunda recorre el resto del panel, agrupada en \"Tu día a día\", \"La cara de tu tienda\" y \"Tu negocio\". Se tildan solos a medida que vas cumpliendo.",
      "destino": {
        "seccion": "dashboard",
        "label": "Ir al Inicio"
      }
    },
    {
      "id": "escribinos",
      "capitulo": "Si te trabás",
      "titulo": "Escribinos",
      "texto": "Si algo no cierra, en Configuración → Soporte está el canal para contarnos qué pasó. Lo puede usar cualquiera de tu equipo con acceso al panel.",
      "destino": {
        "seccion": "configuracion",
        "vista": "soporte",
        "label": "Abrir Soporte"
      }
    }
  ],
  "primerosPasos": [
    {
      "id": "verificar-email",
      "titulo": "Confirmá tu email",
      "etapa": 1,
      "destino": {
        "seccion": "perfil",
        "label": "Ir a Mi perfil"
      }
    },
    {
      "id": "negocio",
      "titulo": "Completá los datos del negocio",
      "etapa": 1,
      "destino": {
        "seccion": "configuracion",
        "vista": "negocio",
        "label": "Ir a Configuración"
      }
    },
    {
      "id": "mp",
      "titulo": "Conectá Mercado Pago (opcional)",
      "etapa": 1,
      "destino": {
        "seccion": "configuracion",
        "vista": "pagos",
        "label": "Ir a Pagos"
      }
    },
    {
      "id": "categorias",
      "titulo": "Creá tus primeras categorías",
      "etapa": 1,
      "destino": {
        "seccion": "categorias",
        "label": "Ir a Categorías"
      }
    },
    {
      "id": "producto",
      "titulo": "Creá tu primer producto",
      "etapa": 1,
      "destino": {
        "seccion": "catalogo",
        "vista": "nuevo",
        "label": "Crear producto"
      }
    },
    {
      "id": "envios",
      "titulo": "Definí cómo entregás",
      "etapa": 1,
      "destino": {
        "seccion": "configuracion",
        "vista": "envios",
        "label": "Ir a Envíos"
      }
    },
    {
      "id": "publicar",
      "titulo": "Publicá la tienda",
      "etapa": 1,
      "destino": {
        "seccion": "dashboard",
        "label": "Ir al Inicio"
      }
    },
    {
      "id": "pedidos",
      "titulo": "Cargá tu primer pedido",
      "etapa": 2,
      "grupo": "Tu día a día",
      "destino": {
        "seccion": "pedidos",
        "vista": "nuevo",
        "label": "Nuevo pedido"
      }
    },
    {
      "id": "estados",
      "titulo": "Llevá un pedido hasta \"Entregado\"",
      "etapa": 2,
      "grupo": "Tu día a día",
      "destino": {
        "seccion": "pedidos",
        "label": "Ir a Pedidos"
      }
    },
    {
      "id": "clientes",
      "titulo": "Conocé tu base de clientes",
      "etapa": 2,
      "grupo": "Tu día a día",
      "destino": {
        "seccion": "clientes",
        "label": "Ir a Clientes"
      }
    },
    {
      "id": "plantillas",
      "titulo": "Armá tus plantillas de respuesta",
      "etapa": 2,
      "grupo": "Tu día a día",
      "destino": {
        "seccion": "mensajes",
        "vista": "plantillas",
        "label": "Ir a Plantillas"
      }
    },
    {
      "id": "herramientas",
      "titulo": "Usá la barra de arriba",
      "etapa": 2,
      "grupo": "Tu día a día",
      "destino": {
        "seccion": "dashboard",
        "label": "Ir al Inicio"
      }
    },
    {
      "id": "apariencia",
      "titulo": "Personalizá cómo se ve tu tienda",
      "etapa": 2,
      "grupo": "La cara de tu tienda",
      "destino": {
        "seccion": "configuracion",
        "vista": "apariencia",
        "label": "Ir a Apariencia"
      }
    },
    {
      "id": "contacto",
      "titulo": "Cargá tus datos de contacto",
      "etapa": 2,
      "grupo": "La cara de tu tienda",
      "destino": {
        "seccion": "configuracion",
        "vista": "contacto",
        "label": "Ir a Contacto"
      }
    },
    {
      "id": "redes",
      "titulo": "Sumá tus redes sociales",
      "etapa": 2,
      "grupo": "La cara de tu tienda",
      "destino": {
        "seccion": "configuracion",
        "vista": "redes",
        "label": "Ir a Redes sociales"
      }
    },
    {
      "id": "descuentos",
      "titulo": "Creá tu primer descuento o cupón",
      "etapa": 2,
      "grupo": "La cara de tu tienda",
      "destino": {
        "seccion": "descuentos",
        "label": "Ir a Descuentos"
      }
    },
    {
      "id": "dominio",
      "titulo": "Poné tu dirección propia",
      "etapa": 2,
      "grupo": "La cara de tu tienda",
      "destino": {
        "seccion": "configuracion",
        "vista": "dominios",
        "label": "Ir a Dominios"
      }
    },
    {
      "id": "equipo",
      "titulo": "Invitá a alguien de tu equipo",
      "etapa": 2,
      "grupo": "Tu negocio",
      "destino": {
        "seccion": "configuracion",
        "vista": "equipo",
        "label": "Ir a Equipo"
      }
    },
    {
      "id": "notificaciones",
      "titulo": "Elegí qué avisos recibís",
      "etapa": 2,
      "grupo": "Tu negocio",
      "destino": {
        "seccion": "configuracion",
        "vista": "notificaciones",
        "label": "Ir a Notificaciones"
      }
    },
    {
      "id": "postventa",
      "titulo": "Definí cambios y devoluciones",
      "etapa": 2,
      "grupo": "Tu negocio",
      "destino": {
        "seccion": "configuracion",
        "vista": "postventa",
        "label": "Ir a Cancelaciones"
      }
    },
    {
      "id": "reportes",
      "titulo": "Mirá tus reportes",
      "etapa": 2,
      "grupo": "Tu negocio",
      "destino": {
        "seccion": "reportes",
        "label": "Ir a Reportes"
      }
    },
    {
      "id": "plan",
      "titulo": "Conocé tu plan",
      "etapa": 2,
      "grupo": "Tu negocio",
      "destino": {
        "seccion": "configuracion",
        "vista": "suscripcion",
        "label": "Ir a Suscripción"
      }
    }
  ],
  "modulosDelMenu": [
    {
      "id": "dashboard",
      "label": "Inicio",
      "permisos": [
        "reports.dashboard"
      ]
    },
    {
      "id": "pedidos",
      "label": "Pedidos",
      "permisos": [
        "orders.view"
      ]
    },
    {
      "id": "clientes",
      "label": "Clientes",
      "permisos": [
        "customers.view"
      ]
    },
    {
      "id": "productos",
      "label": "Productos",
      "permisos": [
        "catalog.view",
        "inventory.view"
      ]
    },
    {
      "id": "mensajes",
      "label": "Mensajes",
      "permisos": [
        "messages.view"
      ]
    },
    {
      "id": "descuentos",
      "label": "Descuentos",
      "permisos": [
        "discounts.view",
        "discounts.manage"
      ]
    },
    {
      "id": "config",
      "label": "Configuración",
      "permisos": [
        "config.edit",
        "config.team.view",
        "config.team.manage",
        "config.audit.view",
        "config.domains.manage"
      ]
    },
    {
      "id": "avanzado",
      "label": "Avanzado",
      "permisos": [
        "advanced.manage"
      ]
    },
    {
      "id": "manual",
      "label": "Manual",
      "permisos": []
    }
  ]
};
