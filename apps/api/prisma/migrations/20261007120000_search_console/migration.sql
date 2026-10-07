-- Search Console: verificar los dominios propios de las tiendas y enviarle a
-- Google el sitemap de cada una, sin que el comerciante toque nada.
--
-- Solo agrega columnas nuevas (con valor por defecto o nulas) y un tipo nuevo:
-- no reescribe filas ni cambia el comportamiento de ninguna tienda existente.
CREATE TYPE "GscStatus" AS ENUM ('PENDIENTE', 'VERIFICADO');

ALTER TABLE "custom_domains" ADD COLUMN "gsc_verification_token" TEXT;
ALTER TABLE "custom_domains" ADD COLUMN "gsc_status" "GscStatus" NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "custom_domains" ADD COLUMN "gsc_error" TEXT;
ALTER TABLE "custom_domains" ADD COLUMN "gsc_tried_at" TIMESTAMP(3);
ALTER TABLE "custom_domains" ADD COLUMN "gsc_sitemap_at" TIMESTAMP(3);

ALTER TABLE "businesses" ADD COLUMN "gsc_sitemap_at" TIMESTAMP(3);
