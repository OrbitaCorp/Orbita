import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { ListaEsperaService } from './lista-espera.service';
import { ListWaitlistQuery, OfferWaitlistDto } from './dto/lista-espera.dto';

// Lista de espera de turnos (CONTRATO § P4.8). No es una función de Avanzado
// con interruptor (depende de rules.waitlistEnabled): sin @RequiresAddon.
@Controller('appointments/waitlist')
export class ListaEsperaController {
  constructor(private readonly espera: ListaEsperaService) {}

  @Get()
  @RequirePermission('appointments.agenda.view')
  listar(@CurrentBusiness() ctx: AuthContext, @Query() q: ListWaitlistQuery) {
    return this.espera.listar(assertMemberContext(ctx), q);
  }

  @Post(':id/offer')
  @RequirePermission('appointments.agenda.manage')
  ofrecer(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferWaitlistDto) {
    return this.espera.ofrecerAMano(assertMemberContext(ctx), id, dto);
  }

  @Delete(':id')
  @RequirePermission('appointments.agenda.manage')
  sacar(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.espera.sacar(assertMemberContext(ctx), id);
  }
}
