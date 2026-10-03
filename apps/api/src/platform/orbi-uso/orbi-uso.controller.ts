import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { SoloSuperadmin } from '../../common/decorators/platform-role.decorator';
import { PlatformAdminContext } from '../../common/types/auth-context.type';
import { mesArgentina } from '../../common/utils/hora-argentina';
import { CupoOrbiService } from '../../orbi/cupo/cupo-orbi.service';
import { PlatformAdminLogService } from '../platform-admin-log.service';
import { OrbiUsoService } from './orbi-uso.service';
import { AjusteCupoDto } from './dto/ajuste-cupo.dto';

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

/**
 * Uso de Orbi por mes, negocio y mensaje, y ajustes de cupo (spec
 * 2026-10-03 §5-§6). Solo el superadmin: acá viajan USD, tokens y créditos.
 * Sin `mes` se usa el mes en curso de Argentina.
 */
@UseGuards(PlatformAdminGuard)
@SoloSuperadmin()
@Controller('platform/orbi/uso')
export class OrbiUsoPlataformaController {
  constructor(
    private readonly uso: OrbiUsoService,
    private readonly cupo: CupoOrbiService,
    private readonly adminLog: PlatformAdminLogService,
  ) {}

  @Get()
  resumen(@Query('mes') mes?: string) {
    return this.uso.resumen(mes ?? mesArgentina(new Date()));
  }

  @Get('negocios/:id')
  negocio(@Param('id') id: string, @Query('mes') mes?: string) {
    return this.uso.negocio(id, mes ?? mesArgentina(new Date()));
  }

  @Get('turnos')
  turnos(
    @Query('businessId') businessId: string,
    @Query('memberId') memberId?: string,
    @Query('mes') mes?: string,
    @Query('antesDe') antesDe?: string,
  ) {
    if (!businessId) throw new BadRequestException('Falta el negocio');
    return this.uso.turnos({ businessId, memberId, mes: mes ?? mesArgentina(new Date()), antesDe });
  }

  @Post('ajustes')
  @HttpCode(200)
  async ajustar(@Req() req: RequestWithAdmin, @Body() dto: AjusteCupoDto) {
    const r = await this.cupo.ajustar({ ...dto, adminId: req.user.adminId });
    await this.adminLog.orbiCupoAjuste({
      adminId: req.user.adminId,
      businessId: dto.businessId,
      mes: dto.mes,
      creditos: dto.creditos,
      motivo: dto.motivo,
      ajusteId: r.id,
    });
    return { ok: true, id: r.id };
  }
}
