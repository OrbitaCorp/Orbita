-- Bug real (22/09/2026, reportado sobre venustyle.orbita.site): el slug de
-- una categoría era único por NEGOCIO entero, no por categoría padre. Una
-- subcategoría "jeans" bajo "Indumentaria masculina" bloqueaba crear otra
-- "jeans" bajo "Indumentaria femenina", aunque son namespaces distintos.
--
-- Se reemplaza el unique simple por DOS índices únicos PARCIALES (Prisma no
-- puede expresar esto con @@unique, se escribe a mano — ver comentario en
-- schema.prisma):
--   - Categorías de nivel raíz (parent_id NULL): únicas por (business_id, slug).
--     Postgres no trata dos NULL como iguales en un índice compuesto normal,
--     así que sin esta parcial dos categorías raíz podrían repetir slug.
--   - Categorías hijas: únicas por (business_id, parent_id, slug) — mismo
--     padre, mismo slug, choca; padres distintos, no.
DROP INDEX "categories_business_id_slug_key";

CREATE UNIQUE INDEX "categories_business_id_slug_raiz_key"
  ON "categories"("business_id", "slug")
  WHERE "parent_id" IS NULL;

CREATE UNIQUE INDEX "categories_business_id_parent_id_slug_key"
  ON "categories"("business_id", "parent_id", "slug")
  WHERE "parent_id" IS NOT NULL;
