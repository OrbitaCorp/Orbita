-- Campañas de precio congelado ("los primeros N comercios pagan $X por mes
-- durante M meses"). Reemplazan al beneficio de bienvenida fijo de 3 meses.
-- Todo aditivo: una tabla nueva, columnas con default o que admiten null, y
-- code_id de los descuentos de activación deja de ser obligatorio (una fila de
-- precio congelado no tiene código).

CREATE TABLE "price_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "price_base" DECIMAL(12,2) NOT NULL,
    "price_advanced" DECIMAL(12,2) NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 3,
    "max_slots" INTEGER,
    "used_slots" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "price_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "price_campaigns_code_key" ON "price_campaigns"("code");
CREATE INDEX "price_campaigns_is_active_idx" ON "price_campaigns"("is_active");

-- Mismo criterio que el resto de las tablas (ver 20260910110000_rls_tablas_publicas):
-- cerrada a la API pública de Supabase, el backend entra como dueño.
ALTER TABLE "price_campaigns" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "subscriptions"
  ADD COLUMN "campaign_id" TEXT,
  ADD COLUMN "frozen_amount" DECIMAL(12,2),
  ADD COLUMN "frozen_charges_left" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "subscription_activation_discounts"
  ALTER COLUMN "code_id" DROP NOT NULL,
  ADD COLUMN "campaign_id" TEXT,
  ADD COLUMN "charges_total" INTEGER NOT NULL DEFAULT 1;
