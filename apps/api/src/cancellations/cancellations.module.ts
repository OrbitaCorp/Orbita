import { Module } from '@nestjs/common';
import { CancellationsController } from './cancellations.controller';
import { CustomerCancellationsController } from './customer-cancellations.controller';
import { CancellationsService } from './cancellations.service';
import { OrdersModule } from '../orders/orders.module';
import { MercadopagoModule } from '../mercadopago/mercadopago.module';

// Módulo aparte (ni dentro de OrdersModule ni de MercadopagoModule) porque
// necesita los dos a la vez: OrdersService (cancelar de verdad, reingresar
// stock) y MercadopagoService (reembolso real por API). Cualquiera de esos
// dos módulos importándose entre sí ya forma un ciclo — este, al depender de
// ambos sin que ninguno dependa de él, no lo forma.
@Module({
  imports: [OrdersModule, MercadopagoModule],
  controllers: [CancellationsController, CustomerCancellationsController],
  providers: [CancellationsService],
})
export class CancellationsModule {}
