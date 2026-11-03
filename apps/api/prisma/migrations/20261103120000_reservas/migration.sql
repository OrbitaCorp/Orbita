-- Reservas: el backend compartido de Turnos, Alquileres y Gimnasio (03/11/2026).
-- Las tablas y los índices los generó `prisma migrate diff` a partir del bloque
-- "Reservas" de schema.prisma. Lo que Prisma no modela va al final, a mano:
-- la extensión btree_gist, las restricciones de integridad (CHECK y la de
-- exclusión que impide dos reservas pisadas en un recurso exclusivo), RLS
-- (como el resto de public desde 20260910110000_rls_tablas_publicas) y los
-- tres permisos nuevos del panel con su reparto a los roles de fábrica.

-- CreateEnum
CREATE TYPE "ReservaModulo" AS ENUM ('TURNOS', 'ALQUILERES', 'GIMNASIO');

-- CreateEnum
CREATE TYPE "ReservaRecursoTipo" AS ENUM ('PROFESIONAL', 'ESPACIO', 'CANCHA', 'SALON', 'ALOJAMIENTO', 'CLASE');

-- CreateEnum
CREATE TYPE "ReservaEstado" AS ENUM ('RETENIDA', 'PENDIENTE', 'CONFIRMADA', 'COMPLETADA', 'CANCELADA', 'VENCIDA', 'AUSENTE');

-- CreateEnum
CREATE TYPE "ReservaOrigen" AS ENUM ('TIENDA', 'PANEL');

-- CreateEnum
CREATE TYPE "ReservaActor" AS ENUM ('CLIENTE', 'NEGOCIO', 'SISTEMA');

