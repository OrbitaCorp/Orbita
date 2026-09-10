// Cuántos proxies hay delante de la API (Firebase Hosting y el balanceador de
// Cloud Run). Sin `trust proxy`, Express toma como IP del cliente la del
// último proxy: todos los @Throttle y el tope por IP del wizard de Orbi
// comparten unos pocos baldes entre TODOS los usuarios (auditoría interna
// 10/09, ítem trans.rate-limit).
//
// Nunca `true`: con `true` Express toma la primera IP de X-Forwarded-For, que
// la escribe el cliente, y cualquiera se saltearía los límites. Tiene que ser
// el número exacto de saltos, medido con GET /api/v1/health/ip (ver
// DEPLOYMENT.md). Sin la variable, todo queda como estaba.
export function saltosDeProxy(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env.TRUST_PROXY_HOPS;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}
