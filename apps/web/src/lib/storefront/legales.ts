// Documentos legales del storefront: Términos y Condiciones de Compra y
// Política de Privacidad, de cada Comercio hacia sus clientes.
//
// El TEXTO es el de las plantillas que dejó Ale en docs/legales/ (08/09/2026),
// tal cual — acá no se redacta nada: solo se completan las variables
// {{ }} con los datos que ya tiene cada tienda (nombre, email, WhatsApp,
// medios de pago, envíos). Si alguna vez hay que cambiar una palabra del
// texto, se cambia en la plantilla de docs/legales/ Y acá, y se corre la
// fecha de actualización.
//
// Lo que las plantillas marcaban como "nota interna" o como ejemplo entre
// paréntesis no se publica: era guía para nosotros, no texto para el cliente.
//
// Variables que la plantilla pide y hoy la tienda NO tiene como dato:
//   - {{cuit_comercio}}: no hay campo de CUIT en el negocio → la frase
//     ", CUIT …" se omite. Cuando exista el campo, se enchufa acá.
//   - {{finalidad_marketing_opcional}}: no hay opt-in de marketing → el
//     punto se omite (la plantilla ya decía que va solo si está habilitado).
//   - {{politica_de_cambios_comercial}}: no hay campo propio → va un texto
//     neutro que remite al contacto del Comercio, sin inventar plazos.

import type { StorefrontConfigResponse } from './api'

export type TipoDocumentoLegal = 'terminos' | 'privacidad'

export type BloqueLegal =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; items: string[] }

export type SeccionLegal = { titulo: string; bloques: BloqueLegal[] }

export type DocumentoLegal = {
  titulo: string
  actualizado: string
  secciones: SeccionLegal[]
}

// Fecha de la versión del texto (no de la visita): cambia cuando cambia la
// plantilla.
export const FECHA_ACTUALIZACION_LEGALES = '8 de septiembre de 2026'

// Lo que se completa en las plantillas. Se arma con `datosLegalesDe()` a
// partir de la config pública de la tienda; se expone para poder probarlo.
export type DatosLegales = {
  nombreComercio: string
  cuit: string | null
  email: string | null
  // "WhatsApp +54 9 11 …", "Instagram @tienda", o null si no hay ninguno.
  canalAlternativo: string | null
  mediosDePago: string
  politicaEnvios: string
}

const CARRIERS: Record<string, string> = {
  CORREO_ARGENTINO: 'Correo Argentino',
  OCA: 'OCA',
  ANDREANI: 'Andreani',
  VIA_CARGO: 'Vía Cargo',
  DELIVERY_APP: 'delivery local',
  OTRO: 'otros transportistas',
}

function listar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

const fmtPesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

export function datosLegalesDe(config: StorefrontConfigResponse): DatosLegales {
  const nombreComercio = config.appearance?.storeName || config.business.name
  const email = config.contact?.email?.trim() || null

  const wpp = config.contact?.whatsapp?.trim()
  const ig = config.contact?.instagram?.trim()
  const canalAlternativo = wpp
    ? `WhatsApp (${wpp})`
    : ig
      ? `Instagram (${ig.startsWith('@') || ig.startsWith('http') ? ig : `@${ig}`})`
      : null

  const pago = config.payment
  const medios: string[] = []
  if (pago?.acceptsMercadopago) medios.push('Mercado Pago')
  if (pago?.acceptsTransfer) medios.push('transferencia bancaria')
  if (pago?.acceptsCash) medios.push(pago.acceptsPickup ? 'efectivo con retiro en el local' : 'efectivo')
  const mediosDePago = medios.length ? listar(medios) : 'los medios de pago indicados al finalizar la compra'

  // Envíos: si el Comercio escribió su política, va la suya; si no, se arma
  // con lo que tiene configurado (transportistas, envío gratis, retiro).
  const envio = config.shipping
  let politicaEnvios = envio?.shippingPolicy?.trim() || ''
  if (!politicaEnvios) {
    const partes: string[] = []
    const carriers = (envio?.enabledCarriers ?? []).map((c) => CARRIERS[c] ?? c)
    if (carriers.length) partes.push(`Realizamos envíos a través de ${listar(carriers)}.`)
    if (envio?.freeShippingFrom != null && envio.freeShippingFrom > 0) partes.push(`El envío es gratis en compras desde ${fmtPesos(envio.freeShippingFrom)}.`)
    if (pago?.acceptsPickup) partes.push(pago.pickupAddress ? `También podés retirar tu compra sin cargo en ${pago.pickupAddress}.` : 'También podés retirar tu compra sin cargo en nuestro local.')
    partes.push('El costo y el tiempo estimado de entrega se informan al finalizar la compra, antes de confirmar el pedido.')
    politicaEnvios = partes.join(' ')
  }

  return { nombreComercio, cuit: null, email, canalAlternativo, mediosDePago, politicaEnvios }
}

