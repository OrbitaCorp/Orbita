import { Injectable, Logger } from '@nestjs/common';
import { AppointmentMessageChannel, AppointmentMessageStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CanalMensaje, MensajeAutomatico, MensajeId, MensajesTurnos } from '../../appointments.types';
import { esUnicoRepetido } from './codigos';

// Mensajes que manda Avanzado: "te extrañamos" (Recuperar clientes) y "se
// liberó un lugar" (lista de espera).
//
// El canal oficial es `AppointmentMessagingService.despachar(plantilla,
// destino)` de CONTRATO § 1.6, que crea P2. Todavía no existe en la rama, así
// que Avanzado define acá la interfaz MÍNIMA que necesita y la recibe por
// inyección OPCIONAL con el token MENSAJERIA_TURNOS: cuando P2 registre su
// servicio con ese token (o un adaptador), Avanzado lo usa sin cambios.
// Mientras tanto corre `MensajeriaRegistroLocal`: arma el texto y deja la fila
// en appointment_message_logs como SIMULATED por cada canal (lo mismo que hace
// el STUB de WhatsApp del contrato), con la misma clave de idempotencia. NO
// envía nada: no hay proveedor de WhatsApp y MailService no tiene todavía
// `sendAppointmentWinback` / `sendAppointmentWaitlistOffer`.

export const MENSAJERIA_TURNOS = Symbol('MENSAJERIA_TURNOS');

export interface DestinoMensaje {
  businessId: string;
  customerId?: string | null;
  appointmentId?: string | null;
  nombre: string;
  /** Solo dígitos (normalizado). */
  telefono?: string | null;
  email?: string | null;
  /** {nombre} {servicio} {fecha} {hora} {profesional} {negocio} {link}. */
  variables: Record<string, string>;
  /** Texto propio (el de la campaña); si no viene, el de la plantilla del negocio o el de fábrica. */
  texto?: string;
  /** Identifica el envío: la clave final es "<plantilla>:<canal>:<clave>". Si ya existe, no se manda de nuevo. */
  clave: string;
}

export interface ResultadoEnvio {
  canal: AppointmentMessageChannel;
  estado: AppointmentMessageStatus | 'DUPLICADO';
}

export interface MensajeriaTurnos {
  despachar(plantilla: MensajeId, destino: DestinoMensaje): Promise<ResultadoEnvio[]>;
}

/** Textos de fábrica de la demo (admin/configuracion/Mensajes.tsx) que usa Avanzado. */
export const TEXTOS_DE_FABRICA: Partial<Record<MensajeId, string>> = {
  espera: '¡{nombre}, se liberó un lugar! {servicio}, {fecha} a las {hora}. Tenés 30 min para tomarlo: {link}',
  extranamos: '¡Hola {nombre}! Hace rato que no te vemos por {negocio}. Tenemos horarios libres esta semana: {link}',
};

/** Reemplaza las variables conocidas; las que no vienen quedan vacías. */
export function armarTexto(texto: string, variables: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (_, k: string) => variables[k] ?? '').replace(/\s{2,}/g, ' ').trim();
}

/** Canales de una plantilla que el negocio tiene prendidos. Sin config guardada: los de fábrica de la demo. */
export function canalesDe(mensajes: unknown, plantilla: MensajeId): CanalMensaje[] {
  const m = mensajes && typeof mensajes === 'object' ? (mensajes as Partial<MensajesTurnos>) : {};
  const wa = m.wa !== false;
  const email = m.email !== false;
  const propia = (m.mensajes ?? []).find((x: MensajeAutomatico) => x?.id === plantilla);
  const canales: CanalMensaje[] = propia?.canales ?? (plantilla === 'extranamos' ? ['wa'] : ['wa', 'email']);
  return canales.filter((c) => (c === 'wa' ? wa : email));
}

@Injectable()
export class MensajeriaRegistroLocal implements MensajeriaTurnos {
  private readonly logger = new Logger('MensajeriaTurnosAvanzado');

  constructor(private readonly prisma: PrismaService) {}

  async despachar(plantilla: MensajeId, destino: DestinoMensaje): Promise<ResultadoEnvio[]> {
    const { businessId } = destino;
    const settings = await this.prisma.appointmentSettings.findFirst({ where: { businessId }, select: { messages: true } });
    const guardada = ((settings?.messages as Partial<MensajesTurnos> | null)?.mensajes ?? []).find((x) => x?.id === plantilla);
    // El texto se arma igual que lo haría el servicio real (queda listo para cuando haya proveedor).
    armarTexto(destino.texto ?? guardada?.texto ?? TEXTOS_DE_FABRICA[plantilla] ?? '', destino.variables);

    const salida: ResultadoEnvio[] = [];
    for (const c of canalesDe(settings?.messages, plantilla)) {
      const canal: AppointmentMessageChannel = c === 'wa' ? 'WHATSAPP' : 'EMAIL';
      const recipient = canal === 'WHATSAPP' ? destino.telefono : destino.email;
      if (!recipient) continue;
      try {
        await this.prisma.appointmentMessageLog.create({
          data: {
            businessId, customerId: destino.customerId ?? null, appointmentId: destino.appointmentId ?? null,
            channel: canal, template: plantilla, recipient, status: 'SIMULATED',
            dedupeKey: `${plantilla}:${c}:${destino.clave}`.slice(0, 160),
          },
        });
        salida.push({ canal, estado: 'SIMULATED' });
      } catch (err) {
        if (esUnicoRepetido(err)) { salida.push({ canal, estado: 'DUPLICADO' }); continue; }
        // Nunca tira (CONTRATO § 1.6.5): se anota y sigue.
        this.logger.error(`No se pudo registrar el mensaje ${plantilla} (${canal}) del negocio ${businessId}`);
        salida.push({ canal, estado: 'FAILED' });
      }
    }
    // Sin el teléfono ni el texto en el log (CONTRATO § 1.6.3).
    this.logger.log(`[TURNOS AVANZADO STUB] ${plantilla} → ${salida.map((s) => `${s.canal}:${s.estado}`).join(', ') || 'sin canal'}`);
    return salida;
  }
}
