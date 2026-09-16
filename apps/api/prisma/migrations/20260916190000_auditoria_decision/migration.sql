-- Qué hacer con cada ítem que no se destraba escribiendo código (los
-- `decision.*` del tablero): lo propone quien revisa y lo lee Ale antes de dar
-- la orden final. Todo aditivo y nullable: las filas existentes quedan con
-- decision NULL, que es exactamente "todavía nadie opinó".

-- CreateEnum
CREATE TYPE "PlatformAuditDecision" AS ENUM ('HACER', 'NO_HACER', 'HABLAR');

-- AlterTable
ALTER TABLE "platform_audit_items"
  ADD COLUMN "decision" "PlatformAuditDecision",
  ADD COLUMN "decision_nota" TEXT,
  ADD COLUMN "decision_por_id" TEXT,
  ADD COLUMN "decision_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "platform_audit_items"
  ADD CONSTRAINT "platform_audit_items_decision_por_id_fkey"
  FOREIGN KEY ("decision_por_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
