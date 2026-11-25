-- RLS: nadie llega a esta tabla por la API publica de Supabase, igual que al
-- resto de las tablas de reservas (20261103120000_reservas). La API de Orbita
-- entra con su propio rol y no se ve afectada. Va aparte de la migracion que
-- crea la tabla porque esa ya estaba aplicada en dev cuando el test de RLS
-- (test/unit/rls-supabase.unit-spec.ts) marco la falta.
ALTER TABLE "reservas_calendarios_externos" ENABLE ROW LEVEL SECURITY;
