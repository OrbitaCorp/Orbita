-- Marketing → cola de videos para aprobar. Solo crea una tabla nueva; no toca nada existente.

CREATE TABLE "marketing_videos" (
    "id" TEXT NOT NULL,
    "creado_por" TEXT,
    "titulo" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "guion" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "duracion_seg" INTEGER,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "ruta" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'SUBIENDO',
    "controles" JSONB NOT NULL DEFAULT '[]',
    "aprobado_por" TEXT,
    "aprobado_at" TIMESTAMP(3),
    "publicaciones" JSONB NOT NULL DEFAULT '[]',
    "expira_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_videos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_videos_ruta_key" ON "marketing_videos"("ruta");
CREATE INDEX "marketing_videos_estado_created_at_idx" ON "marketing_videos"("estado", "created_at");
CREATE INDEX "marketing_videos_expira_at_idx" ON "marketing_videos"("expira_at");

-- Seguridad por filas (RLS): sin políticas, solo accede la API de Órbita (rol que saltea RLS), como el resto.
ALTER TABLE "marketing_videos" ENABLE ROW LEVEL SECURITY;
