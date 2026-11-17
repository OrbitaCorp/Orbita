// ─── Datos inventados de Nébula Regalos: reseñas y mensajes ─────────────────
//
// Los clientes, ciudades y transportes son los mismos de Nébula Tech
// (../datos.ts): personas inventadas, sin relación con ningún producto.
import type { ConversacionDemo } from '../tienda';

// Reseñas por categoría (el texto no nombra el producto: sirve para cualquiera de la categoría).
export const RESENAS_REGALOS: Record<string, string[]> = {
  tazas: [
    'Hermosa, mejor que en la foto. Llegó perfectamente embalada, sin un rasguño.',
    'La uso todas las mañanas. Buen tamaño y aguanta el lavavajillas.',
    'La compré para regalar y fue un éxito total.',
    'Muy linda calidad, se nota que es cerámica buena.',
  ],
  velas: [
    'El aroma es suave y dura un montón. Ya voy por la segunda.',
    'Divina, perfuma todo el living sin ser invasiva.',
    'Llegó rapidísimo y con una notita escrita a mano. Un amor.',
    'Muy buena relación precio-calidad. Ideal para regalar.',
  ],
  peluches: [
    'Súper suave, mi hija no lo suelta. Las costuras son muy prolijas.',
    'Tal cual la foto. Llegó en una caja hermosa.',
    'Excelente calidad, se nota que no es de esos que se desarman.',
  ],
  papeleria: [
    'Las hojas son gruesas y no se traspasa la tinta. Re recomendable.',
    'Muy linda para organizarme el año. La tapa es preciosa.',
    'Llegó en dos días a Córdoba. Todo impecable.',
    'La compré para mi oficina y ya me pidieron otra para regalar.',
  ],
  deco: [
    'Queda hermoso en mi casa, mejor de lo que esperaba.',
    'Muy buena terminación. Llegó bien protegido.',
    'Lindo detalle para regalar, a todos les encanta.',
  ],
  dulces: [
    'Riquísimos, la caja es preciosa. Ideal para un cumpleaños.',
    'Llegaron frescos y en perfecto estado. Se terminaron en un día.',
    'Lo regalé para el Día del Maestro y fue un éxito.',
    'Muy ricos y la presentación es divina.',
  ],
};

// Conversaciones de la bandeja de Mensajes. `cliente` = índice en la lista de
// clientes sembrados (-1 = el Invitado, con el que entra el visitante a la tienda).
export const CONVERSACIONES_REGALOS: ConversacionDemo[] = [
  {
    cliente: 3, haceHoras: 2, sinLeer: true,
    mensajes: [
      ['CUSTOMER', 'Hola! Hacen paquete de regalo? Es para un cumpleaños el sábado.'],
    ],
  },
  {
    cliente: 7, haceHoras: 5, sinLeer: true,
    mensajes: [
      ['CUSTOMER', 'Buenas, hacen envíos a Neuquén? Cuánto tarda más o menos?'],
      ['STORE', '¡Hola! Sí, enviamos a todo el país con Andreani. A Neuquén tarda entre 3 y 5 días hábiles.'],
      ['CUSTOMER', 'Genial, y si compro hoy sale mañana?'],
    ],
  },
  {
    cliente: 12, haceHoras: 26, sinLeer: false,
    mensajes: [
      ['CUSTOMER', 'Hola, la vela de soja de cuánto dura?'],
      ['STORE', '¡Hola! Unas 40 horas de uso. La primera vez dejala prendida hasta que se derrita toda la superficie, así se consume pareja.'],
      ['CUSTOMER', 'Buenísimo, gracias!'],
      ['STORE', '¡De nada! Cualquier otra duda escribinos.'],
    ],
  },
  {
    cliente: 18, haceHoras: 50, sinLeer: false,
    mensajes: [
      ['CUSTOMER', 'Me llegó el pedido, todo perfecto. Gracias por la notita!'],
      ['STORE', '¡Qué bueno! Gracias a vos por elegirnos. Si podés, dejanos una reseña en el producto 🙌'],
    ],
  },
  {
    cliente: 24, haceHoras: 75, sinLeer: false,
    mensajes: [
      ['CUSTOMER', 'Hola, la caja de bombones tiene TACC?'],
      ['STORE', '¡Hola! Los bombones son sin TACC, pero se elaboran en una cocina donde también hay harina. Si es por celiaquía, mejor elegí otra opción.'],
      ['CUSTOMER', 'Ok, gracias por avisar. Entonces llevo la taza y la vela.'],
    ],
  },
  {
    cliente: 31, haceHoras: 120, sinLeer: false,
    mensajes: [
      ['CUSTOMER', 'Puedo pagar con transferencia?'],
      ['STORE', '¡Sí! Elegí "Transferencia" al finalizar la compra y te aparecen los datos. Apenas acreditamos el pago, preparamos el envío.'],
    ],
  },
  // El hilo del Invitado (Mi cuenta → Mensajes). El panel de la demo es el de
  // Nébula Tech, así que el tip lleva allá.
  {
    cliente: -1, haceHoras: 3, sinLeer: false,
    mensajes: [
      ['STORE', '¡Hola! Gracias por elegir Nébula Regalos. Si querés que armemos un paquete o agreguemos una tarjeta, escribinos por acá.'],
      ['STORE', 'Tip de la demo: así le llegan las consultas al dueño. Para verlo del otro lado, abrí "Ver el panel" en la franja de arriba.'],
    ],
  },
];
