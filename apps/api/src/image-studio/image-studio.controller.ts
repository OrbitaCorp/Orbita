import { BadRequestException, Body, Controller, ForbiddenException, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
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

  constructor(private readonly imageStudio: ImageStudioService) {}

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
    if (!file) throw new BadRequestException('Falta el archivo "file"');
    this.consumirCuota(member.businessId);
    return this.imageStudio.generateBackground(member.businessId, file, dto.descripcion);
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
