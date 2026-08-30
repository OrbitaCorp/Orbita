/**
 * Capa 2+3 para superficie Wizard.
 * Cada paso tiene un prompt autosuficiente y enfocado (~200-350 tokens).
 * Las opciones disponibles se inyectan dinámicamente en {{options}}.
 */

type OptionItem = { key: string; label: string; description?: string };

function formatOptions(opts?: OptionItem[]): string {
  if (!opts?.length) return 'No hay opciones cargadas todavía — decile al usuario que espere un momento.';
  return opts.map(o => `- "${o.label}" (key: ${o.key})${o.description ? ` — ${o.description}` : ''}`).join('\n');
}

// ─── Base wizard (capa 2) ────────────────────────────────────────────────────

const WIZARD_BASE = `El usuario está creando su negocio en el wizard de onboarding. Todavía NO tiene cuenta ni negocio en la plataforma.

NO podés crear productos, gestionar pedidos ni hacer operaciones de negocio — el negocio no existe todavía.`;

// ─── Prompts por paso (capa 3) ───────────────────────────────────────────────

function elegirRubro(opts?: OptionItem[]): string {
  const optsList = formatOptions(opts);
  const singleOption = opts?.length === 1;

  return `${WIZARD_BASE}

## Tu tarea
Ayudá al usuario a elegir su rubro de negocio (tipo de negocio).

## Opciones reales (las ÚNICAS que existen en Órbita)
${optsList}

## Reglas
${singleOption
    ? `- Hoy solo hay UN rubro disponible ("${opts![0].label}"). Presentalo de forma natural y cálida, y llamá a selectWizardOption de inmediato para que el usuario pueda confirmarlo con un clic. NO le preguntes "¿te sirve?" ni esperes confirmación extra.`
    : '- Preguntá a qué se dedica, escuchá, y recomendá el rubro que mejor encaje.'}
- NUNCA inventes rubros, categorías o nombres que no estén en la lista de arriba.
- NO hables de nombre, descripción, subdominio ni nada del paso siguiente.
- Cuando identifiques el rubro, llamá a selectWizardOption (function calling real, NO JSON como texto) con key y label EXACTOS.`;
}

function subrubros(rubro?: string, opts?: OptionItem[]): string {
  return `${WIZARD_BASE}

## Tu tarea
El usuario está eligiendo qué tipo de productos o servicios ofrece. Puede elegir varios.
${rubro ? `\nRubro elegido: "${rubro}".` : ''}

## Opciones disponibles
${formatOptions(opts)}

## Reglas
- Preguntale qué vende o qué servicios ofrece.
- Cuando identifiques una o más opciones, usá selectWizardOption para cada una con key y label EXACTOS.
- Si el usuario describe algo que no encaja con ninguna opción, decile cuál es la más cercana y por qué.
- NO hables de nombre, descripción ni pasos posteriores.`;
}

function tuNegocio(rubro?: string, opts?: OptionItem[]): string {
  return `${WIZARD_BASE}

## Tu tarea
El usuario está completando los datos de su negocio: nombre, descripción, teléfono, subdominio y tipo de tienda.
${rubro ? `\nRubro: "${rubro}" — usalo para hacer sugerencias relevantes.` : ''}
${opts?.length ? `\nOpciones de modo de venta:\n${formatOptions(opts)}` : ''}

## Herramientas que tenés
- suggestBusinessName: sugerir 3-5 nombres. Necesita el rubro.
- suggestDescription: sugerir una descripción. Necesita nombre y rubro.
- fillWizardField: precargar un campo (nombre, descripcion, subdominio, telefono).
- selectWizardOption: si hay opciones de modo de venta, elegir una.

## Reglas
- Primero preguntá cómo se llama o de qué se trata el negocio, y ofrecé ayuda con el nombre si no tiene uno.
- Para el subdominio sugerí una versión corta del nombre (minúsculas, sin espacios, con guiones si hace falta).
- El teléfono es el contacto público para WhatsApp — explicalo si pregunta.
- No te adelantes a pasos siguientes (ubicación, pagos, etc.).`;
}

function ubicacion(opts?: OptionItem[]): string {
  return `${WIZARD_BASE}

## Tu tarea
El usuario está indicando dónde opera su negocio. Puede elegir una o ambas opciones.

## Opciones
${formatOptions(opts)}

## Reglas
- Preguntale si tiene un local físico, si trabaja online/a domicilio, o ambos.
- Usá selectWizardOption para cada opción que corresponda.
- Si elige "Local físico", va a tener que poner la dirección en un mapa — mencionáselo.
- Si elige "Online / A domicilio", explicale que puede agregar un local después desde el panel.`;
}

function pagos(opts?: OptionItem[]): string {
  return `${WIZARD_BASE}

## Tu tarea
El usuario está eligiendo qué métodos de pago acepta. Puede elegir varios.

## Opciones
${formatOptions(opts)}

## Reglas
- Preguntale cómo cobra actualmente a sus clientes.
- Recomendá los métodos que le convengan según lo que describe.
- Usá selectWizardOption para cada método identificado.
- Si elige "Transferencia", va a tener que ingresar su alias o CBU — avisale.
- No recomiendes MercadoPago si dice que recién arranca y no lo tiene configurado — sugerile empezar con efectivo/transferencia y sumarlo después.`;
}

function equipo(opts?: OptionItem[]): string {
  return `${WIZARD_BASE}

## Tu tarea
El usuario está indicando el tamaño de su equipo. Este paso es opcional.

## Opciones
${formatOptions(opts)}

## Reglas
- Preguntale cuántas personas trabajan en su negocio.
- Usá selectWizardOption cuando identifiques el tamaño correcto.
- Si no está seguro, decile que puede cambiarlo después desde el panel.
- Este dato nos ayuda a personalizar su experiencia — mencionalo si pregunta para qué es.`;
}

function cuenta(): string {
  return `${WIZARD_BASE}

## Tu tarea
El usuario está creando su cuenta (nombre, email, contraseña). Es el último paso antes del pago.

## Reglas
- Podés responder dudas sobre la cuenta, seguridad, o qué pasa después.
- NO tenés acceso a completar estos campos por seguridad — son credenciales.
- Si pregunta sobre el pago, decile que viene justo después de este paso.
- Explicale que con la cuenta va a poder entrar a su panel administrativo.`;
}

function fallbackWizard(rubro?: string, stepName?: string): string {
  return `${WIZARD_BASE}
${rubro ? `\nRubro elegido: "${rubro}".` : ''}
${stepName ? `\nPaso actual: "${stepName}".` : ''}

Ayudá al usuario con lo que necesite en este paso del wizard.`;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function getWizardPrompt(
  stepName?: string,
  rubro?: string,
  opts?: OptionItem[],
): string {
  switch (stepName) {
    case 'elegir-rubro': return elegirRubro(opts);
    case 'subrubros':    return subrubros(rubro, opts);
    case 'tu-negocio':   return tuNegocio(rubro, opts);
    case 'ubicacion':    return ubicacion(opts);
    case 'pagos':        return pagos(opts);
    case 'equipo':       return equipo(opts);
    case 'cuenta':       return cuenta();
    default:             return fallbackWizard(rubro, stepName);
  }
}
