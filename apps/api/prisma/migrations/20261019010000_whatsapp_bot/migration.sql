-- Orbi como atención al público por WhatsApp. Solo agrega: dos enums, columnas con valor por defecto en conversations y
-- messages, y dos tablas nuevas. No toca ni borra nada existente.

CREATE TYPE "WhatsappBotModo" AS ENUM ('SELECCIONADOS', 'TODOS');
CREATE TYPE "WhatsappBotChatEstado" AS ENUM ('DEFAULT', 'ON', 'OFF', 'PAUSADO', 'DERIVADO');

ALTER TABLE "conversations" ADD COLUMN "bot_estado" "WhatsappBotChatEstado" NOT NULL DEFAULT 'DEFAULT';
ALTER TABLE "conversations" ADD COLUMN "bot_motivo" TEXT;
ALTER TABLE "conversations" ADD COLUMN "bot_cambiado_at" TIMESTAMP(3);

ALTER TABLE "messages" ADD COLUMN "via_orbi" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "whatsapp_bot_configs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "modo" "WhatsappBotModo" NOT NULL DEFAULT 'SELECCIONADOS',
    "instrucciones" TEXT,
    "tope_creditos" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_bot_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_bot_configs_business_id_key" ON "whatsapp_bot_configs"("business_id");
ALTER TABLE "whatsapp_bot_configs" ADD CONSTRAINT "whatsapp_bot_configs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "whatsapp_bot_turns" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "status" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "tools_used" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "model" TEXT,
    "provider" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "cost_usd" DECIMAL(12,6),
    "credits" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "error_category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_bot_turns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "whatsapp_bot_turns_business_id_created_at_idx" ON "whatsapp_bot_turns"("business_id", "created_at");
ALTER TABLE "whatsapp_bot_turns" ADD CONSTRAINT "whatsapp_bot_turns_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tablas del negocio: cerradas a la API pública de Supabase (sin FORCE, igual que el resto; ver
-- 20260910110000_rls_tablas_publicas).
ALTER TABLE "whatsapp_bot_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_bot_turns" ENABLE ROW LEVEL SECURITY;
