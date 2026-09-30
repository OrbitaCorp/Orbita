// Cómo se muestran los valores en la tarjeta de confirmación (spec §3.2).
//
// La tarjeta es la última defensa contra la inyección indirecta: si un texto
// de terceros (el nombre de un cliente, una reseña) convence al modelo de
// meter un valor de más, la persona lo tiene que VER antes de confirmar. Por
// eso cada valor sale limpio y acotado: un salto de línea o unas comillas
// podrían simular que el texto terminó y que lo que sigue es parte de la
// tarjeta, y un texto de 3000 caracteres taparía el resto.

const MAX_TEXTO = 80;

/**
 * Un valor en una línea: sin caracteres de control ni invisibles, sin comillas
 * dobles, espacios colapsados.
 *
 * - Controles C0 y C1 (Cc) y separadores de línea/párrafo (Zl, Zp) pasan a
 *   espacio: son cortes de línea o basura, y entre dos palabras tienen que
 *   seguir separándolas.
 * - Caracteres de formato (Cf) se borran: overrides e isolates bidi
 *   (U+202A-202E, U+2066-2069), ancho cero y marcas de dirección
 *   (U+200B-200F), U+2060-2064, BOM (U+FEFF), guion blando. Un RLO sin
 *   cerrar da vuelta cómo se VE todo lo que sigue en la línea, comilla de
 *   cierre incluida, y los de ancho cero esconden texto a simple vista: la
 *   tarjeta mostraría algo distinto de lo que se escribe.
 *
 * Con clases de propiedades Unicode (flag u) y no con rangos a mano: entran
 * los que se agreguen al estándar, y el código fuente no tiene caracteres
 * invisibles literales.
 */
export function limpio(valor: unknown): string {
  return String(valor)
    .replace(/\p{Cf}/gu, '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Corta a `max` caracteres (contando emojis como uno) y marca el corte. */
export function truncado(texto: string, max = MAX_TEXTO): string {
  const letras = Array.from(texto);
  return letras.length > max ? `${letras.slice(0, max - 1).join('')}…` : texto;
}

/** Texto libre: entre comillas, en una línea y truncado a 80. */
export function entreComillas(valor: unknown): string {
  return `"${truncado(limpio(valor))}"`;
}

/** Un dato corto que no es texto libre (una fecha, un código ya validado): limpio y truncado, sin comillas. */
export function dato(valor: unknown): string {
  return truncado(limpio(valor));
}

/** Un monto tal cual llegó: sin redondear ni agrupar, para que se vea exactamente lo que se va a escribir. */
export function monto(valor: unknown): string {
  return typeof valor === 'number' && Number.isFinite(valor) ? `$${valor}` : `$${dato(valor)}`;
}

/** "1 producto" / "3 productos". */
export function cantidad(lista: unknown, singular: string, plural: string): string {
  const n = Array.isArray(lista) ? lista.length : 0;
  return `${n} ${n === 1 ? singular : plural}`;
}

/** ¿Vino el argumento? El modelo a veces manda null en los opcionales. */
export function presente(valor: unknown): boolean {
  return valor !== undefined && valor !== null;
}
