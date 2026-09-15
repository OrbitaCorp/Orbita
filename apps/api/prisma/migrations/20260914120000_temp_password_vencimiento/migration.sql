-- Hallazgo MEDIA `contrasena-temporal-reseteo` (auditoría interna 09/09): la
-- contraseña temporal que se entrega en un reseteo no vencía nunca. Vencimiento
-- en la fila; null = no es temporal, o es anterior a esta columna (no vence).
-- Solo agrega columnas nullable: una revisión vieja de la API sigue andando.

-- AlterTable
ALTER TABLE "members" ADD COLUMN "temp_password_expires_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "platform_admins" ADD COLUMN "temp_password_expires_at" TIMESTAMP(3);
