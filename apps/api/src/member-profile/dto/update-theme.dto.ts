import { IsIn } from 'class-validator';

export class UpdateThemeDto {
  @IsIn(['LIGHT', 'DARK', 'SYSTEM'])
  themePreference!: 'LIGHT' | 'DARK' | 'SYSTEM';
}
