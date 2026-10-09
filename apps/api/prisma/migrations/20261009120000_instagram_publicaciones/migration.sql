-- Instagram: Publicaciones (kit de difusión). Solo agrega: una columna nullable con los permisos
-- concedidos a la conexión y una tabla con el historial de lo publicado. No toca nada existente.

ALTER TABLE "instagram_connections" ADD COLUMN "scopes" TEXT;

CREATE TABLE "instagram_posts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "member_id" TEXT,
    "caption" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "ig_media_id" TEXT NOT NULL,
    "permalink" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instagram_posts_ig_media_id_key" ON "instagram_posts"("ig_media_id");
CREATE INDEX "instagram_posts_business_id_created_at_idx" ON "instagram_posts"("business_id", "created_at");
ALTER TABLE "instagram_posts" ADD CONSTRAINT "instagram_posts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sin policies, igual que el resto: la API entra con un rol que se salta RLS y la API pública de
-- Supabase no puede leer ni escribir esta tabla (ver 20260910110000_rls_tablas_publicas).
ALTER TABLE "instagram_posts" ENABLE ROW LEVEL SECURITY;
