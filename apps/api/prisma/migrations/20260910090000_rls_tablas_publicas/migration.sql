-- Cerrar la API REST de Supabase sobre el esquema public (auditoría interna
-- 10/09, ítem `api.supabase`).
--
-- Estado encontrado en producción: las 68 tablas de public con RLS APAGADO,
-- ninguna política, y los roles `anon` y `authenticated` con TODOS los
-- permisos (SELECT, INSERT, UPDATE, DELETE, TRUNCATE) sobre todas ellas. Con
-- la clave anon del proyecto —que Supabase diseña para ir en el navegador—
-- cualquiera podía leer y modificar la base entera por
-- https://<proyecto>.supabase.co/rest/v1/, sin pasar por la API de Órbita:
-- members (hashes), platform_admins, refresh_tokens, mp_credentials, todo.
--
-- Órbita no usa esa API REST para nada: el backend entra con DATABASE_URL como
-- `postgres`, que es el dueño de las tablas y por eso no está sujeto a RLS
-- (no se usa FORCE), y Storage entra con service_role (BYPASSRLS). Nada de lo
-- de abajo le cambia algo al backend.
--
-- Vuelta atrás, si hiciera falta: ALTER TABLE ... DISABLE ROW LEVEL SECURITY
-- y GRANT ... TO anon, authenticated (no debería hacer falta nunca).

-- 1) RLS prendido en todas las tablas de public, sin políticas: para anon y
--    authenticated, "sin política" es "sin acceso".
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- 2) Y además, sin permisos: dos barreras en vez de una. Condicionado a que
--    los roles existan, para que la migración también corra en una base
--    Postgres pelada (shadow database, entornos de prueba).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      -- 3) Las tablas que creen las migraciones futuras (las corre `postgres`)
      --    ya no heredan permisos para estos roles.
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
