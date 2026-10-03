import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import type { AvanzadoTurnos, FuncionAvanzada } from '../../appointments.types';
import { rubroTurnosPorKey } from '../../catalogo/rubros';
import { AvanzadoContextoService, leerAvanzado } from '../comun/contexto.service';
import { FUNCIONES_AVANZADAS, configDe, esFuncionAvanzada, recomendadasPara } from '../comun/funciones';
import { DTO_DE_CONFIG, PutAdvancedDto } from './dto/config-avanzado.dto';

export interface HubAvanzadoDto {
  hasAdvanced: boolean;
  functions: AvanzadoTurnos;
  recommended: FuncionAvanzada[];
}

/**
 * El hub de Avanzado (CONTRATO § P4): qué funciones están prendidas, con qué
 * config, y cuáles se recomiendan para el rubro. El GET no pide el add-on (el
 * hub se muestra igual, con el candado); prender/apagar y configurar, sí.
 */
@Injectable()
export class HubAvanzadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: AvanzadoContextoService,
    private readonly audit: AuditService,
  ) {}

  async obtener(businessId: string): Promise<HubAvanzadoDto> {
    const negocio = await this.contexto.delNegocio(businessId);
    return {
      hasAdvanced: await this.contexto.hayAddon(businessId),
      functions: normalizar(negocio.settings.advanced),
      recommended: recomendadasPara(rubroTurnosPorKey(negocio.settings.rubroKey)),
    };
  }

  async guardar(businessId: string, memberId: string, funcion: string, dto: PutAdvancedDto): Promise<AvanzadoTurnos> {
    if (!esFuncionAvanzada(funcion)) throw new NotFoundException('Esa función no existe.');
    const negocio = await this.contexto.delNegocio(businessId);
    const guardado = leerAvanzado(negocio.settings.advanced);
    const anterior = (guardado[funcion] ?? {}) as { on?: boolean; config?: Record<string, unknown> };

    let config = anterior.config ?? {};
    if (dto.config) {
      const instancia = plainToInstance(DTO_DE_CONFIG[funcion], dto.config);
      const errores = await validate(instancia, { whitelist: true, forbidNonWhitelisted: true });
      if (errores.length > 0) {
        const e = errores[0];
        throw new BadRequestException(Object.values(e.constraints ?? {})[0] ?? `Revisá «${e.property}».`);
      }
      // Con ES2023 los campos declarados existen aunque no vengan (undefined): no pisan lo guardado.
      const nuevos = Object.fromEntries(Object.entries(instancia).filter(([, v]) => v !== undefined));
      config = { ...config, ...nuevos };
      await this.validarReferencias(businessId, funcion, config);
    }

    const nuevo: AvanzadoTurnos = { ...guardado, [funcion]: { on: dto.on, ...(Object.keys(config).length > 0 ? { config } : {}) } };
    const { count } = await this.prisma.appointmentSettings.updateMany({
      where: { businessId },
      data: { advanced: nuevo as unknown as Prisma.InputJsonValue },
    });
    if (count === 0) throw new NotFoundException('Este negocio no usa Turnos');
    await this.audit.registrar({
      businessId, memberId, entityType: 'appointment_settings', entityId: negocio.settings.id,
      action: dto.on === (anterior.on === true) ? 'UPDATE' : dto.on ? 'ACTIVATE' : 'DEACTIVATE',
      changes: [{ field: `advanced.${funcion}`, before: anterior, after: nuevo[funcion] }],
    });
    return normalizar(nuevo);
  }

  /** Los ids que nombra una config tienen que ser servicios de ESTE negocio. */
  private async validarReferencias(businessId: string, funcion: FuncionAvanzada, config: Record<string, unknown>): Promise<void> {
    const ids = funcion === 'turno-fijo' ? ((config.serviceIds as string[] | undefined) ?? [])
      : funcion === 'fidelidad' && typeof config.serviceId === 'string' ? [config.serviceId] : [];
    if (ids.length === 0) return;
    const existen = await this.prisma.appointmentService.count({ where: { businessId, id: { in: ids }, deletedAt: null } });
    if (existen !== new Set(ids).size) throw new BadRequestException('Uno de los servicios elegidos no existe.');
  }
}

/** Todas las funciones, cada una con su interruptor y su config completa (fábrica + guardado). */
export function normalizar(json: unknown): AvanzadoTurnos {
  const guardado = leerAvanzado(json);
  const salida: AvanzadoTurnos = {};
  for (const f of FUNCIONES_AVANZADAS) {
    const g = (guardado[f] ?? {}) as { on?: boolean; config?: unknown };
    (salida as Record<string, unknown>)[f] = { on: g.on === true, config: configDe(f, g.config) };
  }
  return salida;
}
