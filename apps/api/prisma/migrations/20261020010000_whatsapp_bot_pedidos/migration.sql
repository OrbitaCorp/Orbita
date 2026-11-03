-- Orbi toma pedidos por WhatsApp y avisa al dueño. Solo agrega columnas con valor por defecto: lo que ya existe sigue igual
-- (toma_pedidos arranca apagado).

ALTER TABLE "whatsapp_bot_configs" ADD COLUMN "toma_pedidos" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "whatsapp_bot_configs" ADD COLUMN "max_unidades" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "whatsapp_bot_configs" ADD COLUMN "max_monto" INTEGER NOT NULL DEFAULT 200000;

ALTER TABLE "conversations" ADD COLUMN "bot_borrador" JSONB;
ALTER TABLE "conversations" ADD COLUMN "bot_aviso_at" TIMESTAMP(3);
