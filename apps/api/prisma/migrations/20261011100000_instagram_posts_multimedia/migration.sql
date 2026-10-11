-- Instagram: publicaciones con varias fotos y videos (carrusel) y proceso en pasos. Solo agrega columnas y
-- un enum, y relaja dos columnas que antes eran obligatorias; no toca datos existentes (las filas de antes
-- quedan como publicaciones de una foto ya publicadas).
--
-- Un video tarda en procesarse en Instagram, más de lo que aguanta una sola llamada HTTP: la publicación se
-- crea en estado PROCESSING y el panel la sigue llamando hasta que queda lista (o falla).

CREATE TYPE "InstagramPostStatus" AS ENUM ('PROCESSING', 'PUBLISHING', 'PUBLISHED', 'FAILED');

ALTER TABLE "instagram_posts"
    ADD COLUMN "status" "InstagramPostStatus" NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'IMAGE',
    ADD COLUMN "media" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN "child_container_ids" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN "container_id" TEXT,
    ADD COLUMN "temp_paths" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN "error" TEXT,
    ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Una publicación puede no ser de un producto (fotos o videos subidos desde la computadora) y, mientras se
-- procesa, todavía no tiene id en Instagram ni miniatura.
ALTER TABLE "instagram_posts" ALTER COLUMN "product_name" DROP NOT NULL;
ALTER TABLE "instagram_posts" ALTER COLUMN "ig_media_id" DROP NOT NULL;
ALTER TABLE "instagram_posts" ALTER COLUMN "image_url" DROP NOT NULL;

CREATE INDEX "instagram_posts_business_id_status_idx" ON "instagram_posts"("business_id", "status");
