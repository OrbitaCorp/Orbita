/**
 * Las reglas que una respuesta de Orbi tiene que cumplir sí o sí.
 *
 * Son deterministas a propósito: no hay ningún LLM juzgando acá. Un juez-LLM
 * cuesta plata, tarda, y encima es no determinista — justo lo que no querés en
 * la parte de la evaluación que tiene que ser confiable. Para "¿el tono está
 * bien?" hace falta criterio; para "¿inventó una opción que no existe?" no,
 * alcanza con mirar la lista.
 *
 * La regla de fugas (sinFugasDeHerramientas) es cleanToolLeaks convertido en
 * test. Hoy el front tapa esas fugas con nueve regex en OrbiMessages.tsx: el
 * usuario no las ve, pero tampoco las ve nadie — con lo cual nunca supimos la
 * tasa real. Acá se miden en vez de taparse.
 *
 * Este archivo es código común, no un script suelto: lo cubre su propio
 * .unit-spec.ts y por lo tanto lo corre el CI, aunque las evals en sí (que
 * llaman a Groq de verdad) se corran a mano.
 */

import type { Expectativa } from './casos';

export type LlamadaAHerramienta = {
  name: string;
  arguments: Record<string, unknown>;
};

/** Lo que devolvió el modelo en un turno. */
export type TurnoDeOrbi = {
  texto: string;
  toolCalls: LlamadaAHerramienta[];
};

/** El escenario en el que se le preguntó. */
export type EscenarioDelCaso = {
  stepName: string;
  /** Las opciones reales del paso, tal como se le inyectaron al prompt. */
  availableOptions?: { key: string; label: string }[];
  /** Las tools que el registry habilita para ese paso. */
  toolsAutorizadas: string[];
  /** Tope de caracteres del texto. Por defecto TOPE_DE_LARGO_POR_DEFECTO. */
  topeDeLargo?: number;
};

export type Violacion = {
  regla: string;
  detalle: string;
};

export const TOPE_DE_LARGO_POR_DEFECTO = 700;

/** Los nombres de tools no tienen por qué aparecer NUNCA en el texto visible. */
const NOMBRES_DE_TOOLS = [
  'selectWizardOption',
  'fillWizardField',
  'suggestBusinessName',
  'suggestDescription',
  'navigateTo',
];

// Una etiqueta con forma de HTML/XML/JSX: "<div", "</p>", "<Boton x=1 />".
// Pide una letra después del "<" justamente para no comerse un "<3" ni un
// "5 < 7" escritos en prosa.
const ETIQUETA = /<\/?[a-zA-Z][\w-]*(?:\s[^>]*)?\/?>/;

// Un bloque de código con backticks, con o sin lenguaje.
const BLOQUE_DE_CODIGO = /```/;

// Un placeholder de template que se filtró sin resolver ({{options}}).
const PLACEHOLDER = /\{\{\s*[a-zA-Z_]\w*\s*\}\}/;

/**
 * Regla 1 — el texto que ve el usuario es texto, no sintaxis.
 *
 * El usuario nunca ve una tool call: ve un botón. Si en el texto aparece una
 * llave, una etiqueta o el nombre de una función, el modelo escribió como
 * texto algo que tendría que haber sido una llamada real.
 */
export function sinFugasDeHerramientas(turno: TurnoDeOrbi): Violacion[] {
  const violaciones: Violacion[] = [];
  const t = turno.texto;

  if (t.includes('{') || t.includes('}')) {
    violaciones.push({
      regla: 'sin-fugas',
      detalle: `El texto tiene llaves (JSON escrito como texto): ${recorte(t, /[{}]/)}`,
    });
  }

  const etiqueta = ETIQUETA.exec(t);
  if (etiqueta) {
    violaciones.push({ regla: 'sin-fugas', detalle: `El texto tiene una etiqueta: "${etiqueta[0]}"` });
  }

  if (BLOQUE_DE_CODIGO.test(t)) {
    violaciones.push({ regla: 'sin-fugas', detalle: 'El texto tiene un bloque de código (```)' });
  }

  const placeholder = PLACEHOLDER.exec(t);
  if (placeholder) {
    violaciones.push({ regla: 'sin-fugas', detalle: `Placeholder sin resolver: "${placeholder[0]}"` });
  }

  for (const nombre of NOMBRES_DE_TOOLS) {
    if (t.includes(nombre)) {
      violaciones.push({ regla: 'sin-fugas', detalle: `El texto nombra la herramienta "${nombre}"` });
    }
  }

  return violaciones;
}

/**
 * Regla 2 — no se inventan opciones.
 *
 * Es la falla más cara del wizard: el modelo ofrece un rubro, un subrubro o un
 * modo de venta que no existe, el usuario hace clic, y no pasa nada — porque
 * el key que mandó no matchea ninguna opción real del formulario.
 */
export function keysQueExisten(turno: TurnoDeOrbi, escenario: EscenarioDelCaso): Violacion[] {
  const validas = new Set((escenario.availableOptions ?? []).map(o => o.key));

  return turno.toolCalls
    .filter(c => c.name === 'selectWizardOption')
    .filter(c => !validas.has(String(c.arguments.key)))
    .map(c => ({
      regla: 'keys-que-existen',
      detalle: `selectWizardOption con key "${String(c.arguments.key)}", que no está entre las opciones del paso (${[...validas].join(', ') || 'ninguna'})`,
    }));
}

