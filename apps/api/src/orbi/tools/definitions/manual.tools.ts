import { Logger } from '@nestjs/common';
import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import { rutaDeDestino, temaDelManual } from '../../manual/manual';

/** Temas por llamada: con más, el contexto se llena de manual y el modelo pierde el foco. */
export const MAX_TEMAS_POR_LLAMADA = 3;

/** Un id que vino del modelo, apto para un log: sin saltos ni caracteres raros. */
export function idParaLog(id: unknown): string {
  return String(id).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || '(vacío)';
}

/**
 * Lee temas del manual (spec 2026-09-30-orbi-base-de-conocimiento, §3.3).
 *
 * Solo lectura y sin permiso: el manual es el mismo para todos los miembros,
 * y no tiene nada del negocio. Devuelve el texto de cada tema y, en `path`, la
 * ruta del primer destino: el front dibuja el botón "Ir a…" con eso, igual
 * que con navigateTo (sesionOrbi.ts#esNavegacion), y `label` es lo que dice
 * el botón ("Abrir Envíos").
 *
 * Un id que no existe se informa y se loguea: es la señal de producción de
 * los temas que faltan (§3.6, capa 4).
 */
export class LeerTemaDelManualTool implements OrbiTool {
  private readonly logger = new Logger(LeerTemaDelManualTool.name);

  name = 'leerTemaDelManual';
  description =
    'Leer temas del manual de uso del panel de Órbita: cómo se hace algo, dónde está, qué significa algo de una pantalla. ' +
    `Pasá los ids del índice del manual que tenés en las instrucciones (hasta ${MAX_TEMAS_POR_LLAMADA}). ` +
    'Devuelve el texto de cada tema; a la persona le aparece el botón para ir a esa pantalla.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions: string[] = [];
  parameters = {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'string' },
        description: `Ids de temas del índice del manual (hasta ${MAX_TEMAS_POR_LLAMADA}), ej. ["cfg-envios"]`,
      },
    },
    required: ['ids'],
  };

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const label = 'Manual';
    // El schema pide un array, pero el modelo a veces manda un string suelto.
    const crudos = Array.isArray(args.ids) ? args.ids : typeof args.ids === 'string' ? [args.ids] : [];
    const ids = [...new Set(crudos.map(String))];
    if (!ids.length) {
      return { success: false, error: 'Pasá al menos un id del índice del manual.', label };
    }

    // Primero se separan los que existen y RECIÉN después se recorta: con
    // ['x', 'y', 'z', 'cfg-envios'] el tema válido no se puede perder.
    const existentes = ids.filter((id) => temaDelManual(id));
    const noEncontrados = ids.filter((id) => !temaDelManual(id)).map(idParaLog);
    const leidos = existentes.slice(0, MAX_TEMAS_POR_LLAMADA);
    const temas: { id: string; capitulo: string; titulo: string; texto: string; irA?: { label: string; path: string } }[] = [];
    for (const id of leidos) {
      const tema = temaDelManual(id)!;
      temas.push({
        id: tema.id,
        capitulo: tema.capitulo,
        titulo: tema.titulo,
        texto: tema.texto,
        ...(tema.destino ? { irA: { label: tema.destino.label, path: rutaDeDestino(tema.destino) } } : {}),
      });
    }

    if (noEncontrados.length) {
      this.logger.warn(`Tema del manual no encontrado: ${noEncontrados.join(', ')}`);
    }
    if (!temas.length) {
      return {
        success: false,
        error: `No hay temas con esos ids (${noEncontrados.join(', ')}). Usá los ids del índice del manual; si ninguno sirve, eso no está en el manual.`,
        label,
      };
    }

    const destino = temas.find((t) => t.irA)?.irA;
    return {
      success: true,
      label: destino?.label ?? `Manual: ${temas[0].titulo}`,
      data: {
        temas,
        ...(noEncontrados.length ? { noEncontrados } : {}),
        ...(existentes.length > leidos.length ? { sinLeer: existentes.slice(leidos.length).map(idParaLog) } : {}),
        ...(destino ? { path: destino.path } : {}),
      },
    };
  }
}
