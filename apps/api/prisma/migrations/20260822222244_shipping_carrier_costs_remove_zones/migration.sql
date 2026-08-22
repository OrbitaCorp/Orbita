-- Elimina "Zonas de entrega" (a pedido — nunca se usaba en el checkout, se
-- decidió sacarlo en vez de terminar de implementarlo) y agrega el costo de
-- envío específico por transportista.
ALTER TABLE "business_config" DROP COLUMN "delivery_zones";
ALTER TABLE "business_config" ADD COLUMN "carrier_shipping_costs" JSONB;
