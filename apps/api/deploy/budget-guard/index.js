const { GoogleAuth } = require('google-auth-library');

// Config del servicio que este guardia protege. Si algún día cambia la
// región/nombre del servicio, actualizar acá.
const PROJECT_ID = 'orbita-api-corp';
const PROJECT_NUMBER = '681215569277'; // namespace real que usa la API v1 (no el project ID)
const REGION = 'southamerica-east1';
const SERVICE = 'orbita-api';
const RUN_API_BASE = `https://${REGION}-run.googleapis.com/apis/serving.knative.dev/v1/namespaces/${PROJECT_NUMBER}/services/${SERVICE}`;

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

async function authedFetch(url, options = {}) {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`${options.method ?? 'GET'} ${url} -> ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Prende el modo mantenimiento: agrega/actualiza la env var MAINTENANCE_MODE
// del servicio y hace un PUT del objeto completo (así funciona la API v1 de
// Cloud Run — no soporta patch parcial de un solo env var, hay que mandar el
// spec entero de vuelta). Formato verificado con --log-http contra el
// servicio real (ver DEPLOYMENT.md § Freno de gasto automático).
//
// El backend mismo (src/main.ts) lee esta env var y corta TODAS las
// requests con un 503 + mensaje de mantenimiento, antes de tocar la base o
// cualquier lógica real — no hace falta apagar el servicio en sí.
async function enableMaintenanceMode() {
  const service = await authedFetch(`${RUN_API_BASE}?alt=json`);

  const containers = service.spec.template.spec.containers;
  const env = containers[0].env ?? [];
  const idx = env.findIndex((e) => e.name === 'MAINTENANCE_MODE');
  if (idx >= 0) {
    env[idx] = { name: 'MAINTENANCE_MODE', value: 'true' };
  } else {
    env.push({ name: 'MAINTENANCE_MODE', value: 'true' });
  }
  containers[0].env = env;

  await authedFetch(`${RUN_API_BASE}?alt=json`, {
    method: 'PUT',
    body: JSON.stringify(service),
  });
}

/**
 * Disparado por notificaciones de Cloud Billing Budgets (via Pub/Sub, tópico
 * "budget-alerts"). El presupuesto tiene 2 umbrales configurados: 80% ($20,
 * solo manda mail) y 100% ($25, publica acá). Cloud Billing manda un mensaje
 * por CADA umbral configurado, así que hay que chequear el payload — no basta
 * con "llegó un mensaje" para decidir activar el modo mantenimiento.
 *
 * Formato del mensaje: cloudEvent.data es directamente el base64 del body
 * (NO cloudEvent.data.message.data — ver historial de este archivo si
 * alguna vez vuelve a fallar esto, ya se probó y confirmó una vez).
 */
exports.pauseIfOverBudget = async (cloudEvent) => {
  const messageData = cloudEvent.data;
  if (!messageData) {
    console.log('Sin data en el mensaje de Pub/Sub, no hago nada.');
    return;
  }

  const payload = JSON.parse(Buffer.from(messageData, 'base64').toString('utf8'));
  const { costAmount, budgetAmount, alertThresholdExceeded } = payload;

  console.log(
    `Notificación de presupuesto: costo=${costAmount} de ${budgetAmount} (umbral: ${alertThresholdExceeded})`,
  );

  if (typeof costAmount !== 'number' || typeof budgetAmount !== 'number' || costAmount < budgetAmount) {
    console.log('Todavía no se alcanzó el 100% del presupuesto — no se activa mantenimiento.');
    return;
  }

  console.log(`Gasto (${costAmount}) alcanzó el presupuesto (${budgetAmount}) — activando modo mantenimiento en ${SERVICE}.`);
  await enableMaintenanceMode();
  console.log('Listo: modo mantenimiento activado. Ver DEPLOYMENT.md para desactivarlo.');
};
