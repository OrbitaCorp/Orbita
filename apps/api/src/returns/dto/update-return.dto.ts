import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateReturnDto {
  @IsOptional() @IsIn(['PENDING', 'IN_PROCESS', 'APPROVED', 'REJECTED']) status?: string;
  @IsOptional() @IsIn(['CREDIT_NOTE', 'REFUND']) refundMethod?: string;
  // (Fase 3 — Ale) El motivo que se le explica al cliente cuando se rechaza.
  // Viaja en el email de aviso, no se guarda en la base (el modelo no tiene
  // columna para esto y no la necesita).
  @IsOptional() @IsString() @MaxLength(500) rejectionMessage?: string;
}
