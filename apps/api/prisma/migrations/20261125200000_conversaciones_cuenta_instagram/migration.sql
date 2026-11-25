-- Instagram: a qué cuenta del negocio llegó cada charla. El IGSID del cliente vale solo para esa cuenta, así que si
-- el negocio conecta otra cuenta de Instagram, las charlas de la anterior no se pueden contestar: la bandeja muestra
-- solo las de la cuenta conectada (y vuelven a verse si se reconecta la misma).
--
-- Aditiva: una columna que admite null (las charlas que no son de Instagram quedan en null).
ALTER TABLE "conversations" ADD COLUMN "instagram_cuenta" TEXT;

-- Las charlas de Instagram que ya existen son de la cuenta que el negocio tiene conectada hoy.
UPDATE "conversations" c
SET "instagram_cuenta" = ic."ig_user_id"
FROM "instagram_connections" ic
WHERE ic."business_id" = c."business_id"
  AND EXISTS (SELECT 1 FROM "messages" m WHERE m."conversation_id" = c."id" AND m."channel" = 'INSTAGRAM');
