import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { PlatformService } from './platform.service';
import { SuspendBusinessDto } from './dto/suspend-business.dto';
import { GrantCompDto } from './dto/grant-comp.dto';
import { UpsertPlatformAdminDto } from './dto/upsert-platform-admin.dto';

// Todos los endpoints de plataforma exigen un super admin autenticado. El
// AuthGuard global valida el JWT; PlatformAdminGuard exige type=platform_admin.
@UseGuards(PlatformAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('businesses')
  listBusinesses() {
    void this.platformService;
    return { message: 'not implemented' };
  }

  @Get('businesses/:businessId')
  getBusiness(@Param('businessId') businessId: string) {
    void this.platformService;
    return { message: 'not implemented' };
  }

  @Post('businesses/:businessId/suspend')
  suspend(@Param('businessId') businessId: string, @Body() dto: SuspendBusinessDto) {
    void this.platformService;
    return { message: 'not implemented' };
  }

  @Post('businesses/:businessId/reactivate')
  reactivate(@Param('businessId') businessId: string) {
    void this.platformService;
    return { message: 'not implemented' };
  }

  @Post('subscriptions/:businessId/grant-comp')
  grantComp(@Param('businessId') businessId: string, @Body() dto: GrantCompDto) {
    void this.platformService;
    return { message: 'not implemented' };
  }

  @Get('admins')
  listAdmins() {
    void this.platformService;
    return { message: 'not implemented' };
  }

  @Post('admins')
  createAdmin(@Body() dto: UpsertPlatformAdminDto) {
    void this.platformService;
    return { message: 'not implemented' };
  }

  @Put('admins/:id')
  updateAdmin(@Param('id') id: string, @Body() dto: UpsertPlatformAdminDto) {
    void this.platformService;
    return { message: 'not implemented' };
  }

  @Delete('admins/:id')
  removeAdmin(@Param('id') id: string) {
    void this.platformService;
    return { message: 'not implemented' };
  }
}
