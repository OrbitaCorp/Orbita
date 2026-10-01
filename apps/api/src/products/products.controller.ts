import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
  Optional,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SUBIDA_IMAGEN } from '../common/utils/subida-imagen';
import { SUBIDA_VIDEO } from '../common/utils/subida-video';
import { Throttle } from '@nestjs/throttler';
import { RequiresAddon } from '../common/decorators/requires-addon.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { ProductsService } from './products.service';
import { ProductAiService } from './product-ai.service';
import { ProductImageSearchService } from './product-image-search.service';
import { BusinessesService } from '../businesses/businesses.service';
import { CreateProductDto } from './dto/create-product.dto';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { ReorderImagesDto } from './dto/reorder-images.dto';
import { SetImageBackgroundDto } from './dto/set-image-background.dto';
import { AddImageDto } from './dto/add-image.dto';
import { ToggleFeaturedDto } from './dto/toggle-featured.dto';
import { UpdateProductContentDto } from './dto/update-product-content.dto';
import { AiAssistDto } from './dto/ai-assist.dto';
import { AiVariantsDto } from './dto/ai-variants.dto';
import { SuggestedImagesDto } from './dto/suggested-images.dto';
import { ProxyImageDto } from './dto/proxy-image.dto';
import { CuotaService } from '../common/cuota/cuota.service';
import { AI_ASSIST_DIA_NEGOCIO } from '../common/cuota/limites';
import { DemoIa } from '../demo/demo-ia';
import { DemoIaInterceptor } from '../demo/demo-ia.interceptor';
import { PresignVideoUploadDto } from '../businesses/dto/presign-video-upload.dto';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productAiService: ProductAiService,
    private readonly businessesService: BusinessesService,
    private readonly cuotaService: CuotaService,
    @Optional() private readonly productImageSearchService?: ProductImageSearchService,
  ) {}

  // Alternativa a pegar un link de video en el producto (Variantes e imágenes)
  // — mismo bucket de assets públicos del negocio que ya usa el video de
  // Apariencia, ver el comentario de uploadStorefrontVideo() en
  // businesses.service.ts. Antes de ':id' porque todavía puede no existir un
  // producto (alta nueva): el resultado es solo una URL, se manda recién al
  // crear/actualizar el producto junto con el resto del form.
  @Post('upload-video')
  @RequirePermission('catalog.manage')
  @UseInterceptors(FileInterceptor('file', SUBIDA_VIDEO))
  uploadVideo(@CurrentBusiness() ctx: AuthContext, @UploadedFile() file?: Express.Multer.File) {
    const member = assertMemberContext(ctx);
    if (!file) throw new BadRequestException('Falta el archivo "file"');
    return this.businessesService.uploadStorefrontVideo(member.businessId, file);
  }

  // Subida directa a R2 desde el navegador — ver el comentario de
  // presignStorefrontVideo en businesses.controller.ts (mismo mecanismo,
  // reusado acá con el permiso de catálogo en vez de owner/admin, igual que
  // el endpoint de arriba respecto al suyo).
  @Post('video-upload-url')
  @RequirePermission('catalog.manage')
  presignVideo(@CurrentBusiness() ctx: AuthContext, @Body() dto: PresignVideoUploadDto) {
    const member = assertMemberContext(ctx);
    return this.businessesService.presignStorefrontVideo(member.businessId, dto.mimetype);
  }

  @Post('ai-assist')
  @RequirePermission('catalog.manage')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @DemoIa('orbi-producto') // prueba de la demo pública, ver demo/demo-ia.ts
  @UseInterceptors(DemoIaInterceptor)
  async aiAssist(@CurrentBusiness() ctx: AuthContext, @Body() dto: AiAssistDto) {
    const member = assertMemberContext(ctx);
    if (!(await this.cuotaService.consumir(`ai-assist:${member.businessId}`, AI_ASSIST_DIA_NEGOCIO))) {
      throw new HttpException('Llegaste al máximo de ayudas de IA por hoy. Mañana se renueva.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.productAiService.assist(member.businessId, dto);
  }

  // Opciones de variante para ESTE producto (Almacenamiento y Color para un
  // celular, Talle para una remera). Pedido corto y aparte del asistente de texto.
  @Post('ai-variants')
  @RequirePermission('catalog.manage')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @DemoIa('orbi-producto') // prueba de la demo pública, ver demo/demo-ia.ts
  @UseInterceptors(DemoIaInterceptor)
  async aiVariants(@CurrentBusiness() ctx: AuthContext, @Body() dto: AiVariantsDto) {
    const member = assertMemberContext(ctx);
    if (!(await this.cuotaService.consumir(`ai-assist:${member.businessId}`, AI_ASSIST_DIA_NEGOCIO))) {
      throw new HttpException('Llegaste al máximo de ayudas de IA por hoy. Mañana se renueva.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.productAiService.suggestVariants(member.businessId, dto);
  }

  // Paquete "Avanzado" (decisión del 01/10): escanear una foto para completar
  // nombre, categoría, descripción y variantes es exclusivo del add-on. Hasta
  // entonces lo usaba cualquier plan. ai-assist y ai-variants (completar por
  // NOMBRE, sin foto) siguen abiertos a todos. La demo pública no se ve
  // afectada: su negocio tiene el add-on activo (ver seed-demo.ts).
  @Post('ai-scan')
  @RequirePermission('catalog.manage')
  @RequiresAddon('ADVANCED')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @DemoIa('orbi-producto') // prueba de la demo pública, ver demo/demo-ia.ts
  @UseInterceptors(FileInterceptor('file', SUBIDA_IMAGEN), DemoIaInterceptor)
  async aiScan(
    @CurrentBusiness() ctx: AuthContext,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const member = assertMemberContext(ctx);
    if (!file) throw new BadRequestException('Falta la imagen a escanear');
    if (!(await this.cuotaService.consumir(`ai-assist:${member.businessId}`, AI_ASSIST_DIA_NEGOCIO))) {
      throw new HttpException('Llegaste al máximo de ayudas de IA por hoy. Mañana se renueva.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.productAiService.scanProductImage(member.businessId, file);
  }

  @Post('suggested-images')
  @RequirePermission('catalog.manage')
  @Throttle({ default: { limit: 25, ttl: 60000 } })
  @DemoIa('fotos-web') // prueba de la demo pública, ver demo/demo-ia.ts
  @UseInterceptors(DemoIaInterceptor)
  suggestedImages(
    @CurrentBusiness() ctx: AuthContext,
    @Body() dto: SuggestedImagesDto,
  ) {
    const member = assertMemberContext(ctx);
    if (!this.productImageSearchService) return [];
    return this.productImageSearchService.searchSuggestedImages({
      query: dto.query,
      model: dto.model,
      brand: dto.brand,
      color: dto.color,
      businessId: member.businessId,
    });
  }

  @Post('proxy-image')
  @RequirePermission('catalog.manage')
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @DemoIa('foto-web') // prueba de la demo pública, ver demo/demo-ia.ts
  @UseInterceptors(DemoIaInterceptor)
  proxyImage(
    @CurrentBusiness() ctx: AuthContext,
    @Body() dto: ProxyImageDto,
  ) {
    assertMemberContext(ctx);
    if (!this.productImageSearchService) throw new BadRequestException('Servicio de imágenes no disponible');
    return this.productImageSearchService.proxyImage(dto.url);
  }

  @Get()
  @RequirePermission('catalog.view')
  findAll(@CurrentBusiness() ctx: AuthContext, @Query() query: FindProductsQueryDto) {
    const member = assertMemberContext(ctx);
    return this.productsService.findAll(member.businessId, query);
  }

  // Declarado antes de ':id' — si no, Nest interpreta "stats" como un :id.
  @Get('stats')
  @RequirePermission('catalog.view')
  stats(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.productsService.stats(member.businessId);
  }

  // Opciones de variante (Color, Talle…) y valores (Crudo, XL…) que el negocio ya
  // usó en sus productos, para ofrecerlos al cargar uno nuevo. Antes de ':id' por
  // la misma razón que 'stats'.
  @Get('variant-history')
  @RequirePermission('catalog.view')
  variantHistory(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.productsService.variantHistory(member.businessId);
  }

  @Get(':id')
  @RequirePermission('catalog.view')
  findOne(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.productsService.findOne(member.businessId, id);
  }

  @Post()
  @RequirePermission('catalog.manage')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: CreateProductDto) {
    const member = assertMemberContext(ctx);
    return this.productsService.create(member.businessId, dto);
  }

  @Put(':id')
  @RequirePermission('catalog.manage')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: CreateProductDto) {
    const member = assertMemberContext(ctx);
    // memberId: los cambios de stock quedan asentados como movimiento de ajuste
    // a nombre de quien editó el producto.
    return this.productsService.update(member.businessId, member.memberId, id, dto);
  }

  // Duplicar: nace siempre como borrador para que el dueño lo revise antes de
  // publicarlo (RBT-302).
  @Post(':id/duplicate')
  @RequirePermission('catalog.manage')
  duplicate(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.productsService.duplicate(member.businessId, id);
  }

  @Delete(':id')
  @RequirePermission('catalog.manage')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.productsService.remove(member.businessId, id, member.memberId);
  }

  @Post(':id/images')
  @RequirePermission('catalog.manage')
  @UseInterceptors(FileInterceptor('file', SUBIDA_IMAGEN))
  addImage(
    @CurrentBusiness() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: AddImageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const member = assertMemberContext(ctx);
    if (!file) throw new BadRequestException('Falta el archivo "file"');
    return this.productsService.addImage(member.businessId, id, dto, file);
  }

  @Delete(':id/images/:imageId')
  @RequirePermission('catalog.manage')
  removeImage(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Param('imageId') imageId: string) {
    const member = assertMemberContext(ctx);
    return this.productsService.removeImage(member.businessId, id, imageId);
  }

  // Rota 90° en sentido horario una foto ya guardada.
  @Post(':id/images/:imageId/rotate')
  @RequirePermission('catalog.manage')
  rotateImage(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Param('imageId') imageId: string) {
    const member = assertMemberContext(ctx);
    return this.productsService.rotateImage(member.businessId, id, imageId);
  }

  // Quitar / devolver el fondo de una foto ya guardada (miniaturas al editar).
  @Patch(':id/images/:imageId/background')
  @RequirePermission('catalog.manage')
  setImageBackground(
    @CurrentBusiness() ctx: AuthContext,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() dto: SetImageBackgroundDto,
  ) {
    const member = assertMemberContext(ctx);
    return this.productsService.setImageBackground(member.businessId, id, imageId, dto.removeBackground);
  }

  @Patch(':id/images/reorder')
  @RequirePermission('catalog.manage')
  reorderImages(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: ReorderImagesDto) {
    const member = assertMemberContext(ctx);
    return this.productsService.reorderImages(member.businessId, id, dto);
  }

  // Estrella de "destacado" en la grilla del panel — separado de PUT :id a
  // propósito, ver comentario en ProductsService.update().
  @Patch(':id/featured')
  @RequirePermission('catalog.manage')
  toggleFeatured(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: ToggleFeaturedDto) {
    const member = assertMemberContext(ctx);
    return this.productsService.toggleFeatured(member.businessId, id, dto);
  }

  // Contenido de la ficha (videos alternados con texto) — separado de PUT :id
  // por el mismo motivo que la estrella: tiene su propio editor en el panel.
  @Put(':id/content')
  @RequirePermission('catalog.manage')
  updateContent(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpdateProductContentDto) {
    const member = assertMemberContext(ctx);
    return this.productsService.updateContent(member.businessId, id, dto);
  }
}
