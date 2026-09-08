import type { ConfigService } from '@nestjs/config';
import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { OnboardingService } from '../../../onboarding/onboarding.service';
import { createGeminiClient, DEFAULT_MODEL } from '../../llm/gemini-client';

// Cliente Gemini lazy compartido por las tools del wizard — mismo criterio que
// ProductAiService: si GEMINI_API_KEY no está configurada, createGeminiClient
// lanza 503 y solo estas dos tools quedan inhabilitadas, el resto de Orbi sigue.
function getGeminiClient(config: ConfigService) {
  return createGeminiClient(config);
}

// Estas llamadas son chicas (un JSON de nombres, una descripción de 160
// caracteres): el flash alcanza de sobra. Overridable por env igual que el resto.
function wizardToolsModel(config: ConfigService): string {
  return config.get<string>('WIZARD_TOOLS_MODEL') ?? DEFAULT_MODEL;
}

export class SuggestBusinessNameTool implements OrbiTool {
  name = 'suggestBusinessName';
  description = 'Sugerir 3 a 5 nombres para el negocio según su rubro y, opcionalmente, palabras clave que el usuario mencionó. Cada nombre ya viene chequeado contra la base: solo se devuelven nombres cuyo subdominio natural (o una variante legible) está realmente disponible. Solo disponible durante el onboarding.';
  surfaces = [OrbiSurface.WIZARD];
  steps = ['tu-negocio'];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      rubro: { type: 'string', description: 'Rubro del negocio (ej. "peluquería", "tienda de ropa")' },
      keywords: { type: 'string', description: 'Palabras clave o ideas que el usuario mencionó (opcional)' },
    },
    required: ['rubro'],
  };

  constructor(
    private readonly config: ConfigService,
    private readonly onboarding: OnboardingService,
  ) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, _ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const client = getGeminiClient(this.config);
      const prompt = [
        `Rubro del negocio: ${args.rubro}`,
        args.keywords ? `Palabras clave del usuario: ${args.keywords}` : '',
      ].filter(Boolean).join('\n');

      const response = await client.chat.completions.create({
        model: wizardToolsModel(this.config),
        // Modelo de razonamiento: con reasoning_effort default gasta buena
        // parte del budget pensando antes de escribir el JSON final. Con poco
        // margen de tokens el razonamiento se come todo el presupuesto y el
        // JSON queda cortado a la mitad (mismo síntoma que ya se documentó en
        // product-ai.service.ts). 'low' + margen de tokens deja lugar de sobra.
        reasoning_effort: 'low',
        max_completion_tokens: 1024,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Sugerís nombres comerciales para un negocio real en Argentina, en español rioplatense.\n\n' +
              'Un buen nombre:\n' +
              '- Corto: 1 a 3 palabras, fácil de decir y de escribir de memoria.\n' +
              '- Con gancho: una palabra real (del rubro, de las palabras clave que te dieron, o una ' +
              'imagen concreta relacionada) combinada de forma que suene a marca — nunca la ' +
              'descripción literal del rubro sola ("Tienda de Ropa", "Ferretería Central" a secas).\n' +
              '- Sin relleno ni genéricos: nada de números, guiones bajos, ni nombres que no dicen nada ' +
              'de qué vende ("Mi Negocio", "Negocio Online", "Tienda Uno").\n' +
              '- Variedad real entre las opciones: no repitas la misma fórmula en todas (nada de "X ' +
              'Store", "Y Store", "Z Store") — mezclá un nombre directo, uno más evocador/creativo, y ' +
              'si te dieron palabras clave, uno que las combine con el rubro.\n\n' +
              'Generá 8 candidatos — se van a filtrar después por disponibilidad, así que no te ' +
              'guardes ideas ni repitas variantes triviales de un mismo nombre. Devolvé SOLO un JSON ' +
              'con esta forma exacta, sin texto adicional: {"names": ["...", "...", ...]}',
          },
          { role: 'user', content: prompt },
        ],
      });

      const raw = response.choices[0]?.message?.content?.trim() ?? '';
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')) as { names?: unknown };
      const candidatos = Array.isArray(parsed.names) ? parsed.names.filter((n): n is string => typeof n === 'string') : [];

      if (!candidatos.length) throw new Error('Gemini no devolvió nombres válidos');

      // Filtro real contra la base (RBT-293): un nombre cuyo subdominio ya
      // está tomado no es una sugerencia usable, es una que la persona iba a
      // tener que descartar recién al querer publicar el negocio. Se corta en
      // los primeros 5 nombres con subdominio libre — no hace falta chequear
      // los 8 si ya juntamos suficientes.
      const vetados: { name: string; subdomain: string }[] = [];
      for (const nombre of candidatos) {
        if (vetados.length >= 5) break;
        const [subdomain] = await this.onboarding.suggestSubdomains(nombre, 1);
        if (subdomain) vetados.push({ name: nombre, subdomain });
      }

      if (!vetados.length) {
        return {
          success: false,
          error: 'Ningún candidato tenía un subdominio disponible. Probá pidiéndole otras palabras clave al usuario y generá nombres distintos.',
          label: 'Sin nombres disponibles',
        };
      }

      return {
        success: true,
        label: 'Nombres sugeridos',
        data: {
          names: vetados.map(v => v.name),
          // Informativo, no para reusar: el historial que viaja al wizard en
          // el próximo turno es solo texto (ver OrbiChatDto.history), así que
          // el modelo no tiene forma de recuperar esto más adelante — sirve
          // para que la respuesta de ESTE turno pueda decir con verdad "todos
          // con subdominio disponible", nada más. Cuando el usuario elija un
          // nombre (en el turno siguiente), Orbi vuelve a llamar
          // suggestSubdomain igual — ver wizard.ts `tuNegocio()`.
          subdominioPorNombre: Object.fromEntries(vetados.map(v => [v.name, v.subdomain])),
        },
      };
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      return { success: false, error: `No pude sugerir nombres: ${msg}`, label: 'Error sugiriendo nombres' };
    }
  }
}

