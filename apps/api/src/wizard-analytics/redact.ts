// Redacción de datos personales ANTES de escribir en la base.
//
// De lo que la gente tipea en el formulario del wizard no se guarda una sola
// letra (solo metadatos: qué campo, cuánto tardó, si dio error). Pero de lo
// que le PREGUNTA a Orbi sí se guarda el texto — es la única forma de saber
// qué no se entiende del onboarding. Como esa gente no tiene cuenta ni aceptó
// nada, el texto pasa primero por acá: emails, teléfonos, URLs y documentos
// quedan reemplazados por un marcador, y lo que sobrevive es la pregunta.
//
// El orden de las reglas importa: un email contiene algo que parece un
// dominio, y un CUIT contiene algo que parece un teléfono. Va de lo más
// específico a lo más general.

const MAX_LEN = 2000;

const REGLAS: [RegExp, string][] = [
  // 1. Emails primero: adentro tienen un dominio que la regla de URL se comería.
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],

  // 2. URLs: con protocolo, con www, o un dominio pelado de los que se usan acá.
  [/\b(?:https?:\/\/|www\.)\S+/gi, '[url]'],
  [/\b[a-z0-9-]+\.(?:com|ar|net|org|io|site|shop|store|app|dev)(?:\.[a-z]{2,3})?(?:\/\S*)?/gi, '[url]'],

  // 3. Documentos y tarjetas antes que teléfono: un CUIT con guiones también
  //    matchea el patrón de teléfono, y queremos que gane la etiqueta correcta.
  [/\b\d{2}-\d{8}-\d\b|\b\d{11,16}\b/g, '[num]'],

  // 4. Teléfonos: 8+ dígitos admitiendo espacios, guiones y paréntesis.
  [/\+?\d[\d\s\-().]{6,}\d/g, '[tel]'],
];

export function redact(text: string): string {
  if (!text) return '';

  let out = text;
  for (const [re, reemplazo] of REGLAS) out = out.replace(re, reemplazo);

  // Cortar: una respuesta de Orbi puede ser larguísima y no aporta nada
  // guardarla entera — para clasificar el tema alcanza y sobra con esto.
  return out.length > MAX_LEN ? `${out.slice(0, MAX_LEN)}…` : out;
}
