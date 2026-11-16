import { Module } from '@nestjs/common';
import { StorefrontModule } from '../../storefront/storefront.module';
import { OrdersModule } from '../../orders/orders.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { llmAdapterDelBotProvider } from '../llm/llm-adapter.provider';
import { PedidosPorChatService } from './pedidos';

// Lo que comparten los canales donde Orbi atiende a los clientes (WhatsApp e Instagram): la toma de pedidos por chat y la
// cadena de IA del bot (Groq → Workers AI de Cloudflare → Gemini, del más barato al más caro). Cada canal importa este
// módulo y pone su servicio, que hereda de AtencionDeOrbi (atencion-de-orbi.ts).
@Module({
  // StorefrontModule: Orbi lee el catálogo con el mismo servicio que la tienda pública. OrdersModule: crea los pedidos.
  // NotificationsModule: avisa al dueño.
  imports: [StorefrontModule, OrdersModule, NotificationsModule],
  providers: [PedidosPorChatService, llmAdapterDelBotProvider],
  exports: [PedidosPorChatService, llmAdapterDelBotProvider, StorefrontModule, NotificationsModule],
})
export class AtencionOrbiModule {}
