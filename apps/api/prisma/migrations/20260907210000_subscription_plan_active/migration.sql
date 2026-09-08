-- Beneficio de bienvenida (planes multiples): distingue si la suscripcion del
-- plan elegido (mensual/semestral/anual) ya esta activa en MP o si la cuenta
-- todavia esta cursando el beneficio de bienvenida (3 meses, pago unico).
ALTER TABLE "subscriptions" ADD COLUMN "plan_active" BOOLEAN NOT NULL DEFAULT true;
