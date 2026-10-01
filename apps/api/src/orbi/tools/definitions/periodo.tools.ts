import { HttpException } from '@nestjs/common';
import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { ReportsService } from '../../../reports/reports.service';
import { fechaArgentina } from '../../../common/utils/hora-argentina';

// El resumen de un período (handoff 2026-10-01, "el resumen de tienda es
// flojo"): hasta acá Orbi solo tenía el mes en curso contra el anterior
// (getSalesReport) y, para "la última semana", sumaba pedidos de listOrders,
// que trae como mucho 20.
//
// No es una métrica nueva: es ReportsService.dashboard, el mismo cálculo que
// el Inicio (días de Argentina, ventas netas de devoluciones, ticket bruto,
// comparación contra el período anterior del mismo largo). Si Orbi y el Inicio
// dicen números distintos para el mismo período, la persona deja de creerle a
// los dos.

export const PERIODOS = ['hoy', 'ayer', 'ultimos_7_dias', 'ultimos_30_dias', 'este_mes', 'mes_pasado', 'rango'] as const;
export type Periodo = (typeof PERIODOS)[number];

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Una fecha AAAA-MM-DD corrida `dias` días (calendario: sin hora ni zona). */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** AAAA-MM-DD y además una fecha que existe (2026-02-31 no). */
export function esFecha(texto: unknown): texto is string {
  return typeof texto === 'string' && DIA.test(texto) && new Date(`${texto}T12:00:00.000Z`).toISOString().slice(0, 10) === texto;
}

/**
 * El rango de días (de Argentina, `hasta` inclusive) de un período, a partir
 * de "hoy". Lo resuelve el servidor y no el modelo: el modelo no sabe qué día
 * es (el prompt no tiene la fecha), y "la última semana" calculada por él
 * sería una adivinanza.
 */
export function rangoDelPeriodo(
  periodo: Periodo,
  hoy: string,
  desde?: unknown,
  hasta?: unknown,
): { desde: string; hasta: string } | { error: string } {
  switch (periodo) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case 'ayer': {
      const ayer = sumarDias(hoy, -1);
      return { desde: ayer, hasta: ayer };
    }
    case 'ultimos_7_dias':
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case 'ultimos_30_dias':
      return { desde: sumarDias(hoy, -29), hasta: hoy };
    case 'este_mes':
      return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
    case 'mes_pasado': {
      const ultimoDelPasado = sumarDias(`${hoy.slice(0, 8)}01`, -1);
      return { desde: `${ultimoDelPasado.slice(0, 8)}01`, hasta: ultimoDelPasado };
    }
    case 'rango': {
      if (!esFecha(desde) || !esFecha(hasta)) {
        return { error: 'Para un rango pasá desde y hasta como fechas AAAA-MM-DD.' };
      }
      if (desde > hasta) return { error: 'La fecha "desde" tiene que ser anterior o igual a "hasta".' };
      if (desde > hoy) return { error: `Ese rango es futuro: hoy es ${hoy}.` };
      // Lo que todavía no pasó no tiene ventas: se corta en hoy.
      return { desde, hasta: hasta > hoy ? hoy : hasta };
    }
  }
}

const diasEntre = (desde: string, hasta: string) =>
  Math.round((new Date(`${hasta}T12:00:00.000Z`).getTime() - new Date(`${desde}T12:00:00.000Z`).getTime()) / 86_400_000) + 1;

export class GetResumenDelPeriodoTool implements OrbiTool {
  name = 'getResumenDelPeriodo';
  description =
    'Resumen de ventas de un período: ventas, pedidos, ticket promedio, clientes nuevos y lo más vendido, comparados con el período anterior del mismo largo. ' +
    'Son los mismos números que el Inicio del panel. Usalo para hoy, ayer, los últimos 7 o 30 días, este mes, el mes pasado o un rango de fechas.';
  surfaces = [OrbiSurface.PANEL];
  // El mismo permiso que GET /reports/dashboard: es la foto de la facturación.
  requiredPermissions = ['reports.dashboard'];
  parameters = {
    type: 'object',
    properties: {
      periodo: {
        type: 'string',
        enum: [...PERIODOS],
        description: 'El período. "rango" pide además desde y hasta.',
      },
      desde: { type: 'string', description: 'Solo con periodo "rango": primer día, AAAA-MM-DD' },
      hasta: { type: 'string', description: 'Solo con periodo "rango": último día (inclusive), AAAA-MM-DD' },
    },
    required: ['periodo'],
  };

  /** `ahora` se inyecta para las evals, que corren el dataset contra un "ahora" fijo. */
  constructor(
    private readonly reports: ReportsService,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    const label = 'Resumen del período';
    const periodo = args.periodo;
    if (typeof periodo !== 'string' || !(PERIODOS as readonly string[]).includes(periodo)) {
      return { success: false, error: `Período inválido. Opciones: ${PERIODOS.join(', ')}.`, label };
    }

    const hoy = fechaArgentina(this.ahora());
    const rango = rangoDelPeriodo(periodo as Periodo, hoy, args.desde, args.hasta);
    if ('error' in rango) return { success: false, error: rango.error, label };

    try {
      const d = await this.reports.dashboard(ctx.businessId, rango.desde, rango.hasta);
      const dias = diasEntre(rango.desde, rango.hasta);
      return {
        success: true,
        label,
        // Mapeado campo por campo: la "actividad reciente" del dashboard trae
        // nombres de clientes (texto de terceros) y no hace falta para un
        // resumen; el "canal" suma solo las últimas dos semanas (no sirve para
        // rangos largos); las imágenes no le dicen nada al modelo.
        data: {
          periodo: { desde: rango.desde, hasta: rango.hasta, dias },
          comparadoCon: { desde: sumarDias(rango.desde, -dias), hasta: sumarDias(rango.desde, -1) },
          ventas: d.kpis.ventas,
          pedidos: d.kpis.pedidos,
          ticketPromedio: d.kpis.ticketPromedio,
          clientesNuevos: d.kpis.clientesNuevos,
          pedidosPendientesDelPeriodo: d.kpis.pedidosPendientes,
          comisionMercadoPago: d.kpis.comisionMp,
          visitasALaTienda: d.kpis.visitas,
          variacionPorcentualContraElPeriodoAnterior: {
            ventas: d.kpis.deltas.ventas,
            pedidos: d.kpis.deltas.pedidos,
            ticketPromedio: d.kpis.deltas.ticketPromedio,
            clientesNuevos: d.kpis.deltas.clientesNuevos,
          },
          masVendidos: d.top.productos.map((p) => ({ nombre: p.name, unidades: p.unidades, importe: p.importe })),
          categoriasMasVendidas: d.top.categorias.map((c) => ({ nombre: c.label, unidades: c.value })),
          alertasDeHoy: d.alertas,
        },
      };
    } catch (error) {
      // Un 400 del service (rango de más de 400 días) se le explica al
      // modelo; cualquier otro error, sin detalles internos.
      const mensaje = error instanceof HttpException && error.getStatus() === 400 ? error.message : 'No pude calcular el resumen de ese período.';
      return { success: false, error: mensaje, label };
    }
  }
}
