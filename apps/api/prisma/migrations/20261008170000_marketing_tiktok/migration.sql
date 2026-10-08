-- Marketing de Órbita en TikTok: la cuenta de la empresa conectada (con sus tokens
-- cifrados) y el historial de videos enviados a TikTok.
--
-- Aditiva: dos tablas nuevas, no toca nada existente. Con RLS desde el arranque,
-- igual que el resto de las tablas (nadie les llega por la API pública de Supabase).
CREATE TABLE "marketing_tiktok_accounts" (
    "id" TEXT NOT NULL,
    "open_id" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "access_expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_expires_at" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "connected_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_tiktok_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_tiktok_accounts_open_id_key" ON "marketing_tiktok_accounts"("open_id");

CREATE TABLE "marketing_tiktok_posts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "publish_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "privacy_level" TEXT NOT NULL,
    "video_url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fail_reason" TEXT,
    "post_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_tiktok_posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_tiktok_posts_publish_id_key" ON "marketing_tiktok_posts"("publish_id");
CREATE INDEX "marketing_tiktok_posts_account_id_created_at_idx" ON "marketing_tiktok_posts"("account_id", "created_at");

ALTER TABLE "marketing_tiktok_posts" ADD CONSTRAINT "marketing_tiktok_posts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "marketing_tiktok_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketing_tiktok_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_tiktok_posts" ENABLE ROW LEVEL SECURITY;
