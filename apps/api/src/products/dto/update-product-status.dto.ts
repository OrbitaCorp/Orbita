import { IsIn } from 'class-validator';

export class UpdateProductStatusDto {
  @IsIn(['PUBLISHED', 'DRAFT'])
  status!: 'PUBLISHED' | 'DRAFT';
}
