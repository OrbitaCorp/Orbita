import type { Etapa } from './etapas';

// Un correo por etapa, escrito como lo escribe una persona: corto, en primera
// persona, con UNA pregunta al final para que sea fácil contestar. La firma de
// la casilla y el botón de WhatsApp los suma el armado del correo; acá va solo
// el texto. En el panel se editan antes de mandar, así que esto es el punto de
// partida, no un texto fijo.
//
// Variables: {nombre} (nombre de pila del dueño), {negocio}, {tienda} (su
// dirección web), {remitente} (nombre de pila de quien firma) y {vence} (fecha
// de fin del período, solo en "por vencer").

export type PlantillaSeguimiento = {
  etapa: Etapa;
  nombre: string; // cómo se llama la etapa en el panel
  cuando: string; // qué la dispara, para leerlo en el panel
  asunto: string;
  cuerpo: string;
  botonWhatsapp: string;
  mensajeWhatsapp: string; // lo que le queda escrito al cliente en el chat
};

export const PLANTILLAS: Record<Etapa, PlantillaSeguimiento> = {
  bienvenida: {
    etapa: 'bienvenida',
    nombre: 'Recién creada',
    cuando: `Se creó hace menos de 3 días y todavía no tiene productos.`,
    asunto: 'Te doy la bienvenida a Órbita, {nombre}',
    cuerpo: `Hola {nombre}:

Soy {remitente}, de Órbita. Vi que creaste {negocio} y quería presentarme: cualquier duda que tengas mientras armás la tienda, la resolvemos juntos.

El primer paso es cargar tus productos. Si los tenés en una lista de Excel o en fotos del celular, contame y te digo la forma más rápida.

¿Qué vas a vender?`,
    botonWhatsapp: 'Escribime por WhatsApp',
    mensajeWhatsapp: 'Hola {remitente}, soy {nombre} de {negocio}. Recién arranco con la tienda y tengo una consulta:',
  },
  sin_productos: {
    etapa: 'sin_productos',
    nombre: 'Sin productos',
    cuando: 'Tiene 3 días o más y todavía no cargó ningún producto.',
    asunto: '{nombre}, ¿te ayudo a cargar los productos?',
    cuerpo: `Hola {nombre}:

Vi que {negocio} todavía no tiene productos cargados. Es el paso que más cuesta al principio, así que te ofrezco una mano.

Contame qué vendés y cómo tenés la información (una lista, fotos, un catálogo en PDF) y te digo la forma más rápida de cargarlo. Muchas veces lo resolvemos en una llamada corta.

¿Qué te frenó?`,
    botonWhatsapp: 'Pedime ayuda por WhatsApp',
    mensajeWhatsapp: 'Hola {remitente}, soy {nombre} de {negocio}. Necesito ayuda para cargar los productos.',
  },
  sin_publicar: {
    etapa: 'sin_publicar',
    nombre: 'Sin publicar',
    cuando: 'Ya tiene productos pero la tienda sigue en borrador.',
    asunto: 'Te falta poco para publicar {negocio}',
    cuerpo: `Hola {nombre}:

{negocio} ya tiene productos cargados, ¡buenísimo! Lo único que falta es publicarla para que tus clientes la puedan ver en {tienda}.

Si hay algo que te hace dudar (los precios, las fotos, los medios de pago o el envío), contame y lo vemos.

¿Qué te falta para publicarla?`,
    botonWhatsapp: 'Escribime por WhatsApp',
    mensajeWhatsapp: 'Hola {remitente}, soy {nombre} de {negocio}. Quiero publicar la tienda pero tengo una duda:',
  },
  sin_ventas: {
    etapa: 'sin_ventas',
    nombre: 'Publicada sin ventas',
    cuando: 'Está publicada y todavía no recibió ningún pedido.',
    asunto: '¿Cómo viene {negocio}?',
    cuerpo: `Hola {nombre}:

Tu tienda ya está en línea en {tienda}. Las primeras ventas suelen llegar cuando la tienda empieza a circular, así que te dejo tres ideas que les funcionaron a otros negocios:

- Poné el link en la biografía de Instagram y en tu estado de WhatsApp.
- Compartí un producto por día en tus historias, con su link.
- Mandales la tienda a tus clientes de siempre y pediles que la recomienden.

¿Querés que la miremos juntos y te diga qué mejoraría?`,
    botonWhatsapp: 'Miremos la tienda por WhatsApp',
    mensajeWhatsapp: 'Hola {remitente}, soy {nombre} de {negocio}. Me gustaría que miremos juntos la tienda.',
  },
  vendiendo: {
    etapa: 'vendiendo',
    nombre: 'Vendiendo',
    cuando: 'Ya recibió pedidos y el dueño entra seguido al panel.',
    asunto: '{nombre}, ¿cómo te está yendo?',
    cuerpo: `Hola {nombre}:

Vi que {negocio} ya está recibiendo pedidos, ¡felicitaciones! Te escribo para saber cómo te está resultando Órbita.

¿Hay algo que te complique el día a día, o algo que te gustaría que la tienda hiciera y todavía no hace? Lo que me cuentes lo usamos para mejorarla.`,
    botonWhatsapp: 'Contame por WhatsApp',
    mensajeWhatsapp: 'Hola {remitente}, soy {nombre} de {negocio}. Te cuento cómo me va con la tienda:',
  },
  se_enfrio: {
    etapa: 'se_enfrio',
    nombre: 'Se enfrió',
    cuando: 'La tienda está publicada pero el dueño no entra al panel hace más de 14 días.',
    asunto: '¿Todo bien con {negocio}?',
    cuerpo: `Hola {nombre}:

Hace un tiempo que no entrás al panel de {negocio} y quería saber si está todo bien.

Si algo no te convenció o te trabaste en algún paso, me sirve mucho saberlo: puede que tenga una solución rápida.

¿Te puedo ayudar en algo?`,
    botonWhatsapp: 'Escribime por WhatsApp',
    mensajeWhatsapp: 'Hola {remitente}, soy {nombre} de {negocio}. Te escribo por la tienda:',
  },
  por_vencer: {
    etapa: 'por_vencer',
    nombre: 'Por vencer',
    cuando: 'El período termina en 5 días o menos y no se renueva solo (cortesía o bienvenida).',
    asunto: 'El plan de {negocio} vence el {vence}',
    cuerpo: `Hola {nombre}:

Te aviso que el período actual de {negocio} vence el {vence}. Para que la tienda siga funcionando sin cortes, podés elegir tu plan desde el panel, en Configuración → Suscripción.

Si tenés dudas sobre los planes o el pago, escribime y lo vemos.`,
    botonWhatsapp: 'Consultame por WhatsApp',
    mensajeWhatsapp: 'Hola {remitente}, soy {nombre} de {negocio}. Tengo una consulta sobre el plan:',
  },
  pago_pendiente: {
    etapa: 'pago_pendiente',
    nombre: 'Pago pendiente',
    cuando: 'Un cobro falló o la suscripción quedó suspendida.',
    asunto: 'Hay un pago pendiente en {negocio}',
    cuerpo: `Hola {nombre}:

El último cobro de {negocio} no se pudo hacer. Suele pasar cuando la tarjeta venció o no tenía saldo en ese momento.

Podés actualizar el medio de pago desde el panel, en Configuración → Suscripción. Si te trabás en algún paso, escribime y lo resolvemos.`,
    botonWhatsapp: 'Escribime por WhatsApp',
    mensajeWhatsapp: 'Hola {remitente}, soy {nombre} de {negocio}. Te escribo por el pago de la suscripción:',
  },
  pausada: {
    etapa: 'pausada',
    nombre: 'Pausada',
    cuando: 'El dueño pausó la tienda: nadie la ve ni le compra.',
    asunto: '¿Volvemos a abrir {negocio}?',
    cuerpo: `Hola {nombre}:

Vi que pausaste {negocio}. Si fue por algo puntual (vacaciones, falta de stock), no hay problema: la reactivás desde el panel cuando quieras, con el botón Reactivar tienda.

Si la pausaste porque algo no funcionó como esperabas, me gustaría saberlo. ¿Qué pasó?`,
    botonWhatsapp: 'Contame por WhatsApp',
    mensajeWhatsapp: 'Hola {remitente}, soy {nombre} de {negocio}. Te cuento por qué pausé la tienda:',
  },
  baja: {
    etapa: 'baja',
    nombre: 'Dada de baja',
    cuando: 'El dueño canceló la cuenta (se puede reactivar durante 60 días).',
    asunto: 'Una pregunta sobre {negocio}',
    cuerpo: `Hola {nombre}:

Vi que diste de baja {negocio}. Lamento que no haya funcionado y no te quiero insistir: solo me sirve mucho saber qué te faltó.

¿Me contás en una línea por qué te fuiste? Lo uso para mejorar Órbita. Y si cambiás de idea, la cuenta se puede reactivar durante 60 días.`,
    botonWhatsapp: 'Contame por WhatsApp',
    mensajeWhatsapp: 'Hola {remitente}, soy {nombre} de {negocio}. Te cuento por qué di de baja la tienda:',
  },
};

export type VariablesSeguimiento = { nombre: string; negocio: string; tienda: string; remitente: string; vence: string };

// Reemplaza solo las variables conocidas: una llave que no es variable queda
// tal cual (el texto lo puede haber editado una persona).
export function rellenar(texto: string, v: VariablesSeguimiento): string {
  return texto.replace(/\{(nombre|negocio|tienda|remitente|vence)\}/g, (_, k: keyof VariablesSeguimiento) => v[k]);
}

export function nombreDePila(nombreCompleto: string | null | undefined): string {
  return (nombreCompleto ?? '').trim().split(/\s+/)[0] ?? '';
}
