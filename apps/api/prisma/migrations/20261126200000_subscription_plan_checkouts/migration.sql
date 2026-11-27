-- Link de activación del plan como plan de Mercado Pago (preapproval_plan), sin
-- email: lo paga cualquier cuenta de MP. Esta tabla dice de qué negocio es cada
-- link y qué descuento lleva. Aditiva (tabla nueva, sin FK).
CREATE TABLE "subscription_plan_checkouts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "mp_plan_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "amount_list" DECIMAL(12,2) NOT NULL,
    "amount_final" DECIMAL(12,2) NOT NULL,
    "discounted" BOOLEAN NOT NULL DEFAULT false,
    "code_id" TEXT,
    "campaign_id" TEXT,
    "charges_total" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "preapproval_id" TEXT,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plan_checkouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_plan_checkouts_mp_plan_id_key" ON "subscription_plan_checkouts"("mp_plan_id");
CREATE INDEX "subscription_plan_checkouts_business_id_status_idx" ON "subscription_plan_checkouts"("business_id", "status");
CREATE INDEX "subscription_plan_checkouts_preapproval_id_idx" ON "subscription_plan_checkouts"("preapproval_id");

-- Como el resto de las tablas de public: RLS prendido y sin acceso para anon/authenticated
-- (ver 20260910110000_rls_tablas_publicas). El backend es el dueño y no lo necesita.
ALTER TABLE "subscription_plan_checkouts" ENABLE ROW LEVEL SECURITY;
