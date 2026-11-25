import { Controller, Get, NotFoundException, Param, Query, UnprocessableEntityException } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from '../storefront/storefront.service';
import { ReservasCatalogoService } from '../reservas/reservas-catalogo.service';
import { DisponibilidadService } from '../reservas/disponibilidad.service';
import { GrillaQueryDto } from './dto/gimnasio.dto';
import { GimnasioService } from './gimnasio.service';
import { planDto } from './gimnasio.types';

// Lo que el sitio público de un gimnasio lee de Gimnasio:
// <slug>.orbita.site → /api/v1/storefront/:slug/gimnasio/... Sin login.
//
// Las clases, los lugares y la reserva misma son del motor
// (/storefront/:slug/reservas, con modulo=GIMNASIO). Acá están los planes que
// el negocio ofrece, para la sección "Planes y pases" del sitio, y la grilla:
// las sesiones de todas las clases con sus lugares libres en un solo pedido
// (la arma el motor; el sitio no pide clase por clase). Pide el sitio abierto
// (publicado y sin pausar), como el motor.
@Controller('storefront/:slug/gimnasio')
export class GimnasioPublicoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storefront: StorefrontService,
    private readonly catalogo: ReservasCatalogoService,
    private readonly disponibilidad: DisponibilidadService,
    private readonly gimnasio: GimnasioService,
  ) {}

  /** El negocio del slug, si existe, está publicado y sin pausar, y usa Gimnasio. */
  private async negocioAbierto(slug: string): Promise<string> {
    const businessId = await this.storefront.resolveBusinessId(slug);
    const b = await this.prisma.business.findUnique({ where: { id: businessId }, select: { isActive: true, isPaused: true } });
    if (!b?.isActive) throw new NotFoundException('Negocio no encontrado');
    if (b.isPaused) throw new UnprocessableEntityException('Este negocio está pausado temporalmente.');
    await this.catalogo.configOFalla(businessId, 'GIMNASIO');
    return businessId;
  }

  /**
   * La grilla del sitio: las sesiones de cada clase entre dos días (hasta 35),
   * con el cupo y los lugares que quedan, y los días que el negocio cerró con
   * su motivo. Con las reglas del sitio: no salen las clases que ya no se
   * pueden reservar. Qué clase es cada una (actividad, profe, sala) lo dicen
   * los recursos del motor: el sitio cruza las dos cosas por `recursoId`.
   */
  @Get('grilla')
  @Public()
  async grilla(@Param('slug') slug: string, @Query() q: GrillaQueryDto) {
    const businessId = await this.negocioAbierto(slug);
    return this.disponibilidad.sesionesEntre(businessId, { modulo: 'GIMNASIO', desde: q.desde, hasta: q.hasta }, 'publico');
  }

  /** Los planes que se ofrecen en el sitio, en el orden que les dio el negocio. */
  @Get('planes')
  @Public()
  async planes(@Param('slug') slug: string) {
    const businessId = await this.negocioAbierto(slug);
    // `activo` es "se ofrece en el sitio": acá vienen solo esos, así que no viaja.
    return (await this.gimnasio.planesPublicos(businessId)).map((p) => {
      const { activo: _activo, ...publico } = planDto(p);
      void _activo;
      return publico;
    });
  }
}
