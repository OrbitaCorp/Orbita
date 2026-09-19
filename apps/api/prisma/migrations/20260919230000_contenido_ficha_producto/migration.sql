-- Contenido de la ficha de producto: bloques de video + texto alternados
-- (Ale, 19/09). Columna nullable: ningún producto cambia al aplicar esto.
ALTER TABLE "products" ADD COLUMN "content_blocks" JSONB;
