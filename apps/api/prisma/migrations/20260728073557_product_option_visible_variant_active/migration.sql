-- AlterTable
ALTER TABLE "product_options" ADD COLUMN     "is_visual" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: productos existentes que ya tienen fotos asociadas a un valor de
-- opción (ej. fotos por color) necesitan que esa opción quede marcada como
-- "visual" — si no, el nuevo filtro del wizard ("Fotos por variante" solo
-- muestra la opción visual) las dejaría sin poder verse/gestionarse aunque
-- las fotos sigan existiendo en la base.
UPDATE "product_options" po SET "is_visual" = true
WHERE EXISTS (
  SELECT 1 FROM "product_images" pi
  JOIN "product_option_values" pov ON pi."option_value_id" = pov.id
  WHERE pov."option_id" = po.id
);
