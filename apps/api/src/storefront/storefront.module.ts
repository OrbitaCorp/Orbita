import { Module } from '@nestjs/common';
import { StorefrontController } from './storefront.controller';
import { StorefrontService } from './storefront.service';
import { OrdersModule } from '../orders/orders.module';
import { MercadopagoModule } from '../mercadopago/mercadopago.module';
import { DiscountsModule } from '../discounts/discounts.module';

// (Fase 3) El MeController que vivía acá (rutas /me/orders, /me/orders/:id/
// return, /me/orders/:id/cancel, /me/profile) era un cascarón viejo: los 4
// métodos devolvían literalmente {message: 'not implemented'}. Las versiones
// REALES de esas rutas ya existían en otro lado — /me (perfil) en MeModule,
// /me/orders (+ /:id/cancel, /:id/return) en CustomerOrdersController — y
// coincidían en el mismo path+método, así que este cascarón quedaba muerto
// (o competía por la ruta según el orden de carga de módulos). Se borró
// entero en vez de dejarlo pudrirse. Ver comentario en Jira (RBT-628).
@Module({
  imports: [OrdersModule, MercadopagoModule, DiscountsModule], // checkout real + estado de MP + descuentos automáticos (RBT-613)
  controllers: [StorefrontController],
  providers: [StorefrontService],
})
export class StorefrontModule {}
