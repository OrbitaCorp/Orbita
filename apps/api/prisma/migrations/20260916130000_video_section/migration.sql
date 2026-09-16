-- AlterTable
ALTER TABLE "storefront_config" ADD COLUMN     "show_video" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "video_title" TEXT,
ADD COLUMN     "video_subtitle" TEXT,
ADD COLUMN     "video_url" TEXT,
ADD COLUMN     "video_poster_url" TEXT;
