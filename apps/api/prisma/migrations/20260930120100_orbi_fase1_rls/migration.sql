-- La migración 20260930120000_orbi_fase1_base creó orbi_pending_actions,
-- daily_quota y orbi_turns sin habilitar RLS. El repo exige RLS en toda tabla
-- de public creada después de 20260910110000_rls_tablas_publicas (lo verifica
-- test/unit/rls-supabase.unit-spec.ts): sin RLS, Supabase las expondría a los
-- roles anon/authenticated vía PostgREST. Se corrige acá en una migración
-- nueva, sin editar la original (ya aplicada en dev, cambiaría su checksum).
-- Sin policies: la API accede con el rol dueño de la base, que ignora RLS.

ALTER TABLE "orbi_pending_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_quota" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orbi_turns" ENABLE ROW LEVEL SECURITY;
