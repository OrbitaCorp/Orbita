-- Demo pública de Órbita: negocio demo + miembro de solo lectura (ver
-- Business.isDemo y Member.readOnly en schema.prisma). Aditiva.
ALTER TABLE "businesses" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "members" ADD COLUMN "read_only" BOOLEAN NOT NULL DEFAULT false;
