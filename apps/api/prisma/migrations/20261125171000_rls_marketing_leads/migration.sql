-- RLS: nadie llega a marketing_leads por la API pública de Supabase.
-- La API de Órbita accede con su rol de backend (que saltea RLS).
ALTER TABLE "marketing_leads" ENABLE ROW LEVEL SECURITY;
