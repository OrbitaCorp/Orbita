-- Gimnasio: lo que no es una reserva (24/11/2026). Decisión del 16/11: los planes, los alumnos y
-- el plan de cada alumno viven en tablas propias, al lado del motor de reservas y sin tocarlo.
--
-- Las clases que un alumno usó de su plan NO tienen tabla: cada reserva dice con qué se pagó en
-- `reservas.datos.gimnasio` y de ahí se cuentan, así el saldo de un pack no puede desfasarse.
--
-- Aditiva: tres tablas y dos enums nuevos, nada de lo que existe cambia. Las tablas y los índices
-- los generó `prisma migrate diff` a partir del bloque "Gimnasio" de schema.prisma. Lo que Prisma
-- no modela va al final, a mano: las restricciones CHECK y RLS (como el resto de public desde
-- 20260910110000_rls_tablas_publicas). No suma permisos: usa los tres de reservas.

-- CreateEnum
CREATE TYPE "GimnasioPlanTipo" AS ENUM ('PRUEBA', 'SUELTA', 'PACK', 'MEMBRESIA');

-- CreateEnum
CREATE TYPE "GimnasioSuscripcionEstado" AS ENUM ('VIGENTE', 'CANCELADA');

-- CreateTable
CREATE TABLE "gimnasio_planes" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "tipo" "GimnasioPlanTipo" NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "clases" INTEGER,
    "por_semana" INTEGER,
    "vigencia_dias" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "eliminado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gimnasio_planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gimnasio_alumnos" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "nota" VARCHAR(500),
    "alta" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gimnasio_alumnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gimnasio_suscripciones" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "alumno_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "tipo" "GimnasioPlanTipo" NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "clases" INTEGER,
    "por_semana" INTEGER,
    "desde" VARCHAR(10) NOT NULL,
    "hasta" VARCHAR(10) NOT NULL,
    "estado" "GimnasioSuscripcionEstado" NOT NULL DEFAULT 'VIGENTE',
    "renueva_id" TEXT,
    "creada_por_member_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gimnasio_suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gimnasio_planes_business_id_eliminado_en_idx" ON "gimnasio_planes"("business_id", "eliminado_en");

-- CreateIndex
CREATE UNIQUE INDEX "gimnasio_alumnos_business_id_cliente_id_key" ON "gimnasio_alumnos"("business_id", "cliente_id");

-- CreateIndex
CREATE INDEX "gimnasio_suscripciones_business_id_alumno_id_hasta_idx" ON "gimnasio_suscripciones"("business_id", "alumno_id", "hasta");

-- CreateIndex
CREATE INDEX "gimnasio_suscripciones_business_id_desde_idx" ON "gimnasio_suscripciones"("business_id", "desde");

-- AddForeignKey
ALTER TABLE "gimnasio_planes" ADD CONSTRAINT "gimnasio_planes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gimnasio_alumnos" ADD CONSTRAINT "gimnasio_alumnos_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gimnasio_alumnos" ADD CONSTRAINT "gimnasio_alumnos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gimnasio_suscripciones" ADD CONSTRAINT "gimnasio_suscripciones_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gimnasio_suscripciones" ADD CONSTRAINT "gimnasio_suscripciones_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "gimnasio_alumnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gimnasio_suscripciones" ADD CONSTRAINT "gimnasio_suscripciones_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "gimnasio_planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Integridad que Prisma no modela ─────────────────────────────────────────

ALTER TABLE "gimnasio_planes" ADD CONSTRAINT "gimnasio_planes_precio_no_negativo" CHECK ("precio" >= 0);
ALTER TABLE "gimnasio_planes" ADD CONSTRAINT "gimnasio_planes_vigencia_positiva" CHECK ("vigencia_dias" >= 1);
-- Un pack dice cuántas clases trae; el tope semanal de una membresía nunca es negativo (0 = libre).
ALTER TABLE "gimnasio_planes" ADD CONSTRAINT "gimnasio_planes_pack_con_clases" CHECK ("tipo" <> 'PACK' OR ("clases" IS NOT NULL AND "clases" >= 1));
ALTER TABLE "gimnasio_planes" ADD CONSTRAINT "gimnasio_planes_por_semana_no_negativo" CHECK ("por_semana" IS NULL OR "por_semana" >= 0);
ALTER TABLE "gimnasio_suscripciones" ADD CONSTRAINT "gimnasio_suscripciones_precio_no_negativo" CHECK ("precio" >= 0);
-- Los días van como AAAA-MM-DD: así se comparan como texto, y el plan no termina antes de empezar.
ALTER TABLE "gimnasio_suscripciones" ADD CONSTRAINT "gimnasio_suscripciones_hasta_despues_de_desde" CHECK ("hasta" >= "desde");

-- ─── RLS: nadie llega a estas tablas por la API pública de Supabase ──────────

ALTER TABLE "gimnasio_planes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gimnasio_alumnos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gimnasio_suscripciones" ENABLE ROW LEVEL SECURITY;
