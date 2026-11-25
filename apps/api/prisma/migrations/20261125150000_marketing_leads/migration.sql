-- Marketing → Leads y Pilotos por rubro (Superadmin → Marketing → Leads).
CREATE TABLE "marketing_leads" (
    "id" TEXT NOT NULL,
    "clave" TEXT,
    "rubro" TEXT NOT NULL,
    "subrubro" TEXT NOT NULL,
    "clasificacion" TEXT NOT NULL DEFAULT 'LEAD',
    "negocio" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "telefono" TEXT,
    "whatsapp_url" TEXT,
    "instagram" TEXT,
    "web_actual" TEXT,
    "resenas" TEXT,
    "direccion" TEXT,
    "fuente" TEXT,
    "contactado" BOOLEAN NOT NULL DEFAULT false,
    "contactado_por" TEXT,
    "contactado_at" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'NUEVO',
    "asignado_a" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_leads_clave_key" ON "marketing_leads"("clave");
CREATE INDEX "marketing_leads_rubro_localidad_idx" ON "marketing_leads"("rubro", "localidad");
CREATE INDEX "marketing_leads_rubro_clasificacion_idx" ON "marketing_leads"("rubro", "clasificacion");
CREATE INDEX "marketing_leads_estado_contactado_idx" ON "marketing_leads"("estado", "contactado");
