-- Cola de videos: comentarios del equipo y vínculo «este video mejora a otro». Aditiva: una columna nullable y una tabla nueva.

ALTER TABLE "marketing_videos" ADD COLUMN "mejora_de_id" TEXT;

CREATE TABLE "marketing_video_comentarios" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_video_comentarios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_video_comentarios_video_id_created_at_idx" ON "marketing_video_comentarios"("video_id", "created_at");

-- Los comentarios se borran junto con el video.
ALTER TABLE "marketing_video_comentarios" ADD CONSTRAINT "marketing_video_comentarios_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "marketing_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seguridad por filas (RLS): sin políticas, solo accede la API de Órbita (rol que saltea RLS), como el resto.
ALTER TABLE "marketing_video_comentarios" ENABLE ROW LEVEL SECURITY;
