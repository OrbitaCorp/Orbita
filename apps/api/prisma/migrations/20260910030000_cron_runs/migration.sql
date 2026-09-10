-- Corridas de los jobs de Cloud Scheduler (auditoría interna 09/09, ítem
-- `api.internal-cron`): marca persistente por ventana lógica para que un
-- reintento no repita el trabajo y dos disparos simultáneos no se pisen.
CREATE TABLE "cron_runs" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "run_key" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "ok" BOOLEAN,
    "detalle" TEXT,

    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cron_runs_job_run_key_key" ON "cron_runs"("job", "run_key");
CREATE INDEX "cron_runs_job_started_at_idx" ON "cron_runs"("job", "started_at");
