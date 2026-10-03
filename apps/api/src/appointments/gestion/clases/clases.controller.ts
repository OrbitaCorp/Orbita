import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { OptionalAuth } from '../../../common/decorators/optional-auth.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { RangoQueryDto } from '../comun/rango';
import { ClasesService } from './clases.service';
import { AttendanceDto, EnrollDto, PublicEnrollDto, UpdateClassSessionDto, UpsertClassTemplateDto } from './dto/clases.dto';

// Clases con cupo, panel (CONTRATO § P3.1). La grilla (plantillas) se edita
// con `appointments.services.manage`; ver clases, con `agenda.view`; anotar,
// sacar, suspender y tomar asistencia, con `agenda.manage`. Sin el `_all`,
// solo las clases que da quien mira o que se dan en su espacio.
@Controller('appointments')
export class ClasesController {
  constructor(private readonly clases: ClasesService) {}

  @Get('class-templates')
  @RequirePermission('appointments.agenda.view')
  plantillas(@CurrentBusiness() ctx: AuthContext) {
    return this.clases.plantillas(assertMemberContext(ctx));
  }

  @Post('class-templates')
  @RequirePermission('appointments.services.manage')
  crearPlantilla(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertClassTemplateDto) {
    return this.clases.crearPlantilla(assertMemberContext(ctx), dto);
  }

  @Put('class-templates/:id')
  @RequirePermission('appointments.services.manage')
  editarPlantilla(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpsertClassTemplateDto) {
    return this.clases.editarPlantilla(assertMemberContext(ctx), id, dto);
  }

  @Delete('class-templates/:id')
  @RequirePermission('appointments.services.manage')
  borrarPlantilla(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.clases.borrarPlantilla(assertMemberContext(ctx), id);
  }

  @Get('classes')
  @RequirePermission('appointments.agenda.view')
  listar(@CurrentBusiness() ctx: AuthContext, @Query() q: RangoQueryDto) {
    return this.clases.clases(assertMemberContext(ctx), q);
  }

  @Get('classes/:templateId/:date')
  @RequirePermission('appointments.agenda.view')
  detalle(@CurrentBusiness() ctx: AuthContext, @Param('templateId', new ParseUUIDPipe()) templateId: string, @Param('date') date: string) {
    return this.clases.detalle(assertMemberContext(ctx), templateId, date);
  }

  @Put('classes/:templateId/:date')
  @RequirePermission('appointments.agenda.manage')
  actualizar(
    @CurrentBusiness() ctx: AuthContext,
    @Param('templateId', new ParseUUIDPipe()) templateId: string,
    @Param('date') date: string,
    @Body() dto: UpdateClassSessionDto,
  ) {
    return this.clases.actualizarSesion(assertMemberContext(ctx), templateId, date, dto);
  }

  @Post('classes/:templateId/:date/enrollments')
  @RequirePermission('appointments.agenda.manage')
  anotar(
    @CurrentBusiness() ctx: AuthContext,
    @Param('templateId', new ParseUUIDPipe()) templateId: string,
    @Param('date') date: string,
    @Body() dto: EnrollDto,
  ) {
    return this.clases.anotar(assertMemberContext(ctx), templateId, date, dto);
  }

  @Delete('class-enrollments/:id')
  @RequirePermission('appointments.agenda.manage')
  sacar(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.clases.sacar(assertMemberContext(ctx), id);
  }

  @Patch('class-enrollments/:id/attendance')
  @RequirePermission('appointments.agenda.manage')
  asistencia(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AttendanceDto) {
    return this.clases.asistencia(assertMemberContext(ctx), id, dto.attended);
  }
}

// Clases en el sitio público (sitio abierto). Una tienda (STORE) responde 404.
@Controller('storefront/:slug/appointments/classes')
export class ClasesPublicoController {
  constructor(private readonly clases: ClasesService) {}

  @Get()
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listar(@Param('slug') slug: string, @Query() q: RangoQueryDto) {
    return this.clases.clasesPublicas(slug, q);
  }

  // Con sesión de cliente de ESTE negocio la inscripción queda en su cuenta;
  // un JWT de otro negocio se ignora (se trata como anónimo).
  @Post('enroll')
  @OptionalAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  anotar(@Param('slug') slug: string, @Body() dto: PublicEnrollDto, @CurrentBusiness() ctx: AuthContext | undefined) {
    return this.clases.anotarPublico(slug, dto, ctx);
  }
}
