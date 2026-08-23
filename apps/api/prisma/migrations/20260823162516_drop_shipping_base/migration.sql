-- Elimina el costo de envío "general" (a pedido) — el costo de envío ahora
-- es SIEMPRE por transportista (carrier_shipping_costs), sin fallback
-- genérico. Un transportista sin costo cargado simplemente no calcula envío.
ALTER TABLE "business_config" DROP COLUMN "shipping_base";
