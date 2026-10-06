-- WhatsApp Business dentro de la bandeja de Mensajes.
-- Solo agrega: columnas nuevas con default / nullable, una tabla y dos enums.
-- No toca ni borra nada existente, así que es seguro de aplicar y reversible
-- (ver DEPLOYMENT.md § Rollback).

CREATE TYPE "MessageChannel" AS ENUM ('STOREFRONT', 'WHATSAPP');
CREATE TYPE "WhatsappConnectionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED');

ALTER TABLE "customers" ADD COLUMN "whatsapp_id" TEXT;
CREATE UNIQUE INDEX "customers_business_id_whatsapp_id_key" ON "customers"("business_id", "whatsapp_id");

ALTER TABLE "messages"
  ADD COLUMN "channel" "MessageChannel" NOT NULL DEFAULT 'STOREFRONT',
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "delivery_status" TEXT;
CREATE UNIQUE INDEX "messages_external_id_key" ON "messages"("external_id");

CREATE TABLE "whatsapp_connections" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "waba_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "display_phone" TEXT,
    "access_token" TEXT NOT NULL,
    "status" "WhatsappConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_connections_business_id_key" ON "whatsapp_connections"("business_id");
CREATE UNIQUE INDEX "whatsapp_connections_phone_number_id_key" ON "whatsapp_connections"("phone_number_id");
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
