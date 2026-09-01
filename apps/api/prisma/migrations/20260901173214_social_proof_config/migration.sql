-- CreateEnum
CREATE TYPE "SocialProofPosition" AS ENUM ('BOTTOM_LEFT', 'BOTTOM_RIGHT');

-- CreateTable
CREATE TABLE "social_proof_configs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "position" "SocialProofPosition" NOT NULL DEFAULT 'BOTTOM_LEFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_proof_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_proof_configs_business_id_key" ON "social_proof_configs"("business_id");

-- AddForeignKey
ALTER TABLE "social_proof_configs" ADD CONSTRAINT "social_proof_configs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
