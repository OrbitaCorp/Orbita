-- Informe completo por ítem de la auditoría interna (Markdown): cómo está
-- hecho el módulo, qué se verificó y qué se encontró. Se renderiza en la
-- pestaña Auditoría y se exporta al documento "Cómo está construida Órbita".
--
-- Escrita a mano (no con `prisma migrate diff`) por el drift preexistente de
-- wizard_ai_turns.
ALTER TABLE "platform_audit_items" ADD COLUMN "informe" TEXT;
