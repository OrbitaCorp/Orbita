-- Acceso anticipado a Instagram: a quién avisar por correo cuando el equipo habilita el negocio.
-- Columna nullable: los pedidos que ya existen quedan sin correo y se avisa al propietario.

ALTER TABLE "instagram_early_access" ADD COLUMN "contact_email" TEXT;
