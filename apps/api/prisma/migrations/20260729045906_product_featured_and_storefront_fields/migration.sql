-- AlterTable
ALTER TABLE "products" ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "storefront_config" ADD COLUMN     "cta_text" TEXT,
ADD COLUMN     "font_family_body" TEXT,
ADD COLUMN     "shipping_text" TEXT,
ADD COLUMN     "show_categories_section" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_footer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_low_stock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_offer_badge" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_search" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whatsapp_text" TEXT;
