-- CreateEnum
CREATE TYPE "DomainPurchaseStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "domain_purchase_orders" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "years" INTEGER NOT NULL DEFAULT 1,
    "price_vercel" DECIMAL(10,2) NOT NULL,
    "price_charged" DECIMAL(10,2) NOT NULL,
    "contact_first_name" TEXT NOT NULL,
    "contact_last_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "contact_address1" TEXT NOT NULL,
    "contact_city" TEXT NOT NULL,
    "contact_state" TEXT NOT NULL,
    "contact_zip" TEXT NOT NULL,
    "contact_country" TEXT NOT NULL,
    "status" "DomainPurchaseStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "fail_reason" TEXT,
    "mp_preference_id" TEXT,
    "mp_payment_id" TEXT,
    "vercel_order_id" TEXT,
    "custom_domain_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_purchase_orders_business_id_idx" ON "domain_purchase_orders"("business_id");

-- AddForeignKey
ALTER TABLE "domain_purchase_orders" ADD CONSTRAINT "domain_purchase_orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
