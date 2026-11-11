// ─── Datos inventados de Nébula Moda: reseñas y mensajes ────────────────────
//
// Los clientes, ciudades y transportes son los mismos de Nébula Tech
// (../datos.ts): personas inventadas, sin relación con ningún producto.
import type { ConversacionDemo } from '../tienda';

// Reseñas por categoría (el texto no nombra el producto: sirve para cualquiera de la categoría).
export const RESENAS_MODA: Record<string, string[]> = {
  calzado: [
    'Calzan perfecto, pedí mi número de siempre y me quedaron bien. Comodísimas desde el primer día.',
    'Muy buena calidad, la suela es firme y no hacen ruido. Llegaron en dos días.',
    'Las uso todos los días para ir a trabajar. Recomendables.',
    'Hermosas, mejor que en las fotos. El empaque impecable.',
    'Tuve que cambiar el talle y fue rapidísimo. Atención de diez.',
  ],
  remeras: [
    'La tela es suave y no se deformó después de varios lavados.',
    'El calce es tal cual la tabla de talles. Ya pedí otra en otro color.',
    'Muy buena calidad para el precio. Llegó bien doblada y en bolsa.',
    'Me encantó el color, igual a la foto.',
  ],
  abrigos: [
    'Abriga un montón y es liviano. Ideal para el invierno.',
    'Tal cual la descripción. Me asesoraron con el talle por mensaje y acerté.',
    'Excelente terminación, las costuras son muy prolijas.',
    'Lo uso todos los días. Volvería a comprar.',
  ],
  pantalones: [
    'Me quedó perfecto de largo y de cintura. El jean tiene buen elastizado.',
    'Muy cómodo y la tela se nota de calidad.',
    'Llegó al día siguiente a Rosario. Muy conforme.',
  ],
  vestidos: [
    'Divino, la tela cae muy lindo. Lo usé para un casamiento y me llenaron de elogios.',
    'Fresco y cómodo para el verano. El talle es exacto.',
    'Hermoso color y muy buena terminación.',
  ],
  accesorios: [
    'Muy lindo y de buena calidad. Lo compré para regalar y fue un éxito.',
    'Tal cual las fotos, llegó rápido y bien embalado.',
    'Práctico y resistente, lo uso todos los días.',
    'Excelente relación precio-calidad.',
  ],
};

// Conversaciones de la bandeja de Mensajes. `cliente` = índice en la lista de
// clientes sembrados (-1 = el Invitado, con el que entra el visitante a la tienda).
export const CONVERSACIONES_MODA: ConversacionDemo[] = [
  {
    cliente: 3, haceHoras: 2, sinLeer: true,
    mensajes: [
      ['CUSTOMER', 'Hola! Las zapatillas de lona calzan normal o conviene pedir un número más?'],
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
      ['CUSTOMER', 'Hola, el jean recto tiene elastano? Busco uno que no apriete.'],
      ['STORE', '¡Hola! Sí, tiene 2 % de elastano: es cómodo pero mantiene la forma. Si estás entre dos talles, te recomendamos el más grande.'],
      ['CUSTOMER', 'Buenísimo, gracias!'],
      ['STORE', '¡De nada! Cualquier otra duda escribinos.'],
    ],
  },
  {
    cliente: 18, haceHoras: 50, sinLeer: false,
    mensajes: [
      ['CUSTOMER', 'Me llegó el pedido, todo perfecto. Gracias por la atención!'],
      ['STORE', '¡Qué bueno! Gracias a vos por elegirnos. Si podés, dejanos una reseña en el producto 🙌'],
    ],
  },
  {
    cliente: 24, haceHoras: 75, sinLeer: false,
    mensajes: [
      ['CUSTOMER', 'Hola, puedo cambiar el buzo por un talle más grande?'],
      ['STORE', '¡Hola! Sí, tenés 30 días para cambiarlo. Desde Mi cuenta → Mis pedidos pedís el cambio y te pasamos la etiqueta de envío.'],
      ['CUSTOMER', 'Perfecto. Hay stock del L en gris?'],
      ['STORE', 'Sí, hay stock en gris y en negro.'],
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
      ['STORE', '¡Hola! Gracias por elegir Nébula Moda. Si tenés dudas con un talle o con tus pedidos, escribinos por acá.'],
      ['STORE', 'Tip de la demo: así le llegan las consultas al dueño. Para verlo del otro lado, abrí "Ver el panel" en la franja de arriba.'],
    ],
  },
];
