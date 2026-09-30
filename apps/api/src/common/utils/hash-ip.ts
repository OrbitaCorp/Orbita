import { createHmac } from 'crypto';

// La IP nunca se guarda en texto plano: se guarda este HMAC. Lo usan la cuota
// semanal de la demo (contexto 'demo-ia') y la cuota diaria del wizard de Orbi
// (contexto 'orbi-wizard'). El contexto entra en el HMAC para que un mismo
// visitante no tenga la misma huella en dos tablas distintas.
//
// Sale de DemoIaService.claveDe con el mismo resultado exacto: si cambia la
// fórmula, cambian las claves de demo_ai_usage y todos recuperan el cupo. Si
// rota JWT_SECRET pasa lo mismo, y es aceptable (se reinicia la cuota).
//
// `secreto` es opcional: DemoIaService pasa el de su ConfigService; el resto
// lee JWT_SECRET del entorno. Sin secreto falla fuerte: un HMAC con clave
// vacía es predecible y dejaría la IP recuperable por fuerza bruta.
export function hmacIp(contexto: string, ip: string | undefined, secreto = process.env.JWT_SECRET): string {
  if (!secreto) throw new Error('hmacIp: falta JWT_SECRET');
  return createHmac('sha256', secreto).update(`${contexto}:${ip ?? 'sin-ip'}`).digest('hex');
}