export class SuggestSubdomainTool implements OrbiTool {
  name = 'suggestSubdomain';
  description = 'Sugerir hasta 3 subdominios YA CHEQUEADOS contra la base (disponibles de verdad) a partir del nombre del negocio. Usar SIEMPRE antes de completar el campo subdominio con fillWizardField — nunca inventar uno a ojo ni copiar el nombre tal cual sin pasar por acá primero.';
  surfaces = [OrbiSurface.WIZARD];
  steps = ['tu-negocio'];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      businessName: { type: 'string', description: 'Nombre del negocio (o la idea de subdominio que quiere probar el usuario)' },
    },
    required: ['businessName'],
  };

  constructor(private readonly onboarding: OnboardingService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, _ctx: ToolExecutionContext): Promise<ToolResult> {
    const businessName = String(args.businessName ?? '').trim();
    if (!businessName) {
      return { success: false, error: 'Falta el nombre del negocio', label: 'Error sugiriendo subdominio' };
    }

    const disponibles = await this.onboarding.suggestSubdomains(businessName, 3);

    if (!disponibles.length) {
      return {
        success: false,
        error:
          'Ninguna variante de subdominio para ese nombre está disponible. Pedile al usuario un ' +
          'nombre o palabra distinta para probar, no inventes un subdominio sin chequear.',
        label: 'Sin subdominios disponibles',
      };
    }

    return { success: true, label: 'Subdominios disponibles', data: { subdomains: disponibles } };
  }
}

export class SuggestDescriptionTool implements OrbiTool {
  name = 'suggestDescription';
  description = 'Sugerir una descripción corta para el negocio según su nombre, rubro y, si ya se conoce, el detalle de lo que vende (tipos de producto/servicio elegidos, palabras clave que mencionó el usuario). Cuanto más detalle se pase, más específica sale. Solo disponible durante el onboarding.';
  surfaces = [OrbiSurface.WIZARD];
  steps = ['tu-negocio'];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      businessName: { type: 'string', description: 'Nombre del negocio' },
      rubro: { type: 'string', description: 'Rubro del negocio' },
      detalle: {
        type: 'string',
        description: 'Opcional. Lo que ya se sabe que vende u ofrece (tipos de producto/servicio elegidos en el paso anterior, especialidad, palabras clave del usuario). Mejora mucho la calidad de la descripción.',
      },
    },
    required: ['businessName', 'rubro'],
  };

  constructor(private readonly config: ConfigService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, _ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const client = getGeminiClient(this.config);

      const response = await client.chat.completions.create({
        model: wizardToolsModel(this.config),
        reasoning_effort: 'low',
        max_completion_tokens: 512,
        messages: [
          {
            role: 'system',
            content:
              'Escribís descripciones cortas para negocios en Argentina, en español rioplatense, tono cercano y directo, ' +
              'sin exclamaciones ni emojis.\n\n' +
              'Estructura, en ese orden, en 1-2 oraciones y sin superar los 160 caracteres en total ' +
              '(tiene que entrar en una tarjeta de catálogo y en un meta description de buscador):\n' +
              '1) Qué vende u ofrece, de forma CONCRETA — nombrá el tipo de producto o servicio real ' +
              '(si te pasaron un detalle, usalo acá; si no, apoyate en el rubro).\n' +
              '2) Qué lo distingue de otro negocio del mismo rubro: variedad, especialidad, atención ' +
              'personalizada, hecho a mano, rapidez de entrega, precio — SOLO si podés anclarlo a algo ' +
              'concreto que te dieron, nunca inventado.\n\n' +
              'Prohibido el relleno genérico sin contenido real: frases como "la mejor calidad", ' +
              '"gran variedad" o "atención al cliente" sin especificar qué, no van. ' +
              'Devolvé SOLO el texto de la descripción, sin comillas ni markdown.',
          },
          {
            role: 'user',
            content: [
              `Nombre: ${args.businessName}`,
              `Rubro: ${args.rubro}`,
              args.detalle ? `Detalle de lo que vende: ${args.detalle}` : '',
            ].filter(Boolean).join('\n'),
          },
        ],
      });

      const description = response.choices[0]?.message?.content?.trim();
      if (!description) throw new Error('Gemini no devolvió una descripción');

      return { success: true, label: 'Descripción sugerida', data: { description } };
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      return { success: false, error: `No pude sugerir una descripción: ${msg}`, label: 'Error sugiriendo descripción' };
    }
  }
}

