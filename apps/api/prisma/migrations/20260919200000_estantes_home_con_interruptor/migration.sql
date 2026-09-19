-- Los cuatro estantes de productos del home clásico (destacados, nuevos
-- ingresos, recomendados, top ventas), cada uno con su interruptor en
-- Apariencia (Ale, 19/09). DEFAULT true: son secciones que ya se veían,
-- ninguna tienda pierde nada al aplicar esto.
ALTER TABLE "storefront_config" ADD COLUMN "show_featured_section" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "storefront_config" ADD COLUMN "show_new_arrivals_section" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "storefront_config" ADD COLUMN "show_recommended_section" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "storefront_config" ADD COLUMN "show_best_sellers_section" BOOLEAN NOT NULL DEFAULT true;
