-- AlterEnum
ALTER TYPE "UserType" ADD VALUE 'PLATFORM_ADMIN';

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_business_id_fkey";

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_business_id_fkey";

-- AlterTable
ALTER TABLE "password_reset_tokens" ALTER COLUMN "business_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "platform_admins" ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "google_id" TEXT,
ADD COLUMN     "has_temp_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_access_at" TIMESTAMP(3),
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "password_hash" TEXT;

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "business_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_google_id_key" ON "platform_admins"("google_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

