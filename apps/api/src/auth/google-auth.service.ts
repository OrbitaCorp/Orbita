import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export interface OAuthStatePayload {
  slug: string | null;
  contexto: 'storefront' | 'apex';
  // A dónde volver tras un login iniciado a mitad de un flujo (ej. el
  // checkout del storefront) — null cuando se entró a Google desde el login
  // "de siempre" (sin nada que retomar). Nunca una URL absoluta: se valida
  // en el controller (empieza con "/tienda/") antes de firmar el state, así
  // que lo que viaja firmado ya es confiablemente relativo — sin eso, un
  // returnTo absoluto firmado en el state sería un open redirect servido por
  // este mismo backend.
  returnTo: string | null;
  nonce: string;
  exp: number; // epoch ms
}

export interface GoogleIdentity {
  email: string;
  googleId: string; // `sub` del id_token
  firstName: string;
  lastName: string | null;
}

const STATE_TTL_MS = 10 * 60 * 1000; // tiempo de sobra para completar el consent en Google

@Injectable()
export class GoogleAuthService {
  private readonly client: OAuth2Client;
  private readonly clientId: string;
  private readonly stateSecret: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI');
    // Reutiliza JWT_SECRET para firmar el `state` — ya es un secreto de alta
    // entropía gestionado vía ConfigService; evita sumar otra env var solo
    // para esto.
    this.stateSecret = this.config.getOrThrow<string>('JWT_SECRET');
    this.client = new OAuth2Client(this.clientId, clientSecret, redirectUri);
  }

  // HMAC propio, no JWT: el state solo necesita viajar firmado y con
  // expiración corta, no todo el aparato de un JWT (header, alg negotiation).
  signState(payload: Pick<OAuthStatePayload, 'slug' | 'contexto'> & Partial<Pick<OAuthStatePayload, 'returnTo'>>): string {
    const full: OAuthStatePayload = {
      returnTo: null,
      ...payload,
      nonce: randomBytes(16).toString('hex'),
      exp: Date.now() + STATE_TTL_MS,
    };
    const body = Buffer.from(JSON.stringify(full)).toString('base64url');
    const sig = createHmac('sha256', this.stateSecret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  verifyState(state: string | undefined): OAuthStatePayload {
    const [body, sig] = (state ?? '').split('.');
    if (!body || !sig) throw new BadRequestException('state inválido');

    const expectedSig = createHmac('sha256', this.stateSecret).update(body).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      throw new BadRequestException('state inválido');
    }

    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('state inválido');
    }
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      throw new BadRequestException('state expirado');
    }
    return payload;
  }

  generateAuthUrl(state: string): string {
    return this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });
  }

  // Intercambia el code por tokens y verifica el id_token (firma, aud, iss —
  // todo a cargo de google-auth-library, no se confía en nada sin verificar).
  async exchangeCodeAndVerify(code: string): Promise<GoogleIdentity> {
    const { tokens } = await this.client.getToken(code);
    if (!tokens.id_token) throw new UnauthorizedException('Google no devolvió id_token');

    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('id_token de Google inválido');
    }
    if (!payload.email_verified) {
      throw new UnauthorizedException('El email de Google no está verificado');
    }

    return {
      email: payload.email,
      googleId: payload.sub,
      firstName: payload.given_name ?? payload.name ?? payload.email.split('@')[0],
      lastName: payload.family_name ?? null,
    };
  }
}
