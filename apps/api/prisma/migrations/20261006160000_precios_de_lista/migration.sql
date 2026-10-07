-- Precios de lista de los planes, editables desde el superadmin. Historial:
-- cada cambio agrega una fila y el vigente de un plan es su fila más nueva.
-- Vacía = los valores por defecto del código, así que crearla no cambia ningún
-- precio.

CREATE TABLE "plan_prices" (
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "plan_prices_plan_created_at_idx" ON "plan_prices"("plan", "created_at");

-- Mismo criterio que el resto de las tablas (ver 20260910110000_rls_tablas_publicas).
ALTER TABLE "plan_prices" ENABLE ROW LEVEL SECURITY;
