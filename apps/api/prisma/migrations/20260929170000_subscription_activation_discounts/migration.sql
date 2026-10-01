-- Descuento en la activación del plan: recuerda, entre el link de pago, la
-- autorización y el primer cobro, que ese monto rebajado vale solo para el
-- primer ciclo. Aditiva (tabla nueva, sin FK).
CREATE TABLE "subscription_activation_discounts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "preapproval_id" TEXT NOT NULL,
    "code_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "amount_list" DECIMAL(12,2) NOT NULL,
    "amount_final" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "activated_at" TIMESTAMP(3),
    "restored_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_activation_discounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_activation_discounts_preapproval_id_key" ON "subscription_activation_discounts"("preapproval_id");
CREATE INDEX "subscription_activation_discounts_business_id_idx" ON "subscription_activation_discounts"("business_id");
CREATE INDEX "subscription_activation_discounts_status_idx" ON "subscription_activation_discounts"("status");

-- Como el resto de las tablas de public: RLS prendido y sin acceso para anon/authenticated
-- (ver 20260910110000_rls_tablas_publicas). El backend es el dueño y no lo necesita.
ALTER TABLE "subscription_activation_discounts" ENABLE ROW LEVEL SECURITY;
