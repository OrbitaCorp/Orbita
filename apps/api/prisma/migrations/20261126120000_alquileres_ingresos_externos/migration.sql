-- Alquileres: las estadias que el dueno cobro afuera (hoy, Airbnb), importadas
-- del archivo de ganancias, y con que propiedad va cada aviso de afuera. Ver
-- AlquilerIngresoExterno y AlquilerAvisoExterno en schema.prisma y
-- src/alquileres/README.md. Dos tablas nuevas: no tocan ninguna otra. Con RLS,
-- como el resto.
CREATE TABLE "alquileres_ingresos_externos" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "recurso_id" TEXT NOT NULL,
    "canal" VARCHAR(20) NOT NULL,
    "codigo_externo" VARCHAR(40) NOT NULL,
    "entrada" VARCHAR(10) NOT NULL,
    "salida" VARCHAR(10) NOT NULL,
    "noches" INTEGER NOT NULL,
    "huesped" VARCHAR(120),
    "monto_bruto" DECIMAL(14,2) NOT NULL,
    "comision" DECIMAL(14,2) NOT NULL,
    "limpieza" DECIMAL(14,2) NOT NULL,
    "monto_neto" DECIMAL(14,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL,
    "importado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alquileres_ingresos_externos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alquileres_avisos_externos" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "canal" VARCHAR(20) NOT NULL,
    "nombre_externo" VARCHAR(200) NOT NULL,
    "recurso_id" TEXT NOT NULL,

    CONSTRAINT "alquileres_avisos_externos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alquileres_ingresos_externos_business_id_canal_codigo_exter_key" ON "alquileres_ingresos_externos"("business_id", "canal", "codigo_externo");
CREATE INDEX "alquileres_ingresos_externos_business_id_entrada_idx" ON "alquileres_ingresos_externos"("business_id", "entrada");
CREATE UNIQUE INDEX "alquileres_avisos_externos_business_id_canal_nombre_externo_key" ON "alquileres_avisos_externos"("business_id", "canal", "nombre_externo");

ALTER TABLE "alquileres_ingresos_externos" ADD CONSTRAINT "alquileres_ingresos_externos_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alquileres_ingresos_externos" ADD CONSTRAINT "alquileres_ingresos_externos_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "reservas_recursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alquileres_avisos_externos" ADD CONSTRAINT "alquileres_avisos_externos_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alquileres_avisos_externos" ADD CONSTRAINT "alquileres_avisos_externos_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "reservas_recursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "alquileres_ingresos_externos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alquileres_avisos_externos" ENABLE ROW LEVEL SECURITY;
