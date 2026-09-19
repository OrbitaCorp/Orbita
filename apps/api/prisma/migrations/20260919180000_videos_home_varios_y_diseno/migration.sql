-- Sección de video del home: varios videos y un diseño a elegir (Ale,
-- 19/09). Dos columnas nuevas y nullables: ninguna tienda cambia sola —
-- con `videos` en null el storefront sigue mostrando `video_url` como
-- único video, y `video_layout` null es el diseño de siempre ('cine').
ALTER TABLE "storefront_config" ADD COLUMN "video_layout" TEXT;
ALTER TABLE "storefront_config" ADD COLUMN "videos" JSONB;
