-- "Se hace por pedido": el producto se muestra sin stock y solo se consulta por WhatsApp (sin carrito ni compra).
-- Aditiva y con default false: todo lo existente sigue igual.
ALTER TABLE "products" ADD COLUMN "by_order" BOOLEAN NOT NULL DEFAULT false;
