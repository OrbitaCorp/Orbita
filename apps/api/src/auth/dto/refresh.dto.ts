import { IsString, Length } from 'class-validator';

export class RefreshDto {
  /** 32 bytes en hex (createRefreshToken). El tope evita que llegue un body enorme al hash. */
  @IsString()
  @Length(64, 64)
  refreshToken!: string;
}
