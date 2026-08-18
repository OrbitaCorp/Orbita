import { Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { AuthThrottlerGuard } from '../common/guards/auth-throttler.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { VerifyPlatformAdminCodeDto } from './dto/verify-platform-admin-code.dto';
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
  register(@Body() dto: RegisterDto, @Req() req: Request, @Headers('x-business-slug') businessSlug: string) {
    return this.authService.register(dto, businessSlug, deviceInfoFrom(req));
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(AuthThrottlerGuard) // + balde por email, además del de IP (RBT-662)
  login(@Body() dto: LoginDto, @Req() req: Request, @Headers('x-business-slug') businessSlug?: string) {
    return this.authService.login(dto, businessSlug, deviceInfoFrom(req));
  }

  @Post('refresh')
  @Public()
  refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Headers('x-business-slug') businessSlug?: string,
  ) {
    return this.authService.refresh(dto.refreshToken, deviceInfoFrom(req), businessSlug);
  }

  @Post('logout')
  @Public()
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  // Sola-lectura: no rota nada, solo dice si ese refresh token de panel
  // sigue vivo y es de ESTE negocio (ver AuthService.peekPanelSession) — lo
  // usa /api/auth/has-session (BFF) para decidir si mostrar el atajo "Panel
  // de administrador" en el storefront, sin arriesgar una colisión de
  // rotación con un refresh real en otra pestaña.
  @Post('session/peek')
  @Public()
  async peekSession(@Body() dto: RefreshDto, @Headers('x-business-slug') businessSlug?: string) {
    const exists = await this.authService.peekPanelSession(dto.refreshToken, businessSlug);
    return { exists };
  }

  @Post('forgot-password')
  @Public()
  // Por IP, mismo patrón que login (ThrottlerGuard global no tiene tracker
  // combinado IP+email en este proyecto — ver PENDIENTES.md).
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 intentos / 15 min
  @UseGuards(AuthThrottlerGuard) // + balde por email, además del de IP (RBT-662)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Headers('x-business-slug') businessSlug?: string) {
    return this.authService.forgotPassword(dto, businessSlug);
  }

  @Post('verify-reset-code')
  @Public()
  // Por IP: el límite real (5 intentos por código) vive en el servicio, esto
  // es una segunda capa contra alguien probando muchos emails/códigos distintos.
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 intentos / 15 min
  @UseGuards(AuthThrottlerGuard) // + balde por email, además del de IP (RBT-662)
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @UseGuards(AuthThrottlerGuard) // + balde por email, además del de IP (RBT-662)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // Datos públicos de una invitación vigente (tienda, rol, invitado) para que
  // la pantalla /aceptar-invitacion salude con nombre. Con throttle: es un
  // endpoint público que se consulta por token.
  @Get('invitation-info')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  invitationInfo(@Query('token') token?: string) {
    return this.authService.invitationInfo(token ?? '');
  }

  @Post('accept-invitation')
  @Public()
  acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return this.authService.acceptInvitation(dto);
  }

  // Segundo factor del login de platform admin (RBT-647). Mismo criterio de
  // throttle que verify-reset-code: el límite real (5 intentos por código)
  // vive en el servicio, esto es una segunda capa contra fuerza bruta por IP.
  @Post('platform/verify-code')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @UseGuards(AuthThrottlerGuard) // + balde por email, además del de IP (RBT-662)
  verifyPlatformAdminCode(@Body() dto: VerifyPlatformAdminCodeDto, @Req() req: Request) {
    return this.authService.verifyPlatformAdminLoginCode(dto.email, dto.code, deviceInfoFrom(req));
  }

  @Get('me')
  getMe(@CurrentUser() user: AuthContext) {
    return this.authService.getMe(user);
  }
}
