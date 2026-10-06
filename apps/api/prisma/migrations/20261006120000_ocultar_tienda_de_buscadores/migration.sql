-- Moderación: el equipo de Órbita puede sacar una tienda de Google y del
-- directorio público sin suspenderla (la tienda sigue vendiendo).
--
-- Solo agrega dos columnas con valor por defecto: no reescribe filas ni cambia
-- el comportamiento de ninguna tienda existente (todas quedan visibles, como hoy).
ALTER TABLE "businesses" ADD COLUMN "hidden_from_search" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN "hidden_from_search_reason" TEXT;
