-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIT_NOTE';

-- AlterTable
ALTER TABLE "credit_notes" ADD COLUMN     "redeemed_in_order_id" TEXT;

-- CreateIndex
CREATE INDEX "credit_notes_redeemed_in_order_id_idx" ON "credit_notes"("redeemed_in_order_id");

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_redeemed_in_order_id_fkey" FOREIGN KEY ("redeemed_in_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
