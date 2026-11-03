import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { SuperadminYMarketing } from '../common/decorators/platform-role.decorator';
import { PlatformAdminContext } from '../common/types/auth-context.type';
import { SUBIDA_IMAGEN } from '../common/utils/subida-imagen';
import { OcultarComentarioDto, ResponderComentarioDto } from '../instagram/dto/comentarios-instagram.dto';
import { CrearPublicacionDto, SubirVideoDto } from '../instagram/dto/crear-publicacion.dto';
import { ProgramarPublicacionDto } from '../instagram/dto/programacion-instagram.dto';
import { InstagramComentariosService } from '../instagram/instagram-comentarios.service';
import { InstagramEstadisticasService } from '../instagram/instagram-estadisticas.service';
import { InstagramMediosService } from '../instagram/instagram-medios.service';
import { InstagramPublicacionesService } from '../instagram/instagram-publicaciones.service';
import { InstagramContenidoService } from './instagram-contenido.service';

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

// Superadmin → Marketing → Instagram: el contenido de la cuenta de la empresa (publicaciones, comentarios y
// estadísticas). Usa los mismos servicios que Difusión en el panel de un negocio, ya atados al negocio de la empresa:
// desde acá no se puede tocar la cuenta de ningún otro negocio. Publicar y contestar queda a la vista de los
// seguidores y sale con el nombre de la empresa: todo es de SUPERADMIN y MARKETING (un OPERATOR no entra), y queda anotado quién lo hizo.
@UseGuards(PlatformAdminGuard)
@SuperadminYMarketing()
@Controller('platform/marketing/instagram')
export class InstagramContenidoController {
  constructor(
    private readonly contenido: InstagramContenidoService,
    private readonly publicaciones: InstagramPublicacionesService,
    private readonly medios: InstagramMediosService,
    private readonly comentarios: InstagramComentariosService,
    private readonly estadisticas: InstagramEstadisticasService,
  ) {}

  // Todo lo que ya está publicado en la cuenta, con sus números.
  @Get('posts/account')
  deLaCuenta() {
    return this.contenido.publicacionesDeLaCuenta();
  }

  // Lo que se subió desde Órbita: publicado, procesándose, programado, en borrador o fallado.
  @Get('posts')
  async desdeOrbita() {
    return this.publicaciones.listar(await this.contenido.negocioId());
  }

  @Post('posts')
  async publicar(@Req() req: RequestWithAdmin, @Body() dto: CrearPublicacionDto) {
    const r = await this.publicaciones.crear(await this.contenido.negocioId(), undefined, dto);
    await this.contenido.anotar(req.user.adminId, 'instagram_publish', r.id, { items: dto.items.length });
    return r;
  }

  @Post('posts/schedule')
  async programar(@Req() req: RequestWithAdmin, @Body() dto: ProgramarPublicacionDto) {
    const fecha = new Date(dto.programarPara);
    if (Number.isNaN(fecha.getTime())) throw new BadRequestException('La fecha no es válida.');
    const r = await this.publicaciones.programar(await this.contenido.negocioId(), undefined, dto, fecha);
    await this.contenido.anotar(req.user.adminId, 'instagram_schedule', r.id, { para: dto.programarPara });
    return r;
  }

  // Un video (o una foto grande) tarda en procesarse en Instagram: la pantalla vuelve a llamar acá hasta que termina.
  @Post('posts/:id/continuar')
  async continuar(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicaciones.continuar(await this.contenido.negocioId(), id);
  }

  @Post('posts/:id/unschedule')
  async desprogramar(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicaciones.pasarABorrador(await this.contenido.negocioId(), id);
  }

  // Borra un borrador o una programada (lo ya publicado no se borra desde acá).
  @Delete('posts/:id')
  async descartar(@Req() req: RequestWithAdmin, @Param('id', ParseUUIDPipe) id: string, @Query('conservar') conservar?: string) {
    const r = await this.publicaciones.descartar(await this.contenido.negocioId(), id, conservar === '1');
    await this.contenido.anotar(req.user.adminId, 'instagram_discard', id);
    return r;
  }

  // Foto subida desde la computadora.
  @Post('media/foto')
  @UseInterceptors(FileInterceptor('file', SUBIDA_IMAGEN))
  async subirFoto(@UploadedFile() file?: Express.Multer.File) {
    return this.medios.subirFoto(await this.contenido.negocioId(), file);
  }

  // Dirección firmada para que el navegador suba un video directo al almacenamiento.
  @Post('media/video')
  async prepararVideo(@Body() dto: SubirVideoDto) {
    return this.medios.prepararVideo(await this.contenido.negocioId(), dto.tipo, dto.bytes);
  }

  @Get('comments')
  async verComentarios() {
    return this.comentarios.listar(await this.contenido.negocioId());
  }

  @Post('comments/:id/reply')
  async responder(@Req() req: RequestWithAdmin, @Param('id') id: string, @Body() dto: ResponderComentarioDto) {
    const r = await this.comentarios.responder(await this.contenido.negocioId(), id, dto.texto);
    await this.contenido.anotar(req.user.adminId, 'instagram_comment_reply', id);
    return r;
  }

  @Post('comments/:id/hide')
  async ocultar(@Req() req: RequestWithAdmin, @Param('id') id: string, @Body() dto: OcultarComentarioDto) {
    const r = await this.comentarios.ocultar(await this.contenido.negocioId(), id, dto.oculto);
    await this.contenido.anotar(req.user.adminId, dto.oculto ? 'instagram_comment_hide' : 'instagram_comment_show', id);
    return r;
  }

  // Resumen de la cuenta de los últimos 7 o 28 días.
  @Get('insights')
  async verEstadisticas(@Query('dias') dias?: string) {
    return this.estadisticas.resumen(await this.contenido.negocioId(), dias === '28' ? 28 : 7);
  }

  // Qué tipo de publicación y qué momento funciona mejor en la cuenta.
  @Get('insights/rendimiento')
  async rendimiento() {
    return this.estadisticas.rendimiento(await this.contenido.negocioId());
  }
}
