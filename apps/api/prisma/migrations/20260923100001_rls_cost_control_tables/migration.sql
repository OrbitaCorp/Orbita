-- RLS para las tablas de cost control (misma política que el resto de public:
-- habilitado sin FORCE, sin grants a anon/authenticated).
ALTER TABLE "cost_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cost_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cost_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cost_alerts" ENABLE ROW LEVEL SECURITY;
