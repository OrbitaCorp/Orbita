-- Variedad de diseño para el banner de WhatsApp del home (pedido explícito,
-- 22/09): antes había un solo diseño fijo. Columna nueva y nullable: ninguna
-- tienda cambia sola — null sigue siendo el diseño de siempre ('clasico').
ALTER TABLE "storefront_config" ADD COLUMN "whatsapp_layout" TEXT;
