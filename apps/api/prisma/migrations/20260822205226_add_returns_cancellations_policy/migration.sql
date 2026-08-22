-- AlterTable
ALTER TABLE "business_config" ADD COLUMN     "cancellations_credit_note_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cancellations_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cancellations_mp_refund_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "returns_credit_note_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "returns_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "returns_mp_refund_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "cancellation_requests" ADD COLUMN     "refund_method" "RefundMethod";
