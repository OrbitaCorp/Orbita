import { IsBoolean, IsEnum } from 'class-validator';
import { SocialProofPosition } from '@prisma/client';

export class UpsertSocialProofDto {
  @IsBoolean() isActive!: boolean;
  @IsEnum(SocialProofPosition) position!: SocialProofPosition;
}
