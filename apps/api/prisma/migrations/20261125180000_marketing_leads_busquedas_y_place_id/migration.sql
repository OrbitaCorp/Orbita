-- Agrega place_id único a marketing_leads y tabla de checkpoints de búsquedas automáticas
ALTER TABLE "marketing_leads" ADD COLUMN IF NOT EXISTS "place_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_leads_place_id_key" ON "marketing_leads"("place_id");

CREATE TABLE "marketing_lead_busquedas" (
  "id" TEXT NOT NULL,
  "clave_consulta" TEXT NOT NULL,
  "rubro" TEXT NOT NULL,
  "localidad" TEXT NOT NULL,
  "termino" TEXT NOT NULL,
  "pagina" INTEGER NOT NULL DEFAULT 1,
  "fuente" TEXT NOT NULL DEFAULT 'serper_maps',
  "encontrados" INTEGER NOT NULL DEFAULT 0,
  "nuevos" INTEGER NOT NULL DEFAULT 0,
  "duplicados" INTEGER NOT NULL DEFAULT 0,
  "ejecutado_por" TEXT,
  "ejecutado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "marketing_lead_busquedas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_lead_busquedas_clave_consulta_key" ON "marketing_lead_busquedas"("clave_consulta");
CREATE INDEX "marketing_lead_busquedas_rubro_localidad_idx" ON "marketing_lead_busquedas"("rubro", "localidad");

ALTER TABLE "marketing_lead_busquedas" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "marketing_lead_busquedas" FROM anon, authenticated;
