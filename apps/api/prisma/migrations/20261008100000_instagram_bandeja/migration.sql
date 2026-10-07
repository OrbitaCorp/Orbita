-- Instagram dentro de la bandeja de Mensajes (Business Login de Instagram).
-- Solo agrega: un valor al enum de canales, una columna nullable, una tabla y su
-- enum. No toca ni borra nada existente.

ALTER TYPE "MessageChannel" ADD VALUE 'INSTAGRAM';

CREATE TYPE "InstagramConnectionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED');

ALTER TABLE "customers" ADD COLUMN "instagram_id" TEXT;
CREATE UNIQUE INDEX "customers_business_id_instagram_id_key" ON "customers"("business_id", "instagram_id");

CREATE TABLE "instagram_connections" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "ig_user_id" TEXT NOT NULL,
    "username" TEXT,
    "access_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "status" "InstagramConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_connections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instagram_connections_business_id_key" ON "instagram_connections"("business_id");
CREATE UNIQUE INDEX "instagram_connections_ig_user_id_key" ON "instagram_connections"("ig_user_id");
ALTER TABLE "instagram_connections" ADD CONSTRAINT "instagram_connections_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Guarda el token de Instagram de cada negocio (cifrado): no puede quedar abierta
-- a la API pública de Supabase. Sin FORCE, igual que el resto (ver
-- 20260910110000_rls_tablas_publicas).
ALTER TABLE "instagram_connections" ENABLE ROW LEVEL SECURITY;
