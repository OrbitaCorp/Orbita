-- El módulo "Countdown y exit-intent" pasa a poder gestionar un Discount real
-- (mismo patrón que two_for_one_promos): el dueño elige el %, a qué productos
-- aplica y hasta cuándo, y de ahí sale la fecha que muestran el banner y las
-- cards de producto.
--
-- Escrita a mano y NO con `prisma migrate diff`: ese comando genera además un
-- DROP de model/prompt_tokens/completion_tokens en wizard_ai_turns, porque esas
-- columnas existen en la base pero no en schema.prisma (drift preexistente, con
-- datos). Ver el comentario de WizardAiTurn.

-- AlterTable
ALTER TABLE "countdown_configs" ADD COLUMN "discount_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "countdown_configs_discount_id_key" ON "countdown_configs"("discount_id");

-- AddForeignKey
ALTER TABLE "countdown_configs" ADD CONSTRAINT "countdown_configs_discount_id_fkey"
  FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
