import { Body, Controller, ForbiddenException, Get, Next, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { isUUID } from 'class-validator';
import type { NextFunction, Response } from 'express';
import { CurrentBusiness } from '../../common/decorators/current-business.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../common/types/auth-context.type';
import { assertMemberContext } from '../../common/utils/assert-member-context';
import { AppointmentsPanelService } from './appointments-panel.service';
import {
  AvailabilityQueryDto, AvailabilityRangeQueryDto, ChangeStatusDto, CreateAppointmentDto, ListAppointmentsQueryDto, MessageTemplateDto,
  MoveAppointmentDto, NoteDto, RegisterDepositDto,
} from './dto/appointments.dto';
import { tiene } from './lib/permisos';

const UUID = new ParseUUIDPipe({ version: '4' });

/** Permiso del detalle: se chequea en el handler (ver `detail`). */
export const PERMISO_DETALLE = 'appointments.agenda.view';

// Turnos del panel (CONTRATO.md § P1.4). Las rutas fijas (availability,
// availability/range) van ANTES que `:id`.
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly panel: AppointmentsPanelService) {}

  @Get()
  @RequirePermission('appointments.agenda.view')
  list(@CurrentBusiness() ctx: AuthContext, @Query() q: ListAppointmentsQueryDto) {
    return this.panel.listar(assertMemberContext(ctx), q);
  }

  @Get('availability')
  @RequirePermission('appointments.agenda.manage')
  availability(@CurrentBusiness() ctx: AuthContext, @Query() q: AvailabilityQueryDto) {
    return this.panel.disponibilidad(assertMemberContext(ctx), q);
  }

  @Get('availability/range')
  @RequirePermission('appointments.agenda.manage')
  availabilityRange(@CurrentBusiness() ctx: AuthContext, @Query() q: AvailabilityRangeQueryDto) {
    return this.panel.disponibilidadRango(assertMemberContext(ctx), q);
  }

  /**
   * GET appointments/:id. Este módulo se registra antes que los de P2–P4, y
   * Express toma la primera ruta que coincide: un `:id` a secas taparía
   * `GET appointments/clients`, `/team`, `/roles`, `/earnings`… Por eso un id
   * que no es UUID sigue de largo (`next()`) hacia la ruta que corresponda, y
   * el permiso se chequea acá adentro, DESPUÉS de ese paso, en vez de con
   * @RequirePermission (el guard cortaría con 403 antes de poder seguir).
   */
  @Get(':id')
  async detail(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Res() res: Response, @Next() next: NextFunction): Promise<void> {
    if (!isUUID(id, '4')) return next();
    const member = assertMemberContext(ctx);
    if (!tiene(member, PERMISO_DETALLE)) throw new ForbiddenException(`Permiso requerido: ${PERMISO_DETALLE}`);
    res.json(await this.panel.detalle(member, id));
  }

  @Post()
  @RequirePermission('appointments.agenda.manage')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: CreateAppointmentDto) {
    return this.panel.crear(assertMemberContext(ctx), dto);
  }

  @Patch(':id/status')
  @RequirePermission('appointments.agenda.manage')
  changeStatus(@CurrentBusiness() ctx: AuthContext, @Param('id', UUID) id: string, @Body() dto: ChangeStatusDto) {
    return this.panel.cambiarEstado(assertMemberContext(ctx), id, dto);
  }

  @Post(':id/move')
  @RequirePermission('appointments.agenda.manage')
  move(@CurrentBusiness() ctx: AuthContext, @Param('id', UUID) id: string, @Body() dto: MoveAppointmentDto) {
    return this.panel.mover(assertMemberContext(ctx), id, dto);
  }

  @Post(':id/deposit')
  @RequirePermission('appointments.cash.charge')
  deposit(@CurrentBusiness() ctx: AuthContext, @Param('id', UUID) id: string, @Body() dto: RegisterDepositDto) {
    return this.panel.registrarPago(assertMemberContext(ctx), id, dto);
  }

  @Patch(':id/note')
  @RequirePermission('appointments.agenda.manage')
  note(@CurrentBusiness() ctx: AuthContext, @Param('id', UUID) id: string, @Body() dto: NoteDto) {
    return this.panel.nota(assertMemberContext(ctx), id, dto);
  }

  // Trae el enlace personal del turno adentro del texto: por eso pide clients.contact.
  @Get(':id/message')
  @RequirePermission('appointments.clients.contact')
  message(@CurrentBusiness() ctx: AuthContext, @Param('id', UUID) id: string, @Query() q: MessageTemplateDto) {
    return this.panel.mensaje(assertMemberContext(ctx), id, q.template);
  }

  @Post(':id/messages')
  @RequirePermission('appointments.clients.contact')
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  sendMessage(@CurrentBusiness() ctx: AuthContext, @Param('id', UUID) id: string, @Body() dto: MessageTemplateDto) {
    return this.panel.enviarMensaje(assertMemberContext(ctx), id, dto.template);
  }
}
