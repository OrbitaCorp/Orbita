-- AlterTable
-- Entidad (banco o billetera) de la cuenta del alias de "Coordinar por
-- WhatsApp": se muestra en el checkout junto con alias y titular. Opcional.
ALTER TABLE "business_config" ADD COLUMN     "transfer_bank" VARCHAR(80);
