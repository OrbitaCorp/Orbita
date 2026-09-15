-- AlterTable
ALTER TABLE "storefront_config" ADD COLUMN     "show_brands" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "brands_title" TEXT,
ADD COLUMN     "brands" JSONB;
