-- Orbi atiende también los mensajes directos de Instagram (paquete Avanzado). Solo agrega: una tabla de configuración por
-- negocio (como whatsapp_bot_configs, sin el menú) y el canal de cada turno de Orbi, para repartir el cupo mensual del plan
-- (uno solo para WhatsApp e Instagram) y el tope propio de cada canal. Los turnos que ya existen son de WhatsApp.
ALTER TABLE "whatsapp_bot_turns" ADD COLUMN "canal" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP';
CREATE INDEX "whatsapp_bot_turns_business_id_canal_created_at_idx" ON "whatsapp_bot_turns"("business_id", "canal", "created_at");

CREATE TABLE "instagram_bot_configs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "modo" "WhatsappBotModo" NOT NULL DEFAULT 'SELECCIONADOS',
    "instrucciones" TEXT,
    "toma_pedidos" BOOLEAN NOT NULL DEFAULT false,
    "max_unidades" INTEGER NOT NULL DEFAULT 10,
    "max_monto" INTEGER NOT NULL DEFAULT 200000,
    "tope_creditos" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_bot_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instagram_bot_configs_business_id_key" ON "instagram_bot_configs"("business_id");
ALTER TABLE "instagram_bot_configs" ADD CONSTRAINT "instagram_bot_configs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Igual que el resto de las tablas: la API entra con su propio rol; nadie lee esto con la clave pública de Supabase.
ALTER TABLE "instagram_bot_configs" ENABLE ROW LEVEL SECURITY;
