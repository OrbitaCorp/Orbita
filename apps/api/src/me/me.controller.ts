import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { AuthService } from '../auth/auth.service';
import { MeService } from './me.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// (RBT-630 / RBT-631) Cuenta del cliente del storefront. Exclusivo de customers:
// cada handler resuelve el customerId del token con assertCustomerContext.
//
// Las rutas de sesiones delegan en AuthService (dueño de refresh_tokens). El
// "x-refresh-token" opcional lo manda el BFF de Next.js desde la cookie httpOnly
// para saber cuál es LA sesión actual (marcarla / preservarla al cerrar el resto).
@Controller('me')
export class MeController {
  constructor(
    private readonly meService: MeService,
    private readonly authService: AuthService,
  ) {}

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

  // ── Sesiones activas (RBT-631) ─────────────────────────────────────────────

  @Get('sessions')
  listSessions(@CurrentUser() ctx: AuthContext, @Headers('x-refresh-token') currentRefreshToken?: string) {
    const { customerId } = assertCustomerContext(ctx);
    return this.authService.listSessions(customerId, 'CUSTOMER', currentRefreshToken);
  }

  @Delete('sessions/:id')
  async revokeSession(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    const { customerId } = assertCustomerContext(ctx);
    await this.authService.revokeSession(customerId, 'CUSTOMER', id);
    return { ok: true };
  }

  // Cierra todas las demás sesiones (preserva la actual si el BFF manda su
  // refresh token en x-refresh-token). "Cerrá sesión en los otros dispositivos".
  @Post('sessions/revoke-all')
  async revokeAllSessions(@CurrentUser() ctx: AuthContext, @Headers('x-refresh-token') currentRefreshToken?: string) {
    const { customerId } = assertCustomerContext(ctx);
    await this.authService.revokeAllSessions(customerId, 'CUSTOMER', currentRefreshToken);
    return { ok: true };
  }
}
