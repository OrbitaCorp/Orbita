-- Cambio de plan pedido desde el panel, pendiente de aplicar en la proxima
-- renovacion (MP no permite cambiar la frecuencia de una preapproval ya
-- autorizada, solo el monto -- un cambio de plan siempre implica una
-- preapproval nueva, con reautorizacion).
ALTER TABLE "subscriptions" ADD COLUMN "next_plan" TEXT;
