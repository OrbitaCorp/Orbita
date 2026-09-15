import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  findAll(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.branchesService.findAll(member.businessId);
  }

  @Get(':id')
  findOne(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.branchesService.findOne(member.businessId, id);
  }

  // Rol owner únicamente: crear/editar/eliminar sucursales es una operación
  // estructural (a diferencia de config/appearance, no es reversible con un toggle).
  // CONTRATO_API.md permite owner/admin acá — decisión documentada en el resumen final.
  @Post()
  @Roles('owner')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: CreateBranchDto) {
    const member = assertMemberContext(ctx);
    return this.branchesService.create(member.businessId, dto, member.memberId);
  }

  @Put(':id')
  @Roles('owner')
  update(
    @CurrentBusiness() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    const member = assertMemberContext(ctx);
    return this.branchesService.update(member.businessId, id, dto, member.memberId);
  }

  @Delete(':id')
  @Roles('owner')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.branchesService.remove(member.businessId, id, member.memberId);
  }
}
