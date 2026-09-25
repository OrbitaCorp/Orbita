-- CreateTable
CREATE TABLE "store_visits" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT '',
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "path" TEXT NOT NULL DEFAULT '/',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_visits_business_id_created_at_idx" ON "store_visits"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "store_visits_business_id_is_custom_idx" ON "store_visits"("business_id", "is_custom");

-- AddForeignKey
ALTER TABLE "store_visits" ADD CONSTRAINT "store_visits_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "store_visits" ENABLE ROW LEVEL SECURITY;
