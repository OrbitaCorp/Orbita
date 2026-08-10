import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { MercadopagoService } from './mercadopago.service';

// Payload real de MP para el webhook de "application deauthorized" trae
// `user_id` (el mismo id que se guarda como mp_user_id al conectar). El resto
// de campos que manda MP en estos webhooks (topic, application_id, etc.) no
// hace falta modelarlos: solo importa desactivar la cuenta.
interface OAuthWebhookBody {
  user_id?: number | string;
}

@Controller('webhooks/mercadopago')
export class MercadopagoWebhooksController {
  constructor(private readonly mercadopagoService: MercadopagoService) {}

  // Confirmación de pagos (checkout Orders API) — depende del módulo de
  // creación de preferencias (POST /mercadopago/orders), todavía no
  // construido. Deliberadamente diferido, ver comentario en Jira.
  @Post('payments')
  @Public()
  paymentsWebhook() {
    void this.mercadopagoService;
    return { message: 'not implemented' };
  }

  @Post('oauth')
  @Public()
  async oauthWebhook(@Body() body: OAuthWebhookBody) {
    // Siempre 200 rápido — MP reintenta si no responde 2xx, y no hay nada
    // más que decirle acá (mismo criterio que el resto de webhooks de MP).
    await this.mercadopagoService.handleOAuthWebhook(body.user_id !== undefined ? String(body.user_id) : undefined);
    return { received: true };
  }
}
