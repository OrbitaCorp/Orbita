import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { OrbiTool, ToolExecutionContext, ToolResult } from '../tool.interface';
import type { LlmToolDefinition } from '../../llm/llm-adapter.interface';
import type { BusinessesService } from '../../../businesses/businesses.service';
import { UpdateBusinessDto } from '../../../businesses/dto/update-business.dto';
import { UpdateBusinessConfigDto } from '../../../businesses/dto/update-business-config.dto';
import { validarConDto } from '../acciones/validar-args';
import { entreComillas, monto, presente } from '../acciones/formato';

// Lo que se le manda al service, armado en un solo lugar: validarArgs() lo
// pasa por el DTO del endpoint (PUT /businesses/me y /businesses/me/config) y
// execute() lo escribe, así lo validado es exactamente lo escrito. Solo con
// las claves que vinieron con valor: el modelo a veces manda null en los
// opcionales queriendo decir "no tocar", y un null que llegara al service se
// escribiría sin que la tarjeta lo muestre.
function soloPresentes(args: Record<string, unknown>, claves: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of claves) if (presente(args[k])) out[k] = args[k];
  return out;
}

const CAMPOS_NEGOCIO = ['name', 'industry', 'description'];
const CAMPOS_PAGOS = ['acceptsMercadopago', 'acceptsCash', 'acceptsTransfer', 'acceptsCard', 'acceptsCoordinateLater', 'transferAlias'];
const CAMPOS_ENVIOS = ['freeShippingFrom', 'shippingPolicy', 'enabledCarriers'];

export class UpdateBusinessInfoTool implements OrbiTool {
  name = 'updateBusinessInfo';
  description = 'Actualizar el nombre, rubro o descripción del negocio. NO permite cambiar el subdominio, el plan ni las credenciales — eso está fuera de mi alcance.';
  surfaces = [OrbiSurface.PANEL];
  requiredPermissions = ['config.edit'];
  requiresConfirmation = true;

  // Antes mostraba solo los NOMBRES de los campos: "(name, description)". La
  // persona confirmaba sin ver qué nombre ni qué descripción iba a quedar en
  // su tienda.
  describirAccion(args: Record<string, unknown>): string {
    const etiquetas: Record<string, string> = { name: 'nombre', industry: 'rubro', description: 'descripción' };
    const cambios = CAMPOS_NEGOCIO
      .filter(k => presente(args[k]))
      .map(k => `${etiquetas[k]} ${entreComillas(args[k])}`);
    return `Cambiar datos del negocio: ${cambios.join(', ') || 'sin cambios'}`;
  }

  validarArgs(args: Record<string, unknown>) {
    return validarConDto(UpdateBusinessDto, soloPresentes(args, CAMPOS_NEGOCIO));
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
      await this.businessesService.updateMe(ctx.businessId, soloPresentes(args, CAMPOS_NEGOCIO) as UpdateBusinessDto);

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
  requiredPermissions = ['config.edit'];
  requiresConfirmation = true;

  // Los nombres son los del panel (ConfigGeneral.tsx): acceptsTransfer hoy se
  // llama "Coordinar por WhatsApp" allá, y acceptsCoordinateLater es "Permitir
  // pagar más tarde". El alias de transferencia se muestra siempre que venga:
  // es público en la tienda y es a donde va la plata de los clientes.
  describirAccion(args: Record<string, unknown>): string {
    const nombres: Record<string, string> = {
      acceptsMercadopago: 'Mercado Pago', acceptsCash: 'efectivo',
      acceptsTransfer: 'coordinar por WhatsApp', acceptsCard: 'tarjeta',
      acceptsCoordinateLater: 'pagar más tarde',
    };
    const booleanos = Object.keys(nombres);
    const prende = booleanos.filter(k => args[k] === true).map(k => nombres[k]);
    const apaga = booleanos.filter(k => args[k] === false).map(k => nombres[k]);
    const partes = [
      prende.length ? `activar ${prende.join(', ')}` : '',
      apaga.length ? `desactivar ${apaga.join(', ')}` : '',
      presente(args.transferAlias) ? `alias de transferencia ${entreComillas(args.transferAlias)}` : '',
    ].filter(Boolean);
    return `Cambiar métodos de pago: ${partes.join('; ') || 'sin cambios'}`;
  }

  validarArgs(args: Record<string, unknown>) {
    return validarConDto(UpdateBusinessConfigDto, soloPresentes(args, CAMPOS_PAGOS));
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
      await this.businessesService.updateConfig(ctx.businessId, soloPresentes(args, CAMPOS_PAGOS) as UpdateBusinessConfigDto);

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
  requiredPermissions = ['config.edit'];
  requiresConfirmation = true;

  // Antes mostraba solo el envío gratis: una política de envío o una lista de
  // transportistas cambiada por el modelo pasaba sin que la persona la viera.
  describirAccion(args: Record<string, unknown>): string {
    const transportistas: Record<string, string> = {
      CORREO_ARGENTINO: 'Correo Argentino', OCA: 'OCA', ANDREANI: 'Andreani',
      VIA_CARGO: 'Vía Cargo', DELIVERY_APP: 'app de delivery', OTRO: 'otro',
    };
    const partes: string[] = [];
    if (presente(args.freeShippingFrom)) partes.push(`gratis desde ${monto(args.freeShippingFrom)}`);
    if (Array.isArray(args.enabledCarriers)) {
      // Vacía = todos habilitados (así lo interpreta la tienda, ver schema).
      partes.push(args.enabledCarriers.length
        ? `transportistas: ${args.enabledCarriers.map(c => transportistas[String(c)] ?? entreComillas(c)).join(', ')}`
        : 'transportistas: todos');
    }
    if (presente(args.shippingPolicy)) partes.push(`política de envío ${entreComillas(args.shippingPolicy)}`);
    return `Cambiar envíos: ${partes.join('; ') || 'sin cambios'}`;
  }

  validarArgs(args: Record<string, unknown>) {
    return validarConDto(UpdateBusinessConfigDto, soloPresentes(args, CAMPOS_ENVIOS));
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
      await this.businessesService.updateConfig(ctx.businessId, soloPresentes(args, CAMPOS_ENVIOS) as UpdateBusinessConfigDto);

      return { success: true, label: 'Configuración de envíos actualizada', data: {} };
    } catch (error: any) {
      const msg = error?.response?.message ?? error?.message ?? String(error);
      return { success: false, error: `No pude actualizar los envíos: ${msg}`, label: 'Error actualizando envíos' };
    }
  }
}
