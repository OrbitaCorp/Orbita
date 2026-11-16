-- Seguimiento a clientes (superadmin → Seguimiento): el número de WhatsApp de
-- cada casilla y a qué negocio / etapa corresponde cada correo enviado.
ALTER TABLE "platform_mail_senders" ADD COLUMN "whatsapp" TEXT;

ALTER TABLE "platform_outbound_mails" ADD COLUMN "business_id" TEXT,
ADD COLUMN "follow_up_stage" TEXT;

CREATE INDEX "platform_outbound_mails_business_id_created_at_idx" ON "platform_outbound_mails"("business_id", "created_at");
