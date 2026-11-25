-- La lista de tutoriales distingue el módulo (tienda, turnos, alquileres o gimnasio): así el responsable de cada módulo
-- nuevo carga su propia lista al terminar su ciclo, y el panel de Tienda sigue recibiendo solo lo suyo en «Ver tutorial».
-- Aditiva: los tutoriales que ya existen son todos de Tienda y quedan como 'tienda' por el valor por defecto.
-- Escrita a mano e idempotente (IF NOT EXISTS), como las anteriores de esta tabla: la base de dev tiene drift ajeno.
ALTER TABLE "marketing_tutoriales" ADD COLUMN IF NOT EXISTS "modulo" TEXT NOT NULL DEFAULT 'tienda';

-- La lista se lee por módulo y en orden (grupo, y dentro del grupo).
CREATE INDEX IF NOT EXISTS "marketing_tutoriales_modulo_grupo_orden_orden_idx" ON "marketing_tutoriales"("modulo", "grupo_orden", "orden");
