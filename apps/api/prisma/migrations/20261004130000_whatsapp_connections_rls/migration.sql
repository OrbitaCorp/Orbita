-- RLS en whatsapp_connections (la tabla de la migración 20260929100000_whatsapp_bandeja).
--
-- Guarda el access_token de WhatsApp de cada negocio (cifrado), así que no puede
-- quedar abierta a la API pública de Supabase. Va en una migración aparte y no
-- editando la anterior porque esa ya estaba aplicada en la base de desarrollo.
-- Sin FORCE: el backend (dueño de la tabla) sigue entrando sin RLS, igual que en
-- el resto (ver 20260910110000_rls_tablas_publicas).

ALTER TABLE "whatsapp_connections" ENABLE ROW LEVEL SECURITY;
