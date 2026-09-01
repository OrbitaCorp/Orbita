-- AlterTable
-- RBT-691: alícuota de IVA por negocio (NOT NULL DEFAULT 21.00 — Postgres
-- rellena el valor en las filas existentes al agregar la columna).
-- RBT-692: descuento por medio de pago generalizado a Mercado Pago y
-- "Transferencia" (acceptsTransfer, hoy = "Coordinar por WhatsApp"), mismo
-- criterio que la columna cash_discount_percent ya existente.
ALTER TABLE "business_config"
  ADD COLUMN     "mercadopago_discount_percent" DECIMAL(5,2),
  ADD COLUMN     "transfer_discount_percent" DECIMAL(5,2),
  ADD COLUMN     "iva_rate" DECIMAL(5,2) NOT NULL DEFAULT 21.00;

-- AlterTable
-- RBT-691: snapshot de la alícuota vigente al momento de crear la orden, para
-- que el comprobante no cambie retroactivamente si el negocio ajusta su IVA
-- después. Nullable: pedidos anteriores a esta feature no tienen valor.
ALTER TABLE "orders" ADD COLUMN     "iva_rate_percent" DECIMAL(5,2);
