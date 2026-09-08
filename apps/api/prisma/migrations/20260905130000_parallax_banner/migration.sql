-- AlterTable
ALTER TABLE "storefront_config" ADD COLUMN     "show_parallax_banner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parallax_image_url" TEXT,
ADD COLUMN     "parallax_title" TEXT,
ADD COLUMN     "parallax_subtitle" TEXT,
ADD COLUMN     "parallax_cta_text" TEXT,
ADD COLUMN     "parallax_cta_link" TEXT;
