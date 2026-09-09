import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GoogleExchangeDto {
  /** Código de canje del store en memoria: 24 bytes en hex. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  code!: string;
}
