-- AlterTable
ALTER TABLE "storefront_config" ADD COLUMN "category_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
