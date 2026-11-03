-- Seguridad por filas (RLS) de las tablas de Marketing → Prospección y del conector MCP.
-- Sin esto, Supabase las expone por su API pública. Quedan sin políticas: solo accede la API de Órbita
-- (con el rol que saltea RLS), igual que el resto de las tablas.

ALTER TABLE "marketing_prospectos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_prospeccion_lotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_mcp_codigos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_mcp_refresh" ENABLE ROW LEVEL SECURITY;