-- CreateEnum
CREATE TYPE "ReservaConfirmacion" AS ENUM ('AUTOMATICA', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReservaEsperaEstado" AS ENUM ('ESPERANDO', 'TOMADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "reservas_config" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "modulo" "ReservaModulo" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "confirmacion" "ReservaConfirmacion" NOT NULL DEFAULT 'AUTOMATICA',
    "retencion_minutos" INTEGER NOT NULL DEFAULT 10,
    "anticipacion_minima_minutos" INTEGER NOT NULL DEFAULT 60,
    "anticipacion_maxima_dias" INTEGER NOT NULL DEFAULT 60,
    "cancelacion_hasta_horas" INTEGER NOT NULL DEFAULT 24,
    "reprogramacion_hasta_horas" INTEGER NOT NULL DEFAULT 24,
    "reprogramaciones_maximas" INTEGER NOT NULL DEFAULT 2,
    "sena_porcentaje" INTEGER NOT NULL DEFAULT 0,
    "sena_reembolsable" BOOLEAN NOT NULL DEFAULT true,
    "maximo_activas_por_cliente" INTEGER NOT NULL DEFAULT 3,
    "lista_de_espera" BOOLEAN NOT NULL DEFAULT true,
    "margen_minutos" INTEGER NOT NULL DEFAULT 0,
    "horario" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

CONSTRAINT "reservas_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_recursos" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "modulo" "ReservaModulo" NOT NULL,
    "tipo" "ReservaRecursoTipo" NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(500),
    "cupo" INTEGER NOT NULL DEFAULT 1,
    "duracion_minutos" INTEGER,
    "paso_minutos" INTEGER,
    "margen_minutos" INTEGER,
    "maximo_seguidos" INTEGER NOT NULL DEFAULT 1,
    "precio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "horario" JSONB,
    "datos" JSONB,
    "member_id" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

CONSTRAINT "reservas_recursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_servicios" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "modulo" "ReservaModulo" NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(500),
    "duracion_minutos" INTEGER NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reservable_online" BOOLEAN NOT NULL DEFAULT true,
    "recurso_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

CONSTRAINT "reservas_servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "modulo" "ReservaModulo" NOT NULL,
    "recurso_id" TEXT NOT NULL,
    "servicio_id" TEXT,
    "codigo" VARCHAR(8) NOT NULL,
    "token_acceso" TEXT NOT NULL,
    "estado" "ReservaEstado" NOT NULL DEFAULT 'RETENIDA',
    "origen" "ReservaOrigen" NOT NULL DEFAULT 'TIENDA',
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "fecha" VARCHAR(10) NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "exclusivo" BOOLEAN NOT NULL DEFAULT true,
    "retenida_hasta" TIMESTAMP(3),
    "cliente_id" TEXT,
    "cliente_nombre" VARCHAR(120) NOT NULL,
    "cliente_telefono" VARCHAR(30),
    "cliente_email" VARCHAR(200),
    "notas" VARCHAR(500),
    "nota_interna" VARCHAR(500),
    "servicio" JSONB,
    "extras" JSONB,
    "precio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sena" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pago_metodo" VARCHAR(30),
    "confirmada_en" TIMESTAMP(3),
    "completada_en" TIMESTAMP(3),
    "cancelada_en" TIMESTAMP(3),
    "cancelada_por" "ReservaActor",
    "motivo_cancelacion" VARCHAR(300),
    "reprogramaciones" INTEGER NOT NULL DEFAULT 0,
    "clave_idempotencia" VARCHAR(80),
    "version" INTEGER NOT NULL DEFAULT 1,
    "creada_por_member_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_historial" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "reserva_id" TEXT NOT NULL,
    "de" "ReservaEstado",
    "a" "ReservaEstado" NOT NULL,
    "quien" "ReservaActor" NOT NULL,
    "member_id" TEXT,
    "motivo" VARCHAR(300),
    "datos" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "reservas_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_espera" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "modulo" "ReservaModulo" NOT NULL,
    "recurso_id" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "cliente_id" TEXT,
    "cliente_nombre" VARCHAR(120) NOT NULL,
    "cliente_telefono" VARCHAR(30),
    "cliente_email" VARCHAR(200),
    "token_acceso" TEXT NOT NULL,
    "estado" "ReservaEsperaEstado" NOT NULL DEFAULT 'ESPERANDO',
    "reserva_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

CONSTRAINT "reservas_espera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_bloqueos" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "modulo" "ReservaModulo" NOT NULL,
    "recurso_id" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "motivo" VARCHAR(200),
    "creado_por_member_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "reservas_bloqueos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservas_config_business_id_modulo_key" ON "reservas_config"("business_id", "modulo");

-- CreateIndex
CREATE INDEX "reservas_recursos_business_id_modulo_idx" ON "reservas_recursos"("business_id", "modulo");

-- CreateIndex
CREATE INDEX "reservas_servicios_business_id_modulo_idx" ON "reservas_servicios"("business_id", "modulo");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_token_acceso_key" ON "reservas"("token_acceso");

-- CreateIndex
CREATE INDEX "reservas_business_id_recurso_id_inicio_idx" ON "reservas"("business_id", "recurso_id", "inicio");

-- CreateIndex
CREATE INDEX "reservas_business_id_fecha_idx" ON "reservas"("business_id", "fecha");

-- CreateIndex
CREATE INDEX "reservas_business_id_estado_inicio_idx" ON "reservas"("business_id", "estado", "inicio");

-- CreateIndex
CREATE INDEX "reservas_estado_retenida_hasta_idx" ON "reservas"("estado", "retenida_hasta");

-- CreateIndex
CREATE INDEX "reservas_cliente_id_idx" ON "reservas"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_business_id_codigo_key" ON "reservas"("business_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_business_id_clave_idempotencia_key" ON "reservas"("business_id", "clave_idempotencia");

-- CreateIndex
CREATE INDEX "reservas_historial_reserva_id_created_at_idx" ON "reservas_historial"("reserva_id", "created_at");

-- CreateIndex
CREATE INDEX "reservas_historial_business_id_idx" ON "reservas_historial"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_espera_token_acceso_key" ON "reservas_espera"("token_acceso");

-- CreateIndex
CREATE INDEX "reservas_espera_business_id_recurso_id_inicio_estado_idx" ON "reservas_espera"("business_id", "recurso_id", "inicio", "estado");

-- CreateIndex
CREATE INDEX "reservas_bloqueos_business_id_modulo_inicio_idx" ON "reservas_bloqueos"("business_id", "modulo", "inicio");

-- AddForeignKey
ALTER TABLE "reservas_config" ADD CONSTRAINT "reservas_config_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_recursos" ADD CONSTRAINT "reservas_recursos_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_servicios" ADD CONSTRAINT "reservas_servicios_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "reservas_recursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_historial" ADD CONSTRAINT "reservas_historial_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_historial" ADD CONSTRAINT "reservas_historial_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_espera" ADD CONSTRAINT "reservas_espera_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_espera" ADD CONSTRAINT "reservas_espera_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "reservas_recursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_bloqueos" ADD CONSTRAINT "reservas_bloqueos_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_bloqueos" ADD CONSTRAINT "reservas_bloqueos_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "reservas_recursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Integridad que no depende del código ────────────────────────────────────

-- btree_gist permite mezclar `=` sobre un texto con `&&` sobre un rango en un
-- mismo índice GiST, que es lo que necesita la restricción de exclusión.
-- Disponible en Supabase; si ya está creada no hace nada.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservas" ADD CONSTRAINT "reservas_fin_despues_de_inicio" CHECK ("fin" > "inicio");
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cantidad_positiva" CHECK ("cantidad" >= 1);
ALTER TABLE "reservas_espera" ADD CONSTRAINT "reservas_espera_fin_despues_de_inicio" CHECK ("fin" > "inicio");
ALTER TABLE "reservas_bloqueos" ADD CONSTRAINT "reservas_bloqueos_fin_despues_de_inicio" CHECK ("fin" > "inicio");
ALTER TABLE "reservas_recursos" ADD CONSTRAINT "reservas_recursos_cupo_positivo" CHECK ("cupo" >= 1);

-- Dos reservas que ocupan lugar (retenida, pendiente o confirmada) de un mismo
-- recurso exclusivo (cupo 1) no pueden pisarse en el tiempo: [inicio, fin) es
-- abierto a la derecha, así una de 10:00 a 10:30 y otra de 10:30 a 11:00 no
-- chocan. Si dos pedidos llegan a la vez y los dos pasan la verificación del
-- service, el segundo INSERT falla acá con 23P01 y el service responde 409.
-- Las canceladas, vencidas, completadas y ausentes quedan afuera del índice.
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_sin_solapamiento"
  EXCLUDE USING gist ("recurso_id" WITH =, tsrange("inicio", "fin", '[)') WITH &&)
  WHERE ("exclusivo" AND "estado" IN ('RETENIDA', 'PENDIENTE', 'CONFIRMADA'));

-- ─── RLS: nadie llega a estas tablas por la API pública de Supabase ──────────

ALTER TABLE "reservas_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservas_recursos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservas_servicios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservas_historial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservas_espera" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservas_bloqueos" ENABLE ROW LEVEL SECURITY;

-- ─── Permisos del panel ──────────────────────────────────────────────────────
-- Mismo criterio que 20260917190000_mensajes_avanzado_permisos: ver y gestionar
-- reservas (dar, mover, cancelar, cobrar) van a los roles de fábrica owner,
-- admin y empleado; configurar (recursos, servicios, reglas y bloqueos) solo a
-- owner y admin. El Propietario pasa igual por PermissionsGuard.

INSERT INTO "permissions" ("id", "group", "code", "label")
VALUES
  (gen_random_uuid(), 'Reservas', 'reservas.view', 'Ver reservas'),
  (gen_random_uuid(), 'Reservas', 'reservas.manage', 'Gestionar reservas'),
  (gen_random_uuid(), 'Reservas', 'reservas.config', 'Configurar reservas')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."code" IN ('reservas.view', 'reservas.manage')
  AND r."is_default" = true
  AND r."name" IN ('owner', 'admin', 'empleado')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."code" = 'reservas.config'
  AND r."is_default" = true
  AND r."name" IN ('owner', 'admin')
ON CONFLICT DO NOTHING;
