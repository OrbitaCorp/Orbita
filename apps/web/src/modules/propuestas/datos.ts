// src/modules/propuestas/datos.ts — Las 16 propuestas innovadoras para
// debatir con el equipo (2026-09-02). 5 SIN Orbi (producto puro) y 11 CON
// Orbi (IA como protagonista). Además hay una propuesta de nueva home en
// pages/nueva-home.tsx. Cada una tiene un prototipo interactivo en
// prototipos/<Id>.tsx y se ve en http://localhost:3001/propuestas/<id>.
//
// DEMO INTERNA — no es producto. Se puede borrar toda la carpeta
// `modules/propuestas` + `pages/propuestas` sin tocar nada más.

export type Grupo = 'sin-orbi' | 'con-orbi'

export interface Propuesta {
  id: string
  numero: number
  grupo: Grupo
  nombre: string
  /** Una línea que vende la idea. */
  tagline: string
  /** Emoji simple para el hub y las tarjetas. */
  emoji: string
  /** Color de acento propio de la propuesta (hex). */
  color: string
  /** Qué es, en 2-3 oraciones. */
  resumen: string
  /** Por qué no existe hoy / por qué es distinto de lo que hay. */
  porQueUnico: string
  /** Por qué tiene sentido justo en Órbita (rubros, Argentina, marca). */
  porQueOrbita: string
  /** Cómo funcionaría, en 3-4 pasos. */
  pasos: { titulo: string; detalle: string }[]
  /** Contras / riesgos a debatir. */
  riesgos: string[]
  /** Esfuerzo estimado (1-5) e impacto estimado (1-5), para el debate. */
  esfuerzo: 1 | 2 | 3 | 4 | 5
  impacto: 1 | 2 | 3 | 4 | 5
  /** Qué partes de Órbita toca. */
  toca: string[]
}

