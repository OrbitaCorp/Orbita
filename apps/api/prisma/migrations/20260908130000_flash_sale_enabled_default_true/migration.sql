-- "Oferta relámpago" (RBT-675): la regla pasa a ser "habilitada si el negocio
-- tiene el paquete Avanzado pagado". El interruptor de la tarjeta de Avanzado
-- queda solo para APAGARLA, así que arranca prendido para todos: sin esto,
-- quien paga el paquete la encontraba apagada y no entendía por qué no podía
-- elegir el tipo en Descuentos. Sin el paquete, el flag no importa.
--
-- Escrita a mano y NO con `prisma migrate diff` (drift de wizard_ai_turns).

-- AlterTable
ALTER TABLE "businesses" ALTER COLUMN "flash_sale_enabled" SET DEFAULT true;
UPDATE "businesses" SET "flash_sale_enabled" = true;
