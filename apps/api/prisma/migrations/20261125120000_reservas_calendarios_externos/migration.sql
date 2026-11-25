-- Calendarios externos (.ics) para el motor de reservas: hoy, el de un aviso de
-- Airbnb conectado a un alojamiento (decision "lo que Alquileres le pide al
-- backend compartido", punto 5; plan 2026-11-25-alquileres-airbnb-calendario).
--
-- Tabla nueva, y en reservas_bloqueos cuatro columnas: de donde vino el bloqueo
-- y, si vino de un calendario, de cual. Ninguna fila existente cambia: todo
-- bloqueo actual queda como DUENO, que es lo que era. Turnos y Gimnasio no
-- tienen que hacer nada.
CREATE TYPE "ReservaBloqueoOrigen" AS ENUM ('DUENO', 'ICAL');

CREATE TABLE "reservas_calendarios_externos" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "modulo" "ReservaModulo" NOT NULL,
    "recurso_id" TEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "url" VARCHAR(600) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultima_sync" TIMESTAMP(3),
    "ultimo_error" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_calendarios_externos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reservas_calendarios_externos_business_id_modulo_idx" ON "reservas_calendarios_externos"("business_id", "modulo");
CREATE INDEX "reservas_calendarios_externos_activo_ultima_sync_idx" ON "reservas_calendarios_externos"("activo", "ultima_sync");

ALTER TABLE "reservas_calendarios_externos" ADD CONSTRAINT "reservas_calendarios_externos_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservas_calendarios_externos" ADD CONSTRAINT "reservas_calendarios_externos_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "reservas_recursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservas_bloqueos" ADD COLUMN "origen" "ReservaBloqueoOrigen" NOT NULL DEFAULT 'DUENO';
ALTER TABLE "reservas_bloqueos" ADD COLUMN "calendario_id" TEXT;
ALTER TABLE "reservas_bloqueos" ADD COLUMN "externo_tipo" VARCHAR(12);
ALTER TABLE "reservas_bloqueos" ADD COLUMN "externo_uid" VARCHAR(255);

CREATE INDEX "reservas_bloqueos_calendario_id_idx" ON "reservas_bloqueos"("calendario_id");

-- Al borrar un calendario, sus bloqueos se van con el.
ALTER TABLE "reservas_bloqueos" ADD CONSTRAINT "reservas_bloqueos_calendario_id_fkey" FOREIGN KEY ("calendario_id") REFERENCES "reservas_calendarios_externos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
