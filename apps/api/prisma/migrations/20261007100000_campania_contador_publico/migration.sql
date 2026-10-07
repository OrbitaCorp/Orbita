-- Campañas de precio: si la landing y el alta muestran cuántos lugares quedan.
-- Aditiva y con default true, que es como se venía mostrando.
ALTER TABLE "price_campaigns" ADD COLUMN "show_counter" BOOLEAN NOT NULL DEFAULT true;
