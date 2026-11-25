import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { InstagramService, IgWebhookBody } from './instagram.service';
import { InstagramBotService } from './instagram-bot.service';
import { InstagramRuteoService } from './instagram-ruteo.service';

// Webhook ÚNICO de Instagram para toda la plataforma. Es público (Meta no tiene
// sesión): la autenticidad sale de la firma X-Hub-Signature-256 sobre el body
// crudo (ver main.ts, que lo conserva en `rawBody`).
//
// SkipThrottle: el límite global es por IP y todos los avisos vienen de los
// servidores de Meta; con varios negocios activos se pasarían del tope.
@Controller('webhooks/instagram')
@SkipThrottle()
export class InstagramWebhookController {
  constructor(
    private readonly instagram: InstagramService,
    private readonly bot: InstagramBotService,
    private readonly ruteo: InstagramRuteoService,
  ) {}

  // Verificación al registrar el webhook: Meta llama con hub.* y espera el
  // challenge tal cual.
  @Get()
  @Public()
  verificar(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const respuesta = this.instagram.verificarSuscripcion(mode, token, challenge);
    if (respuesta === null) throw new ForbiddenException();
    return respuesta;
  }

  @Post()
  @Public()
  @HttpCode(200)
  async recibir(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') firma: string | undefined,
    @Body() body: IgWebhookBody,
  ) {
    if (!this.instagram.firmaValida(req.rawBody, firma)) throw new ForbiddenException();
    // Siempre 200 rápido: Meta reintenta durante días si no lo recibe.
    const nuevos = await this.instagram.procesarWebhook(body);
    // Orbi atiende los chats donde corresponde. Va dentro del pedido (Cloud Run no le da CPU a lo que corre después de
    // contestar) y no puede tirar: el webhook siempre responde 200.
    // La cuenta de la empresa la atiende el bot de ventas de Órbita (marketing/instagram-ventas); el resto, Orbi.
    const deOrbi: typeof nuevos = [];
    const deOtro: typeof nuevos = [];
    for (const m of nuevos) (await this.ruteo.atiende(m.businessId) ? deOtro : deOrbi).push(m);
    if (deOrbi.length > 0) await this.bot.atender(deOrbi);
    if (deOtro.length > 0) await this.ruteo.atender(deOtro);
    // Comentarios nuevos (campo `comments`): por ahora solo los usa el bot de ventas.
    const comentarios = await this.instagram.comentariosDelWebhook(body).catch(() => []);
    if (comentarios.length > 0) await this.ruteo.atenderComentarios(comentarios);
    return { received: true };
  }
}
