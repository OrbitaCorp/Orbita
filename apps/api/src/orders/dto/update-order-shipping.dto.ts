import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// Transportista + código de seguimiento que el dueño carga a mano (ver
// OrdersService.updateShippingInfo). `carrier` es una lista cerrada — no
// texto libre — porque el storefront la usa para armar el link correcto al
// buscador de cada correo (ver TRACKING_LINKS en Seguimiento.tsx).
export class UpdateOrderShippingDto {
  @IsOptional() @IsIn(['CORREO_ARGENTINO', 'OCA', 'ANDREANI', 'VIA_CARGO', 'OTRO']) carrier?: string;
  @IsOptional() @IsString() @MaxLength(100) tracking?: string;
}
