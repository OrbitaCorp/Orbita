import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { CreditNotesController } from './credit-notes.controller';
import { CustomerCreditNotesController } from './customer-credit-notes.controller';
import { ReturnsService } from './returns.service';

@Module({
  controllers: [ReturnsController, CreditNotesController, CustomerCreditNotesController],
  providers: [ReturnsService],
  exports: [ReturnsService], // OrdersModule lo usa para devoluciones del cliente (storefront)
})
export class ReturnsModule {}
