-- Modalidades de Orbi en WhatsApp (conversacional, menú + conversación, solo menú) y su menú de opciones editable. Solo
-- agrega columnas con valor por defecto a whatsapp_bot_configs: lo que ya existe sigue atendiendo como antes.

CREATE TYPE "WhatsappBotModalidad" AS ENUM ('CONVERSACIONAL', 'MENU_Y_CONVERSACION', 'SOLO_MENU');
CREATE TYPE "WhatsappMenuEstilo" AS ENUM ('LISTA', 'BOTONES');

ALTER TABLE "whatsapp_bot_configs" ADD COLUMN "modalidad" "WhatsappBotModalidad" NOT NULL DEFAULT 'CONVERSACIONAL';
ALTER TABLE "whatsapp_bot_configs" ADD COLUMN "menu_estilo" "WhatsappMenuEstilo" NOT NULL DEFAULT 'LISTA';
ALTER TABLE "whatsapp_bot_configs" ADD COLUMN "bienvenida" TEXT;
ALTER TABLE "whatsapp_bot_configs" ADD COLUMN "menu_opciones" JSONB;
