-- Los chats de WhatsApp e Instagram cuelgan de un Customer (Conversation.customer_id es obligatorio), pero esa persona
-- no es un cliente del negocio hasta que compra. La marca permite ocultarla de Clientes y de los números sin borrar
-- la charla. Ver `soloClientesReales` en apps/api/src/customers/clientes-visibles.ts.
ALTER TABLE "customers" ADD COLUMN "is_chat_contact" BOOLEAN NOT NULL DEFAULT false;

-- Los que ya existen: los creados solos por un chat tienen el id del canal y nada más (sin email, sin cuenta en la
-- tienda, sin Google). Un cliente real vinculado a un chat suele tener email; si no, se corrige a mano.
UPDATE "customers"
SET "is_chat_contact" = true
WHERE ("instagram_id" IS NOT NULL OR "whatsapp_id" IS NOT NULL)
  AND "email" IS NULL
  AND "password_hash" IS NULL
  AND "google_id" IS NULL;
