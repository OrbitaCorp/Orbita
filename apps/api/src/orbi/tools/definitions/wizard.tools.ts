import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';

// Cliente Groq lazy compartido por las tools del wizard — mismo criterio que
// ProductAiService: si GROQ_API_KEY no está configurada, el resto de Orbi
// sigue funcionando, solo estas dos tools quedan inhabilitadas.
function getGroqClient(config: ConfigService): Groq {
  const apiKey = config.get<string>('GROQ_API_KEY');
  if (!apiKey) throw new ServiceUnavailableException('La generación con IA (Orbi) no está configurada en el servidor');
  return new Groq({ apiKey });
}

export class SuggestBusinessNameTool implements OrbiTool {
  name = 'suggestBusinessName';
  description = 'Sugerir 3 a 5 nombres para el negocio según su rubro y, opcionalmente, palabras clave que el usuario mencionó. Solo disponible durante el onboarding.';
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

  constructor(private readonly config: ConfigService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, _ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const client = getGroqClient(this.config);
      const prompt = [
        `Rubro del negocio: ${args.rubro}`,
        args.keywords ? `Palabras clave del usuario: ${args.keywords}` : '',
      ].filter(Boolean).join('\n');

      const response = await client.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        // gpt-oss-20b es un modelo de razonamiento: con reasoning_effort
        // default ('medium') gasta buena parte del budget pensando antes de
        // escribir el JSON final. Con solo 300 tokens el razonamiento se
        // comía todo el presupuesto y el JSON quedaba cortado a la mitad
        // (mismo síntoma que ya se documentó en product-ai.service.ts).
        // 'low' + más margen de tokens deja lugar de sobra para el JSON.
        reasoning_effort: 'low',
        max_completion_tokens: 1024,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Sugerís nombres comerciales cortos y memorables en español rioplatense para un negocio en Argentina. ' +
              'Devolvé SOLO un JSON con esta forma exacta, sin texto adicional: {"names": ["...", "...", "..."]} ' +
              'con entre 3 y 5 nombres.',
          },
          { role: 'user', content: prompt },
        ],
      });

      const raw = response.choices[0]?.message?.content?.trim() ?? '';
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')) as { names?: unknown };
      const names = Array.isArray(parsed.names) ? parsed.names.filter((n): n is string => typeof n === 'string') : [];

      if (!names.length) throw new Error('Groq no devolvió nombres válidos');

      return { success: true, label: 'Nombres sugeridos', data: { names } };
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      return { success: false, error: `No pude sugerir nombres: ${msg}`, label: 'Error sugiriendo nombres' };
    }
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
      const client = getGroqClient(this.config);

      const response = await client.chat.completions.create({
        model: 'openai/gpt-oss-20b',
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
      if (!description) throw new Error('Groq no devolvió una descripción');

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
