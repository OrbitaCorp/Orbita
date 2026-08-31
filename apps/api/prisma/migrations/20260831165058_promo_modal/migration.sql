-- CreateTable
CREATE TABLE "promo_modals" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "badge" TEXT,
    "code" TEXT,
    "cta_text" TEXT,
    "cta_link" TEXT,
    "campaign_version" INTEGER NOT NULL DEFAULT 1,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_modals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promo_modals_business_id_key" ON "promo_modals"("business_id");

-- AddForeignKey
ALTER TABLE "promo_modals" ADD CONSTRAINT "promo_modals_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