// "{{nombre_comercio}}, CUIT {{cuit_comercio}}" → sin CUIT queda solo el nombre.
const conCuit = (d: DatosLegales) => (d.cuit ? `${d.nombreComercio}, CUIT ${d.cuit}` : d.nombreComercio)

// "…escribirnos a {{email}} o a través de {{canal}}." con los dos opcionales.
function contacto(d: DatosLegales, prefijo: string): string {
  if (d.email && d.canalAlternativo) return `${prefijo} a ${d.email} o a través de ${d.canalAlternativo}.`
  if (d.email) return `${prefijo} a ${d.email}.`
  if (d.canalAlternativo) return `${prefijo} a través de ${d.canalAlternativo}.`
  return `${prefijo} por los canales de contacto de esta tienda.`
}

export function armarTerminos(d: DatosLegales): DocumentoLegal {
  return {
    titulo: `Términos y Condiciones de Compra — ${d.nombreComercio}`,
    actualizado: FECHA_ACTUALIZACION_LEGALES,
    secciones: [
      {
        titulo: '1. Quiénes son las partes',
        bloques: [
          { tipo: 'parrafo', texto: `Esta tienda es operada por ${conCuit(d)} (en adelante, "el Comercio", "nosotros"), a través de la plataforma tecnológica Órbita. Al realizar una compra en esta tienda, aceptás estos Términos y Condiciones de Compra.` },
          { tipo: 'parrafo', texto: `Órbita es exclusivamente el proveedor de la tecnología sobre la que funciona esta tienda. La venta de los productos ofrecidos aquí es realizada directamente por ${d.nombreComercio}, quien es el único responsable frente a vos como comprador.` },
        ],
      },
      {
        titulo: '2. Precios',
        bloques: [
          { tipo: 'parrafo', texto: 'Los precios exhibidos en esta tienda están expresados en pesos argentinos e incluyen los impuestos nacionales correspondientes. Junto al precio final, se indica el precio sin impuestos nacionales conforme a la normativa vigente de exhibición de precios.' },
          { tipo: 'parrafo', texto: 'Los precios pueden ser modificados sin previo aviso, pero el precio válido para tu compra es el que figuraba al momento de confirmar el pedido.' },
        ],
      },
      {
        titulo: '3. Medios de pago',
        bloques: [{ tipo: 'parrafo', texto: `Esta tienda acepta los siguientes medios de pago: ${d.mediosDePago}.` }],
      },
      {
        titulo: '4. Proceso de compra',
        bloques: [{ tipo: 'parrafo', texto: 'Tu pedido se considera confirmado una vez que recibís la confirmación correspondiente por parte del Comercio. El Comercio podrá actualizar el estado de tu pedido (pendiente, confirmado, enviado, entregado, etc.), y recibirás una notificación ante cada cambio de estado.' }],
      },
      {
        titulo: '5. Envíos',
        bloques: [{ tipo: 'parrafo', texto: d.politicaEnvios }],
      },
      {
        titulo: '6. Derecho de arrepentimiento',
        bloques: [
          { tipo: 'parrafo', texto: 'Si realizaste tu compra a distancia (a través de esta tienda online), tenés derecho a revocar la aceptación de tu compra dentro de los 10 (diez) días corridos desde que recibiste el producto, sin necesidad de justificar tu decisión y sin costo alguno, conforme al artículo 34 de la Ley N.º 24.240 y a la normativa vigente sobre botón de arrepentimiento.' },
          { tipo: 'parrafo', texto: 'Para ejercer este derecho, podés usar el botón de "Arrepentimiento / Devolución" disponible en esta tienda. Al enviar tu solicitud, vas a recibir un número de trámite de forma inmediata.' },
          { tipo: 'lista', items: [
            'No es necesario que te registres ni realices ningún trámite adicional para usar este derecho.',
            'Los gastos de devolución del producto corren por cuenta del Comercio.',
            'Tenés derecho a que se te reintegre el dinero abonado. El Comercio puede ofrecerte una nota de crédito como alternativa, pero vos podés rechazarla y pedir el reintegro de tu dinero.',
            'Si tu pedido ya fue despachado al momento de tu solicitud, el reintegro se procesará una vez que el Comercio recupere el producto (ya sea porque se intercepta el envío o porque lo devolvés tras recibirlo).',
          ] },
        ],
      },
      {
        titulo: '7. Garantía legal por defectos',
        bloques: [
          { tipo: 'parrafo', texto: 'Si el producto que recibiste presenta un defecto de fabricación, contás con la garantía legal establecida por la Ley N.º 24.240, con una vigencia mínima de 6 (seis) meses desde la entrega. Podés solicitarla a través del mismo botón de "Arrepentimiento / Devolución", indicando el motivo correspondiente.' },
          { tipo: 'parrafo', texto: 'Ante un defecto confirmado, tenés derecho a elegir entre:' },
          { tipo: 'lista', items: [
            'La reparación del producto sin cargo.',
            'Su cambio por otro de idénticas características.',
            'La devolución del dinero abonado.',
          ] },
          { tipo: 'parrafo', texto: 'Los gastos que demande la garantía corren por cuenta del Comercio.' },
        ],
      },
      {
        titulo: '8. Cambios y devoluciones por otros motivos',
        bloques: [{ tipo: 'parrafo', texto: contacto(d, 'Para cambios por otros motivos (por ejemplo, talle o color), fuera del plazo de arrepentimiento y sin defecto, comunicate con el Comercio para coordinarlos') }],
      },
      {
        titulo: '9. Datos personales',
        bloques: [{ tipo: 'parrafo', texto: 'El tratamiento de tus datos personales al comprar en esta tienda se rige por nuestra Política de Privacidad.' }],
      },
      {
        titulo: '10. Ley aplicable',
        bloques: [{ tipo: 'parrafo', texto: 'Estas condiciones se rigen por las leyes de la República Argentina, en particular por la Ley N.º 24.240 de Defensa del Consumidor.' }],
      },
      {
        titulo: '11. Contacto',
        bloques: [{ tipo: 'parrafo', texto: contacto(d, 'Ante cualquier consulta, podés escribirnos') }],
      },
    ],
  }
}

