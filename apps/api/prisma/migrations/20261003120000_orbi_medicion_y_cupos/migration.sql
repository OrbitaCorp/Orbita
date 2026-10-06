-- Orbi: ficha ampliada de cada turno, cupo mensual en créditos y registro de
-- lecturas de conversaciones (spec 2026-10-03-orbi-medicion-y-cupos). Todo
-- aditivo: columnas que admiten null o con default, y tablas nuevas.

ALTER TABLE "orbi_turns"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "cached_tokens" INTEGER,
  ADD COLUMN "thinking_tokens" INTEGER,
  ADD COLUMN "ttft_ms" INTEGER,
  ADD COLUMN "cost_usd" DECIMAL(12,6),
  ADD COLUMN "tools_cost_usd" DECIMAL(12,6),
  ADD COLUMN "credits" INTEGER,
  ADD COLUMN "error_category" TEXT,
  ADD COLUMN "section" TEXT,
  ADD COLUMN "context_chars" JSONB,
  ADD COLUMN "steps" JSONB,
  ADD COLUMN "writes_rejected" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "actions_confirmed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "actions_rejected" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "orbi_pending_actions" ADD COLUMN "turn_id" TEXT;

CREATE TABLE "orbi_cupo_ajustes" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "creditos" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orbi_cupo_ajustes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "orbi_cupo_ajustes_business_id_mes_idx" ON "orbi_cupo_ajustes"("business_id", "mes");
ALTER TABLE "orbi_cupo_ajustes" ADD CONSTRAINT "orbi_cupo_ajustes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "orbi_cupo_miembros" (
    "business_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "tope_porcentaje" INTEGER NOT NULL,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orbi_cupo_miembros_pkey" PRIMARY KEY ("business_id", "member_id")
);
ALTER TABLE "orbi_cupo_miembros" ADD CONSTRAINT "orbi_cupo_miembros_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "orbi_conversation_access" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "ticket" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orbi_conversation_access_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "orbi_conversation_access_conversation_id_idx" ON "orbi_conversation_access"("conversation_id");
CREATE INDEX "orbi_conversation_access_admin_id_created_at_idx" ON "orbi_conversation_access"("admin_id", "created_at");

-- RLS: el repo lo exige en toda tabla de public (test/unit/rls-supabase.unit-spec.ts).
-- Sin policies: la API accede con el rol dueño de la base, que ignora RLS.
ALTER TABLE "orbi_cupo_ajustes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orbi_cupo_miembros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orbi_conversation_access" ENABLE ROW LEVEL SECURITY;
