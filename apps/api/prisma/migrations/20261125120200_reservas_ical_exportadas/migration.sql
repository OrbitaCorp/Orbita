-- La memoria de lo que el .ics publico de un recurso mostro alguna vez, para
-- reconocer el eco de Airbnb (ver ReservaIcalExportada en schema.prisma y
-- src/reservas/README.md). Tabla nueva: no toca ninguna otra. Con RLS, como
-- el resto de las tablas de reservas.
CREATE TABLE "reservas_ical_exportadas" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "recurso_id" TEXT NOT NULL,
    "desde" VARCHAR(10) NOT NULL,
    "hasta" VARCHAR(10) NOT NULL,
    "ultima_vez" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_ical_exportadas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reservas_ical_exportadas_recurso_id_desde_hasta_key" ON "reservas_ical_exportadas"("recurso_id", "desde", "hasta");
CREATE INDEX "reservas_ical_exportadas_business_id_idx" ON "reservas_ical_exportadas"("business_id");

ALTER TABLE "reservas_ical_exportadas" ADD CONSTRAINT "reservas_ical_exportadas_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservas_ical_exportadas" ADD CONSTRAINT "reservas_ical_exportadas_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "reservas_recursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservas_ical_exportadas" ENABLE ROW LEVEL SECURITY;
