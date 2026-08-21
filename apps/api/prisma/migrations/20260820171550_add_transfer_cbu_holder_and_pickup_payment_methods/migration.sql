-- AlterTable
ALTER TABLE "business_config" ADD COLUMN     "pickup_payment_methods" TEXT[],
ADD COLUMN     "transfer_cbu" TEXT,
ADD COLUMN     "transfer_holder" TEXT;
