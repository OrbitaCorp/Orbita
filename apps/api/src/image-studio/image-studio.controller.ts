import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SUBIDA_IMAGEN } from '../common/utils/subida-imagen';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { RequiresAddon } from '../common/decorators/requires-addon.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { ImageStudioService } from './image-studio.service';
import { GenerateBackgroundDto } from './dto/generate-background.dto';
import { GenerateModelDto } from './dto/generate-model.dto';
import { CuotaDiaria } from '../orbi/cuota-diaria';
import { BACKGROUND_STYLES, SIN_FONDO_KEY } from './background-styles';
import { R2Service } from '../r2/r2.service';

// Cada generación es una llamada paga (hoy cae dentro del free tier de
// Workers AI, pero eso puede cambiar) — mismo criterio que
// AI_ASSIST_DIA_NEGOCIO en products.controller.ts: tope diario en memoria,
// por negocio, para no depender solo del throttle global (20/min).
export const IMAGE_STUDIO_DIA_NEGOCIO = 30;

// Paquete "Avanzado" — mismo gate que games/promo-modal/two-for-one
// (RequirePermission('advanced.manage') + RequiresAddon('ADVANCED')). Sin
// UI en el panel todavía: estos dos endpoints son la base para que el
// panel los consuma cuando se decida dónde (estudio de foto de producto,
// generador de banners, etc. — ver resumen de la tarea).
@Controller('image-studio')
export class ImageStudioController {
  private readonly cuota = new CuotaDiaria();

  constructor(
    private readonly imageStudio: ImageStudioService,
    private readonly r2: R2Service,
  ) {}

  // Sin RequiresAddon a propósito: es solo el catálogo (metadata estática),
  // no gasta nada — el panel lo necesita para armar el selector aunque el
  // negocio todavía no tenga el paquete Avanzado (para poder mostrárselo
  // como upsell). El gate real está en POST /background. previewUrl es la
  // primera de las 3 variantes cacheadas en R2 (ver background-styles.ts) —
  // el panel la usa como thumbnail del selector, no hace falta pedirle nada
  // a Flux para mostrar de qué se trata cada estilo.
  @Get('background-styles')
  listBackgroundStyles() {
    // Filtra estilos sin variantes en R2 todavía (backgroundKeys: []) — un
    // estilo recién agregado al catálogo pero sin sembrar (ver
    // scripts/image-studio/seed-backgrounds.ts) no tiene qué mostrar de
    // preview y, peor, forzaría una generación en vivo con Flux en cada uso
    // (gasta cuota gratis para algo que se supone pre-generado). Se habilita
    // solo después de correr el script para ese estilo.
    const estilos = Object.entries(BACKGROUND_STYLES)
      .filter(([, { backgroundKeys }]) => backgroundKeys.length > 0)
      .map(([key, { label, backgroundKeys }]) => ({
        key,
        label,
        previewUrl: this.r2.publicUrlDe(backgroundKeys[0]) as string | null,
      }));
    // "Sin fondo" no es un estilo del catálogo (no compone nada, ver
    // ImageStudioService) — se agrega primero, con previewUrl null: el
    // frontend le da un tratamiento visual propio (ver EstudioFondoModal).
    return [{ key: SIN_FONDO_KEY, label: 'Sin fondo (transparente)', previewUrl: null }, ...estilos];
  }

  @Post('background')
  @RequirePermission('advanced.manage')
  @RequiresAddon('ADVANCED')
  @UseInterceptors(FileInterceptor('file', SUBIDA_IMAGEN))
  async generateBackground(
    @CurrentBusiness() ctx: AuthContext,
    @Body() dto: GenerateBackgroundDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const member = assertMemberContext(ctx);
    // `file` (foto pendiente, alta) o `dto.imageUrl` (foto ya guardada,
    // edición) — uno de los dos, ver comentario de ImageStudioService.
    if (!file && !dto.imageUrl) throw new BadRequestException('Falta el archivo "file" o "imageUrl"');
    this.consumirCuota(member.businessId);
    return this.imageStudio.generateBackground(member.businessId, file, dto.estilo, dto.descripcion, dto.imageUrl);
  }

  @Post('model')
  @RequirePermission('advanced.manage')
  @RequiresAddon('ADVANCED')
  @UseInterceptors(FileInterceptor('file', SUBIDA_IMAGEN))
  async generateModel(
    @CurrentBusiness() ctx: AuthContext,
    @Body() dto: GenerateModelDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const member = assertMemberContext(ctx);
    if (!file) throw new BadRequestException('Falta el archivo "file"');
    this.consumirCuota(member.businessId);
    return this.imageStudio.generateModelWearing(member.businessId, file, dto.descripcion);
  }

  private consumirCuota(businessId: string): void {
    if (!this.cuota.consumir(businessId, IMAGE_STUDIO_DIA_NEGOCIO)) {
      throw new ForbiddenException(`Límite diario de generación de imágenes alcanzado (${IMAGE_STUDIO_DIA_NEGOCIO}/día). Probá de nuevo mañana.`);
    }
  }
}
