-- Stock opcional en la vidriera: false = el negocio no cargó el stock de esta variante y la tienda no lo muestra.
-- Aditiva y con default true: todo lo existente sigue mostrándose igual. Solo la lee la tienda en modo vidriera.
ALTER TABLE "product_variants" ADD COLUMN "show_stock" BOOLEAN NOT NULL DEFAULT true;
