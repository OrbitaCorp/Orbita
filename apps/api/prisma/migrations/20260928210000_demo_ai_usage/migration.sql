-- Contador semanal de pruebas de IA de la demo pública, por IP (hasheada).
-- Ver DemoAiUsage en schema.prisma. Aditiva.
CREATE TABLE "demo_ai_usage" (
    "id" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_ai_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "demo_ai_usage_ip_hash_feature_week_key" ON "demo_ai_usage"("ip_hash", "feature", "week");
CREATE INDEX "demo_ai_usage_week_idx" ON "demo_ai_usage"("week");

-- Mismo criterio que el resto de las tablas: RLS activado y sin políticas, así
-- los roles públicos de Supabase (anon/authenticated) no la leen ni escriben;
-- la API entra con el rol dueño, que no pasa por RLS.
ALTER TABLE "demo_ai_usage" ENABLE ROW LEVEL SECURITY;
