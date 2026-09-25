import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { SoloSuperadmin } from '../../common/decorators/platform-role.decorator';
import { CostsService } from './costs.service';
import { CreateLimitDto } from './dto/create-limit.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { MonthQueryDto, MonthsQueryDto } from './dto/month-query.dto';

@UseGuards(PlatformAdminGuard)
@SoloSuperadmin()
@Controller('platform/costs')
export class CostsController {
  constructor(private readonly costs: CostsService) {}

  @Get('overview')
  overview(@Query() query: MonthsQueryDto) {
    return this.costs.getOverview(query.months ?? 3);
  }

  @Get('history')
  history(@Query() query: MonthsQueryDto) {
    return this.costs.getHistory(query.months ?? 6);
  }

  @Get('provider/:slug')
  providerDetail(@Param('slug') slug: string, @Query() query: MonthQueryDto) {
    const month = query.month ?? new Date().toISOString().slice(0, 7);
    return this.costs.getProviderDetail(slug, month);
  }

  @Get('by-business')
  byBusiness(@Query() query: MonthQueryDto) {
    const month = query.month ?? new Date().toISOString().slice(0, 7);
    return this.costs.getByBusiness(month);
  }

  @Get('usage')
  usage() {
    return this.costs.getUsage();
  }

  @Get('limits')
  limits() {
    return this.costs.getLimits();
  }

  @Post('limits')
  createLimit(@Body() dto: CreateLimitDto) {
    return this.costs.createLimit(dto);
  }

  @Delete('limits/:id')
  deleteLimit(@Param('id') id: string) {
    return this.costs.deleteLimit(id);
  }

  @Get('alerts')
  alerts(@Query() query: MonthQueryDto) {
    const month = query.month ?? new Date().toISOString().slice(0, 7);
    return this.costs.getAlerts(month);
  }

  @Post('alerts/:id/ack')
  acknowledgeAlert(@Param('id') id: string) {
    return this.costs.acknowledgeAlert(id);
  }

  @Post('snapshot')
  createSnapshot(@Body() dto: CreateSnapshotDto) {
    return this.costs.createManualSnapshot(dto);
  }

  @Post('sync')
  sync() {
    return this.costs.syncAll();
  }
}
