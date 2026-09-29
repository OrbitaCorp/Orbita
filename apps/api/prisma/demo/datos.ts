// ─── Datos inventados de la demo: clientes, reseñas, mensajes ───────────────
//
// Todo ficticio. Los emails van a example.com (RFC 2606, nunca recibe mail) y
// además MailService no manda nada de un negocio demo.

export const NOMBRES = [
  'Lucía', 'Martín', 'Sofía', 'Joaquín', 'Valentina', 'Tomás', 'Camila', 'Mateo', 'Julieta', 'Franco',
  'Agustina', 'Nicolás', 'Florencia', 'Santiago', 'Micaela', 'Facundo', 'Catalina', 'Ignacio', 'Delfina', 'Bruno',
  'Martina', 'Lautaro', 'Paula', 'Gonzalo', 'Rocío', 'Federico', 'Milagros', 'Ezequiel', 'Carolina', 'Matías',
  'Abril', 'Leandro', 'Josefina', 'Gastón', 'Ailén', 'Emiliano', 'Victoria', 'Ramiro', 'Brenda', 'Maximiliano',
  'Luciana', 'Alejo', 'Candela', 'Diego', 'Pilar',
];

export const APELLIDOS = [
  'González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'García', 'Pérez', 'Romero', 'Sánchez', 'Díaz',
  'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Suárez',
  'Aguirre', 'Giménez', 'Gutiérrez', 'Pereyra', 'Rojas', 'Molina', 'Castro', 'Ortiz', 'Silva', 'Núñez',
];

// [ciudad, provincia, código postal, peso]: más pedidos donde más gente vive.
export const CIUDADES: [string, string, string, number][] = [
  ['Ciudad Autónoma de Buenos Aires', 'CABA', 'C1414', 10],
  ['La Plata', 'Buenos Aires', 'B1900', 3],
  ['Mar del Plata', 'Buenos Aires', 'B7600', 2],
  ['Quilmes', 'Buenos Aires', 'B1878', 2],
  ['San Isidro', 'Buenos Aires', 'B1642', 2],
  ['Córdoba', 'Córdoba', 'X5000', 4],
  ['Rosario', 'Santa Fe', 'S2000', 4],
  ['Mendoza', 'Mendoza', 'M5500', 2],
  ['San Miguel de Tucumán', 'Tucumán', 'T4000', 1],
  ['Neuquén', 'Neuquén', 'Q8300', 1],
  ['Salta', 'Salta', 'A4400', 1],
  ['Bahía Blanca', 'Buenos Aires', 'B8000', 1],
];

export const CALLES = [
  'Av. Corrientes', 'Av. Santa Fe', 'Mitre', 'San Martín', 'Belgrano', 'Rivadavia', 'Sarmiento', '9 de Julio',
  'Av. Colón', 'Urquiza', 'Moreno', 'Balcarce', 'Av. Cabildo', 'Güemes', 'Laprida', 'Av. Pellegrini',
];

export const TRANSPORTES = ['Andreani', 'OCA', 'Correo Argentino'];

// Reseñas por categoría (el texto no nombra el producto: sirve para cualquiera de la categoría).
export const RESENAS: Record<string, string[]> = {
  audio: [
    'Suenan muy bien y la batería dura muchísimo. Llegó en dos días.',
    'Excelente calidad de sonido para el precio. Los uso todos los días para trabajar.',
    'Cómodos, livianos y se conectan al toque con el celular. Recomendables.',
    'Muy buena compra. La cancelación de ruido funciona de verdad en el colectivo.',
    'Me encantaron. El empaque impecable y llegaron antes de lo esperado.',
  ],
  celulares: [
    'Carga rapidísimo, lo que prometía. Muy conforme.',
    'Buena calidad y precio justo. Llegó bien embalado.',
    'Lo compré para regalar y fue un éxito. Atención de diez.',
    'Funciona perfecto, ya es la segunda vez que compro acá.',
  ],
  computacion: [
    'Cambió mi forma de trabajar desde casa. Muy recomendable.',
    'Tal cual la descripción. Me respondieron todas las dudas por WhatsApp antes de comprar.',
    'Excelente terminación. El envío llegó en 48 horas a Córdoba.',
    'Muy buen producto, se nota la calidad. Volvería a comprar.',
  ],
  gaming: [
    'Lo uso todos los días para jugar y va perfecto. Las luces se ven bárbaras.',
    'Muy buena respuesta y cero latencia. Llegó rápido.',
    'Se lo regalé a mi hijo y no lo suelta. Gracias por la buena atención.',
    'Relación precio-calidad excelente.',
  ],
  hogar: [
    'Fácil de configurar, en cinco minutos estaba andando con el celular.',
    'Funciona muy bien, lo manejo con la voz. Ya compré otro más.',
    'Muy práctico y la app es simple. Recomendado.',
  ],
  wearables: [
    'La batería dura una semana tranquila. Muy lindo en la muñeca.',
    'Mide todo y la pantalla se ve perfecta al sol. Excelente compra.',
    'Cómodo para dormir y entrenar. Llegó al día siguiente.',
    'Muy conforme, se sincroniza al toque con el celular.',
  ],
};

// Conversaciones de la bandeja de Mensajes. `cliente` = índice en la lista de
// clientes sembrados; `haceHoras` del primer mensaje; cada mensaje suma minutos.
export const CONVERSACIONES: { cliente: number; haceHoras: number; sinLeer: boolean; mensajes: [('CUSTOMER' | 'STORE'), string][] }[] = [
  {
    cliente: 3, haceHoras: 2, sinLeer: true,
    mensajes: [
      ['CUSTOMER', 'Hola! Los auriculares Pulse vienen con estuche?'],
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
      ['CUSTOMER', 'Hola, el teclado Keys 75 sirve para Mac?'],
      ['STORE', '¡Hola! Sí, es compatible con Mac, Windows y Linux. Tiene un modo para Mac que cambia las teclas de función.'],
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
      ['CUSTOMER', 'Hola, quería saber si el smartwatch mide la presión.'],
      ['STORE', '¡Hola! Mide pulso, oxígeno en sangre y sueño. La presión arterial no, para eso recomendamos un tensiómetro.'],
      ['CUSTOMER', 'Ok, igual me interesa. Tienen la malla blanca?'],
      ['STORE', 'Sí, hay stock en blanca y en negra.'],
    ],
  },
  {
    cliente: 31, haceHoras: 120, sinLeer: false,
    mensajes: [
      ['CUSTOMER', 'Puedo pagar con transferencia?'],
      ['STORE', '¡Sí! Elegí "Transferencia" al finalizar la compra y te aparecen los datos. Apenas acreditamos el pago, preparamos el envío.'],
    ],
  },
];