/**
 * Regla 3 — no se llama una tool que este paso no habilita.
 *
 * Si pasa, el registry la rechaza en execute() y el usuario ve a Orbi
 * "intentar" algo y fallar sin ninguna explicación. Es el bug que tenía
 * selectWizardOption habilitada en el paso 'cuenta'.
 */
export function toolsAutorizadas(turno: TurnoDeOrbi, escenario: EscenarioDelCaso): Violacion[] {
  const habilitadas = new Set(escenario.toolsAutorizadas);

  return turno.toolCalls
    .filter(c => !habilitadas.has(c.name))
    .map(c => ({
      regla: 'tools-autorizadas',
      detalle: `Llamó "${c.name}", que no está habilitada en el paso "${escenario.stepName}" (habilitadas: ${[...habilitadas].join(', ') || 'ninguna'})`,
    }));
}

/**
 * Regla 4 — brevedad.
 *
 * El prompt pide 2-3 oraciones. Es un panel lateral angosto al costado de un
 * formulario, no un chat a pantalla completa: una parrafada obliga a scrollear
 * justo cuando la persona está tratando de completar un campo.
 */
export function largoRazonable(turno: TurnoDeOrbi, escenario: EscenarioDelCaso): Violacion[] {
  const tope = escenario.topeDeLargo ?? TOPE_DE_LARGO_POR_DEFECTO;
  if (turno.texto.length <= tope) return [];

  return [{
    regla: 'largo-razonable',
    detalle: `${turno.texto.length} caracteres, tope ${tope}`,
  }];
}

/**
 * Regla 5 — no contesta en silencio.
 *
 * El CORE_PROMPT dice, textual: "escribí PRIMERO tu mensaje explicativo y
 * DESPUÉS invocá la herramienta". Cuando el modelo se saltea el texto, en
 * pantalla aparece un botón solo, sin una línea que explique de dónde salió ni
 * por qué — el usuario ve a Orbi hacer algo sin decir nada.
 */
export function noContestaEnSilencio(turno: TurnoDeOrbi): Violacion[] {
  if (turno.texto.trim().length > 0) return [];

  return [{
    regla: 'no-contesta-en-silencio',
    detalle: turno.toolCalls.length
      ? `Llamó ${turno.toolCalls.map(c => c.name).join(', ')} sin escribir una sola palabra`
      : 'Respuesta vacía: ni texto ni herramientas',
  }];
}

/** Todas las reglas de una. */
export function evaluarTurno(turno: TurnoDeOrbi, escenario: EscenarioDelCaso): Violacion[] {
  return [
    ...sinFugasDeHerramientas(turno),
    ...keysQueExisten(turno, escenario),
    ...toolsAutorizadas(turno, escenario),
    ...largoRazonable(turno, escenario),
    ...noContestaEnSilencio(turno),
  ];
}

/**
 * Chequeos propios de un caso puntual, además de las cuatro reglas generales.
 *
 * Se declaran en casos.ts en vez de escribirse como código suelto por caso:
 * así el archivo de casos se lee como una tabla de "situación → qué esperamos"
 * y no como cien funciones parecidas.
 */
export function verificarExpectativas(
  turno: TurnoDeOrbi,
  expectativas: Expectativa[],
): Violacion[] {
  const violaciones: Violacion[] = [];
  const llamadas = turno.toolCalls.map(c => c.name);

  for (const e of expectativas) {
    switch (e.tipo) {
      case 'debe-llamar':
        if (!llamadas.includes(e.tool)) {
          violaciones.push({ regla: 'debe-llamar', detalle: `Nunca llamó "${e.tool}" (llamó: ${llamadas.join(', ') || 'nada'})` });
        }
        break;

      case 'no-debe-llamar':
        if (llamadas.includes(e.tool)) {
          violaciones.push({ regla: 'no-debe-llamar', detalle: `Llamó "${e.tool}" y no correspondía` });
        }
        break;

      case 'no-llama-ninguna-tool':
        if (llamadas.length) {
          violaciones.push({ regla: 'no-llama-ninguna-tool', detalle: `Llamó ${llamadas.join(', ')}` });
        }
        break;

      case 'keys-exactas': {
        const obtenidas = turno.toolCalls
          .filter(c => c.name === 'selectWizardOption')
          .map(c => String(c.arguments.key))
          .sort();
        const esperadas = [...e.keys].sort();
        if (obtenidas.join('|') !== esperadas.join('|')) {
          violaciones.push({
            regla: 'keys-exactas',
            detalle: `Esperaba [${esperadas.join(', ')}] y seleccionó [${obtenidas.join(', ')}]`,
          });
        }
        break;
      }

      case 'cantidad-de-llamadas': {
        const n = llamadas.filter(l => l === e.tool).length;
        if (n !== e.cantidad) {
          violaciones.push({
            regla: 'cantidad-de-llamadas',
            detalle: `Esperaba ${e.cantidad} llamada(s) a "${e.tool}" y hubo ${n}`,
          });
        }
        break;
      }

      case 'texto-no-contiene':
        if (turno.texto.toLowerCase().includes(e.fragmento.toLowerCase())) {
          violaciones.push({ regla: 'texto-no-contiene', detalle: `El texto contiene "${e.fragmento}"` });
        }
        break;
    }
  }

  return violaciones;
}

/** Un pedacito del texto alrededor del primer match, para que el error se lea. */
function recorte(texto: string, patron: RegExp, margen = 30): string {
  const i = texto.search(patron);
  if (i < 0) return '';
  const desde = Math.max(0, i - margen);
  const hasta = Math.min(texto.length, i + margen);
  return `...${texto.slice(desde, hasta).replace(/\n/g, ' ')}...`;
}
