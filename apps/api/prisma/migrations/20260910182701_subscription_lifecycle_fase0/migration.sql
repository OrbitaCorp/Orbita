-- CreateEnum
CREATE TYPE "SubscriptionLifecycleStage" AS ENUM ('PRE_AVISO', 'GRACIA_INICIO', 'GRACIA_MEDIO', 'SUSPENDIDA');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "cancellation_warning_email_sent_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "scheduled_deletion_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "grace_period_days" SET DEFAULT 7;

-- CreateTable
CREATE TABLE "subscription_lifecycle_notices" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "stage" "SubscriptionLifecycleStage" NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_lifecycle_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_lifecycle_notices_subscription_id_stage_period_key" ON "subscription_lifecycle_notices"("subscription_id", "stage", "period_end");

-- AddForeignKey
ALTER TABLE "subscription_lifecycle_notices" ADD CONSTRAINT "subscription_lifecycle_notices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
