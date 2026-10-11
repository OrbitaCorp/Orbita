import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Logger, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { describeError } from '../common/utils/describe-error.util';
import { SUBIDA_IMAGEN } from '../common/utils/subida-imagen';
import { MarcarLeidaDto, ResponderMensajeDto } from './dto/bandeja-instagram.dto';
import { RedactarTextoDto, SugerirRespuestaDto } from './dto/orbi-instagram.dto';
import { ConectarInstagramDto } from './dto/conectar-instagram.dto';
import { OcultarComentarioDto, ResponderComentarioDto } from './dto/comentarios-instagram.dto';
import { CrearPublicacionDto, SubirVideoDto } from './dto/crear-publicacion.dto';
import { SolicitarAccesoDto } from './dto/solicitar-acceso.dto';
import { InstagramBandejaService } from './instagram-bandeja.service';
import { InstagramComentariosService } from './instagram-comentarios.service';
import { InstagramEstadisticasService } from './instagram-estadisticas.service';
import { InstagramMediosService } from './instagram-medios.service';
import { InstagramOrbiService } from './instagram-orbi.service';
import { InstagramPublicacionesService } from './instagram-publicaciones.service';
import { InstagramService } from './instagram.service';

// `express` es solo dependencia transitiva — mismo motivo que en
// mercadopago.controller.ts.
interface RedirectableResponse {
  redirect(url: string): void;
}

// Conexión de Instagram del negocio, desde el panel. Conectar y desconectar son
// cosa de propietario/admin (igual que WhatsApp y Mercado Pago): cambian a dónde
// llegan los mensajes de los clientes.
@Controller('instagram')
export class InstagramController {
  private readonly logger = new Logger(InstagramController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly instagram: InstagramService,
    private readonly publicaciones: InstagramPublicacionesService,
    private readonly medios: InstagramMediosService,
    private readonly comentariosSvc: InstagramComentariosService,
    private readonly estadisticasSvc: InstagramEstadisticasService,
    private readonly bandeja: InstagramBandejaService,
    private readonly orbi: InstagramOrbiService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
  }

  // Bandeja de mensajes directos (Difusión → Mensajes). A diferencia de conectar y publicar, atender los
  // mensajes lo puede hacer todo el equipo, igual que en el módulo de Mensajes.
  @Get('inbox')
  @FullModeOnly()
  async charlas(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    return this.bandeja.listar(businessId);
  }

  @Get('inbox/unread-count')
  @FullModeOnly()
  async noLeidas(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    return this.bandeja.noLeidas(businessId);
  }

  @Get('inbox/:id/messages')
  @FullModeOnly()
  async mensajesDeCharla(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const { businessId } = assertMemberContext(ctx);
    return this.bandeja.mensajes(businessId, id);
  }

  // Texto, foto (campo `file`) o las dos cosas.
  @Post('inbox/:id/messages')
  @FullModeOnly()
  @UseInterceptors(FileInterceptor('file', SUBIDA_IMAGEN))
  async responderCharla(
    @CurrentBusiness() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: ResponderMensajeDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const { businessId } = assertMemberContext(ctx);
    return this.bandeja.responder(businessId, id, dto.texto, file);
  }

  @Patch('inbox/:id')
  @FullModeOnly()
  async marcarCharla(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: MarcarLeidaDto) {
    const { businessId } = assertMemberContext(ctx);
    return this.bandeja.marcarLeida(businessId, id, dto.leida);
  }

  // Ideas de qué publicar (productos de la tienda que todavía no se mostraron en Instagram).
  @Get('posts/ideas')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async ideas(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.publicaciones.ideas(businessId);
  }

