-- Diseños de las promos del paquete Avanzado. Todas opcionales y sin default:
-- null es "como se veía hasta ahora", así ninguna tienda cambia de aspecto
-- hasta que su dueño elija un diseño.
ALTER TABLE "games" ADD COLUMN "theme" TEXT;
ALTER TABLE "games" ADD COLUMN "presentation" TEXT;

ALTER TABLE "promo_modals" ADD COLUMN "format" TEXT;
ALTER TABLE "promo_modals" ADD COLUMN "design" TEXT;
ALTER TABLE "promo_modals" ADD COLUMN "image_url" TEXT;

ALTER TABLE "countdown_configs" ADD COLUMN "format" TEXT;
ALTER TABLE "countdown_configs" ADD COLUMN "design" TEXT;
