import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { AddressesService } from './addresses.service';
import { UpsertAddressDto } from './dto/upsert-address.dto';

// (RBT-629) Direcciones guardadas del cliente. Exclusivo del storefront: cada
// ruta resuelve el customerId del token con assertCustomerContext, así un member
// del panel (u otro cliente) no puede tocar estos datos.
@Controller('me/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  findAll(@CurrentUser() ctx: AuthContext) {
    const { customerId } = assertCustomerContext(ctx);
    return this.addressesService.findAll(customerId);
  }

  @Post()
  create(@CurrentUser() ctx: AuthContext, @Body() dto: UpsertAddressDto) {
    const { customerId } = assertCustomerContext(ctx);
    return this.addressesService.create(customerId, dto);
  }

  @Put(':id')
  update(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertAddressDto) {
    const { customerId } = assertCustomerContext(ctx);
    return this.addressesService.update(customerId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    const { customerId } = assertCustomerContext(ctx);
    return this.addressesService.remove(customerId, id);
  }
}
