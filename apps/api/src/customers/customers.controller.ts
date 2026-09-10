import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { CustomersService } from './customers.service';
import { UpsertCustomerDto } from './dto/upsert-customer.dto';
import { CustomerEmailDto } from './dto/customer-email.dto';
import { FindCustomersQueryDto } from './dto/find-customers-query.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermission('customers.view')
  findAll(@CurrentBusiness() ctx: AuthContext, @Query() query: FindCustomersQueryDto) {
    const member = assertMemberContext(ctx);
    return this.customersService.findAll(member.businessId, query);
  }

  // Antes de `:id` a propósito: si no, "export" se tomaba como un id.
  // Baja la base entera con DNI y teléfono: pide customers.manage, el mismo
  // permiso con el que el panel muestra el botón y el del email masivo (no hay
  // un `customers.export` en el catálogo). Antes pedía customers.view y un
  // Empleado podía bajarla por la API aunque no viera el botón (auditoría
  // interna 10/09, ítem web.panel.clientes). Queda registrada en audit_logs.
  @Get('export')
  @RequirePermission('customers.manage')
  exportAll(@CurrentBusiness() ctx: AuthContext, @Query() query: FindCustomersQueryDto) {
    const member = assertMemberContext(ctx);
    return this.customersService.exportAll(member.businessId, member.memberId, query.search);
  }

  @Get(':id')
  @RequirePermission('customers.view')
  findOne(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.customersService.findOne(member.businessId, id);
  }

  @Post()
  @RequirePermission('customers.manage')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertCustomerDto) {
    const member = assertMemberContext(ctx);
    return this.customersService.create(member.businessId, dto);
  }

  @Put(':id')
  @RequirePermission('customers.manage')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertCustomerDto) {
    const member = assertMemberContext(ctx);
    return this.customersService.update(member.businessId, id, dto);
  }

  @Post('email')
  @RequirePermission('customers.manage')
  sendEmail(@CurrentBusiness() ctx: AuthContext, @Body() dto: CustomerEmailDto) {
    const member = assertMemberContext(ctx);
    return this.customersService.sendEmail(member.businessId, dto);
  }
}
