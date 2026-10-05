import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { WhatsappService, WaWebhookBody } from './whatsapp.service';

// Webhook ÚNICO de WhatsApp para toda la plataforma (Meta lo registra una sola
// vez en la app). Es público — Meta no tiene sesión —, así que la autenticidad
// sale de la firma X-Hub-Signature-256 sobre el body crudo (ver main.ts, que lo
// conserva en `rawBody`).
//
// SkipThrottle: el límite global es por IP y todos los avisos vienen de los
// servidores de Meta; con varios negocios activos se pasarían de largo del tope
// y Meta empezaría a recibir 429 (y a reintentar).
@Controller('webhooks/whatsapp')
@SkipThrottle()
export class WhatsappWebhookController {
  constructor(private readonly whatsapp: WhatsappService) {}

  // Verificación al registrar el webhook: Meta llama con hub.* y espera el
  // challenge tal cual, como texto.
  @Get()
  @Public()
  verificar(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const respuesta = this.whatsapp.verificarSuscripcion(mode, token, challenge);
    if (respuesta === null) throw new ForbiddenException();
    return respuesta;
  }

  @Post()
  @Public()
  @HttpCode(200)
  async recibir(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') firma: string | undefined,
    @Body() body: WaWebhookBody,
  ) {
    if (!this.whatsapp.firmaValida(req.rawBody, firma)) throw new ForbiddenException();
    // Siempre 200 rápido: Meta reintenta durante días si no lo recibe. Los
    // errores por mensaje se registran adentro sin cortar el resto.
    await this.whatsapp.procesarWebhook(body);
    return { received: true };
  }
}
