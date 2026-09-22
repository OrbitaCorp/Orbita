-- Cargo con el que un admin de plataforma firma las respuestas de Soporte
-- (CEO, CTO, CPO...). Opcional: sin cargo, el negocio ve "Soporte de Órbita".
ALTER TABLE "platform_admins" ADD COLUMN "job_title" TEXT;
