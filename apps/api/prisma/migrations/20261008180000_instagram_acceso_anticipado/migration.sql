-- Acceso anticipado a Instagram: el dueño pide acceso con su @usuario y el equipo lo
-- habilita desde el superadmin. Solo agrega un enum y una tabla; no toca nada existente.

CREATE TYPE "InstagramEarlyAccessStatus" AS ENUM ('PENDING', 'ENABLED');

CREATE TABLE "instagram_early_access" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "status" "InstagramEarlyAccessStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled_at" TIMESTAMP(3),

    CONSTRAINT "instagram_early_access_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instagram_early_access_business_id_key" ON "instagram_early_access"("business_id");
ALTER TABLE "instagram_early_access" ADD CONSTRAINT "instagram_early_access_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sin policies, igual que el resto: la API entra con un rol que se salta RLS y la API
-- pública de Supabase no puede leer ni escribir esta tabla (ver
-- 20260910110000_rls_tablas_publicas).
ALTER TABLE "instagram_early_access" ENABLE ROW LEVEL SECURITY;
