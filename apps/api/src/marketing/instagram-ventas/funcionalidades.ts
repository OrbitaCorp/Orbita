// Lo que un dueño puede hacer con Órbita, por área y con su plan. Sale del documento "Funcionalidades para el
// propietario" (noviembre 2026) y del manual del panel. El bot de ventas de Instagram responde con esto (además de
// las preguntas frecuentes de la web): si una pregunta no está acá, deriva al equipo.
//
// Los precios NO van acá: los da la API (SubscriptionsService.ofertaPublica) para que siempre sean los vigentes.
// Si se agrega una función o cambia de plan, actualizar esta lista.

export type Plan = 'Base' | 'Avanzado' | 'Base, en acceso anticipado';

export interface Area {
  area: string;
  nota?: string;
  items: { nombre: string; que: string; plan: Plan }[];
}

export const FUNCIONALIDADES: Area[] = [
  {
    area: 'Crear tu negocio y salir a vender',
    items: [
      { nombre: 'Alta guiada', que: 'registro en pocos pasos (qué vendés, datos del negocio, ubicación, tu cuenta y el pago del primer mes); Orbi ayuda a elegir nombre, dirección web y descripción', plan: 'Base' },
      { nombre: 'Tienda online o vidriera', que: 'tienda con carrito y cobro online, o vidriera (catálogo) donde te consultan por WhatsApp; se puede cambiar después', plan: 'Base' },
      { nombre: 'Dirección web incluida', que: 'tunegocio.orbita.site desde el primer día', plan: 'Base' },
      { nombre: 'Dominio propio', que: 'comprás un dominio desde el panel o conectás uno que ya tengas en cualquier proveedor; el candado de seguridad se emite solo', plan: 'Base' },
      { nombre: 'Primeros pasos guiados', que: 'te acompaña a crear tu primera categoría y tu primer producto', plan: 'Base' },
      { nombre: 'Publicar la tienda', que: 'la ponés online cuando decidís; mientras tanto cargás todo sin que nadie la vea', plan: 'Base' },
      { nombre: 'Sin comisión por venta', que: 'cobrás en tu propia cuenta, Órbita no se queda con ningún porcentaje', plan: 'Base' },
    ],
  },
  {
    area: 'Tu tienda online (lo que ven tus clientes)',
    items: [
      { nombre: 'Portada', que: 'carrusel, destacados, nuevos ingresos, categorías, banner, video, marcas y pie de página', plan: 'Base' },
      { nombre: 'Catálogo con filtros', que: 'categorías y subcategorías, buscador y filtros', plan: 'Base' },
      { nombre: 'Ficha de producto', que: 'fotos, precio, variantes (talle, color, medida), stock y características técnicas', plan: 'Base' },
      { nombre: 'Reseñas', que: 'quien compró deja su opinión en la ficha', plan: 'Base' },
      { nombre: 'Consulta por WhatsApp', que: 'botón para que el cliente te escriba, también flotante en toda la tienda', plan: 'Base' },
      { nombre: 'Carrito y checkout', que: 'envío o retiro, cupones, descuentos, notas de crédito y el medio de pago que elija', plan: 'Base' },
      { nombre: 'Cuenta del cliente', que: 'sus pedidos, direcciones guardadas y mensajes con tu negocio', plan: 'Base' },
      { nombre: 'Seguimiento del pedido', que: 'el estado de la compra y, si lo cargaste, transportista y código de envío', plan: 'Base' },
      { nombre: 'Comprobante', que: 'el cliente ve y descarga el comprobante de su compra', plan: 'Base' },
      { nombre: 'Cancelar o devolver desde la tienda', que: 'según las reglas que definís vos', plan: 'Base' },
      { nombre: 'Chat con la tienda', que: 'el cliente te escribe desde la tienda y ve tus respuestas en su perfil', plan: 'Base' },
      { nombre: 'Links con descuento', que: 'el link de un cupón abre la tienda con el descuento ya aplicado', plan: 'Base' },
      { nombre: 'Páginas legales', que: 'términos, privacidad y formulario de denuncia incluidos', plan: 'Base' },
      { nombre: 'Aparecer en Google', que: 'cada tienda se indexa sola (mapa del sitio, datos para buscadores y directorio de tiendas de Órbita), sin configurar nada', plan: 'Base' },
      { nombre: 'Adaptada al celular', que: 'tienda y panel funcionan en celular, tablet y computadora', plan: 'Base' },
    ],
  },
  {
    area: 'Productos, catálogo y stock',
    items: [
      { nombre: 'Alta de productos', que: 'nombre, fotos, precio, costo, stock, categoría, etiquetas, publicado o borrador, con vista previa', plan: 'Base' },
      { nombre: 'Variantes por rubro', que: 'talles, colores, números de calzado, medidas, tonos, presentaciones, cada una con su stock', plan: 'Base' },
      { nombre: 'Venta por unidad, número de serie o medida', que: 'control por número de serie o IMEI, o venta por metro, kilo y litro, según el rubro', plan: 'Base' },
      { nombre: 'Ficha técnica', que: 'pares como "RAM: 8 GB" que se muestran como Características', plan: 'Base' },
      { nombre: 'Productos por pedido', que: 'lo que se fabrica a pedido se muestra sin stock y el cliente consulta por WhatsApp', plan: 'Base' },
      { nombre: 'Redactar con Orbi', que: 'escribís el nombre y Orbi redacta la descripción y sugiere categoría, etiquetas y especificaciones', plan: 'Base' },
      { nombre: 'Importar desde Excel', que: 'plantilla, revisión con errores por fila y columna, e importación de cientos de productos con variantes y categorías', plan: 'Base' },
      { nombre: 'Fotos sugeridas al importar', que: 'cada producto importado aparece con una foto encontrada en la web; la aceptás, elegís otra o subís la tuya', plan: 'Base' },
      { nombre: 'Exportar a Excel', que: 'el catálogo completo en .xlsx', plan: 'Base' },
      { nombre: 'Edición rápida de stock', que: 'desde la lista, también por variante', plan: 'Base' },
      { nombre: 'Stock mínimo y alertas', que: 'aviso en el Inicio, la campana o por mail cuando queda poco', plan: 'Base' },
      { nombre: 'Categorías', que: 'árbol de categorías y subcategorías con ícono y color', plan: 'Base' },
      { nombre: 'Números del catálogo', que: 'productos publicados, sin stock, valor del inventario y ganancia estimada', plan: 'Base' },
      { nombre: 'Fotos sin fondo y fondo con IA', que: 'sacarle el fondo a una foto con un clic o ponerle un fondo de estudio', plan: 'Avanzado' },
    ],
  },
  {
    area: 'Pedidos y ventas',
    items: [
      { nombre: 'Pedidos por estado', que: 'pendientes, confirmados, en preparación, enviados, entregados y cancelados; cada cambio puede avisarle al cliente', plan: 'Base' },
      { nombre: 'Detalle del pedido', que: 'productos, total, cliente, cómo pagó, cómo lo recibe y la comisión de Mercado Pago', plan: 'Base' },
      { nombre: 'Ventas a mano', que: 'cargás ventas de mostrador, WhatsApp, Instagram o teléfono; descuentan stock y suman a tus números', plan: 'Base' },
      { nombre: 'Acciones en lote', que: 'confirmar o archivar varios pedidos de una vez', plan: 'Base' },
      { nombre: 'Exportar pedidos', que: 'a CSV, para la contadora o el cierre de mes', plan: 'Base' },
      { nombre: 'Historial', que: 'todos los pedidos cerrados', plan: 'Base' },
      { nombre: 'Cancelaciones y devoluciones', que: 'las aprobás o rechazás con tus propias reglas', plan: 'Base' },
      { nombre: 'Notas de crédito', que: 'saldo a favor del cliente en vez de devolver la plata', plan: 'Base' },
    ],
  },
  {
    area: 'Cobros y envíos',
    items: [
      { nombre: 'Mercado Pago', que: 'tarjeta, débito y cuotas; la plata va directo a tu cuenta', plan: 'Base' },
      { nombre: 'Transferencia o coordinar por WhatsApp', que: 'el pago se arregla aparte; podés mostrar alias, titular y banco en el checkout', plan: 'Base' },
      { nombre: 'Retiro en el local', que: 'con efectivo, débito, crédito o Mercado Pago', plan: 'Base' },
      { nombre: 'Descuento por pagar con Mercado Pago', que: 'un porcentaje opcional', plan: 'Base' },
      { nombre: 'Envíos', que: 'Correo Argentino, OCA, Andreani, Vía Cargo, delivery local u otro, con su costo', plan: 'Base' },
      { nombre: 'Envío gratis desde un monto', que: 'a partir del monto que elijas', plan: 'Base' },
    ],
  },
  {
    area: 'Clientes',
    items: [
      { nombre: 'Base automática', que: 'cada venta, online o a mano, suma al cliente', plan: 'Base' },
      { nombre: 'Ficha de cada cliente', que: 'compras, gasto, ticket promedio, última compra y pedidos', plan: 'Base' },
      { nombre: 'Email individual y masivo', que: 'a una persona o a una lista filtrada', plan: 'Base' },
      { nombre: 'Exportar la base', que: 'en CSV', plan: 'Base' },
    ],
  },
  {
    area: 'Mensajes y WhatsApp',
    items: [
      { nombre: 'Bandeja de mensajes de la tienda', que: 'no leídos, acceso al pedido y al perfil del cliente, archivo', plan: 'Base' },
      { nombre: 'Mencionar pedidos', que: 'escribís # en el chat y linkeás el pedido', plan: 'Base' },
      { nombre: 'Plantillas de respuesta', que: 'respuestas frecuentes con un toque', plan: 'Base' },
      { nombre: 'WhatsApp Business en el panel', que: 'conectás tu número y respondés desde Órbita con una bandeja como WhatsApp Web, con fotos; la app del celular sigue andando', plan: 'Base' },
      { nombre: 'Orbi atiende tu WhatsApp', que: 'contesta a tus clientes con los datos reales de la tienda (productos, precios, stock, promos, envíos, estado del pedido) y te pasa el chat ante un reclamo o una duda; en todos los chats o en los que elijas', plan: 'Avanzado' },
      { nombre: 'Menú automático de WhatsApp', que: 'saludo con menú de opciones en lista o botones; modo "solo menú" sin IA', plan: 'Avanzado' },
      { nombre: 'Orbi toma pedidos por WhatsApp', que: 'arma el pedido con precios y stock reales, el cliente confirma y queda pendiente en tu panel; con topes de unidades y monto', plan: 'Avanzado' },
      { nombre: 'Fotos de productos en el chat', que: 'Orbi manda la foto del producto que piden', plan: 'Avanzado' },
      { nombre: 'Control de Orbi en WhatsApp', que: 'indicaciones propias (tono, promos del mes), cupo mensual con tope, aviso cuando un chat necesita atención; si respondés vos, Orbi se calla', plan: 'Avanzado' },
    ],
  },
  {
    area: 'Difusión en Instagram',
    nota: 'Hoy está en acceso anticipado: se pide desde el panel y se habilita cuenta por cuenta.',
    items: [
      { nombre: 'Conexión de la cuenta', que: 'la cuenta profesional del negocio, con todos los permisos de una vez; al conectarla trae las charlas recientes', plan: 'Base, en acceso anticipado' },
      { nombre: 'Tablero de Difusión', que: 'alcance, interacciones y seguidores de la semana, lo pendiente de responder y los productos que no mostraste', plan: 'Base, en acceso anticipado' },
      { nombre: 'Mensajes directos', que: 'bandeja de Instagram en Órbita: texto o foto, plantillas, mandar un producto con su link de compra', plan: 'Base, en acceso anticipado' },
      { nombre: 'Respuestas sugeridas por Orbi', que: 'dos respuestas según la conversación, para elegir y editar', plan: 'Base, en acceso anticipado' },
      { nombre: 'Respuestas automáticas', que: 'bienvenida para quien escribe por primera vez y mensaje de ausencia fuera de horario', plan: 'Base, en acceso anticipado' },
      { nombre: 'Orbi atiende tu Instagram', que: 'igual que en WhatsApp: contesta los mensajes directos con los datos reales de la tienda, puede tomar pedidos y te pasa la charla cuando hace falta; comparte el cupo con WhatsApp', plan: 'Avanzado' },
      { nombre: 'Publicar y programar', que: 'fotos, carruseles de hasta 10 o reels, ahora o programados; desde un producto o tus archivos', plan: 'Base, en acceso anticipado' },
      { nombre: 'Textos con Orbi', que: 'tres versiones del texto (cercana, vendedora y breve) con hashtags', plan: 'Base, en acceso anticipado' },
      { nombre: 'Publicaciones sugeridas por Orbi', que: 'hasta 3 publicaciones armadas según tus ventas y lo que mejor funciona', plan: 'Base, en acceso anticipado' },
      { nombre: 'Calendario', que: 'lo publicado y lo programado, con los mejores días', plan: 'Base, en acceso anticipado' },
      { nombre: 'Comentarios y moderación', que: 'responder, ocultar y ocultar solos los que tengan palabras que elijas', plan: 'Base, en acceso anticipado' },
      { nombre: 'Estadísticas', que: 'alcance, visualizaciones, interacciones, mejores horarios y formatos, explicadas por Orbi', plan: 'Base, en acceso anticipado' },
    ],
  },
  {
    area: 'Descuentos y promociones',
    items: [
      { nombre: 'Descuentos automáticos', que: 'porcentaje o monto sobre productos, categorías o el total; "comprá X y llevate Z"; descuentos por volumen', plan: 'Base' },
      { nombre: 'Condiciones y vigencia', que: 'mínimos, fechas, días y franja horaria, límite de usos y prioridad', plan: 'Base' },
      { nombre: 'Cupones', que: 'con usos máximos, usos por cliente, monto mínimo, vigencia y opción privada', plan: 'Base' },
      { nombre: 'Compartir por link o email', que: 'cada cupón tiene su link con el descuento aplicado', plan: 'Base' },
      { nombre: 'Rendimiento de las promos', que: 'usos, plata movida y descuento regalado', plan: 'Base' },
      { nombre: '2x1 y 3x2', que: 'aplicado solo en el carrito, con cartel en el producto', plan: 'Avanzado' },
      { nombre: 'Oferta relámpago', que: 'un descuento con cuenta regresiva en la portada, con varios diseños', plan: 'Avanzado' },
      { nombre: 'Juegos con premio', que: 'mini-juegos (encestar, patear un gol) donde el cliente gana un descuento, con temáticas de temporada', plan: 'Avanzado' },
      { nombre: 'Modales de anuncios', que: 'avisos grandes en la tienda (bienvenida con descuento, temporada, novedades), en varios formatos', plan: 'Avanzado' },
      { nombre: 'Prueba social', que: 'avisos de "alguien acaba de comprar esto" con pedidos reales', plan: 'Avanzado' },
    ],
  },
  {
    area: 'Diseño de la tienda',
    items: [
      { nombre: 'Identidad de marca', que: 'logo y favicon', plan: 'Base' },
      { nombre: 'Colores y tipografía', que: 'paleta, letra y tamaño de texto', plan: 'Base' },
      { nombre: 'Portada a medida', que: 'carrusel, banner con parallax, video, marcas, estadísticas, textos y pie', plan: 'Base' },
      { nombre: 'Secciones', que: 'prendés o apagás partes de la tienda y elegís cómo se acomodan los productos', plan: 'Base' },
      { nombre: 'Vista previa en vivo', que: 'nada se publica hasta guardar', plan: 'Base' },
      { nombre: 'Redes sociales', que: 'Instagram, TikTok y Facebook enlazados desde la tienda', plan: 'Base' },
      { nombre: 'Plantillas de portada', que: 'dieciséis diseños alternativos para la portada, que se prueban antes de aplicar', plan: 'Avanzado' },
    ],
  },
  {
    area: 'Números y reportes',
    items: [
      { nombre: 'Inicio con 5 indicadores', que: 'ganancias, pedidos, ticket promedio, clientes nuevos y comisión de Mercado Pago, comparados con el período anterior', plan: 'Base' },
      { nombre: 'Alertas', que: 'pedidos para atender o sin tocar, stock crítico y pagos por confirmar', plan: 'Base' },
      { nombre: 'Gráficos y top', que: 'ventas por día, más vendidos, ventas online contra ventas a mano', plan: 'Base' },
      { nombre: 'Métricas avanzadas', que: 'ganancia, margen, conversión, cancelación, clientes que vuelven, cuándo te compran', plan: 'Base' },
      { nombre: 'Cómo te encuentran en Google', que: 'visitas, apariciones, posición y qué buscan para llegar a vos', plan: 'Base' },
      { nombre: 'Reportes', que: 'ventas, productos, clientes, inventario y pagos', plan: 'Base' },
      { nombre: 'Resúmenes por email', que: 'diario y semanal', plan: 'Base' },
    ],
  },
  {
    area: 'Orbi, el asistente con IA del panel',
    nota: 'Está en todas las pantallas del panel, contesta con los datos del negocio y puede hacer cambios, siempre con confirmación.',
    items: [
      { nombre: 'Preguntas sobre tu negocio', que: '"¿cuánto vendí esta semana?", "¿qué pedidos tengo pendientes?", "¿qué no rota?"', plan: 'Base' },
      { nombre: 'Cómo se hace algo', que: 'explica cualquier pantalla y te lleva a donde se hace', plan: 'Base' },
      { nombre: 'Acciones en el panel', que: 'crea productos, categorías, descuentos y cupones; cambia el estado de un pedido; actualiza datos del negocio, pagos y envíos', plan: 'Base' },
      { nombre: 'Textos para vender', que: 'descripciones, textos de promos y mensajes para clientes', plan: 'Base' },
      { nombre: 'Cupo y uso del equipo', que: 'cupo mensual por negocio, con topes por persona y registro de lo que hizo Orbi', plan: 'Base' },
    ],
  },
  {
    area: 'Equipo, avisos y control',
    items: [
      { nombre: 'Equipo con roles', que: 'invitás por email; propietario con acceso total y empleado sin las secciones sensibles', plan: 'Base' },
      { nombre: 'Registro de actividad', que: 'quién hizo qué y cuándo', plan: 'Base' },
      { nombre: 'Notificaciones a medida', que: 'por evento, en la campana, por email, los dos o ninguno', plan: 'Base' },
      { nombre: 'Búsqueda global', que: 'pedidos, clientes, productos o secciones desde la barra de arriba', plan: 'Base' },
      { nombre: 'Mi perfil', que: 'email, contraseña y modo claro u oscuro', plan: 'Base' },
      { nombre: 'Credenciales por negocio', que: 'cada persona tiene su contraseña, exclusiva de ese negocio', plan: 'Base' },
    ],
  },
  {
    area: 'Ayuda, plan y cuenta',
    items: [
      { nombre: 'Tutoriales por pantalla', que: 'video corto o recorrido guiado la primera vez, siempre a mano con "Ver tutorial"', plan: 'Base' },
      { nombre: 'Manual de uso', que: 'completo y con buscador, dentro de Órbita', plan: 'Base' },
      { nombre: 'Soporte', que: 'canal para escribirle al equipo de Órbita y soporte prioritario por WhatsApp', plan: 'Base' },
      { nombre: 'Suscripción', que: 'mensual, semestral o anual con débito automático por Mercado Pago; desde ahí se activa el paquete Avanzado', plan: 'Base' },
      { nombre: 'Pausar la tienda', que: 'nadie la ve hasta que la reactivás, los datos quedan intactos', plan: 'Base' },
      { nombre: 'Pasar a vidriera o a tienda completa', que: 'cambiás entre carrito y catálogo con consulta por WhatsApp', plan: 'Base' },
      { nombre: 'Eliminar el espacio', que: 'se pausa al instante y hay 60 días para arrepentirse', plan: 'Base' },
    ],
  },
];

