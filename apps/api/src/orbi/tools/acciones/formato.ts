// Cómo se muestran los valores en la tarjeta de confirmación (spec §3.2).
//
// La tarjeta es la última defensa contra la inyección indirecta: si un texto
// de terceros (el nombre de un cliente, una reseña) convence al modelo de
// meter un valor de más, la persona lo tiene que VER antes de confirmar. Por
// eso cada valor sale limpio y acotado: un salto de línea o unas comillas
// podrían simular que el texto terminó y que lo que sigue es parte de la
// tarjeta, y un texto de 3000 caracteres taparía el resto.

const MAX_TEXTO = 80;

/** Un valor en una línea: sin caracteres de control, sin comillas dobles, espacios colapsados. */
export function limpio(valor: unknown): string {
  return String(valor)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, ' ')
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
