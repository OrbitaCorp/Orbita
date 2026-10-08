import { Body, Controller, Delete, Get, Logger, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { SoloSuperadmin } from '../../common/decorators/platform-role.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PlatformAdminContext } from '../../common/types/auth-context.type';
import { describeError } from '../../common/utils/describe-error.util';
import { PublicarTiktokDto } from './dto/publicar-tiktok.dto';
import { TiktokService } from './tiktok.service';

// `express` es solo dependencia transitiva — mismo motivo que en instagram.controller.ts.
interface RedirectableResponse {
  redirect(url: string): void;
}

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

// Marketing → TikTok del super panel. Leer el estado lo puede cualquier admin de plataforma;
// conectar, publicar y desconectar son cosa de superadmin (publican con el nombre de la empresa).
@UseGuards(PlatformAdminGuard)
@Controller('platform/marketing/tiktok')
export class TiktokController {
  constructor(private readonly tiktok: TiktokService) {}

  @Get()
  estado() {
    return this.tiktok.estado();
  }

  // Devuelve la dirección del login de TikTok: el panel redirige ahí al superadmin.
  @Post('connect')
  @SoloSuperadmin()
  conectar(@Req() req: RequestWithAdmin) {
    return { url: this.tiktok.urlDeAutorizacion(req.user.adminId) };
  }

  // Lo que TikTok deja hacer con la cuenta ahora (privacidades, límites): la pantalla de
  // publicar tiene que mostrarlo, es parte de lo que TikTok revisa en la auditoría.
  @Get('creator-info')
  infoDelCreador() {
    return this.tiktok.infoDelCreador();
  }

  @Get('posts')
  publicaciones(@Query('limit') limit?: string) {
    return this.tiktok.publicaciones(limit ? Number(limit) || 20 : 20);
  }

  @Post('posts')
  @SoloSuperadmin()
  publicar(@Req() req: RequestWithAdmin, @Body() dto: PublicarTiktokDto) {
    return this.tiktok.publicar(dto, req.user.adminId);
  }

  @Get('posts/:publishId')
  estadoDePublicacion(@Param('publishId') publishId: string) {
    return this.tiktok.consultarEstado(publishId);
  }

  @Delete()
  @SoloSuperadmin()
  desconectar(@Req() req: RequestWithAdmin) {
    return this.tiktok.desconectar(req.user.adminId);
  }
}

// Vuelta del login: TikTok redirige acá sin sesión (el superadmin viaja en el `state` firmado).
// Siempre termina redirigiendo al super panel, con el resultado.
@Controller('platform/marketing/tiktok')
export class TiktokCallbackController {
  private readonly logger = new Logger(TiktokCallbackController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly tiktok: TiktokService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
  }

  @Get('callback')
  @Public()
  @SkipThrottle()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: RedirectableResponse,
  ): Promise<void> {
    const volver = `${this.frontendUrl}/superadmin?seccion=marketing`;
    try {
      if (error || !code) throw new Error(error ?? 'Falta el code de TikTok');
      await this.tiktok.manejarCallback(code, state);
      res.redirect(`${volver}&tiktok=conectado`);
    } catch (e) {
      this.logger.warn(`Conexión de TikTok fallida: ${describeError(e)}`);
      res.redirect(`${volver}&tiktok=error`);
    }
  }
}
