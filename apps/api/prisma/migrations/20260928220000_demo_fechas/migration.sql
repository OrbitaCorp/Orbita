-- Demo pública: hasta qué instante están corridas las fechas de sus datos
-- (ver Business.demoFechasAl). Aditiva.
ALTER TABLE "businesses" ADD COLUMN "demo_fechas_al" TIMESTAMP(3);
