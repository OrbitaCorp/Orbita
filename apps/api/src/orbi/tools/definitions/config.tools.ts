import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { BusinessesService } from '../../../businesses/businesses.service';

export class UpdateBusinessInfoTool implements OrbiTool {
  name = 'updateBusinessInfo';
  description = 'Actualizar el nombre, rubro o descripción del negocio. NO permite cambiar el subdominio, el plan ni las credenciales — eso está fuera de mi alcance.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['config:write'];
  requiresConfirmation = true;

  describirAccion(args: Record<string, unknown>): string {
    const campos = Object.keys(args).filter(k => args[k] !== undefined && args[k] !== null);
    return `Cambiar datos del negocio (${campos.join(', ') || 'sin cambios'})`;
  }

  parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nuevo nombre del negocio (opcional)' },
      industry: { type: 'string', description: 'Nuevo rubro (opcional)' },
      description: { type: 'string', description: 'Nueva descripción del negocio (opcional)' },
    },
  };

  constructor(private readonly businessesService: BusinessesService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      await this.businessesService.updateMe(ctx.businessId, {
        name: args.name as string | undefined,
        industry: args.industry as string | undefined,
        description: args.description as string | undefined,
      });

      return { success: true, label: 'Datos del negocio actualizados', data: {} };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude actualizar el negocio: ${msg}`, label: 'Error actualizando negocio' };
    }
  }
}

export class UpdatePaymentMethodsTool implements OrbiTool {
  name = 'updatePaymentMethods';
  description = 'Actualizar qué métodos de pago acepta el negocio (efectivo, transferencia, tarjeta, MercadoPago, coordinar por WhatsApp) y sus datos asociados.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['config:write'];
  requiresConfirmation = true;

  describirAccion(args: Record<string, unknown>): string {
    const nombres: Record<string, string> = {
      acceptsMercadopago: 'MercadoPago', acceptsCash: 'efectivo',
      acceptsTransfer: 'transferencia', acceptsCard: 'tarjeta',
      acceptsWhatsapp: 'coordinar por WhatsApp',
    };
    const prende = Object.keys(args).filter(k => args[k] === true).map(k => nombres[k] ?? k);
    const apaga = Object.keys(args).filter(k => args[k] === false).map(k => nombres[k] ?? k);
    const partes = [
      prende.length ? `activar ${prende.join(', ')}` : '',
      apaga.length ? `desactivar ${apaga.join(', ')}` : '',
    ].filter(Boolean);
    return `Cambiar métodos de pago: ${partes.join(' y ') || 'sin cambios'}`;
  }

  parameters = {
    type: 'object',
    properties: {
      acceptsMercadopago: { type: 'boolean' },
      acceptsCash: { type: 'boolean' },
      acceptsTransfer: { type: 'boolean' },
      acceptsCard: { type: 'boolean' },
      acceptsCoordinateLater: { type: 'boolean' },
      transferAlias: { type: 'string', description: 'Alias de la cuenta para transferencias (opcional)' },
    },
  };

  constructor(private readonly businessesService: BusinessesService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      await this.businessesService.updateConfig(ctx.businessId, {
        acceptsMercadopago: args.acceptsMercadopago as boolean | undefined,
        acceptsCash: args.acceptsCash as boolean | undefined,
        acceptsTransfer: args.acceptsTransfer as boolean | undefined,
        acceptsCard: args.acceptsCard as boolean | undefined,
        acceptsCoordinateLater: args.acceptsCoordinateLater as boolean | undefined,
        transferAlias: args.transferAlias as string | undefined,
      });

      return { success: true, label: 'Métodos de pago actualizados', data: {} };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude actualizar los métodos de pago: ${msg}`, label: 'Error actualizando pagos' };
    }
  }
}

export class UpdateShippingTool implements OrbiTool {
  name = 'updateShipping';
  description = 'Actualizar la configuración de envíos: transportistas habilitados, costo de envío gratis a partir de cierto monto, y política de envíos.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['config:write'];
  requiresConfirmation = true;

  describirAccion(args: Record<string, unknown>): string {
    return typeof args.freeShippingFrom === 'number'
      ? `Cambiar envíos: gratis desde $${args.freeShippingFrom}`
      : 'Cambiar la configuración de envíos';
  }

  parameters = {
    type: 'object',
    properties: {
      freeShippingFrom: { type: 'number', description: 'Monto a partir del cual el envío es gratis (opcional)' },
      shippingPolicy: { type: 'string', description: 'Texto de política de envíos (opcional)' },
      enabledCarriers: {
        type: 'array',
        items: { type: 'string', enum: ['CORREO_ARGENTINO', 'OCA', 'ANDREANI', 'VIA_CARGO', 'DELIVERY_APP', 'OTRO'] },
        description: 'Transportistas habilitados (opcional)',
      },
    },
  };

  constructor(private readonly businessesService: BusinessesService) {}

  toLlmDefinition(): LlmToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  async execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    try {
      await this.businessesService.updateConfig(ctx.businessId, {
        freeShippingFrom: args.freeShippingFrom as number | undefined,
        shippingPolicy: args.shippingPolicy as string | undefined,
        enabledCarriers: args.enabledCarriers as string[] | undefined,
      });

      return { success: true, label: 'Configuración de envíos actualizada', data: {} };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude actualizar los envíos: ${msg}`, label: 'Error actualizando envíos' };
    }
  }
}
