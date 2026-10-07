-- Correo del super panel: la imagen de la firma puede ser la firma completa
-- (una tarjeta ya diseñada, con nombre y cargo adentro) en vez de un logo al
-- lado del texto. Aditiva y con default false, que es como venía.
ALTER TABLE "platform_mail_senders" ADD COLUMN "signature_banner" BOOLEAN NOT NULL DEFAULT false;
