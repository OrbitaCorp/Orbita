-- Mensajes: archivos adjuntos (fotos y videos) de la bandeja de Instagram del módulo Difusión.
-- Solo agrega una columna opcional; no toca datos existentes (los mensajes de antes quedan sin adjuntos).
ALTER TABLE "messages" ADD COLUMN "attachments" JSONB;
