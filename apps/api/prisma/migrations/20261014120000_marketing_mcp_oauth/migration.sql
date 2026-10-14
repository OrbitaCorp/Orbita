-- Marketing → Prospección: conector MCP. Dos tablas nuevas para el OAuth de Claude (códigos de autorización de
-- un solo uso y tokens de renovación). Los dos van como hash. No toca nada existente.

CREATE TABLE "marketing_mcp_codigos" (
    "id" TEXT NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "code_challenge" TEXT NOT NULL,
    "expira_at" TIMESTAMP(3) NOT NULL,
    "usado_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_mcp_codigos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_mcp_refresh" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "familia_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "expira_at" TIMESTAMP(3) NOT NULL,
    "revocado_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_mcp_refresh_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_mcp_codigos_codigo_hash_key" ON "marketing_mcp_codigos"("codigo_hash");
CREATE INDEX "marketing_mcp_codigos_expira_at_idx" ON "marketing_mcp_codigos"("expira_at");
CREATE UNIQUE INDEX "marketing_mcp_refresh_token_hash_key" ON "marketing_mcp_refresh"("token_hash");
CREATE INDEX "marketing_mcp_refresh_admin_id_idx" ON "marketing_mcp_refresh"("admin_id");
CREATE INDEX "marketing_mcp_refresh_familia_id_idx" ON "marketing_mcp_refresh"("familia_id");
