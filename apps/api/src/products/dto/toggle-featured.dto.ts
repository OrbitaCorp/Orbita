import { IsBoolean } from 'class-validator';

export class ToggleFeaturedDto {
  @IsBoolean() isFeatured!: boolean;
}
