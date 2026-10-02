import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthContext } from '../../common/types/auth-context.type';
import { SesionesService } from './sesiones.service';
import { CrearSesionDto, EditarSesionDto, ListarSesionesDto } from './sesiones.dto';

/**
 * Sesiones del Orbi del panel (fase 3, spec §3.4). Negocio y miembro salen
 * SIEMPRE del token; una sesión ajena o inexistente da 404. Las sesiones son
 * privadas: el dueño no lee las de su equipo. La demo pública (miembro
 * readOnly) no escribe nada (DemoGuard) y no guarda conversaciones, así que
 * su lista sale vacía.
 */
@Controller('orbi/sesiones')
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class SesionesController {
  constructor(private readonly sesiones: SesionesService) {}

  private miembro(user: AuthContext): { businessId: string; memberId: string } {
    if (user.type !== 'member') throw new ForbiddenException('Orbi solo está disponible para miembros del negocio');
    return { businessId: user.businessId, memberId: user.memberId };
  }

  @Get()
  listar(@CurrentUser() user: AuthContext, @Query() q: ListarSesionesDto) {
    const { businessId, memberId } = this.miembro(user);
    return this.sesiones.listar(businessId, memberId, { archivadas: q.archivadas === '1', q: q.q, cursor: q.cursor });
  }

  @Post()
  crear(@CurrentUser() user: AuthContext, @Body() dto: CrearSesionDto) {
    const { businessId, memberId } = this.miembro(user);
    return this.sesiones.crear(businessId, memberId, dto.pantalla);
  }

  @Get(':id')
  abrir(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const { businessId, memberId } = this.miembro(user);
    return this.sesiones.abrir(businessId, memberId, id);
  }

  @Patch(':id')
  editar(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EditarSesionDto) {
    const { businessId, memberId } = this.miembro(user);
    if (dto.titulo === undefined && dto.fijada === undefined && dto.archivada === undefined) {
      throw new BadRequestException('No hay nada para cambiar');
    }
    return this.sesiones.editar(businessId, memberId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async borrar(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { businessId, memberId } = this.miembro(user);
    await this.sesiones.borrar(businessId, memberId, id);
  }
}
