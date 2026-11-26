-- Alquileres: cada estadia importada guarda las filas del archivo que la forman
-- (sus movimientos) y el nombre del aviso del que vino. Con los movimientos se
-- pueden juntar dos archivos de periodos distintos sin duplicar ni pisar; con el
-- aviso, mover sus estadias si cambia la union con la propiedad. Solo suma dos
-- columnas a una tabla de Alquileres que todavia no tiene filas en produccion.
ALTER TABLE "alquileres_ingresos_externos"
  ADD COLUMN "aviso" VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN "movimientos" JSONB NOT NULL DEFAULT '[]';
