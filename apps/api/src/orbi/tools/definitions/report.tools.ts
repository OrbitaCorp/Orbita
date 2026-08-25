import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { ReportsService } from '../../../reports/reports.service';

export class GetSalesReportTool implements OrbiTool {
  name = 'getSalesReport';
  description = 'Obtener el reporte de ventas del negocio: ventas, pedidos, ticket promedio y tasa de cancelación de este mes comparado con el mes anterior.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['reports.view'];
  parameters = { type: 'object', properties: {} };

  constructor(private readonly reportsService: ReportsService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(_args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const report = await this.reportsService.sales(ctx.businessId);
      return { success: true, label: 'Reporte de ventas obtenido', data: report };
    } catch (error) {
      return { success: false, error: `Error al obtener el reporte de ventas: ${error}`, label: 'Error obteniendo reporte de ventas' };
    }
  }
}

export class GetProductReportTool implements OrbiTool {
  name = 'getProductReport';
  description = 'Obtener el reporte de productos del negocio: qué productos se venden más, cuáles no rotan y cuáles están por quedarse sin stock.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['reports.view'];
  parameters = {
    type: 'object',
    properties: {
      days: { type: 'number', description: 'Ventana de días para el reporte (default 30)' },
    },
  };

  constructor(private readonly reportsService: ReportsService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const report = await this.reportsService.products(ctx.businessId, Number(args.days) || undefined);
      return { success: true, label: 'Reporte de productos obtenido', data: report };
    } catch (error) {
      return { success: false, error: `Error al obtener el reporte de productos: ${error}`, label: 'Error obteniendo reporte de productos' };
    }
  }
}

export class GetCustomerReportTool implements OrbiTool {
  name = 'getCustomerReport';
  description = 'Obtener el reporte de clientes del negocio: segmentación (VIP, recurrente, nuevo, inactivo) y métricas por cliente.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['reports.view'];
  parameters = { type: 'object', properties: {} };

  constructor(private readonly reportsService: ReportsService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(_args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      const report = await this.reportsService.customers(ctx.businessId);
      return { success: true, label: 'Reporte de clientes obtenido', data: report };
    } catch (error) {
      return { success: false, error: `Error al obtener el reporte de clientes: ${error}`, label: 'Error obteniendo reporte de clientes' };
    }
  }
}
