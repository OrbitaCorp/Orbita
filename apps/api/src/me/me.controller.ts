import { BadRequestException, Body, Controller, Get, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { MeService } from './me.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// (RBT-630 / RBT-631) Cuenta del cliente del storefront. Exclusivo de customers:
// cada handler resuelve el customerId del token con assertCustomerContext.
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  getProfile(@CurrentUser() ctx: AuthContext) {
    const { customerId } = assertCustomerContext(ctx);
    return this.meService.getProfile(customerId);
  }

  @Patch()
  updateProfile(@CurrentUser() ctx: AuthContext, @Body() dto: UpdateMeDto) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.meService.updateProfile(customerId, businessId, dto);
  }

  @Post('change-password')
  changePassword(@CurrentUser() ctx: AuthContext, @Body() dto: ChangePasswordDto) {
    const { customerId } = assertCustomerContext(ctx);
    return this.meService.changePassword(customerId, dto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(@CurrentUser() ctx: AuthContext, @UploadedFile() file?: Express.Multer.File) {
    const { customerId } = assertCustomerContext(ctx);
    if (!file) throw new BadRequestException('Falta el archivo.');
    return this.meService.uploadAvatar(customerId, file);
  }
}
