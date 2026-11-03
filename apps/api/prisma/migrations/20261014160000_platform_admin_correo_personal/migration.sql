-- Correo personal opcional de cada admin de plataforma: a ese correo viaja la contraseña temporal que genera
-- el superadmin desde Admins y, además del correo de la cuenta, el código del segundo factor.
-- Aditiva y nullable: todo lo existente sigue funcionando igual.
ALTER TABLE "platform_admins" ADD COLUMN "personal_email" TEXT;
