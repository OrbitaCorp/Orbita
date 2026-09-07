-- El módulo "Countdown y exit-intent" pasa a poder dibujar una SECCIÓN en la
-- portada con los productos que están en oferta (no solo el banner): ver
-- CountdownOfertaSection.tsx. Solo aplica cuando el countdown tiene un
-- descuento gestionado — sin descuento no hay productos que listar.
--
-- Default true: quien ya tenga un countdown con descuento configurado pasa a
-- mostrar la sección sin tener que entrar a prenderla, que es lo que espera
-- después de haber elegido a qué productos aplica.
--
-- Escrita a mano y NO con `prisma migrate diff`: ese comando genera además un
-- DROP de model/prompt_tokens/completion_tokens en wizard_ai_turns, porque esas
-- columnas existen en la base pero no en schema.prisma (drift preexistente, con
-- datos). Ver el comentario de WizardAiTurn.

-- AlterTable
ALTER TABLE "countdown_configs" ADD COLUMN "show_products_on_home" BOOLEAN NOT NULL DEFAULT true;
