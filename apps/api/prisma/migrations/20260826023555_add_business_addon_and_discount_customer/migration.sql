-- AlterTable
ALTER TABLE "discounts" ADD COLUMN     "customer_id" TEXT;

-- CreateTable
CREATE TABLE "business_addons" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "granted_by" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_addons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_addons_business_id_type_key" ON "business_addons"("business_id", "type");

-- CreateIndex
CREATE INDEX "discounts_customer_id_idx" ON "discounts"("customer_id");

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_addons" ADD CONSTRAINT "business_addons_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_addons" ADD CONSTRAINT "business_addons_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
