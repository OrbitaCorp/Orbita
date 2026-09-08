-- DropIndex
DROP INDEX "two_for_one_promos_business_id_key";

-- CreateIndex
CREATE INDEX "two_for_one_promos_business_id_idx" ON "two_for_one_promos"("business_id");
