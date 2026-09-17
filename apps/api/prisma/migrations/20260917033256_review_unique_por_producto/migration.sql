-- Una sola reseña por cliente y producto, sin importar en qué pedido lo
-- compró (antes: una por cada compra). Antes de estrechar el índice único
-- hay que deduplicar lo que ya exista: se conserva la reseña más VIEJA de
-- cada (customer_id, product_id) y se borran las demás (created_at + id
-- como desempate, por si dos quedaron con el mismo instante).
DELETE FROM "reviews"
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY customer_id, product_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
    FROM "reviews"
  ) ranked
  WHERE ranked.rn > 1
);

-- DropIndex
DROP INDEX "reviews_customer_id_product_id_order_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "reviews_customer_id_product_id_key" ON "reviews"("customer_id", "product_id");
