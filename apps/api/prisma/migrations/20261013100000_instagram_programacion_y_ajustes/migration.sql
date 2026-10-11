-- Instagram (Difusión): publicaciones programadas y borradores, y los ajustes del negocio (respuestas
-- automáticas de mensajes y moderación de comentarios). Solo agrega: dos valores de un enum, dos columnas
-- opcionales, un índice y una tabla. No toca datos existentes.

ALTER TYPE "InstagramPostStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "InstagramPostStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

ALTER TABLE "instagram_posts"
    ADD COLUMN "scheduled_at" TIMESTAMP(3),
    ADD COLUMN "plan" JSONB;
CREATE INDEX "instagram_posts_status_scheduled_at_idx" ON "instagram_posts"("status", "scheduled_at");

CREATE TABLE "instagram_settings" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "welcome_enabled" BOOLEAN NOT NULL DEFAULT false,
    "welcome_text" TEXT NOT NULL DEFAULT '',
    "away_enabled" BOOLEAN NOT NULL DEFAULT false,
    "away_text" TEXT NOT NULL DEFAULT '',
    "open_from" TEXT NOT NULL DEFAULT '09:00',
    "open_to" TEXT NOT NULL DEFAULT '18:00',
    "open_days" JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
    "moderation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "moderation_words" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instagram_settings_business_id_key" ON "instagram_settings"("business_id");
ALTER TABLE "instagram_settings" ADD CONSTRAINT "instagram_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sin policies, igual que el resto: la API entra con un rol que se salta RLS y la API pública de
-- Supabase no puede leer ni escribir esta tabla (ver 20260910110000_rls_tablas_publicas).
ALTER TABLE "instagram_settings" ENABLE ROW LEVEL SECURITY;
