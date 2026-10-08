-- RLS en las tablas de Correo del super panel: nadie les llega por la API
-- pública de Supabase. Sin FORCE, igual que el resto (ver
-- 20260910110000_rls_tablas_publicas). Va aparte de la migración que las crea
-- porque esa ya estaba aplicada en dev cuando el test de RLS lo marcó.
ALTER TABLE "platform_mail_senders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_outbound_mails" ENABLE ROW LEVEL SECURITY;
