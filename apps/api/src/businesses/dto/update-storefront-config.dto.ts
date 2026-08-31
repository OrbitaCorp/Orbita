import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsArray, IsIn, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { HeroSlideDto } from './hero-slide.dto';
import { HeaderLinkDto } from './header-link.dto';
import { StatsBarItemDto } from './stats-bar-item.dto';

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

export class UpdateStorefrontConfigDto {
  @IsOptional() @IsString() storeName?: string;
  @IsOptional() @IsString() tagline?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() faviconUrl?: string;
  @IsOptional() @Matches(HEX_COLOR, { message: 'colorPrimary debe ser un color hex válido' }) colorPrimary?: string;
  @IsOptional() @Matches(HEX_COLOR, { message: 'colorSecondary debe ser un color hex válido' }) colorSecondary?: string;
  @IsOptional() @Matches(HEX_COLOR, { message: 'colorAccent debe ser un color hex válido' }) colorAccent?: string;
  @IsOptional() @Matches(HEX_COLOR, { message: 'colorBackground debe ser un color hex válido' }) colorBackground?: string;
  @IsOptional() @IsIn(['light', 'dark', 'system']) colorMode?: 'light' | 'dark' | 'system';
  @IsOptional() @Matches(FONT_NAME, { message: 'fontFamily inválido' }) fontFamily?: string;
  @IsOptional() @Matches(FONT_NAME, { message: 'fontFamilyBody inválido' }) fontFamilyBody?: string;
  @IsOptional() @IsNumber() fontScale?: number;
  @IsOptional() @IsString() headerLayout?: string;
  @IsOptional() @IsString() gridLayout?: string;
  @IsOptional() @IsInt() cardRadius?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HeroSlideDto)
  heroSlides?: HeroSlideDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HeaderLinkDto)
  headerLinks?: HeaderLinkDto[];

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

  @IsOptional() @IsString() shippingText?: string;
  @IsOptional() @IsString() whatsappText?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatsBarItemDto)
  statsBar?: StatsBarItemDto[];
}
