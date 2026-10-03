import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { MercadopagoService } from '../../../mercadopago/mercadopago.service';

// Cobro online de lo que se vende desde el sitio en Avanzado (packs, gift
// cards), con el Mercado Pago DEL NEGOCIO.
//
// CONTRATO § P2.5 pone la preferencia en un método nuevo de MercadopagoService
// (`createAppointmentPreference`) y el webhook en
// `POST webhooks/mercadopago/appointments`, los dos de P2. Para no tocar ese
// servicio ni depender de él, Avanzado arma su propia preferencia (calcada de
// createOrderPreference) con las MISMAS convenciones: `external_reference =
// "appt:<appointmentPaymentId>"`, el mismo notification_url y vencimiento a 30
// minutos. Cuando el webhook de P2 aprueba un AppointmentPayment de kind
// PACKAGE / GIFT_CARD / MEMBERSHIP, tiene que llamar a
// `AvanzadoPagosService.aplicarPagoAprobado` (ver pagos.service.ts): es lo que
// pone `paidAt` en la compra.
//
// Se inyecta con un token para que los tests (unitarios y e2e) lo reemplacen
// sin salir a Mercado Pago.

export const COBRO_ONLINE_TURNOS = Symbol('COBRO_ONLINE_TURNOS');

export interface PreferenciaPedida {
  businessId: string;
  /** AppointmentPayment.id: viaja como external_reference "appt:<id>". */
  paymentId: string;
  title: string;
  amount: number;
  /** Adónde vuelve el cliente al terminar en Mercado Pago. */
  volverA: string;
}

export interface CobroOnlineTurnos {
  /** null = el negocio no tiene Mercado Pago conectado (o el token no se pudo renovar). */
  crearPreferencia(p: PreferenciaPedida): Promise<{ preferenceId: string; initPoint: string } | null>;
}

const VENCE_MS = 30 * 60_000;

@Injectable()
export class CobroOnlineMercadoPago implements CobroOnlineTurnos {
  private readonly logger = new Logger('CobroOnlineTurnosAvanzado');
  private readonly webhookUrl: string;

  constructor(
    private readonly mercadopago: MercadopagoService,
    config: ConfigService,
  ) {
    const redirect = config.get<string>('MERCADOPAGO_REDIRECT_URI') ?? '';
    this.webhookUrl = redirect.replace('/mercadopago/oauth/callback', '/webhooks/mercadopago/appointments');
  }

  async crearPreferencia(p: PreferenciaPedida): Promise<{ preferenceId: string; initPoint: string } | null> {
    const accessToken = await this.mercadopago.getValidAccessToken(p.businessId);
    if (!accessToken) return null;
    const ahora = Date.now();
    const respuesta = await new Preference(new MercadoPagoConfig({ accessToken })).create({
      body: {
        items: [{ id: p.paymentId, title: p.title.slice(0, 250), quantity: 1, unit_price: p.amount, currency_id: 'ARS' }],
        external_reference: `appt:${p.paymentId}`,
        notification_url: this.webhookUrl || undefined,
        back_urls: { success: `${p.volverA}&pago=ok`, pending: `${p.volverA}&pago=pendiente`, failure: `${p.volverA}&pago=error` },
        auto_return: 'approved',
        expires: true,
        expiration_date_from: new Date(ahora).toISOString(),
        expiration_date_to: new Date(ahora + VENCE_MS).toISOString(),
      },
    });
    if (!respuesta.id || !respuesta.init_point) {
      this.logger.error(`Mercado Pago no devolvió una preferencia válida (negocio ${p.businessId})`);
      return null;
    }
    return { preferenceId: respuesta.id, initPoint: respuesta.init_point };
  }
}

/** El sitio del negocio, para las back_urls. */
export const sitioDe = (subdomain: string): string => `https://${subdomain}.orbita.site`;
