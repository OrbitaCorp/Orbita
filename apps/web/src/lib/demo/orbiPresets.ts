// ─── Orbi en la demo pública: respuestas prearmadas ─────────────────────────
//
// En la demo (demo.orbita.site/panel) Orbi NO habla con el modelo: cada
// mensaje a Orbi son llamadas pagas, y cualquiera con el token anónimo de la
// demo podía gastarlas. El visitante elige una pregunta de esta lista y Orbi
// "contesta" con el texto de acá, escrito de a poco como si lo estuviera
// pensando. Todo pasa en el navegador: no hay ninguna llamada a la API.
//
// Del lado del servidor, /orbi/chat le responde 403 al visitante de la demo
// (ver MENSAJE_ORBI_DEMO en la API): esta lista no es la única barrera.
//
// Las respuestas evitan cifras que se desactualicen (las fechas de los datos
// sembrados de la demo se desplazan solas) y no prometen nada que la demo no
// muestre. El dueño real que cura la demo entra con su login y usa el Orbi de
// verdad: esto solo aplica al visitante anónimo (esVisitanteDemo).

export interface PresetDemo {
  id: string
  /** Lo que dice el botón y lo que "escribe" el visitante. */
  pregunta: string
  /**
   * La herramienta que Orbi "usa" mientras piensa: de ahí sale la frase
   * ("Consultando ventas") que se muestra antes de escribir. Tiene que ser
   * una de FRASES (modules/orbi/estado/actividad.ts); en las preguntas de
   * cupón es la consulta previa (los descuentos que ya hay), no la tarjeta.
   */
  tool: string
  /**
   * Lo que dice la fila de la consulta al terminar, con el formato que manda el
   * servidor ("Manual: Cargar un producto"). Opcional: sin cifras inventadas.
   */
  resultado?: string
  /** Con **negrita** en markdown, como las respuestas reales. */
  respuesta: string
  /** Si la pregunta termina en una propuesta con botón Confirmar. */
  accion?: {
    tool: string
    /** Texto plano: la tarjeta no interpreta markdown. */
    resumen: string
    /** Lo que se lee si la persona aprieta Confirmar: nada se guarda. */
    alConfirmar: string
  }
}

export const PRESETS_DEMO: readonly PresetDemo[] = [
  {
    id: 'ventas',
    pregunta: '¿Cómo van mis ventas?',
    tool: 'getSalesReport',
    respuesta:
      'Revisé las ventas de **Nébula Tech** de los últimos 30 días: vienen **en alza** frente al período anterior y el ticket promedio se mantiene estable.\n\n' +
      'Lo que más movimiento tiene son los **celulares** y los **accesorios**. Si querés ver el detalle por día o por producto, lo tenés en Reportes.',
  },
  {
    id: 'mas-vendidos',
    pregunta: '¿Qué productos se venden más?',
    tool: 'getProductReport',
    respuesta:
      'Mirando tus pedidos, lo que más sale son los **accesorios** (cargadores, fundas y auriculares), seguidos por los **celulares**.\n\n' +
      'Un dato útil: los accesorios suelen venderse en el mismo pedido que un celular. Un descuento por combo puede subirte el ticket promedio. Pedime uno y te lo dejo armado para que lo confirmes.',
  },
  {
    id: 'pedidos',
    pregunta: '¿Tengo pedidos pendientes?',
    tool: 'listOrders',
    respuesta:
      'Revisé tus pedidos: los que están **pendientes de preparar o de despacho** aparecen primero en la sección Pedidos, con su estado y su medio de pago.\n\n' +
      'Cuando uno ya salió, decime «marcá el pedido como enviado» y te preparo el cambio para que lo confirmes.',
  },
  {
    id: 'descripcion',
    pregunta: 'Escribime una descripción para unos auriculares',
    tool: 'generateDescription',
    respuesta:
      'Dale. Para unos auriculares inalámbricos te propongo esto:\n\n' +
      '**Auriculares inalámbricos con cancelación de ruido**\n' +
      'Sonido nítido, batería para todo el día y carga rápida. Se conectan en segundos al celular y vienen con estuche de carga. Ideales para el trabajo, el gimnasio y los viajes.\n\n' +
      'Si cargás el producto con una foto, la reconozco y completo yo el nombre, la categoría y la descripción.',
  },
  {
    id: 'cargar-producto',
    pregunta: '¿Cómo cargo un producto nuevo?',
    tool: 'leerTemaDelManual',
    resultado: 'Manual: Cargar un producto',
    respuesta:
      'Cargar un producto es rápido:\n\n' +
      '1. Entrá a **Productos** y tocá **Crear producto**.\n' +
      '2. Subí la foto: puedo reconocerla y completar el nombre y la descripción.\n' +
      '3. Poné el precio y el stock.\n' +
      '4. Guardá, y ya aparece en tu tienda.\n\n' +
      'También me lo podés pedir a mí y lo dejo armado para que lo revises.',
  },
  {
    id: 'cupon-finde',
    pregunta: 'Creá un cupón del 10% para el finde',
    tool: 'listDiscounts',
    respuesta: 'Listo, te armé el cupón. Revisalo y confirmalo para activarlo:',
    accion: {
      tool: 'createCoupon',
      resumen: 'Crear el cupón FINDE10: 10% de descuento en toda la tienda, válido el fin de semana.',
      alConfirmar:
        'Así quedaría el cupón FINDE10 en tu tienda. En la demo no se guarda nada: en tu negocio, al confirmar queda activo.',
    },
  },
  {
    id: 'cupon-envio',
    pregunta: 'Armame un cupón de envío gratis',
    tool: 'listDiscounts',
    respuesta:
      'Dale. Para incentivar compras más grandes te propongo un cupón de **envío gratis** a partir de cierto monto. Confirmalo para activarlo:',
    accion: {
      tool: 'createCoupon',
      resumen: 'Crear el cupón ENVIOGRATIS: envío sin cargo en compras grandes, durante 7 días.',
      alConfirmar:
        'Así quedaría el cupón ENVIOGRATIS en tu tienda. En la demo no se guarda nada: en tu negocio, al confirmar queda activo.',
    },
  },
]

