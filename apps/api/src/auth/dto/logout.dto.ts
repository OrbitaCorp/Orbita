import { IsOptional, IsString, Length } from 'class-validator';

export class LogoutDto {
  @IsOptional()
  @IsString()
  @Length(64, 64)
  refreshToken?: string;
}
