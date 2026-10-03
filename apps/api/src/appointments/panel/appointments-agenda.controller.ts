import { Controller, Get, Query } from '@nestjs/common';
import { CurrentBusiness } from '../../common/decorators/current-business.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../common/types/auth-context.type';
import { assertMemberContext } from '../../common/utils/assert-member-context';
import { AppointmentsAgendaService } from './appointments-agenda.service';
import { DayQueryDto, RangeQueryDto } from './dto/appointments.dto';

// Agenda y resumen (CONTRATO.md § P1.5).
@Controller('appointments')
export class AppointmentsAgendaController {
  constructor(private readonly agenda: AppointmentsAgendaService) {}

  @Get('agenda/day')
  @RequirePermission('appointments.agenda.view')
  day(@CurrentBusiness() ctx: AuthContext, @Query() q: DayQueryDto) {
    return this.agenda.dia(assertMemberContext(ctx), q.date);
  }

  @Get('agenda/range')
  @RequirePermission('appointments.agenda.view')
  range(@CurrentBusiness() ctx: AuthContext, @Query() q: RangeQueryDto) {
    return this.agenda.rango(assertMemberContext(ctx), q.from, q.to);
  }

  @Get('summary')
  @RequirePermission('appointments.agenda.view')
  summary(@CurrentBusiness() ctx: AuthContext, @Query() q: DayQueryDto) {
    return this.agenda.resumen(assertMemberContext(ctx), q.date);
  }
}
