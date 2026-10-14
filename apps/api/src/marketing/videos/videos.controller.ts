import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { SoloSuperadmin } from '../../common/decorators/platform-role.decorator';
import { PlatformAdminContext } from '../../common/types/auth-context.type';
import { PublicarVideoInstagramDto } from './dto/videos.dto';
import { VideosPublicarService } from './videos-publicar.service';
import { VideosService } from './videos.service';

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

// Superadmin → Marketing → Videos: la cola de videos que generó el equipo con su Claude (ver videos.service.ts).
// Aprobar, rechazar y pasar a TikTok o Instagram queda a la vista de todos y sale con el nombre de la empresa: solo SUPERADMIN.
@UseGuards(PlatformAdminGuard)
@SoloSuperadmin()
@Controller('platform/marketing/videos')
export class VideosController {
  constructor(
    private readonly videos: VideosService,
    private readonly publicar: VideosPublicarService,
  ) {}

  @Get()
  listar(@Query('estado') estado?: string) {
    return this.videos.listar(estado);
  }

  @Post(':id/aprobar')
  aprobar(@Req() req: RequestWithAdmin, @Param('id', ParseUUIDPipe) id: string) {
    return this.videos.aprobar(req.user.adminId, id);
  }

  // Rechazar borra el archivo y el registro.
  @Post(':id/rechazar')
  rechazar(@Req() req: RequestWithAdmin, @Param('id', ParseUUIDPipe) id: string) {
    return this.videos.rechazar(req.user.adminId, id);
  }

  @Get(':id/descarga')
  descarga(@Param('id', ParseUUIDPipe) id: string) {
    return this.videos.descarga(id);
  }

  // Lo manda a los borradores de TikTok: la persona lo termina en la app (la visibilidad y el resto se eligen ahí).
  @Post(':id/tiktok-borrador')
  enTiktok(@Req() req: RequestWithAdmin, @Param('id', ParseUUIDPipe) id: string) {
    return this.publicar.enBorradoresDeTiktok(req.user.adminId, id);
  }

  // Lo deja como borrador en Instagram → Publicaciones: ahí se publica o se programa.
  @Post(':id/instagram-borrador')
  enInstagram(@Req() req: RequestWithAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PublicarVideoInstagramDto) {
    return this.publicar.enBorradorDeInstagram(req.user.adminId, id, dto.caption);
  }
}
