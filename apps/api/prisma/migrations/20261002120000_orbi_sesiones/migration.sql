-- Sesiones de Orbi (fase 3, spec 2026-10-01-orbi-fase-3-ui-panel §3.2). Expand
-- puro: columnas con default en orbi_conversations y una tabla nueva. Nada se
-- borra ni se renombra; el código viejo no lee las columnas nuevas.

-- AlterTable
ALTER TABLE "orbi_conversations" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "pinned_at" TIMESTAMP(3),
ADD COLUMN     "screen" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "title_auto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- Las conversaciones que ya existen: su última actividad real, no la fecha de
-- esta migración (si no, la lista de sesiones las mostraría todas como de hoy).
UPDATE "orbi_conversations" SET "last_activity_at" = "updated_at";

-- CreateTable
CREATE TABLE "orbi_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "parts" JSONB NOT NULL,
    "turn_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orbi_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orbi_messages_conversation_id_created_at_idx" ON "orbi_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "orbi_conversations_business_id_user_id_archived_at_last_act_idx" ON "orbi_conversations"("business_id", "user_id", "archived_at", "last_activity_at" DESC);

-- AddForeignKey
ALTER TABLE "orbi_messages" ADD CONSTRAINT "orbi_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "orbi_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: el repo lo exige en toda tabla de public (test/unit/rls-supabase.unit-spec.ts).
-- Sin policies: la API accede con el rol dueño de la base, que ignora RLS.
ALTER TABLE "orbi_messages" ENABLE ROW LEVEL SECURITY;
