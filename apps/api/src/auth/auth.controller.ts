import { Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { DeviceInfo } from './auth.service';

// user-agent + IP del request, para la metadata de "sesiones activas" (RBT-631).
function deviceInfoFrom(req: Request): DeviceInfo {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  register(@Body() dto: RegisterDto, @Headers('x-business-slug') businessSlug: string) {
    return this.authService.register(dto, businessSlug);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  login(@Body() dto: LoginDto, @Req() req: Request, @Headers('x-business-slug') businessSlug?: string) {
    return this.authService.login(dto, businessSlug, deviceInfoFrom(req));
  }

  @Post('refresh')
  @Public()
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, deviceInfoFrom(req));
  }

  @Post('logout')
  @Public()
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('forgot-password')
  @Public()
  // Por IP, mismo patrón que login (ThrottlerGuard global no tiene tracker
  // combinado IP+email en este proyecto — ver PENDIENTES.md).
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 intentos / 15 min
  forgotPassword(@Body() dto: ForgotPasswordDto, @Headers('x-business-slug') businessSlug?: string) {
    return this.authService.forgotPassword(dto, businessSlug);
  }

  @Post('verify-reset-code')
  @Public()
  // Por IP: el límite real (5 intentos por código) vive en el servicio, esto
  // es una segunda capa contra alguien probando muchos emails/códigos distintos.
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 intentos / 15 min
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('accept-invitation')
  @Public()
  acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return this.authService.acceptInvitation(dto);
  }

  @Get('me')
  getMe(@CurrentUser() user: AuthContext) {
    return this.authService.getMe(user);
  }
}
