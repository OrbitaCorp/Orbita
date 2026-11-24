-- Negocios de prueba: no cuentan en las métricas del superadmin (ver Business.isTest). Aditiva.
ALTER TABLE "businesses" ADD COLUMN "is_test" BOOLEAN NOT NULL DEFAULT false;
