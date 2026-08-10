import { IsBoolean, IsOptional } from 'class-validator';

export class ResetMemberPasswordDto {
  // true = además de devolverla para copiar, se la manda por email al miembro.
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}
