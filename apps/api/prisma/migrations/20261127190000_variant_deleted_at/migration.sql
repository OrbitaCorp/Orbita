-- Soft-delete de variantes con historial (ventas o movimientos de stock):
-- las variantes sin historial se borran físicamente; las que tienen historial
-- se marcan con deleted_at para preservar FKs de order_items / stock_movements
-- sin que sigan apareciendo en el catálogo, editor, inventario ni tienda.
ALTER TABLE "product_variants" ADD COLUMN "deleted_at" TIMESTAMP(3);
