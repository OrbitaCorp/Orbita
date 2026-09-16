-- Verificación del email de un member (hallazgo `alta-sin-verificar-email`,
-- decisión del 2026-09-16: no va en el wizard, se hace después desde "Mi
-- perfil" del panel, con 7 días de plazo).
--
-- Aditiva: la columna es nullable y la tabla es nueva. Los members que ya
-- existen quedan con `email_verify_due_at` NULL, o sea sin nada pendiente —
-- no se le pone un plazo retroactivo a nadie que ya está trabajando.

-- AlterTable
ALTER TABLE "members" ADD COLUMN "email_verify_due_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_tokens_member_id_idx" ON "email_verification_tokens"("member_id");

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Misma postura que las otras 70 tablas (hallazgo `rls-api-rest-abierta`): la
-- Data API de Supabase no la puede tocar ni con la clave anon.
ALTER TABLE "email_verification_tokens" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "email_verification_tokens" FROM anon, authenticated;
