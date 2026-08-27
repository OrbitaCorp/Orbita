import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { RequiresAddon } from '../common/decorators/requires-addon.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { GamesService } from './games.service';
import { UpsertGameDto } from './dto/upsert-game.dto';

// Paquete "Avanzado" — gateado por AddonGuard en los dos endpoints (mismo
// patrón que el resto de rutas de panel que requieren el add-on). Estos
// endpoints son del PANEL (dueño configurando), no del storefront — el
// consumo desde la tienda (Fase 2.2) va a resolver el add-on por su cuenta,
// AddonGuard es member-scoped (ver su comentario).
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  @RequiresAddon('ADVANCED')
  getGames(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.gamesService.getForBusiness(member.businessId);
  }

  @Put(':type')
  @RequiresAddon('ADVANCED')
  upsertGame(@CurrentBusiness() ctx: AuthContext, @Param('type') type: string, @Body() dto: UpsertGameDto) {
    const member = assertMemberContext(ctx);
    return this.gamesService.upsert(member.businessId, type, dto);
  }

  // Reporte de ganadores — "cómo lleva el dueño el control de quién ganó".
  @Get(':type/winners')
  @RequiresAddon('ADVANCED')
  getWinners(@CurrentBusiness() ctx: AuthContext, @Param('type') type: string) {
    const member = assertMemberContext(ctx);
    return this.gamesService.getWinners(member.businessId, type);
  }
}
