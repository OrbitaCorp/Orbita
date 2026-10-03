import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { ClientesService } from './clientes.service';
import { CreateClientDto, ListClientsQueryDto, UpdateClientDto } from './dto/clientes.dto';

// Clientes de Turnos (CONTRATO § P3.2). No es /customers de Tienda: ese pide
// permisos customers.* y expone columnas que acá no van.
@Controller('appointments/clients')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  @RequirePermission('appointments.clients.view')
  listar(@CurrentBusiness() ctx: AuthContext, @Query() q: ListClientsQueryDto) {
    return this.clientes.listar(assertMemberContext(ctx), q);
  }

  @Get(':id')
  @RequirePermission('appointments.clients.view')
  ficha(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.clientes.ficha(assertMemberContext(ctx), id);
  }

  @Post()
  @RequirePermission('appointments.agenda.manage')
  crear(@CurrentBusiness() ctx: AuthContext, @Body() dto: CreateClientDto) {
    return this.clientes.crear(assertMemberContext(ctx), dto);
  }

  @Put(':id')
  @RequirePermission('appointments.agenda.manage')
  editar(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateClientDto) {
    return this.clientes.editar(assertMemberContext(ctx), id, dto);
  }
}
