ALTER TABLE "storefront_config" ADD COLUMN "show_announcement_bar" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "storefront_config" ADD COLUMN "show_stats_bar" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "storefront_config" ADD COLUMN "stats_bar" JSONB;
