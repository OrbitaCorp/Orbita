import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentPriceRule } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import type { ReglaPrecioDto } from '../../appointments.types';
import { AvanzadoContextoService, Db } from '../comun/contexto.service';
import { UpsertPriceRuleDto } from './dto/upsert-price-rule.dto';
import { PrecioAjustado, ReglaPrecio, ajustarPrecioConReglas } from './precios-horario.puro';

const MAX_REGLAS = 30;

const aDto = (r: AppointmentPriceRule): ReglaPrecioDto => ({
  id: r.id, weekdays: [...r.weekdays].sort((a, b) => a - b), fromMin: r.fromMin, toMin: r.toMin, adjustPercent: r.adjustPercent, isActive: r.isActive,
});

/**
 * Precios por horario (P4.4): CRUD de franjas y el ajuste que se enchufa en la
 * reserva (`ajustarPrecio`) y en la disponibilidad (`reglasVigentes` +
 * `ajustarPrecioConReglas`, para no ir a la base por cada horario libre).
 */
@Injectable()
export class PreciosHorarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: AvanzadoContextoService,
    private readonly audit: AuditService,
  ) {}

  async listar(businessId: string): Promise<ReglaPrecioDto[]> {
    await this.contexto.delNegocio(businessId);
    const reglas = await this.prisma.appointmentPriceRule.findMany({ where: { businessId }, orderBy: [{ createdAt: 'asc' }] });
    return reglas.map(aDto);
  }

  async crear(businessId: string, memberId: string, dto: UpsertPriceRuleDto): Promise<ReglaPrecioDto> {
    await this.contexto.delNegocio(businessId);
    validarFranja(dto);
    const cuantas = await this.prisma.appointmentPriceRule.count({ where: { businessId } });
    if (cuantas >= MAX_REGLAS) throw new BadRequestException(`Podés tener hasta ${MAX_REGLAS} franjas.`);
    const r = await this.prisma.appointmentPriceRule.create({
      data: { businessId, weekdays: dto.weekdays, fromMin: dto.fromMin, toMin: dto.toMin, adjustPercent: dto.adjustPercent, isActive: dto.isActive ?? true },
    });
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_price_rule', entityId: r.id, action: 'CREATE' });
    return aDto(r);
  }

  async editar(businessId: string, memberId: string, id: string, dto: UpsertPriceRuleDto): Promise<ReglaPrecioDto> {
    await this.contexto.delNegocio(businessId);
    validarFranja(dto);
    const antes = await this.prisma.appointmentPriceRule.findFirst({ where: { id, businessId } });
    if (!antes) throw new NotFoundException('Esa franja no existe.');
    const data = { weekdays: dto.weekdays, fromMin: dto.fromMin, toMin: dto.toMin, adjustPercent: dto.adjustPercent, isActive: dto.isActive ?? antes.isActive };
    const { count } = await this.prisma.appointmentPriceRule.updateMany({ where: { id, businessId }, data });
    if (count === 0) throw new NotFoundException('Esa franja no existe.');
    const despues = { ...antes, ...data };
    await this.audit.registrar({
      businessId, memberId, entityType: 'appointment_price_rule', entityId: id, action: 'UPDATE',
      changes: AuditService.diferencias(antes, despues, ['weekdays', 'fromMin', 'toMin', 'adjustPercent', 'isActive']),
    });
    return aDto(despues);
  }

  async borrar(businessId: string, memberId: string, id: string): Promise<{ ok: true }> {
    await this.contexto.delNegocio(businessId);
    const { count } = await this.prisma.appointmentPriceRule.deleteMany({ where: { id, businessId } });
    if (count === 0) throw new NotFoundException('Esa franja no existe.');
    await this.audit.registrar({ businessId, memberId, entityType: 'appointment_price_rule', entityId: id, action: 'DELETE' });
    return { ok: true };
  }

  // ── Para enchufar en la reserva y la disponibilidad ──────────────────────

  /**
   * Las reglas que aplican HOY a este negocio: [] si la función está apagada o
   * no hay add-on. Para calcular el precio de muchos horarios libres de una vez
   * con `ajustarPrecioConReglas` (puro).
   */
  async reglasVigentes(businessId: string, tx: Db = this.prisma): Promise<ReglaPrecio[]> {
    const { on } = await this.contexto.activa(businessId, 'precios-horario', tx);
    if (!on) return [];
    return tx.appointmentPriceRule.findMany({
      where: { businessId, isActive: true },
      select: { id: true, weekdays: true, fromMin: true, toMin: true, adjustPercent: true, isActive: true },
    });
  }

  /**
   * Precio de lista de un turno que empieza en `instante` (CONTRATO § 1.3).
   * Sin add-on o con la función apagada devuelve el precio base sin tocar.
   */
  async ajustarPrecio(businessId: string, precioBase: number, instante: Date, tx: Db = this.prisma): Promise<PrecioAjustado> {
    return ajustarPrecioConReglas(await this.reglasVigentes(businessId, tx), precioBase, instante);
  }
}

function validarFranja(dto: UpsertPriceRuleDto): void {
  if (dto.fromMin >= dto.toMin) throw new BadRequestException('La franja tiene que terminar después de empezar.');
}
