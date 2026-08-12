-- CreateEnum
CREATE TYPE "OrderOrigin" AS ENUM ('MANUAL', 'STOREFRONT');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "origin" "OrderOrigin" NOT NULL DEFAULT 'STOREFRONT';
