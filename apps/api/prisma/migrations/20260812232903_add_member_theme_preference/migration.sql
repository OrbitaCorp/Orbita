-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "theme_preference" "ThemePreference" NOT NULL DEFAULT 'SYSTEM';
