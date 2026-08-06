import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsArray, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { HeroSlideDto } from './hero-slide.dto';
import { HeaderLinkDto } from './header-link.dto';
import { StatsBarItemDto } from './stats-bar-item.dto';

export class UpdateStorefrontConfigDto {
  @IsOptional() @IsString() storeName?: string;
  @IsOptional() @IsString() tagline?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() faviconUrl?: string;
  @IsOptional() @IsString() colorPrimary?: string;
  @IsOptional() @IsString() colorSecondary?: string;
  @IsOptional() @IsString() colorAccent?: string;
  @IsOptional() @IsString() colorBackground?: string;
  @IsOptional() @IsIn(['light', 'dark', 'system']) colorMode?: 'light' | 'dark' | 'system';
  @IsOptional() @IsString() fontFamily?: string;
  @IsOptional() @IsString() fontFamilyBody?: string;
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
  @IsOptional() @IsBoolean() showStatsBar?: boolean;

  @IsOptional() @IsString() shippingText?: string;
  @IsOptional() @IsString() whatsappText?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatsBarItemDto)
  statsBar?: StatsBarItemDto[];
}