  // Orbi escribe el texto de una publicación (3 versiones y hashtags). Es una sugerencia: no publica nada.
  @Post('orbi/texto')
  @FullModeOnly()
  @Roles('owner', 'admin')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async orbiTexto(@CurrentBusiness() ctx: AuthContext, @Body() dto: RedactarTextoDto) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.orbi.redactarTexto(businessId, dto);
  }

  // Orbi sugiere cómo responder un comentario o un mensaje directo (lo atiende todo el equipo).
  @Post('orbi/respuesta')
  @FullModeOnly()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async orbiRespuesta(@CurrentBusiness() ctx: AuthContext, @Body() dto: SugerirRespuestaDto) {
    const { businessId } = assertMemberContext(ctx);
    return this.orbi.sugerirRespuesta(businessId, dto);
  }

  // Orbi explica las estadísticas en palabras simples.
  @Get('orbi/lectura')
  @FullModeOnly()
  @Roles('owner', 'admin')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async orbiLectura(@CurrentBusiness() ctx: AuthContext, @Query('dias') dias?: string) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.orbi.leerEstadisticas(businessId, dias === '28' ? 28 : 7);
  }

  // Historial de lo publicado desde Órbita (Difusión → Publicaciones).
  @Get('posts')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async historial(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.publicaciones.listar(businessId);
  }

  // Publica en Instagram la foto de un producto con el texto que escribió el dueño. Es una acción con
  // efecto afuera de Órbita (queda a la vista de los seguidores): solo propietario/admin.
  @Post('posts')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async publicar(@CurrentBusiness() ctx: AuthContext, @Body() dto: CrearPublicacionDto) {
    const { businessId, memberId } = assertMemberContext(ctx);
    return this.publicaciones.crear(businessId, memberId, dto);
  }

  // Un video (o una foto grande) tarda en procesarse en Instagram: el panel vuelve a llamar acá cada pocos
  // segundos hasta que la publicación queda publicada o falla.
  @Post('posts/:id/continuar')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async continuar(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.publicaciones.continuar(businessId, id);
  }

  // Foto subida desde la computadora (para sumar a una publicación).
  @Post('media/foto')
  @FullModeOnly()
  @Roles('owner', 'admin')
  @UseInterceptors(FileInterceptor('file', SUBIDA_IMAGEN))
  async subirFoto(@CurrentBusiness() ctx: AuthContext, @UploadedFile() file?: Express.Multer.File) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.medios.subirFoto(businessId, file);
  }

  // Dirección firmada para que el navegador suba un video directo al almacenamiento.
  @Post('media/video')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async prepararVideo(@CurrentBusiness() ctx: AuthContext, @Body() dto: SubirVideoDto) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.medios.prepararVideo(businessId, dto.tipo, dto.bytes);
  }

  // Comentarios de las últimas publicaciones (Difusión → Comentarios).
  @Get('comments')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async comentarios(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.comentariosSvc.listar(businessId);
  }

  // Responder un comentario queda a la vista pública: solo propietario/admin.
  @Post('comments/:id/reply')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async responder(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: ResponderComentarioDto) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.comentariosSvc.responder(businessId, id, dto.texto);
  }

  @Post('comments/:id/hide')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async ocultar(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: OcultarComentarioDto) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.comentariosSvc.ocultar(businessId, id, dto.oculto);
  }

  // Resumen de la cuenta de los últimos 7 o 28 días (Difusión → Estadísticas).
  @Get('insights')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async estadisticas(@CurrentBusiness() ctx: AuthContext, @Query('dias') dias?: string) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.estadisticasSvc.resumen(businessId, dias === '28' ? 28 : 7);
  }

  @Get('connection')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async estado(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    // Sin acceso todavía no es un error: el panel muestra "pedir acceso anticipado".
    return this.instagram.estadoParaPanel(businessId);
  }

  // El dueño deja su @usuario para que el equipo lo sume como evaluador de la app.
  @Post('access-request')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async pedirAcceso(@CurrentBusiness() ctx: AuthContext, @Body() dto: SolicitarAccesoDto) {
    const { businessId, memberId } = assertMemberContext(ctx);
    return this.instagram.solicitarAcceso(businessId, dto.username, memberId);
  }

  // Devuelve la dirección del login de Instagram: el panel redirige ahí al dueño.
  @Post('connect')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async conectar(@CurrentBusiness() ctx: AuthContext, @Req() req: { headers: { origin?: string } }, @Body() dto: ConectarInstagramDto) {
    const member = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(member.businessId);
    // El Origin del navegador dice desde qué dirección se está usando el panel: al terminar el login se
    // vuelve a ese mismo lugar, donde está la sesión.
    return { url: this.instagram.urlDeAutorizacion(member.businessId, member.memberId, req.headers.origin, dto?.seccion, dto?.permisos) };
  }

  @Delete('connection')
  @FullModeOnly()
  @Roles('owner', 'admin')
  async desconectar(@CurrentBusiness() ctx: AuthContext) {
    const { businessId } = assertMemberContext(ctx);
    await this.instagram.asegurarHabilitado(businessId);
    return this.instagram.desconectar(businessId);
  }

  // Vuelta del login: Instagram redirige acá sin sesión (el negocio viaja en el
  // `state` firmado). Siempre termina redirigiendo al panel, con el resultado.
  @Get('oauth/callback')
  @Public()
  @SkipThrottle()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: RedirectableResponse,
  ): Promise<void> {
    try {
      if (error || !code) throw new Error(error ?? 'Falta el code de Instagram');
      // Instagram agrega "#_" al final del code en algunos redirects.
      const { suscripta, retorno } = await this.instagram.manejarCallback(code.replace(/#_$/, ''), state);
      res.redirect(`${retorno}${retorno.includes('?') ? '&' : '?'}ig=${suscripta ? 'conectado' : 'sin-suscripcion'}`);
    } catch (e) {
      this.logger.warn(`Conexión de Instagram fallida: ${describeError(e)}`);
      // Con el state válido se sabe a qué negocio y a qué panel volver: se vuelve ahí y el modal explica qué
      // hacer. Sin negocio verificable no hay a dónde volver con certeza: cae al login.
      const retorno = await this.instagram.retornoDelState(state);
      res.redirect(retorno ? `${retorno}${retorno.includes('?') ? '&' : '?'}ig=error` : `${this.frontendUrl}/login?ig=error`);
    }
  }

  // "Desautorización": Instagram lo llama cuando el dueño quita la app desde su
  // cuenta (llega un signed_request firmado con el App Secret).
  @Post('deauthorize')
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  async desautorizar(@Body() body: { signed_request?: string }) {
    if (!body?.signed_request) throw new ForbiddenException();
    await this.instagram.desautorizar(body.signed_request);
    return { ok: true };
  }
}
