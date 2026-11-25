-- Los negocios de Puerto Iguazú en rubros nuevos (Turnos, Alquileres, Gimnasio, POS)
-- arrancan como posibles pilotos (POTENCIAL_LOCAL) con cupo 0/5 libre para que el equipo
-- elija manualmente a cuáles 5 ofrecer cortesía. Solo actualiza filas todavía no contactadas.
UPDATE "marketing_leads"
SET "clasificacion" = 'POTENCIAL_LOCAL'
WHERE "rubro" IN ('TURNOS', 'ALQUILERES', 'GIMNASIO', 'POS')
  AND "localidad" = 'Puerto Iguazú'
  AND "contactado" = false
  AND "estado" = 'NUEVO';
