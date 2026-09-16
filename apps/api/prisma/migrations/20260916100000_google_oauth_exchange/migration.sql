-- Hallazgo `auth-estado-en-memoria` de la auditoría interna.
--
-- El handoff entre /auth/google/callback y el BFF de Next.js vivía en un Map
-- del proceso (GoogleOAuthExchangeStore). Cloud Run puede levantar más de una
-- instancia: el callback lo atiende una y el POST /auth/google/exchange que
-- viene justo después puede caer en otra, que no tiene el código → el login
-- por Google falla sin motivo visible. Pasa a Postgres, que ya es compartido.
--
-- Se guarda el SHA-256 del código, no el código: la fila sola no alcanza para
-- canjear una sesión, igual que refresh_tokens.

CREATE TABLE "google_oauth_exchanges" (
    "id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_oauth_exchanges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_oauth_exchanges_code_hash_key" ON "google_oauth_exchanges"("code_hash");

CREATE INDEX "google_oauth_exchanges_expires_at_idx" ON "google_oauth_exchanges"("expires_at");

-- Igual que las otras 69 tablas de public (migración 20260910110000_rls_tablas_publicas):
-- RLS prendido y sin permisos para anon/authenticated, así la clave anon de
-- Supabase no la ve por la API REST. Sin FORCE: el backend es el dueño.
ALTER TABLE "google_oauth_exchanges" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "google_oauth_exchanges" FROM anon, authenticated;
