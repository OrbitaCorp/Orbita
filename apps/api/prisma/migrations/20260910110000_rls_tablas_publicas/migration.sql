-- Cierra el hallazgo ALTO encontrado y verificado el 10/09: las 68 tablas de
-- `public` tenían RLS apagado y los roles `anon`/`authenticated` (los que usa
-- la API REST automática de Supabase, PostgREST) tenían permiso completo
-- (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) sobre TODAS ellas — incluidas
-- members, platform_admins, refresh_tokens y mp_credentials. Con la clave
-- `anon` del proyecto (pensada para ser pública, no es un secreto) se podía
-- leer y escribir la base entera sin pasar por la API de Órbita.
--
-- No le cambia nada al backend: Prisma conecta como el dueño de las tablas
-- (`postgres`), que tiene BYPASSRLS — verificado con
-- `select rolbypassrls from pg_roles where rolname = current_user` antes de
-- escribir esta migración. Storage entra con `service_role`, que también
-- tiene BYPASSRLS por diseño de Supabase. Ninguna tabla usa
-- FORCE ROW LEVEL SECURITY, así que el dueño sigue sin restricciones.
--
-- Reversible con `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` +
-- `GRANT ... TO anon, authenticated` si hiciera falta.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Para que las tablas que creen migraciones futuras (corridas como el mismo
-- rol que corre ésta) no vuelvan a heredar permisos para anon/authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
