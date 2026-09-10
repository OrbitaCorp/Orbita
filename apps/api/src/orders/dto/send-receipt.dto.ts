import { IsOptional } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

// Email normalizado y con tope (auditoría interna 10/09, ítem `api.orders`).
export class SendReceiptDto {
  @IsOptional() @NormalizedEmail() email?: string;
}
