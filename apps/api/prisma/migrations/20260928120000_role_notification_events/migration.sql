-- AlterTable
-- null = el rol recibe todos los avisos por email (comportamiento previo).
ALTER TABLE "roles" ADD COLUMN "notification_events" JSONB;