export const PROPUESTAS: Propuesta[] = [
  // ─── SIN ORBI ────────────────────────────────────────────────────────────
  {
    id: 'constelaciones',
    numero: 1,
    grupo: 'sin-orbi',
    nombre: 'Constelaciones',
    tagline: 'Los negocios del barrio se alían solos: comprás en uno, ganás en el de al lado.',
    emoji: '✦',
    color: '#38BDF8',
    resumen:
      'Cada tienda de Órbita es un planeta. Los que están cerca (mismo barrio, rubros complementarios) forman una constelación: una alianza automática de beneficios cruzados. Te cortás el pelo en la barbería y salís con un 15% en la cafetería de la esquina, que a su vez te manda a la librería. Nadie negocia nada: Órbita propone la constelación y cada dueño acepta con un toque.',
    porQueUnico:
      'Las plataformas de e-commerce compiten por aislar a cada negocio en su propia tienda. Ninguna usa el hecho de que TODOS sus clientes están en la misma red para hacer que se ayuden entre sí. Los programas de beneficios cruzados existen solo entre grandes marcas con equipos comerciales; acá lo arma el software para el kiosco y la peluquería.',
    porQueOrbita:
      'Órbita ya tiene negocios de rubros distintos (ventas, turnos, gastronomía) en la misma plataforma y sabe su ubicación. Es literalmente la metáfora de la marca: planetas que se atraen. Y en Argentina el comercio de barrio vive de la recomendación boca a boca.',
    pasos: [
      { titulo: 'Órbita detecta vecinos', detalle: 'Con la dirección de cada negocio arma clusters de 400 m con rubros que no compiten entre sí.' },
      { titulo: 'Propone la constelación', detalle: 'Cada dueño ve en su panel "Tu constelación: Barbería Sur + Café Nómade + Librería Ulises" y qué beneficio daría y recibiría.' },
      { titulo: 'Un toque para unirse', detalle: 'El dueño elige qué ofrece (un % o un regalo) y se activa. Los beneficios aparecen en el ticket digital de cada compra.' },
      { titulo: 'El cliente descubre el barrio', detalle: 'Al terminar una compra ve "Tu constelación" con los beneficios vecinos, en el mail y en su perfil.' },
    ],
    riesgos: ['Necesita masa crítica de negocios por zona para que aparezcan constelaciones.', 'Definir quién absorbe el costo del beneficio cruzado (hoy: cada negocio el suyo).', 'Rubros en competencia directa no deben quedar en la misma constelación.'],
    esfuerzo: 4,
    impacto: 5,
    toca: ['Descuentos', 'Perfil del cliente', 'Mail post-compra', 'Panel · nuevo módulo'],
  },
  {
    id: 'libreta',
    numero: 2,
    grupo: 'sin-orbi',
    nombre: 'La Libreta',
    tagline: 'El fiado del almacén, digital: confianza de barrio con recordatorios y sin vergüenza.',
    emoji: '📒',
    color: '#F59E0B',
    resumen:
      'Los negocios argentinos siempre fiaron a los clientes de confianza con una libreta. Órbita la digitaliza: el dueño le abre "libreta" a un cliente conocido con un tope, ese cliente compra online o en el POS y paga a fin de mes desde su perfil con Mercado Pago. Recordatorios amables por WhatsApp, historial claro, y un "puntaje de confianza" que crece con cada libreta saldada.',
    porQueUnico:
      'El "compre ahora, pague después" global (Klarna, Affirm) es un banco metido en el medio, con scoring y tasas. La Libreta no presta plata: formaliza la confianza que el negocio YA tiene con su cliente. No existe ningún producto que haga esto para el comercio chico, y menos integrado al POS y a la tienda online a la vez.',
    porQueOrbita:
      'Órbita tiene POS + tienda online + clientes en un mismo lugar, que es exactamente lo que hace falta para que la libreta funcione en el mostrador y en la web. Y "el fiado" es un código cultural argentino que ninguna plataforma extranjera va a entender.',
    pasos: [
      { titulo: 'El dueño abre una libreta', detalle: 'Desde Clientes: elige a Marta, pone tope $40.000 y día de cierre. Marta recibe un WhatsApp con su libreta.' },
      { titulo: 'Marta compra "a la libreta"', detalle: 'En el POS aparece como medio de pago; en la tienda online, como opción si está logueada. Sin tarjeta, sin fricción.' },
      { titulo: 'Cierre del mes', detalle: 'El día de cierre Marta recibe el resumen y paga todo junto por MP desde su perfil. El dueño ve quién debe qué, sin perseguir a nadie.' },
      { titulo: 'La confianza crece', detalle: 'Cada libreta saldada a tiempo sube el puntaje y el tope sugerido. La reputación viaja con el cliente entre negocios de Órbita.' },
    ],
    riesgos: ['Morosidad: el riesgo lo asume el negocio, hay que dejarlo clarísimo.', 'Cobranza automática con MP requiere que el cliente tenga cuenta.', 'Regulación: no debe parecer un crédito financiero.'],
    esfuerzo: 3,
    impacto: 5,
    toca: ['POS', 'Checkout', 'Clientes', 'Perfil del cliente', 'Mensajes/WhatsApp'],
  },
  {
    id: 'carrito-colectivo',
    numero: 3,
    grupo: 'sin-orbi',
    nombre: 'Carrito Colectivo',
    tagline: 'Un link, muchos compradores: cada uno paga lo suyo y el grupo desbloquea el precio.',
    emoji: '🛒',
    color: '#34D399',
    resumen:
      'Una compradora arma un carrito y lo comparte por WhatsApp. Sus amigas, compañeras de oficina o vecinas del edificio agregan lo que quieren al mismo carrito y cada una paga su parte por separado. Cuando el grupo supera un monto o una cantidad, se desbloquea un precio de grupo para todos, y el envío se hace una sola vez.',
    porQueUnico:
      'El "group buying" tipo Pinduoduo es un marketplace gigante en China; nada de eso llegó a la tienda propia del negocio chico. Y el pago dividido que existe (Splitwise, transferencias) es después de la compra, no dentro del checkout. Acá el carrito es multijugador desde el principio.',
    porQueOrbita:
      'En Argentina la compra comunitaria (de la oficina, del edificio, del club) es cultura: alguien "junta pedidos". Órbita ya tiene carrito, cupones por cantidad y Mercado Pago; solo falta que el carrito tenga más de un dueño.',
    pasos: [
      { titulo: 'Se crea el carrito colectivo', detalle: 'Desde cualquier carrito: "Compartir para comprar juntos". Se genera un link con un objetivo (ej: 6 personas o $60.000).' },
      { titulo: 'Se suman por el link', detalle: 'Cada persona entra, agrega lo suyo y ve en vivo cuánto falta para el precio de grupo.' },
      { titulo: 'Cada uno paga lo suyo', detalle: 'Pago individual por MP; el negocio recibe un pedido consolidado con un solo envío.' },
      { titulo: 'Se desbloquea el premio', detalle: 'Al llegar al objetivo, todos los pagos se ajustan al precio de grupo (o se devuelve la diferencia).' },
    ],
    riesgos: ['Qué pasa si el grupo no llega al objetivo antes del vencimiento (cobrar precio normal o cancelar).', 'Entrega única con varios destinatarios: quién recibe.', 'Reembolsos parciales por MP.'],
    esfuerzo: 4,
    impacto: 4,
    toca: ['Carrito', 'Checkout', 'Descuentos', 'Pedidos', 'Envíos'],
  },
  {
    id: 'precio-congelado',
    numero: 4,
    grupo: 'sin-orbi',
    nombre: 'Precio Congelado',
    tagline: 'En un país con inflación, el cliente puede congelar un precio por 72 hs con una seña mínima.',
    emoji: '🧊',
    color: '#A78BFA',
    resumen:
      'Cada producto muestra su historia de precio (transparente, sin trampa) y un botón "Congelar precio 72 hs". El cliente deja una seña chica y el precio queda clavado aunque el negocio actualice la lista. Si compra, la seña se descuenta; si no, el negocio se la queda. Para el dueño es un módulo de reprecio masivo con calendario: sube la lista un martes y ve cuántos congelaron.',
    porQueUnico:
      'Las aerolíneas cobran por "bloquear la tarifa"; ninguna tienda online lo hace. Y ninguna muestra la historia de precios de sus propios productos: Órbita lo convierte en una ventaja de confianza. Es un producto que solo tiene sentido en una economía con inflación, por eso nadie global lo va a hacer.',
    porQueOrbita:
      'Órbita nace en Argentina. La inflación es el problema número uno de sus clientes y de los clientes de sus clientes. Un feature que lo abraza en vez de ignorarlo es una diferencia que Shopify o Tiendanube no pueden copiar sin repensar su producto.',
    pasos: [
      { titulo: 'El dueño programa la lista', detalle: 'En Catálogo: "Actualizar precios +8% el viernes". Ve el impacto antes de aplicar.' },
      { titulo: 'El cliente ve la historia', detalle: 'Cada producto muestra un mini gráfico de precio y "Sube el viernes".' },
      { titulo: 'Congela con una seña', detalle: 'Paga el 10% por MP y el precio queda fijo 72 hs, con cuenta regresiva en su perfil.' },
      { titulo: 'Compra o pierde la seña', detalle: 'Si compra, la seña se descuenta. Si no, el negocio cobró por el riesgo asumido. Todos ganan.' },
    ],
    riesgos: ['La seña como ingreso puede tener implicancias fiscales.', 'Stock reservado vs. no reservado durante el congelamiento.', 'Comunicar bien que "congelar" no es reservar.'],
    esfuerzo: 3,
    impacto: 4,
    toca: ['Catálogo', 'Producto (storefront)', 'Checkout', 'Perfil del cliente', 'Pagos'],
  },
  {
    id: 'radar',
    numero: 5,
    grupo: 'sin-orbi',
    nombre: 'Radar de Deseos',
    tagline: 'Los clientes piden lo que la tienda todavía no tiene. El dueño ve la demanda antes de comprar stock.',
    emoji: '📡',
    color: '#FB7185',
    resumen:
      'En la tienda hay un botón "Pedí algo que no encontrás". Los clientes dejan el deseo en dos palabras (con foto opcional). En el panel, el dueño ve un radar: pedidos agrupados por similitud, con cuántas personas quieren cada cosa. Cuando lo consigue, lo "lanza": todos los que lo pidieron reciben aviso y prioridad 24 hs para comprarlo.',
    porQueUnico:
      'La "lista de deseos" de todo e-commerce es sobre productos que ya existen. El Radar es sobre lo que NO existe todavía en la tienda: convierte a los clientes en el equipo de compras del negocio. Y el "lanzamiento con prioridad" para los que lo pidieron es un mecanismo de lealtad que nadie tiene.',
    porQueOrbita:
      'El negocio chico compra stock a ciegas y se funde en lo que no rota. Órbita ya tiene inventario, clientes y mensajes; sumar la señal de demanda cierra el círculo. Y el radar es una pieza visual que grita "Órbita".',
    pasos: [
      { titulo: 'El cliente pide', detalle: '"Zapatillas urbanas talle 44 negras" + foto de referencia. Diez segundos.' },
      { titulo: 'El radar agrupa', detalle: 'El panel muestra los deseos como puntos: más pedido = más cerca del centro y más grande.' },
      { titulo: 'El dueño decide con datos', detalle: '"14 personas quieren esto": compra 14, no 40. Puede responder "lo consigo en 10 días".' },
      { titulo: 'Lanzamiento prioritario', detalle: 'Al cargar el producto, se avisa a los que lo pidieron y tienen 24 hs de prioridad antes de que salga público.' },
    ],
    riesgos: ['Deseos sin agrupar bien generan ruido (sin IA, agrupar por palabras clave y talle).', 'Expectativa del cliente si el negocio nunca responde.', 'Spam en el formulario público.'],
    esfuerzo: 2,
    impacto: 4,
    toca: ['Storefront', 'Inventario', 'Clientes', 'Mensajes', 'Panel · nuevo módulo'],
  },

  // ─── CON ORBI ────────────────────────────────────────────────────────────
  {
    id: 'regateo',
    numero: 6,
    grupo: 'con-orbi',
    nombre: 'Orbi Regatea',
    tagline: 'El cliente negocia con Orbi como en la feria. El dueño pone los límites; Orbi cierra la venta.',
    emoji: '🤝',
    color: '#F472B6',
    resumen:
      'En la tienda, en vez de "Comprar" a secas hay "Hacé una oferta". El cliente charla con Orbi: "¿me lo dejás en 18?". Orbi conoce el margen mínimo, el stock, cuánto hace que no rota ese producto y si el cliente es recurrente, y negocia de verdad: contraoferta, combo, envío gratis a cambio de llevar dos. El dueño solo configura hasta dónde puede ceder.',
    porQueUnico:
      'Los chatbots de venta responden preguntas; ninguno tiene autoridad para negociar dentro de reglas del dueño. El regateo es humano y argentino ("¿cuánto es lo mínimo?"), y hoy se pierde en el canal online. Orbi lo trae de vuelta, con margen protegido y sin que el dueño esté presente.',
    porQueOrbita:
      'Orbi ya existe, ya conoce el catálogo y los pedidos por herramientas reales, y ya habla rioplatense. Es la extensión natural: pasar de asistente del dueño a vendedor del negocio con criterio.',
    pasos: [
      { titulo: 'El dueño fija las reglas', detalle: 'Margen mínimo por categoría, hasta cuánto cede por producto viejo, qué combos puede armar.' },
      { titulo: 'El cliente hace una oferta', detalle: 'Desde la ficha del producto, en un chat con Orbi, sin formularios.' },
      { titulo: 'Orbi negocia', detalle: 'Contraoferta con motivo ("si llevás las dos te hago 15%"), tono de vendedor, tres rondas máximo.' },
      { titulo: 'Cierre en un toque', detalle: 'El acuerdo se convierte en un cupón único de 15 minutos y va directo al checkout.' },
    ],
    riesgos: ['Los clientes podrían esperar siempre descuento (mitigar: solo en productos marcados).', 'Alucinación de precios: la oferta final la valida el backend, no el modelo.', 'Costo por conversación de LLM.'],
    esfuerzo: 3,
    impacto: 5,
    toca: ['Orbi (storefront)', 'Descuentos', 'Checkout', 'Catálogo'],
  },
  {
    id: 'piloto',
    numero: 7,
    grupo: 'con-orbi',
    nombre: 'Piloto Automático',
    tagline: 'Orbi propone la semana del negocio: promos, avisos y reposiciones. El dueño aprueba con un toque.',
    emoji: '🛰',
    color: '#60A5FA',
    resumen:
      'Todos los domingos Orbi arma un plan de vuelo para la semana con acciones concretas y ya redactadas: "martes: 20% en las remeras que no rotan hace 40 días", "jueves: mensaje a los 31 clientes que no compran hace 2 meses", "viernes: reponer stock de X, se acaba el sábado". El dueño ve el plan como una órbita de la semana y aprueba, edita o descarta cada acción. Lo aprobado se ejecuta solo.',
    porQueUnico:
      'Los dashboards muestran datos y esperan que el dueño sepa qué hacer. Los "insights de IA" dicen "considerá hacer una promo". Nadie entrega acciones listas para ejecutar, con calendario y con un solo botón de aprobar. Es la diferencia entre un tablero y un copiloto.',
    porQueOrbita:
      'Orbi ya tiene las herramientas para crear descuentos, mensajes y leer reportes. Solo falta darle iniciativa y agenda. El dueño de un negocio chico no tiene tiempo de "analizar": quiere que alguien le diga qué hacer y lo haga.',
    pasos: [
      { titulo: 'Domingo: Orbi planifica', detalle: 'Cruza ventas, stock, clientes inactivos y fechas (Día de la Madre, feriados) y arma 4-6 acciones.' },
      { titulo: 'El dueño revisa el plan', detalle: 'Cada acción muestra el porqué, el impacto estimado y lo que se va a mandar, tal cual.' },
      { titulo: 'Aprueba, edita o descarta', detalle: 'Un toque por acción. Puede cambiar el % o el texto, Orbi ajusta el resto.' },
      { titulo: 'Se ejecuta y reporta', detalle: 'Cada acción corre a su hora. El domingo siguiente Orbi muestra qué funcionó y aprende.' },
    ],
    riesgos: ['Acciones automáticas mal calibradas erosionan margen: empezar con aprobación obligatoria.', 'Necesita cron/scheduler en el backend (ya existe Cloud Scheduler).', 'Calidad de las sugerencias depende de tener datos suficientes.'],
    esfuerzo: 4,
    impacto: 5,
    toca: ['Orbi (panel)', 'Descuentos', 'Mensajes', 'Inventario', 'Reportes', 'Dashboard'],
  },
  {
    id: 'foto-catalogo',
    numero: 8,
    grupo: 'con-orbi',
    nombre: 'Catálogo en una Foto',
    tagline: 'Sacale una foto al estante. Orbi arma los productos, precios y descripciones.',
    emoji: '📸',
    color: '#FBBF24',
    resumen:
      'El paso que mata a los negocios nuevos es cargar 80 productos uno por uno. Con esta propuesta el dueño saca una foto del estante, de la góndola o de la vitrina. Orbi detecta cada producto, lee la etiqueta de precio, propone nombre, categoría y descripción, y recorta la foto de cada uno. El dueño solo revisa una grilla y toca "Publicar".',
    porQueUnico:
      'La carga masiva hoy es una planilla de Excel o un importador de CSV. Nadie arranca desde la realidad física del local. Google Lens reconoce productos, pero no los convierte en un catálogo listo con precios leídos de la etiqueta y fotos recortadas.',
    porQueOrbita:
      'Órbita ya tiene un onboarding que quiere ser el más corto del mercado y un Orbi que ya genera descripciones. Esta propuesta reduce "abrir la tienda" de una tarde a diez minutos, y es el demo más impactante para vender Órbita en una reunión.',
    pasos: [
      { titulo: 'Foto del estante', detalle: 'Desde el celular, en el panel o en el onboarding. Varias fotos si hace falta.' },
      { titulo: 'Orbi detecta', detalle: 'Recuadra cada producto, lee la etiqueta (precio, marca) y recorta la imagen.' },
      { titulo: 'Grilla para revisar', detalle: 'Cada detección es una tarjeta editable: nombre, precio, categoría, descripción. Confianza visible.' },
      { titulo: 'Publicar', detalle: 'Un toque crea los productos en el catálogo con stock inicial y fotos.' },
    ],
    riesgos: ['Precisión del reconocimiento en fotos malas (iluminación, ángulo).', 'Costo de modelos de visión por foto.', 'Fotos recortadas del estante no siempre sirven como foto de producto: proponer reemplazarlas después.'],
    esfuerzo: 4,
    impacto: 5,
    toca: ['Orbi (visión)', 'Catálogo', 'Onboarding', 'Inventario'],
  },
  {
    id: 'simulador',
    numero: 9,
    grupo: 'con-orbi',
    nombre: '¿Y si…?',
    tagline: 'Preguntale a Orbi qué pasa si subís los precios, abrís los sábados o hacés 3 cuotas. Con tus datos.',
    emoji: '🔮',
    color: '#2DD4BF',
    resumen:
      'Un simulador de futuros del negocio, en lenguaje natural. "¿Y si subo 10% los precios?", "¿y si dejo de vender X?", "¿y si mando un 2x1 a los inactivos?". Orbi corre el escenario contra las ventas reales, la elasticidad observada y la estacionalidad, y muestra dos líneas: el futuro sin hacer nada y el futuro con la decisión. Cada escenario se puede guardar y convertir en acción.',
    porQueUnico:
      'Los reportes miran para atrás. Las herramientas de "forecast" son para empresas con analistas. Un simulador conversacional para el dueño de una peluquería o una dietética, que responde en segundos con sus propios números, no existe.',
    porQueOrbita:
      'Órbita tiene el histórico de ventas, pedidos y clientes en un solo lugar, y Orbi ya lee reportes por herramientas. Es transformar el módulo Reportes de "qué pasó" en "qué pasaría", que es lo que realmente quiere saber un dueño.',
    pasos: [
      { titulo: 'El dueño pregunta', detalle: 'En Reportes, un campo tipo chat: "¿y si subo 10% las remeras?".' },
      { titulo: 'Orbi arma el escenario', detalle: 'Traduce la pregunta a parámetros (qué productos, cuánto, desde cuándo) y los muestra para ajustar.' },
      { titulo: 'Dos futuros lado a lado', detalle: 'Gráfico de 90 días: sin cambio vs. con cambio, con rango de incertidumbre honesto.' },
      { titulo: 'Convertir en acción', detalle: '"Aplicar" crea el cambio de precio o la promo. "Guardar" lo deja para comparar con otros escenarios.' },
    ],
    riesgos: ['Con pocos datos, la proyección es débil: mostrar siempre la incertidumbre.', 'Riesgo de que el dueño lo tome como certeza.', 'Modelado de elasticidad simple al principio (heurístico), no ML.'],
    esfuerzo: 3,
    impacto: 4,
    toca: ['Orbi (panel)', 'Reportes', 'Catálogo', 'Descuentos'],
  },
  {
    id: 'orbi-oido',
    numero: 10,
    grupo: 'con-orbi',
    nombre: 'Orbi al Oído',
    tagline: 'Con las manos ocupadas, le hablás: "cobrale a Juan dos cortes y una cera". Orbi hace el resto.',
    emoji: '🎙',
    color: '#C084FC',
    resumen:
      'Para el barbero con la máquina en la mano, la cocinera con las manos en la masa o el vendedor con el local lleno: Orbi escucha. "Cobrale a Juan dos cortes y una cera", "dale turno a Lucía el jueves a las 5", "¿cuántas medias negras quedan?". Orbi arma el ticket, agenda el turno o responde, y muestra en pantalla una confirmación grande para tocar con el codo. Sin teclado, sin mouse.',
    porQueUnico:
      'Los asistentes de voz resuelven cosas genéricas (timer, música). Ningún POS ni sistema de turnos se opera hablando en rioplatense, entendiendo "dos cortes y una cera" como productos del catálogo real. Es el primer POS manos libres para oficios.',
    porQueOrbita:
      'Órbita atiende barberías, gastronomía y locales de ropa: todos rubros con las manos ocupadas. Orbi ya tiene las herramientas de POS, turnos y stock. Solo falta la voz como entrada, y un modo de pantalla pensado para leer de lejos.',
    pasos: [
      { titulo: 'Modo Oído', detalle: 'En el POS o en Turnos, un botón grande: la pantalla pasa a modo lejano (tipografía enorme, alto contraste).' },
      { titulo: 'Escucha continua con palabra clave', detalle: '"Orbi, …" activa. Transcripción en vivo en pantalla para que se vea qué entendió.' },
      { titulo: 'Orbi interpreta con el catálogo', detalle: '"dos cortes y una cera" → 2 × Corte clásico + 1 × Cera mate, del catálogo real. Muestra el ticket.' },
      { titulo: 'Confirmación de codo', detalle: 'Un botón que ocupa media pantalla: "Cobrar $14.000". O se confirma diciendo "dale".' },
    ],
    riesgos: ['Ruido de fondo en un local: usar palabra de activación y confirmación siempre.', 'Latencia de speech-to-text en celulares viejos.', 'Privacidad: dejar claro cuándo escucha (indicador visible).'],
    esfuerzo: 3,
    impacto: 4,
    toca: ['Orbi (voz)', 'POS', 'Turnos', 'Inventario'],
  },
  {
    id: 'publicidad',
    numero: 11,
    grupo: 'con-orbi',
    nombre: 'Publicidad de un Toque',
    tagline: 'Google y Meta Ads desde el panel: "Promocionar este producto, $20.000, 7 días". Orbi arma y optimiza.',
    emoji: '📣',
    color: '#FB923C',
    resumen:
      'El dueño no abre Google Ads ni el Administrador de Anuncios de Meta: desde su catálogo toca "Promocionar", elige presupuesto y días, y Órbita crea la campaña en la cuenta publicitaria del negocio con el feed de productos, la tienda como landing y los clientes como público. Orbi redacta los anuncios, reparte el presupuesto entre Google y Meta según lo que rinde, y reporta en pesos: "gastaste $20.000, vendiste $118.000". El cliente paga la pauta con su propia tarjeta; Órbita cobra por la gestión.',
    porQueUnico:
      'Shopify y Tiendanube conectan Google y Meta, pero te mandan a configurar campañas en las herramientas de ellos. Nadie hace la versión "un toque" con la IA decidiendo el reparto y hablando en pesos y ventas, para un negocio que nunca pautó. Es tomar el "Promocionar publicación" de Instagram y hacerlo con datos reales de la tienda.',
    porQueOrbita:
      'Órbita ya tiene lo que las plataformas de anuncios piden: catálogo (feed a Merchant Center y Catálogo de Meta), tienda con dominio (landing), clientes (públicos) y ventas (conversiones). Y tiene a Orbi para escribir y optimizar. Solo faltan el pixel, la conexión OAuth y la pantalla de un toque.',
    pasos: [
      { titulo: 'Conectar una vez', detalle: 'El dueño conecta Google y Meta con OAuth y carga su tarjeta en su cuenta publicitaria. Órbita instala el pixel y el feed solos.' },
      { titulo: 'Promocionar en un toque', detalle: 'Desde un producto o una promo: presupuesto, días, objetivo (ventas / visitas / seguidores). Orbi propone el anuncio con la foto del catálogo.' },
      { titulo: 'Orbi reparte y optimiza', detalle: 'Publica en Google Shopping y en Meta a la vez; cada día mueve presupuesto hacia lo que vende y frena lo que no.' },
      { titulo: 'Reporte en pesos', detalle: '"Gastaste $20.000 y vendiste $118.000 (5,9x)". Sugerencia de Orbi para la próxima: qué producto, qué público, cuánto.' },
    ],
    riesgos: ['Google exige token de desarrollador con revisión y Meta exige App Review + verificación de empresa: semanas de trámite antes de lanzar.', 'Modelo de cobro: tarjeta del cliente en su cuenta (simple) vs. Órbita paga y refactura (más ingreso, más riesgo y percepciones impositivas).', 'Anuncios rechazados por políticas de las plataformas: hay que explicárselo al dueño en criollo.'],
    esfuerzo: 4,
    impacto: 5,
    toca: ['Orbi (panel)', 'Catálogo', 'Storefront (pixel)', 'Clientes', 'Reportes', 'Integraciones'],
  },
  {
    id: 'vidriera-viva',
    numero: 12,
    grupo: 'con-orbi',
    nombre: 'Vidriera Viva',
    tagline: 'La portada de la tienda se rearma sola según la hora, el clima, el stock y quién entra.',
    emoji: '🪟',
    color: '#22D3EE',
    resumen:
      'Hoy la home de una tienda es la misma a las 8 de la mañana de un martes lluvioso que un viernes a la noche. Con Vidriera Viva, Orbi la recompone en tiempo real: a la mañana la panadería muestra medialunas y café, un viernes a la tarde la vinoteca pone los combos para el asado, si llueve la zapatería sube las botas, si quedan 2 unidades de algo aparece "últimas". Y si el que entra ya compró antes, ve primero lo que le gusta. El dueño define límites; Orbi hace la vidriera.',
    porQueUnico:
      'La personalización existe en Amazon o Mercado Libre con equipos de data science. Ninguna plataforma para negocios chicos la ofrece, y menos una que use señales tan simples y humanas como la hora, el clima del barrio y lo que queda en el estante. Es tener a alguien acomodando la vidriera todo el día.',
    porQueOrbita:
      'Órbita ya tiene las veinte plantillas de portada con secciones, el catálogo con stock, el historial de clientes y a Orbi. Vidriera Viva es la capa que decide qué va en cada sección y cuándo. Es la evolución natural de las plantillas: de estáticas a vivas.',
    pasos: [
      { titulo: 'El dueño marca reglas', detalle: 'Qué categorías van por franja horaria, qué hacer cuando llueve, hasta cuántas unidades es "últimas". Todo con toggles, sin código.' },
      { titulo: 'Orbi lee las señales', detalle: 'Hora, día, clima del barrio (API meteorológica), stock, ventas de la última hora y si el visitante es cliente conocido.' },
      { titulo: 'Recompone la portada', detalle: 'Reordena secciones, cambia el hero, sube y baja productos, ajusta el texto del banner. Sin recargar: la tienda respira.' },
      { titulo: 'Aprende qué funciona', detalle: 'Cada composición mide clics y ventas. Orbi se queda con lo que rinde y le muestra al dueño el "antes y después".' },
    ],
    riesgos: ['El dueño puede sentir que pierde control de su vidriera: siempre tiene que poder fijar un producto o volver a estática.', 'Datos de clima requieren una API externa (costo bajo, pero es una dependencia).', 'Personalizar por visitante conocido necesita sesión iniciada o cookie propia.'],
    esfuerzo: 4,
    impacto: 4,
    toca: ['Orbi (storefront)', 'Plantillas', 'Catálogo', 'Inventario', 'Clientes'],
  },
  {
    id: 'marca-60',
    numero: 13,
    grupo: 'con-orbi',
    nombre: 'Marca en 60 Segundos',
    tagline: 'Contale a Orbi qué vendés y en un minuto tenés logo, paleta, tienda, dominio y el post de lanzamiento.',
    emoji: '🎨',
    color: '#F0ABFC',
    resumen:
      'El negocio que arranca no tiene diseñador. En el onboarding, Orbi le hace tres preguntas ("¿qué vendés?", "¿cómo querés que te sientan: cercano, premium, divertido?", "¿tenés un color que ya uses?") y arma todo junto: un logo tipográfico, la paleta, la tipografía, la plantilla de portada que mejor le calza, los textos de la tienda ("Sobre nosotros", el banner), el dominio .com.ar disponible y el post de Instagram de lanzamiento. El dueño elige entre tres propuestas y ajusta con lenguaje natural ("más oscuro", "menos formal").',
    porQueUnico:
      'Canva genera logos; Wix genera sitios con IA; nadie junta identidad + tienda + dominio + primer post en una sola conversación de un minuto, y menos con tiendas que ya venden. La diferencia es que acá el resultado no es un mockup: es la tienda real, publicada.',
    porQueOrbita:
      'Órbita tiene el onboarding más corto del mercado como objetivo, veinte plantillas, apariencia configurable (colores, fuentes), compra de dominios desde el panel y a Orbi en el wizard. Solo falta que Orbi tome las decisiones de diseño por el dueño en vez de mostrarle veinte opciones.',
    pasos: [
      { titulo: 'Tres preguntas', detalle: 'Rubro, personalidad de marca y un color si ya tiene. Puede subir un logo viejo o una foto del local para sacar la paleta.' },
      { titulo: 'Tres propuestas completas', detalle: 'Cada una con logo, paleta, tipografía, plantilla aplicada con productos de ejemplo del rubro y dominio sugerido disponible.' },
      { titulo: 'Ajuste conversacional', detalle: '"Más oscuro", "menos formal", "usá el verde del logo": Orbi regenera solo lo que cambió.' },
      { titulo: 'Publicar y anunciar', detalle: 'Un toque aplica todo a la tienda real, reserva el dominio y deja listo el post de lanzamiento para Instagram.' },
    ],
    riesgos: ['Los logos generados por IA pueden verse genéricos: ofrecer "traé el tuyo" siempre visible.', 'Costo de generación de imágenes por onboarding (bajo, pero real).', 'Derechos: dejar claro que el logo generado es del negocio y no usar marcas parecidas.'],
    esfuerzo: 4,
    impacto: 5,
    toca: ['Orbi (wizard)', 'Onboarding', 'Apariencia', 'Plantillas', 'Dominios'],
  },
  {
    id: 'recupera',
    numero: 14,
    grupo: 'con-orbi',
    nombre: 'Orbi Recupera',
    tagline: 'Carritos abandonados, turnos sin confirmar y clientes que no vuelven: Orbi les escribe y los trae de vuelta.',
    emoji: '🪃',
    color: '#4ADE80',
    resumen:
      'Cada día se pierden ventas que estaban a un paso: el carrito que quedó a medias, el turno que nadie confirmó, el cliente que no compra hace dos meses. Orbi los detecta y conversa por WhatsApp con la voz del negocio: "Hola Sofi, te quedaron las botas en el carrito, ¿te las guardo hasta mañana?", "Juan, ¿tu turno del jueves sigue en pie? Si no, tengo el viernes a las 5". Si el cliente responde, Orbi resuelve: cambia el turno, aplica un envío gratis, arma el link de pago. El dueño ve cuánto recuperó y solo interviene si quiere.',
    porQueUnico:
      'Los mails de carrito abandonado existen hace quince años y nadie los lee. Lo distinto es que sea una conversación de ida y vuelta por WhatsApp, que Orbi tenga permiso para resolver (reprogramar, ofrecer, cobrar) y que cubra a la vez ventas y turnos, que en Órbita conviven.',
    porQueOrbita:
      'Órbita sabe qué carritos quedaron, qué turnos no se confirmaron y quién dejó de venir, y ya tiene mensajería y recordatorios por WhatsApp. Orbi ya opera pedidos y descuentos por herramientas. Recupera es darle iniciativa sobre los clientes que se están yendo.',
    pasos: [
      { titulo: 'Detecta la fuga', detalle: 'Carrito con más de 1 hora, turno sin confirmar a 24 hs, cliente 60 días sin comprar. Umbrales configurables.' },
      { titulo: 'Escribe con la voz del negocio', detalle: 'Un mensaje corto, con nombre y contexto real. El dueño define tono y hasta dónde puede ofrecer.' },
      { titulo: 'Conversa y resuelve', detalle: 'Reprograma el turno, aplica envío gratis, manda el link de pago de Mercado Pago. Todo dentro del chat.' },
      { titulo: 'Reporta lo recuperado', detalle: '"Esta semana: 14 carritos, 6 turnos y 9 clientes recuperados = $186.000". El dueño puede leer cada conversación.' },
    ],
    riesgos: ['WhatsApp Business API tiene costos por conversación y plantillas que aprobar.', 'Riesgo de molestar: frecuencia máxima y opt-out en el primer mensaje.', 'Orbi no debe prometer lo que no puede cumplir (stock, horarios): siempre valida contra el backend.'],
    esfuerzo: 4,
    impacto: 5,
    toca: ['Orbi (WhatsApp)', 'Carrito', 'Turnos', 'Clientes', 'Descuentos', 'Mensajes'],
  },
  {
    id: 'escucha',
    numero: 15,
    grupo: 'con-orbi',
    nombre: 'Orbi Escucha',
    tagline: 'Reseñas de Google, comentarios de Instagram y mensajes: Orbi te dice qué dice la gente y responde por vos.',
    emoji: '👂',
    color: '#FDA4AF',
    resumen:
      'El dueño no tiene tiempo de leer reseñas ni de contestar comentarios, pero su reputación se decide ahí. Orbi Escucha junta todo lo que se dice del negocio (reseñas de Google, comentarios y mensajes de Instagram, consultas de la tienda) y lo convierte en un mapa: qué elogian, de qué se quejan, qué preguntan. Responde reseñas con el tono de la marca (el dueño aprueba o deja en automático), avisa cuando algo se repite ("3 quejas por demora esta semana") y saca ideas de producto de lo que la gente pide.',
    porQueUnico:
      'Las herramientas de "social listening" son para marcas grandes y cuestan cientos de dólares. Para la peluquería o la dietética no existe nada: leen las reseñas cuando pueden. Acá es una pestaña más del panel, conectada a las ventas reales ("los que se quejaron de la demora compraron entre las 19 y las 21").',
    porQueOrbita:
      'Órbita ya tiene Mensajes y Clientes, y la reputación afecta directo a las ventas y a los turnos. Orbi ya habla con el tono del negocio. Escucha cierra el círculo entre lo que la gente dice y lo que el dueño hace, y alimenta al Radar de Deseos y al Piloto Automático.',
    pasos: [
      { titulo: 'Conectar fuentes', detalle: 'Google Business Profile e Instagram con OAuth. Los mensajes de la tienda ya están.' },
      { titulo: 'Orbi clasifica', detalle: 'Cada reseña o comentario cae en un tema (atención, precio, demora, producto, local) con sentimiento y urgencia.' },
      { titulo: 'Responde y alerta', detalle: 'Borradores de respuesta con el tono de la marca; automático para las positivas, aprobación para las negativas. Alertas cuando un tema se repite.' },
      { titulo: 'Convierte en acción', detalle: '"Piden envío a Zona Sur": lo manda al Radar. "Elogian a Mica": sugiere destacarla en la tienda.' },
    ],
    riesgos: ['Las APIs de Google e Instagram tienen límites y revisiones de app.', 'Responder reseñas negativas en automático es riesgoso: por defecto siempre con aprobación.', 'Clasificación errada de sarcasmo o jerga: mostrar la reseña original siempre al lado.'],
    esfuerzo: 3,
    impacto: 4,
    toca: ['Orbi (panel)', 'Mensajes', 'Clientes', 'Integraciones', 'Reportes'],
  },
  {
    id: 'cuentas-claras',
    numero: 16,
    grupo: 'con-orbi',
    nombre: 'Cuentas Claras',
    tagline: 'Orbi te dice cuánto apartar para el monotributo, si te pasás de categoría y qué mandarle al contador.',
    emoji: '🧾',
    color: '#FCD34D',
    resumen:
      'El dueño de un negocio chico en Argentina vive con miedo a la AFIP y no entiende qué le pide el contador. Cuentas Claras lee las ventas reales de Órbita (tienda, POS, Mercado Pago) y responde en criollo: "Este mes facturaste $2.1M; apartá $310.000 para impuestos y monotributo", "A este ritmo te pasás de la categoría F en octubre: te conviene recategorizar", "Tu contador necesita esto: bajalo acá". Con un semáforo mensual y alertas antes de las fechas de vencimiento.',
    porQueUnico:
      'Los sistemas de facturación te hacen la factura, y las apps de finanzas te muestran gráficos. Ninguno te habla como un contador amigo que ya vio tus ventas, y ninguno está adentro de donde se produce la venta. Es un problema 100% argentino, con reglas que cambian cada año: justo lo que un modelo con contexto puede explicar mejor que una tabla.',
    porQueOrbita:
      'Órbita tiene todas las ventas del negocio en un solo lugar (online, mostrador, MP), ya maneja IVA configurable en pagos, y Orbi ya lee reportes. Cuentas Claras es Reportes mirado con ojos de contador, y es una razón enorme para que el dueño cargue todo en Órbita.',
    pasos: [
      { titulo: 'Configurar una vez', detalle: 'Monotributo o responsable inscripto, categoría actual, provincia (ingresos brutos). Orbi lo pregunta en lenguaje simple.' },
      { titulo: 'Semáforo mensual', detalle: 'Facturado, cuánto apartar, cuánto queda de margen de categoría, próximos vencimientos. En pesos, sin jerga.' },
      { titulo: 'Preguntale lo que sea', detalle: '"¿Qué pasa si vendo $500.000 más?", "¿me conviene ser RI?". Orbi responde con los números del negocio y aclara cuándo hay que consultar al contador.' },
      { titulo: 'Carpeta para el contador', detalle: 'Un botón arma el resumen mensual (ventas por medio de pago, IVA, comprobantes) y lo manda por mail.' },
    ],
    riesgos: ['Responsabilidad: Orbi orienta, no reemplaza al contador. Disclaimers claros y tablas de categorías actualizadas por el equipo.', 'Las escalas del monotributo cambian: necesitan mantenimiento (o una fuente oficial parseada).', 'Datos incompletos si el dueño vende por fuera de Órbita: pedir el "otros ingresos" mensual.'],
    esfuerzo: 3,
    impacto: 5,
    toca: ['Orbi (panel)', 'Reportes', 'Pagos', 'POS', 'Configuración'],
  },
]

export function propuestaPorId(id: string): Propuesta | undefined {
  return PROPUESTAS.find(p => p.id === id)
}

export const GRUPOS: Record<Grupo, { titulo: string; sub: string; color: string }> = {
  'sin-orbi': { titulo: 'Sin Orbi', sub: 'Producto puro: mecánicas nuevas que nadie tiene.', color: '#3B82F6' },
  'con-orbi': { titulo: 'Con Orbi', sub: 'La IA como protagonista: Orbi con iniciativa, voz y criterio.', color: '#8B5CF6' },
}
