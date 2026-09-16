import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginResponse, PlatformAdminMfaChallenge } from './auth.types';

// El handoff también puede llevar el desafío de segundo factor (RBT-647):
// el super admin resolvió por Google pero todavía falta el código de mail.
type ExchangePayload = LoginResponse | PlatformAdminMfaChallenge;

const CODE_TTL_MS = 60 * 1000;

// Cuánto se conserva una fila ya vencida antes de borrarla. Sirve para que un
// reintento del BFF dentro de la ventana siga dando "inválido o expirado" con
// la fila presente, y para que la tabla no crezca: se limpia sola en cada
// canje nuevo.
const RETENCION_MS = 60 * 60 * 1000;

/**
 * Handoff de un solo uso entre el redirect final de /auth/google/callback y el
 * BFF del frontend (pages/api/auth/google/exchange.ts): el JWT/refresh token
 * nunca viaja en la URL — se intercambian acá, server-a-server, por un código
 * de vida cortísima.
 *
 * Vivía en un `Map` del proceso. Cloud Run escala a más de una instancia
 * cuando hay carga: el callback lo puede atender una y el POST /exchange que
 * viene medio segundo después, otra, que no tiene el código → el login por
 * Google fallaba sin motivo visible, y solo con tráfico (hallazgo
 * `auth-estado-en-memoria` de la auditoría interna). Desde el 16/09/2026 el
 * canje vive en Postgres, que ya es compartido entre instancias.
 *
 * Se guarda el SHA-256 del código, nunca el código: quien lea la tabla no
 * puede canjear una sesión con eso, igual que en refresh_tokens.
 */
@Injectable()
export class GoogleOAuthExchangeStore {
  private readonly logger = new Logger(GoogleOAuthExchangeStore.name);

  constructor(private readonly prisma: PrismaService) {}

  private static hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  async create(payload: ExchangePayload): Promise<string> {
    const code = randomBytes(24).toString('hex');
    await this.prisma.googleOAuthExchange.create({
      data: {
        codeHash: GoogleOAuthExchangeStore.hash(code),
        payload: payload as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    await this.purgarVencidos();
    return code;
  }

  async consume(code: string): Promise<ExchangePayload | null> {
    const codeHash = GoogleOAuthExchangeStore.hash(code);
    const ahora = new Date();

    // El UPDATE condicional es lo que hace el "un solo uso": dos pedidos
    // concurrentes con el mismo código chocan en la misma fila y solo uno ve
    // consumed_at en null, sea cual sea la instancia que los atienda.
    const { count } = await this.prisma.googleOAuthExchange.updateMany({
      where: { codeHash, consumedAt: null },
      data: { consumedAt: ahora },
    });
    if (count === 0) return null;

    const fila = await this.prisma.googleOAuthExchange.findUnique({ where: { codeHash } });
    if (!fila || fila.expiresAt < ahora) return null;
    return fila.payload as unknown as ExchangePayload;
  }

  /** Limpieza oportunista: la tabla es chica y de vida corta, no necesita un job propio. */
  private async purgarVencidos(): Promise<void> {
    try {
      await this.prisma.googleOAuthExchange.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - RETENCION_MS) } },
      });
    } catch (error) {
      // Nunca romper un login por no poder limpiar.
      this.logger.warn(`No se pudieron purgar los canjes de Google vencidos: ${String(error)}`);
    }
  }
}
