import { Body, Controller, Get, Post, Query, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { GoogleOAuthExchangeStore } from './google-oauth-exchange.store';
import { GoogleExchangeDto } from './dto/google-exchange.dto';

// `express` es solo dependencia transitiva (vía @nestjs/platform-express) —
// pnpm no la deja resolver como import directo. Evita sumarla como dependencia
// nueva: acá solo se necesita `.redirect()`, que el adapter de Nest siempre
// provee sea cual sea la plataforma HTTP subyacente.
interface RedirectableResponse {
  redirect(url: string): void;
}

// Único punto de aterrizaje en el frontend para el flujo completo (storefront
// y apex): la página ahí lee `code` (éxito) o `error` (rechazo) y decide a
// dónde redirigir según el `type` del LoginResponse recibido en el exchange
// (member → subdominio de su negocio /panel, customer → su storefront) —
// reutiliza los helpers de tenant.ts que el frontend ya tiene para eso, en
// vez de que el backend intente adivinar el modo de ruteo (subdominio vs
// path legacy) que está usando el browser.
const CALLBACK_PATH = '/auth/google/callback';

@Controller('auth/google')
export class GoogleAuthController {
  private readonly frontendUrl: string;

  constructor(
    private readonly googleAuth: GoogleAuthService,
    private readonly authService: AuthService,
    private readonly exchangeStore: GoogleOAuthExchangeStore,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
  }

  @Get('start')
  @Public()
  start(
    @Query('slug') slug: string | undefined,
    // A dónde volver tras loguearse (ej. el checkout, "Iniciá sesión" a
    // mitad de comprar como invitado) — antes esto se perdía siempre acá:
    // el callback mandaba a un customer logueado con Google al home del
    // storefront sin importar desde dónde había arrancado. Se valida ACÁ,
    // antes de firmar el state, para que lo que viaje firmado ya sea
    // confiablemente relativo (ver el comentario en OAuthStatePayload).
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: RedirectableResponse,
  ): void {
    const contexto = slug ? ('storefront' as const) : ('apex' as const);
    const returnToSeguro = returnTo && returnTo.startsWith('/tienda/') ? returnTo : null;
    const state = this.googleAuth.signState({ slug: slug ?? null, contexto, returnTo: returnToSeguro });
    const url = this.googleAuth.generateAuthUrl(state);
    res.redirect(url);
  }

  @Get('callback')
  @Public()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: RedirectableResponse,
  ): Promise<void> {
    try {
      // El state se valida ANTES de cualquier otra cosa (firma + expiración).
      // Si es inválido, esto tira y cae directo al catch — no se sigue.
      const statePayload = this.googleAuth.verifyState(state);

      if (!code) throw new UnauthorizedException('Falta el code de Google');
      const identity = await this.googleAuth.exchangeCodeAndVerify(code);

      const sessionPayload =
        statePayload.contexto === 'storefront'
          ? await this.authService.googleLoginStorefront(identity, statePayload.slug!)
          : await this.authService.googleLoginApex(identity);

      if (!sessionPayload) {
        // Apex sin member existente — nunca se crea negocio/member acá.
        res.redirect(`${this.frontendUrl}${CALLBACK_PATH}?error=NO_BUSINESS`);
        return;
      }

      const exchangeCode = this.exchangeStore.create(sessionPayload);
      const sufijoReturnTo = statePayload.returnTo ? `&returnTo=${encodeURIComponent(statePayload.returnTo)}` : '';
      res.redirect(`${this.frontendUrl}${CALLBACK_PATH}?code=${exchangeCode}${sufijoReturnTo}`);
    } catch {
      res.redirect(`${this.frontendUrl}${CALLBACK_PATH}?error=GOOGLE_AUTH_FAILED`);
    }
  }

  // Server-a-server: lo llama el BFF de Next.js (pages/api/auth/google/exchange.ts),
  // nunca el browser directo. El código es de un solo uso y expira a los 60s.
  @Post('exchange')
  @Public()
  exchange(@Body() dto: GoogleExchangeDto) {
    const payload = this.exchangeStore.consume(dto.code);
    if (!payload) throw new UnauthorizedException('Código inválido o expirado');
    return payload;
  }
}
