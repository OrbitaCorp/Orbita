-- Un campo libre en la reserva y en la config de reservas, para lo propio de
-- cada módulo que el motor no interpreta (decisión "lo que Alquileres le pide
-- al backend compartido", punto 4). Opcionales y sin default: null es "como
-- hasta ahora", así que ninguna reserva ni config de Turnos, Alquileres o
-- Gimnasio cambia.
ALTER TABLE "reservas" ADD COLUMN "datos" JSONB;
ALTER TABLE "reservas_config" ADD COLUMN "datos" JSONB;