/** Módulos para otros rubros: armados y visibles en las demos, todavía NO se pueden contratar. */
export const PROXIMAMENTE: { modulo: string; que: string }[] = [
  { modulo: 'Turnos', que: 'peluquerías, estéticas, consultorios: página de reservas, agenda por profesional, servicios con duración y precio, señas, recordatorios; el cliente ve "Mis turnos"' },
  { modulo: 'Alquileres', que: 'canchas, salones, quinchos y propiedades: reservas por hora, evento, noche o mes, disponibilidad y calendarios externos; el cliente ve "Mis reservas"' },
  { modulo: 'Gimnasio', que: 'gimnasios, boxes y estudios: grilla de clases con cupo, alumnos, planes (prueba, suelta, packs, membresías) y check-in; el alumno ve "Mis clases"' },
];

/** Las funcionalidades como texto para el prompt del bot. */
export function funcionalidadesParaPrompt(): string[] {
  const lineas: string[] = [];
  for (const a of FUNCIONALIDADES) {
    lineas.push(`${a.area}${a.nota ? ` (${a.nota})` : ''}:`);
    for (const i of a.items) lineas.push(`- ${i.nombre}: ${i.que}. [${i.plan}]`);
  }
  lineas.push('Próximamente (se ven en las demos, todavía no se pueden contratar):');
  for (const p of PROXIMAMENTE) lineas.push(`- ${p.modulo}: ${p.que}.`);
  return lineas;
}
