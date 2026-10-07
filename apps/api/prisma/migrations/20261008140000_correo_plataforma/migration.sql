-- Correo del super panel: casillas remitentes (con su firma) y lo enviado.
-- Aditiva: dos tablas nuevas, no toca nada existente.
CREATE TABLE "platform_mail_senders" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "job_title" TEXT,
    "phone" TEXT,
    "signature_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_mail_senders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_mail_senders_email_key" ON "platform_mail_senders"("email");

CREATE TABLE "platform_outbound_mails" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "from_name" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EmailSendStatus" NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_outbound_mails_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_outbound_mails_created_at_idx" ON "platform_outbound_mails"("created_at");

ALTER TABLE "platform_outbound_mails" ADD CONSTRAINT "platform_outbound_mails_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "platform_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Las tres casillas del equipo, para no arrancar con la pantalla vacía. El
-- nombre, el cargo y la firma se editan desde el panel.
INSERT INTO "platform_mail_senders" ("id", "email", "name", "job_title", "updated_at") VALUES
  (gen_random_uuid()::text, 'mateo@orbita.site', 'Mateo Rojas', 'CEO', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ceo@orbita.site', 'Mateo Rojas', 'CEO', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'contacto@orbita-corp.com', 'Órbita', NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO NOTHING;
