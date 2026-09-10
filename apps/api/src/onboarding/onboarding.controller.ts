import { Body, Controller, Get, NotFoundException, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { OnboardingService } from './onboarding.service';
import { RegisterBusinessDto } from './dto/register-business.dto';
import { UpdateOnboardingBusinessDto } from './dto/update-onboarding-business.dto';

// El alta de verdad pasa por el pago: POST /subscription/checkout guarda los
// datos y SubscriptionsService.confirmAndCreate crea la cuenta recién cuando
// Mercado Pago confirma. POST /onboarding/register-business crea cuenta y
// negocio SIN pago (y con el email marcado como verificado): hoy solo lo usa
// el atajo de desarrollo del wizard (NEXT_PUBLIC_ALLOW_SKIP_PAYMENT) y los
// e2e. Abierto en producción, cualquiera podía crear negocios sin pagar y
// "ocupar" el email de otra persona, que después no podía darse de alta
// (auditoría interna 10/09, ítem api.onboarding). En producción queda
// apagado salvo que se habilite a propósito con PERMITIR_REGISTRO_DIRECTO.
export function registroDirectoHabilitado(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.PERMITIR_REGISTRO_DIRECTO === 'true';
}

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('rubros')
  @Public()
  getRubros() {
    return this.onboardingService.getRubros();
  }

  // Público: se usa DURANTE el wizard, antes de que exista una cuenta/token
  // (ver PENDIENTES.md — el registro se corrió al final del onboarding).
  // Con tope propio: el wizard lo consulta mientras se escribe.
  @Get('check-subdomain')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  checkSubdomain(@Query('subdomain') subdomain: string) {
    return this.onboardingService.checkSubdomain(subdomain);
  }

  // Dice si un email ya es miembro de algún negocio: sin tope servía para
  // barrer listas de emails (auditoría interna 10/09, ítem api.onboarding).
  @Get('check-email')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  checkEmail(@Query('email') email: string) {
    return this.onboardingService.checkEmail(email);
  }

  @Post('register-business')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  register(@Body() dto: RegisterBusinessDto) {
    if (!registroDirectoHabilitado()) throw new NotFoundException();
    return this.onboardingService.registerBusiness(dto);
  }

  // Es la ficha del negocio (nombre, rubro, ubicación) que quedó a medias en
  // el alta: mismo gate que PUT /business, donde se termina de editar después
  // (auditoría interna 09/09, ítem `api.common`, verificación 2 — antes
  // alcanzaba con ser miembro).
  @Put('business')
  @Roles('owner', 'admin')
  updateDraft(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpdateOnboardingBusinessDto) {
    const member = assertMemberContext(ctx);
    return this.onboardingService.updateDraft(member.businessId, dto);
  }
}
