import { Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { SoloSuperadmin } from '../common/decorators/platform-role.decorator';
import { InstagramService } from './instagram.service';
import { InstagramImportacionService } from './instagram-importacion.service';

// Pedidos de acceso anticipado a Instagram, en el super panel. Verlos lo puede todo el
// equipo; habilitar o quitar el acceso es solo de SUPERADMIN: abre o cierra el login de
// Instagram de un negocio (y hay que haber sumado antes la cuenta como evaluadora en Meta).
@UseGuards(PlatformAdminGuard)
@Controller('platform/instagram')
export class InstagramAdminController {
  constructor(
    private readonly instagram: InstagramService,
    private readonly importacion: InstagramImportacionService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('acceso')
  pedidos() {
    return this.instagram.pedidosDeAcceso();
  }

  @Post('acceso/:businessId/habilitar')
  @SoloSuperadmin()
  habilitar(@Param('businessId') businessId: string) {
    return this.instagram.cambiarHabilitacion(businessId, true);
  }

  @Post('acceso/:businessId/deshabilitar')
  @SoloSuperadmin()
  deshabilitar(@Param('businessId') businessId: string) {
    return this.instagram.cambiarHabilitacion(businessId, false);
  }

  // Vuelve a traer las charlas que la cuenta conectada ya tenía (lo mismo que pasa solo al conectarla). Sirve para
  // cualquier negocio, también el de la empresa. Es idempotente: solo agrega lo que falte. No se espera: corre en
  // sus propios pedidos y en un par de minutos se ve en la bandeja.
  @Post('importar/:businessId')
  @SoloSuperadmin()
  async importar(@Param('businessId') businessId: string) {
    const c = await this.prisma.instagramConnection.findUnique({ where: { businessId }, select: { status: true } });
    if (!c || c.status !== 'ACTIVE') throw new NotFoundException('Ese negocio no tiene Instagram conectado');
    await this.importacion.lanzar(businessId);
    return { iniciada: true };
  }
}
