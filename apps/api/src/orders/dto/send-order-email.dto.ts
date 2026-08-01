import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// (Fase 3 — Ale) El email individual que se manda desde un pedido: asunto y
// cuerpo libres. Las plantillas del modal son atajos de texto del frontend,
// no plantillas del backend — lo que el usuario ve y edita es lo que sale.
export class SendOrderEmailDto {
  @IsString() @IsNotEmpty() @MaxLength(150) subject!: string;
  @IsString() @IsNotEmpty() @MaxLength(5000) body!: string;
}
