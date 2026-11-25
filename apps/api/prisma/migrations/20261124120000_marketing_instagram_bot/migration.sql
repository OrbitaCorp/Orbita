-- Bot de ventas de Órbita en Instagram (Superadmin → Marketing → Instagram → Respuestas automáticas). Solo agrega
-- tablas: la configuración (una fila por negocio, en la práctica solo el de la empresa) y los comentarios a los que ya
-- se les mandó el mensaje privado, para no mandarlo dos veces cuando Meta reintenta el aviso.

CREATE TABLE "marketing_instagram_bots" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "usar_ia" BOOLEAN NOT NULL DEFAULT true,
    "responder_comentarios" BOOLEAN NOT NULL DEFAULT true,
    "todos_los_comentarios" BOOLEAN NOT NULL DEFAULT false,
    "palabras_clave" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "respuestas_publicas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "saludo_comentario" TEXT,
    "correos_aviso" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estado_meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_instagram_bots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "marketing_instagram_bots_business_id_key" ON "marketing_instagram_bots"("business_id");
ALTER TABLE "marketing_instagram_bots" ADD CONSTRAINT "marketing_instagram_bots_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "marketing_instagram_comentarios" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "media_id" TEXT,
    "usuario" TEXT,
    "texto" TEXT NOT NULL,
    "privado" BOOLEAN NOT NULL DEFAULT false,
    "publico" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_instagram_comentarios_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "marketing_instagram_comentarios_comment_id_key" ON "marketing_instagram_comentarios"("comment_id");
CREATE INDEX "marketing_instagram_comentarios_business_id_created_at_idx" ON "marketing_instagram_comentarios"("business_id", "created_at");
ALTER TABLE "marketing_instagram_comentarios" ADD CONSTRAINT "marketing_instagram_comentarios_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Igual que el resto de las tablas: la API entra con su propio rol; nadie lee esto con la clave pública de Supabase.
ALTER TABLE "marketing_instagram_bots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_instagram_comentarios" ENABLE ROW LEVEL SECURITY;
