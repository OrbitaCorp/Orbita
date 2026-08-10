import { Controller, Get, Query } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { SearchService } from './search.service';

// (Fase 4 — Alex) Búsqueda global del panel: un solo endpoint que busca en
// pedidos, clientes, productos y descuentos/cupones a la vez. Los grupos se
// filtran según los permisos del miembro que busca — un empleado sin
// customers.view no ve clientes en los resultados.
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@CurrentBusiness() ctx: AuthContext, @Query('q') q?: string) {
    const member = assertMemberContext(ctx);
    return this.searchService.search(member.businessId, member.permissions, q ?? '');
  }
}
