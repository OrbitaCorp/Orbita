-- Auditoría interna del super admin (RBT, 2026-09-09): inventario vivo de
-- módulos, revisiones transversales y hallazgos, con responsable, estado,
-- informe y checks por ítem. Ver PlatformAuditItem en schema.prisma.
--
-- Escrita a mano y NO con `prisma migrate diff`, por el drift preexistente de
-- wizard_ai_turns (ver 20260906120000_countdown_home_section).

-- CreateEnum
CREATE TYPE "PlatformAuditArea" AS ENUM ('BACKEND', 'FRONTEND', 'TRANSVERSAL', 'HALLAZGO');

-- CreateEnum
CREATE TYPE "PlatformAuditEstado" AS ENUM ('PENDIENTE', 'EN_CURSO', 'HECHO');

-- CreateEnum
CREATE TYPE "PlatformAuditSeveridad" AS ENUM ('CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'INFO');

-- CreateTable
CREATE TABLE "platform_audit_items" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "area" "PlatformAuditArea" NOT NULL,
    "grupo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ruta" TEXT,
    "foco" TEXT NOT NULL,
    "severidad" "PlatformAuditSeveridad",
    "estado" "PlatformAuditEstado" NOT NULL DEFAULT 'PENDIENTE',
    "checks" JSONB NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "es_personalizado" BOOLEAN NOT NULL DEFAULT false,
    "responsable_id" TEXT,
    "informe_url" TEXT,
    "notas" TEXT,
    "hecho_por_id" TEXT,
    "hecho_at" TIMESTAMP(3),
    "actualizado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_audit_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_audit_items_key_key" ON "platform_audit_items"("key");

-- CreateIndex
CREATE INDEX "platform_audit_items_area_grupo_idx" ON "platform_audit_items"("area", "grupo");

-- CreateIndex
CREATE INDEX "platform_audit_items_estado_idx" ON "platform_audit_items"("estado");

-- AddForeignKey
ALTER TABLE "platform_audit_items" ADD CONSTRAINT "platform_audit_items_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_items" ADD CONSTRAINT "platform_audit_items_hecho_por_id_fkey" FOREIGN KEY ("hecho_por_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_items" ADD CONSTRAINT "platform_audit_items_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
