-- Consultas de soporte desde el formulario público de la landing (orbita.site).
-- Antes solo eran un mail a soporte@; ahora se guardan como las del panel y se
-- responden desde el superadmin.
--   source        PANEL (Configuración → Soporte, con sesión) | LANDING (sin sesión)
--   contact_*     quién escribió por la landing (por el panel está en member)
--   has_account   si ese email tiene cuenta de miembro en algún negocio
--   business_id / member_id pasan a opcionales: sin sesión no hay miembro, y el
--   negocio solo se completa si el email coincide con un miembro (sin member_id).
-- CreateEnum
CREATE TYPE "SupportRequestSource" AS ENUM ('PANEL', 'LANDING');

-- AlterTable
ALTER TABLE "support_requests" ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_name" TEXT,
ADD COLUMN     "has_account" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "source" "SupportRequestSource" NOT NULL DEFAULT 'PANEL',
ALTER COLUMN "business_id" DROP NOT NULL,
ALTER COLUMN "member_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "support_requests_has_account_status_idx" ON "support_requests"("has_account", "status");
