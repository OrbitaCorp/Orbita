-- CreateTable
CREATE TABLE "two_for_one_promos" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "discount_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_for_one_promos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "two_for_one_promos_business_id_key" ON "two_for_one_promos"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "two_for_one_promos_discount_id_key" ON "two_for_one_promos"("discount_id");

-- AddForeignKey
ALTER TABLE "two_for_one_promos" ADD CONSTRAINT "two_for_one_promos_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_for_one_promos" ADD CONSTRAINT "two_for_one_promos_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
