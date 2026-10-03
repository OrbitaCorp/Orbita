import { SetMetadata } from '@nestjs/common';

// ─── Pruebas de IA en la demo pública ───────────────────────────────────────
//
// El visitante de la demo (miembro readOnly, ver DemoGuard) no escribe nada,
// pero SÍ puede probar algunas funciones con IA sobre sus propias fotos —
// es lo que más muestra de Órbita. Cada función tiene un tope por IP y por
// semana (DemoIaService), y el visitante tiene que entender que ese tope es
// de la DEMO, no de Órbita: por eso todos los mensajes lo dicen.
//
// Una ruta queda abierta al visitante SOLO si lleva @DemoIa(función): el
// decorador es a la vez el permiso (DemoGuard lo lee) y la cuota
// (DemoIaInterceptor la consume). Una ruta de IA nueva sin el decorador
// queda cerrada para la demo por defecto.

export type FuncionDemoIa = 'orbi-producto' | 'fondo-ia' | 'quitar-fondo' | 'orbi-chat' | 'fotos-web' | 'foto-web';

// 'fotos-web' y 'foto-web' no son IA, pero cuestan igual: la búsqueda paga
// Serper/Tavily y la descarga baja una URL cualquiera desde el servidor. En la
// app solo se llaman después de un escaneo con Orbi (que ya tiene tope de 3),
// así que sus topes son holgados: están para cortar a quien le pegue directo
// a la API con el token de la demo.
export const FUNCIONES_DEMO_IA: Record<FuncionDemoIa, { nombre: string; limiteSemanal: number; unidad: string }> = {
  'orbi-producto': { nombre: 'Redactar con Orbi', limiteSemanal: 3, unidad: 'pruebas' },
  'fondo-ia': { nombre: 'Fondo con IA', limiteSemanal: 2, unidad: 'pruebas' },
  'quitar-fondo': { nombre: 'Quitar fondo', limiteSemanal: 3, unidad: 'pruebas' },
  'orbi-chat': { nombre: 'el chat con Orbi', limiteSemanal: 10, unidad: 'mensajes' },
  'fotos-web': { nombre: 'la búsqueda de fotos en la web', limiteSemanal: 10, unidad: 'búsquedas' },
  'foto-web': { nombre: 'agregar fotos de la web', limiteSemanal: 20, unidad: 'fotos' },
};

export const DEMO_LIMITE_IA = 'DEMO_LIMITE_IA';
export const DEMO_CUPO_GLOBAL = 'DEMO_CUPO_GLOBAL';

export function mensajeLimiteDemo(funcion: FuncionDemoIa): string {
  const { nombre, limiteSemanal, unidad } = FUNCIONES_DEMO_IA[funcion];
  return (
    `Estás en la demo de Órbita: acá ${nombre} tiene ${limiteSemanal} ${unidad} por semana para que todos puedan probarlo, ` +
    `y ya las usaste. Es un límite de la demo: en tu propia tienda el uso es mucho más amplio.`
  );
}

// El tope diario POR NEGOCIO que ya tiene cada función (100 ayudas de texto,
// 30 imágenes, 300 mensajes a Orbi) en la demo lo comparten todos los
// visitantes. Su mensaje normal ("llegaste al máximo por hoy") le haría creer
// al visitante que así funciona su tienda: se reemplaza por este.
export const MENSAJE_CUPO_GLOBAL_DEMO =
  'Estás en la demo de Órbita: el cupo de IA que comparten todos los visitantes se agotó por hoy. ' +
  'Volvé a probar mañana. Es un límite de la demo: en tu propia tienda tenés tu propio cupo, mucho más amplio.';

export const DEMO_IA_KEY = 'demoIa';

/** Función fija, o calculada del pedido (cuando depende del body). */
export type ResolverFuncion = FuncionDemoIa | ((req: { body?: Record<string, unknown> }) => FuncionDemoIa);

/**
 * Abre la ruta al visitante de la demo, con cuota semanal por IP. Hace falta
 * además `@UseInterceptors(DemoIaInterceptor)` en la ruta, DESPUÉS del
 * FileInterceptor si lo hay (para que el body multipart ya esté parseado
 * cuando se resuelve la función).
 */
export const DemoIa = (funcion: ResolverFuncion) => SetMetadata(DEMO_IA_KEY, funcion);
