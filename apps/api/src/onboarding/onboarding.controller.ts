import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { OnboardingService } from './onboarding.service';
import { RegisterBusinessDto } from './dto/register-business.dto';
import { UpdateOnboardingBusinessDto } from './dto/update-onboarding-business.dto';

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
  @Get('check-subdomain')
  @Public()
  checkSubdomain(@Query('subdomain') subdomain: string) {
    return this.onboardingService.checkSubdomain(subdomain);
  }

  @Get('check-email')
  @Public()
  checkEmail(@Query('email') email: string) {
    return this.onboardingService.checkEmail(email);
  }

  @Post('register-business')
  @Public()
  register(@Body() dto: RegisterBusinessDto) {
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
