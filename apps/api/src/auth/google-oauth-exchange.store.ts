import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { LoginResponse, PlatformAdminMfaChallenge } from './auth.types';

// El handoff también puede llevar el desafío de segundo factor (RBT-647):
// el super admin resolvió por Google pero todavía falta el código de mail.
type ExchangePayload = LoginResponse | PlatformAdminMfaChallenge;

const CODE_TTL_MS = 60 * 1000;

interface StoredSession {
  payload: ExchangePayload;
  expiresAt: number;
}

// Handoff de un solo uso entre el redirect final de /auth/google/callback y
// el BFF del frontend (pages/api/auth/google/exchange.ts): el JWT/refresh
// token nunca viaja en la URL — se intercambian acá, server-a-server, por un
// código de vida cortísima. Store en memoria: asume deployment single-instance
// (mismo supuesto que el resto del proyecto en esta etapa — ver PENDIENTES.md).
// Si el proceso reinicia dentro de la ventana de 60s, el login falla y el
// usuario reintenta; no hay pérdida de datos ni token expuesto.
@Injectable()
export class GoogleOAuthExchangeStore {
  private readonly store = new Map<string, StoredSession>();

  create(payload: ExchangePayload): string {
    const code = randomBytes(24).toString('hex');
    this.store.set(code, { payload, expiresAt: Date.now() + CODE_TTL_MS });
    return code;
  }

  consume(code: string): ExchangePayload | null {
    const entry = this.store.get(code);
    this.store.delete(code); // de un solo uso — se borra exista o no, válido o no
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.payload;
  }
}
