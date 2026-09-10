import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsArray, IsIn, Matches, ValidateNested, MaxLength, ArrayMaxSize, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { HeroSlideDto } from './hero-slide.dto';
import { HeaderLinkDto } from './header-link.dto';
import { StatsBarItemDto } from './stats-bar-item.dto';
import { HomeTemplateDataDto } from './home-template-data.dto';
import { URL_IMAGEN, URL_IMAGEN_MENSAJE } from './url-imagen';

// Hex de 3 o 6 dígitos, con o sin '#'. _app.tsx interpola colorPrimary/
// colorBackground directo dentro de un <style> inyectado en el storefront
// (ver plan "Apariencia real") — sin esta validación, cualquier string
// llegaba tal cual hasta ahí, abriendo la puerta a inyectar CSS/HTML
// arbitrario en la tienda de cada negocio (stored XSS vía su propia config).
const HEX_COLOR = /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
// Mismo motivo para las fuentes: solo letras/números/espacios/guion — alcanza
// para cualquier nombre real de Google Fonts y bloquea comillas/`<`/`;` que
// podrían cortar el <style>/fontStack() donde se interpolan.
const FONT_NAME = /^[A-Za-z0-9 '-]{1,60}$/;

// Layouts: el panel manda ids cortos ("centered", "full", "grid-3", "4col");
// '' = el default.
const LAYOUT_ID = /^[a-z0-9-]{0,30}$/i;

// Topes de largo y de cantidad (auditoría interna 10/09): holgados contra lo
// que hay en producción (nombre de tienda más largo: 32; slides: 4; links: 9).
export class UpdateStorefrontConfigDto {
  @IsOptional() @IsString() @MaxLength(80) storeName?: string;
  @IsOptional() @IsString() @MaxLength(200) tagline?: string;
  @IsOptional() @IsString() @MaxLength(1000) @Matches(URL_IMAGEN, { message: URL_IMAGEN_MENSAJE }) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(1000) @Matches(URL_IMAGEN, { message: URL_IMAGEN_MENSAJE }) faviconUrl?: string;
  @IsOptional() @Matches(HEX_COLOR, { message: 'colorPrimary debe ser un color hex válido' }) colorPrimary?: string;
  @IsOptional() @Matches(HEX_COLOR, { message: 'colorSecondary debe ser un color hex válido' }) colorSecondary?: string;
  @IsOptional() @Matches(HEX_COLOR, { message: 'colorAccent debe ser un color hex válido' }) colorAccent?: string;
  @IsOptional() @Matches(HEX_COLOR, { message: 'colorBackground debe ser un color hex válido' }) colorBackground?: string;
  @IsOptional() @IsIn(['light', 'dark', 'system']) colorMode?: 'light' | 'dark' | 'system';
  @IsOptional() @Matches(FONT_NAME, { message: 'fontFamily inválido' }) fontFamily?: string;
  @IsOptional() @Matches(FONT_NAME, { message: 'fontFamilyBody inválido' }) fontFamilyBody?: string;
  @IsOptional() @IsNumber() @Min(0.5) @Max(2) fontScale?: number;
  @IsOptional() @Matches(LAYOUT_ID, { message: 'headerLayout inválido' }) headerLayout?: string;
  @IsOptional() @Matches(LAYOUT_ID, { message: 'gridLayout inválido' }) gridLayout?: string;
  @IsOptional() @IsInt() @Min(0) @Max(64) cardRadius?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => HeroSlideDto)
  heroSlides?: HeroSlideDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => HeaderLinkDto)
  headerLinks?: HeaderLinkDto[];

  // Campos propios de la plantilla de Home elegida (hoy solo el cupón de
  // Vidriera). No se toca al cambiar de plantilla — ver setHomeTemplate().
  @IsOptional()
  @ValidateNested()
  @Type(() => HomeTemplateDataDto)
  homeTemplateData?: HomeTemplateDataDto;

  // "showReviews" es el nombre expuesto por la API (ver CONTRATO_API.md);
  // el schema de Prisma lo mapea internamente como `showRating`.
  @IsOptional() @IsBoolean() showReviews?: boolean;
  @IsOptional() @IsBoolean() showNewBadge?: boolean;
  @IsOptional() @IsBoolean() showWhatsapp?: boolean;
  @IsOptional() @IsBoolean() showLowStock?: boolean;
  @IsOptional() @IsBoolean() showOfferBadge?: boolean;
  @IsOptional() @IsBoolean() showSearch?: boolean;
  @IsOptional() @IsBoolean() showCategoriesSection?: boolean;
  @IsOptional() @IsBoolean() showFooter?: boolean;
  @IsOptional() @IsBoolean() showSocialFooter?: boolean;
  @IsOptional() @IsBoolean() showAnnouncementBar?: boolean;
  // Banner debajo del header en modo "cartelera" (se desliza de derecha a
  // izquierda en loop) en vez de quedarse fijo centrado — pedido explícito
  // del dueño, con un ejemplo real de otra tienda como referencia.
  @IsOptional() @IsBoolean() announcementScroll?: boolean;
  @IsOptional() @IsBoolean() showStatsBar?: boolean;
  @IsOptional() @IsBoolean() showParallaxBanner?: boolean;

  @IsOptional() @IsString() @MaxLength(200) shippingText?: string;
  @IsOptional() @IsString() @MaxLength(500) whatsappText?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => StatsBarItemDto)
  statsBar?: StatsBarItemDto[];

  // Banner parallax — ver el porqué de estar separado en schema.prisma.
  @IsOptional() @IsString() @MaxLength(1000) @Matches(URL_IMAGEN, { message: URL_IMAGEN_MENSAJE }) parallaxImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(120) parallaxTitle?: string;
  @IsOptional() @IsString() @MaxLength(300) parallaxSubtitle?: string;
  @IsOptional() @IsString() @MaxLength(60) parallaxCtaText?: string;
  @IsOptional() @IsString() @MaxLength(500) parallaxCtaLink?: string;
}
