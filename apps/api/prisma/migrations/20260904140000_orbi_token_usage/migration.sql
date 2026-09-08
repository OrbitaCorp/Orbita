-- Consumo real por turno de Orbi.
--
-- Hasta acá wizard_ai_turns guardaba la latencia pero no los tokens, así que
-- el costo del asistente solo se podía proyectar (tantas llamadas x tantos
-- tokens estimados) — y esa proyección era lo único que había para comparar
-- modelos. `model` va por turno porque se puede cambiar por variable de
-- entorno sin desplegar: sin esa columna, comparar el costo de dos semanas no
-- dice qué modelo corrió en cada una.
--
-- Las tres son nullable a propósito: las filas viejas no tienen este dato y un
-- 0 se promediaría como si el turno hubiera sido gratis.
ALTER TABLE "wizard_ai_turns" ADD COLUMN "model" TEXT;
ALTER TABLE "wizard_ai_turns" ADD COLUMN "prompt_tokens" INTEGER;
ALTER TABLE "wizard_ai_turns" ADD COLUMN "completion_tokens" INTEGER;
