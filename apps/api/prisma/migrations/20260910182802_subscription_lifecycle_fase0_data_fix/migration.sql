-- DataMigration: los negocios ya creados con el default viejo de gracia
-- (4 días) pasan al nuevo default parejo de 7 (RBT — ciclo de vida de
-- suscripciones, 2026-09) — no tendría sentido dejarlos con una regla de
-- gracia distinta a la que rige para cualquier negocio nuevo de acá en más.
-- Solo toca filas en el default viejo: si alguna suscripción tiene un valor
-- distinto de 4 hoy es porque alguien lo configuró a mano a propósito, y esa
-- decisión explícita se respeta.
UPDATE "subscriptions" SET "grace_period_days" = 7 WHERE "grace_period_days" = 4;