/** La línea que va debajo de los botones. */
export const LINEA_EJEMPLOS_DEMO = 'Respuestas de ejemplo de la demo'

/** Lo que dice la pantalla vacía de Orbi en la demo (no hay caja de texto). */
export const TEXTO_VACIO_DEMO = 'Elegí una pregunta de abajo y te muestro cómo te ayudo con tu negocio.'

/** Encabezado de la tarjeta cuando se aprieta Confirmar: nada se aplica. */
export const TITULO_ACCION_DEMO = 'En la demo no se aplica'

// Cuánto "piensa" antes de escribir y cuánto tarda cada tramo de la respuesta.
export const PENSANDO_MS = 1100
export const PASO_MS = 32
/** Palabras por tramo: parecido a como llegan los tokens del modelo. */
const PALABRAS_POR_TRAMO = 2

/** Las acciones de la demo llevan este prefijo en su actionId: nunca viajan a la API. */
export const PREFIJO_ACCION_DEMO = 'demo:'

export function actionIdDemo(presetId: string): string {
  return `${PREFIJO_ACCION_DEMO}${presetId}`
}

export function esAccionDemo(actionId: string | undefined): boolean {
  return typeof actionId === 'string' && actionId.startsWith(PREFIJO_ACCION_DEMO)
}

export function presetDeAccion(actionId: string | undefined): PresetDemo | undefined {
  if (!esAccionDemo(actionId)) return undefined
  const id = actionId!.slice(PREFIJO_ACCION_DEMO.length)
  return PRESETS_DEMO.find(p => p.id === id)
}

/**
 * Parte la respuesta en tramos chicos, que al unirlos devuelven el texto
 * exacto (con sus saltos de línea): es lo que se va escribiendo en la burbuja.
 */
export function tramosDeRespuesta(texto: string): string[] {
  const piezas = texto.match(/\s+|\S+/g) ?? []
  const tramos: string[] = []
  let actual = ''
  let palabras = 0
  for (const pieza of piezas) {
    actual += pieza
    if (!/^\s+$/.test(pieza)) palabras += 1
    if (palabras >= PALABRAS_POR_TRAMO) {
      tramos.push(actual)
      actual = ''
      palabras = 0
    }
  }
  if (actual) tramos.push(actual)
  return tramos
}
