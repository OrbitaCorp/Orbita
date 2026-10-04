-- Mantenimiento automático de Orbi (spec 2026-10-01-orbi-mantenimiento-automatico).
-- Solo agrega tablas: no toca ninguna existente (expand puro, sin riesgo de rollback).
-- La fila 'global' de orbi_service_state la crea el servicio al primer uso.

-- CreateTable
CREATE TABLE "orbi_service_state" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "detail" TEXT,
    "tripped_at" TIMESTAMP(3),
    "tripped_by" TEXT,
    "last_ok_at" TIMESTAMP(3),
    "last_notified_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orbi_service_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orbi_provider_failures" (
    "id" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "http_status" INTEGER,
    "actor" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orbi_provider_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orbi_provider_failures_created_at_idx" ON "orbi_provider_failures"("created_at");

-- RLS: el repo lo exige en toda tabla de public (test/unit/rls-supabase.unit-spec.ts).
-- Sin policies: la API accede con el rol dueño de la base, que ignora RLS.
ALTER TABLE "orbi_service_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orbi_provider_failures" ENABLE ROW LEVEL SECURITY;
