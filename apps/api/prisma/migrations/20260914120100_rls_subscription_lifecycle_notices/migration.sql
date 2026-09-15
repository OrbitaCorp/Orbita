-- Hallazgo MEDIA `rls-tabla-ciclo-vida`: la migración
-- 20260910182701_subscription_lifecycle_fase0 creó subscription_lifecycle_notices
-- sin RLS, la única tabla de public sin RLS (verificado el 14/09 contra
-- producción: 69 tablas, 68 con RLS, 0 permisos para anon/authenticated y 0
-- policies). No tenía grants (los default privileges ya los revocan), así que
-- no había exposición real; esto la deja igual que las otras 68.

ALTER TABLE "subscription_lifecycle_notices" ENABLE ROW LEVEL SECURITY;