export function armarPrivacidad(d: DatosLegales): DocumentoLegal {
  return {
    titulo: `Política de Privacidad de ${d.nombreComercio}`,
    actualizado: FECHA_ACTUALIZACION_LEGALES,
    secciones: [
      {
        titulo: '1. Quién es responsable de tus datos',
        bloques: [
          { tipo: 'parrafo', texto: `Esta tienda es operada por ${conCuit(d)}${d.email ? `, con contacto en ${d.email}` : ''} (en adelante, "nosotros", "el Comercio"). Somos los responsables del tratamiento de los datos personales que nos brindás al comprar o interactuar con esta tienda, conforme a la Ley N.º 25.326 de Protección de Datos Personales.` },
          { tipo: 'parrafo', texto: 'Esta tienda funciona sobre la plataforma tecnológica Órbita, que aloja y procesa estos datos por nuestra cuenta y orden, en su carácter de encargado del tratamiento.' },
        ],
      },
      {
        titulo: '2. Qué datos recolectamos',
        bloques: [
          { tipo: 'parrafo', texto: 'Cuando comprás o te contactás con nosotros a través de esta tienda, podemos recolectar:' },
          { tipo: 'lista', items: [
            'Nombre y apellido.',
            'Dirección de entrega.',
            'Teléfono y/o email de contacto.',
            'Historial de pedidos y compras.',
            'Datos de facturación, cuando corresponda.',
          ] },
          { tipo: 'parrafo', texto: 'No recolectamos ni almacenamos los datos completos de tu tarjeta de crédito o débito. El pago se procesa directamente a través de Mercado Pago (u otro medio de pago habilitado en esta tienda), conforme a sus propios términos y medidas de seguridad.' },
        ],
      },
      {
        titulo: '3. Para qué usamos tus datos',
        bloques: [
          { tipo: 'lista', items: [
            'Procesar y gestionar tu pedido (confirmación, envío, facturación).',
            'Comunicarnos con vos sobre el estado de tu compra.',
            'Atender consultas, reclamos, devoluciones o solicitudes de garantía.',
          ] },
          { tipo: 'parrafo', texto: 'No compartimos tus datos con terceros ajenos a la operación de esta tienda, salvo con los proveedores necesarios para prestar el servicio (por ejemplo, la plataforma Órbita que aloja la tienda, el servicio de pago, y la empresa de envíos cuando corresponda).' },
        ],
      },
      {
        titulo: '4. Tus derechos',
        bloques: [
          { tipo: 'parrafo', texto: contacto(d, 'Tenés derecho a acceder, rectificar, actualizar o solicitar la supresión de tus datos personales. Podés ejercer estos derechos escribiendo') },
          { tipo: 'parrafo', texto: 'La Agencia de Acceso a la Información Pública (AAIP) es el Órgano de Control de la Ley N.º 25.326 y tiene la atribución de atender denuncias y reclamos vinculados al tratamiento de tus datos personales.' },
        ],
      },
      {
        titulo: '5. Conservación de los datos',
        bloques: [{ tipo: 'parrafo', texto: 'Conservamos tus datos mientras sea necesario para cumplir con la finalidad para la que fueron recolectados y con las obligaciones legales o fiscales que nos resulten aplicables.' }],
      },
      {
        titulo: '6. Contacto',
        bloques: [{ tipo: 'parrafo', texto: contacto(d, 'Ante cualquier consulta sobre esta política o sobre tus datos personales, podés escribirnos') }],
      },
    ],
  }
}

export function armarDocumentoLegal(tipo: TipoDocumentoLegal, config: StorefrontConfigResponse): DocumentoLegal {
  const d = datosLegalesDe(config)
  return tipo === 'terminos' ? armarTerminos(d) : armarPrivacidad(d)
}
