-- CreateTable
CREATE TABLE "platform_discount_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "percent_off" INTEGER NOT NULL,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_discount_redemptions" (
    "id" TEXT NOT NULL,
    "code_id" TEXT NOT NULL,
    "business_id" TEXT,
    "email" TEXT NOT NULL,
    "amount_base" DECIMAL(12,2) NOT NULL,
    "amount_final" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_discount_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_discount_codes_code_key" ON "platform_discount_codes"("code");

-- CreateIndex
CREATE INDEX "platform_discount_codes_is_active_idx" ON "platform_discount_codes"("is_active");

-- CreateIndex
CREATE INDEX "platform_discount_redemptions_code_id_idx" ON "platform_discount_redemptions"("code_id");

-- AddForeignKey
ALTER TABLE "platform_discount_codes" ADD CONSTRAINT "platform_discount_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_discount_redemptions" ADD CONSTRAINT "platform_discount_redemptions_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "platform_discount_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