export class SelectWizardOptionTool implements OrbiTool {
  name = 'selectWizardOption';
  description = 'Ofrecer un botón para que el usuario seleccione una opción del paso actual del wizard (rubro, tipo de producto/servicio, modo de venta, ubicación). Usá el key y label exactos de las opciones disponibles.';
  surfaces = [OrbiSurface.WIZARD];
  // Los únicos pasos que tienen opciones para elegir. Sin este gate la tool
  // quedaba habilitada también en 'cuenta', donde no hay ninguna opción: el
  // modelo la disparaba igual y el usuario terminaba viendo un botón que no
  // hacía nada, porque el handler de 'orbi:select-option' (SetupUnificado)
  // solo contempla estos tres pasos.
  steps = ['elegir-rubro', 'subrubros', 'tu-negocio', 'ubicacion'];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Key exacto de la opción (ej. "tienda", "ecommerce", "fisico")' },
      label: { type: 'string', description: 'Label visible de la opción (ej. "Tienda online", "Local físico")' },
    },
    required: ['key', 'label'],
  };

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    const key = String(args.key ?? '');
    const opciones = ctx.availableOptions ?? [];

    // Si el paso declaró opciones, el key TIENE que ser una de ellas. Un key
    // inventado antes viajaba entero hasta el front y se renderizaba como un
    // botón que al hacer clic no hacía nada: el handler de 'orbi:select-option'
    // busca la opción por key, no la encuentra, y no pasa absolutamente nada.
    // Devolver el error acá le da al modelo la lista correcta y la chance de
    // corregirse en el mismo turno, en vez de dejar el problema en pantalla.
    if (opciones.length) {
      const valida = opciones.find(o => o.key === key);
      if (!valida) {
        return {
          success: false,
          label: 'Opción inexistente',
          error:
            `"${key}" no es una opción de este paso. Las únicas válidas son: ` +
            `${opciones.map(o => o.key).join(', ')}. Elegí una de esas.`,
        };
      }

      // El label también sale del catálogo, no de lo que haya escrito el
      // modelo: el botón tiene que decir lo mismo que dice el formulario.
      return {
        success: true,
        label: `Elegir: ${valida.label}`,
        data: { key: valida.key, label: valida.label },
      };
    }

    return {
      success: true,
      label: `Elegir: ${args.label}`,
      data: { key, label: args.label },
    };
  }
}

export class FillWizardFieldTool implements OrbiTool {
  name = 'fillWizardField';
  description = 'Aplicar un valor sugerido a un campo del formulario de onboarding (nombre, descripción, subdominio, etc.) para que el usuario lo vea precargado.';
  surfaces = [OrbiSurface.WIZARD];
  steps = ['tu-negocio'];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      field: { type: 'string', description: 'Nombre del campo a completar (ej. "nombre", "descripcion", "subdominio")' },
      value: { type: 'string', description: 'Valor sugerido para el campo' },
    },
    required: ['field', 'value'],
  };

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, _ctx: ToolExecutionContext): Promise<ToolResult> {
    return {
      success: true,
      label: `Campo "${args.field}" completado`,
      data: { field: args.field, value: args.value },
    };
  }
}
