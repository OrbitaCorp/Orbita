import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { RangoQueryDto } from '../comun/rango';
import { PaginaQueryDto, RegisterPayoutDto } from './dto/ganancias.dto';
import { GananciasService } from './ganancias.service';

// Ganancias del equipo (CONTRATO § P3.4). El guard pide el código base
// (`appointments.earnings.view`); quien no tiene `_all` ve solo lo suyo, y
// eso lo resuelve el service (otra persona → 404).
@Controller('appointments/earnings')
export class GananciasController {
  constructor(private readonly ganancias: GananciasService) {}

  @Get()
  @RequirePermission('appointments.earnings.view')
  resumen(@CurrentBusiness() ctx: AuthContext, @Query() q: RangoQueryDto) {
    return this.ganancias.resumen(assertMemberContext(ctx), q);
  }

  @Get(':resourceId')
  @RequirePermission('appointments.earnings.view')
  persona(@CurrentBusiness() ctx: AuthContext, @Param('resourceId', new ParseUUIDPipe()) resourceId: string, @Query() q: RangoQueryDto) {
    return this.ganancias.persona(assertMemberContext(ctx), resourceId, q);
  }

  @Get(':resourceId/payouts')
  @RequirePermission('appointments.earnings.view')
  pagos(@CurrentBusiness() ctx: AuthContext, @Param('resourceId', new ParseUUIDPipe()) resourceId: string, @Query() q: PaginaQueryDto) {
    return this.ganancias.pagos(assertMemberContext(ctx), resourceId, q);
  }

  @Post(':resourceId/payouts')
  @RequirePermission('appointments.earnings.settle')
  registrarPago(@CurrentBusiness() ctx: AuthContext, @Param('resourceId', new ParseUUIDPipe()) resourceId: string, @Body() dto: RegisterPayoutDto) {
    return this.ganancias.registrarPago(assertMemberContext(ctx), resourceId, dto);
  }
}
