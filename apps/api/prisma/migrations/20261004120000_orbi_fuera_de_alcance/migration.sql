-- Orbi: marca de los turnos del panel que contestaron con la frase fija de
-- fuera de alcance (src/orbi/prompts/alcance.ts). Aditiva: columna con default,
-- los turnos anteriores quedan en false.

ALTER TABLE "orbi_turns" ADD COLUMN "out_of_scope" BOOLEAN NOT NULL DEFAULT false;
