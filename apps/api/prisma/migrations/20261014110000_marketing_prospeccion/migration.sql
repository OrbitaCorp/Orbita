-- Marketing → Prospección: negocios de Instagram para contactar, con su puntaje y el análisis de Claude.
-- Solo crea dos tablas nuevas; no toca nada existente.

CREATE TABLE "marketing_prospectos" (
    "id" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "evaluacion" JSONB NOT NULL,
    "analisis" JSONB,
    "analizado_por" TEXT,
    "analizado_at" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'NUEVO',
    "responsable_id" TEXT,
    "notas" TEXT,
    "ultima_consulta_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_prospectos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_prospeccion_lotes" (
    "id" TEXT NOT NULL,
    "creado_por" TEXT,
    "usuarios" TEXT[],
    "sin_datos" JSONB NOT NULL DEFAULT '[]',
    "version_criterio" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_prospeccion_lotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_prospectos_usuario_key" ON "marketing_prospectos"("usuario");
CREATE INDEX "marketing_prospectos_estado_idx" ON "marketing_prospectos"("estado");
CREATE INDEX "marketing_prospectos_ultima_consulta_at_idx" ON "marketing_prospectos"("ultima_consulta_at");
CREATE INDEX "marketing_prospeccion_lotes_created_at_idx" ON "marketing_prospeccion_lotes"("created_at");
