import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentBusiness } from '../../common/decorators/current-business.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../common/types/auth-context.type';
import { assertMemberContext } from '../../common/utils/assert-member-context';
import { AppointmentsSettingsService } from './appointments-settings.service';
import {
  UpdateBookingDto, UpdateBusinessDto, UpdateMessagesDto, UpdatePaymentsDto, UpdateScheduleDto, UpdateSiteDto, UpdateWhatsappDto,
} from './dto/settings.dto';

// Configuración de Turnos (CONTRATO.md § P1.1). El GET lo lee cualquier
// miembro (el panel lo necesita para dibujarse); cada pestaña se guarda con
// appointments.settings.manage. Sin secretos: alias/CBU y el número de
// WhatsApp van en null para quien no configura.
@Controller('appointments/settings')
export class AppointmentsSettingsController {
  constructor(private readonly settings: AppointmentsSettingsService) {}

  @Get()
  get(@CurrentBusiness() ctx: AuthContext) {
    return this.settings.leer(assertMemberContext(ctx));
  }

  @Put('business')
  @RequirePermission('appointments.settings.manage')
  updateBusiness(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpdateBusinessDto) {
    return this.settings.actualizarNegocio(assertMemberContext(ctx), dto);
  }

  @Put('site')
  @RequirePermission('appointments.settings.manage')
  updateSite(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpdateSiteDto) {
    return this.settings.actualizarSitio(assertMemberContext(ctx), dto);
  }

  @Put('schedule')
  @RequirePermission('appointments.settings.manage')
  updateSchedule(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpdateScheduleDto) {
    return this.settings.actualizarHorarios(assertMemberContext(ctx), dto);
  }

  @Put('booking')
  @RequirePermission('appointments.settings.manage')
  updateBooking(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpdateBookingDto) {
    return this.settings.actualizarReglas(assertMemberContext(ctx), dto);
  }

  @Put('messages')
  @RequirePermission('appointments.settings.manage')
  updateMessages(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpdateMessagesDto) {
    return this.settings.actualizarMensajes(assertMemberContext(ctx), dto);
  }

  @Put('payments')
  @RequirePermission('appointments.settings.manage')
  updatePayments(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpdatePaymentsDto) {
    return this.settings.actualizarPagos(assertMemberContext(ctx), dto);
  }

  @Put('whatsapp')
  @RequirePermission('appointments.settings.manage')
  updateWhatsapp(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpdateWhatsappDto) {
    return this.settings.actualizarWhatsapp(assertMemberContext(ctx), dto);
  }
}
