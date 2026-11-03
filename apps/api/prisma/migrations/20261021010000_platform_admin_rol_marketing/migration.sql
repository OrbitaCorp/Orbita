-- Rol de marketing para el super panel: solo accede a lo que se le habilita explícitamente (ver PlatformAdminGuard).
ALTER TYPE "PlatformAdminRole" ADD VALUE IF NOT EXISTS 'MARKETING';
