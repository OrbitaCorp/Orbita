-- Se elimina por completo el "Aviso de salida" (exit-intent) del paquete
-- Avanzado: tarjeta del panel, modal de la tienda, endpoints y tabla.
-- Pedido de Ale del 2026-09-09 ("de avanzado sacar por completo lo que es
-- aviso de salida, eso eliminar"). La oferta relámpago (countdown_configs)
-- no se toca.
--
-- Escrita a mano y NO con `prisma migrate diff`, por el drift preexistente de
-- wizard_ai_turns (ver 20260906120000_countdown_home_section).

-- DropForeignKey
ALTER TABLE "exit_intent_configs" DROP CONSTRAINT "exit_intent_configs_business_id_fkey";

-- DropTable
DROP TABLE "exit_intent_configs";

-- DropEnum
DROP TYPE "ExitIntentFrequency";
