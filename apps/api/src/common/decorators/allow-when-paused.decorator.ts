import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_PAUSED_KEY = 'allowWhenPaused';

/**
 * Marca un endpoint como excepción al modo "solo lectura" de una tienda
 * suspendida por falta de pago (ver SubscriptionActiveGuard) — para las
 * rutas que TIENEN que seguir funcionando igual: activar/cambiar de plan,
 * pausar/reactivar la tienda a mano, y el perfil propio de acceso (cambiar
 * contraseña, cerrar sesión, etc.). Mismo patrón que `@RequiresAddon()`
 * (requires-addon.decorator.ts), pero opt-OUT en vez de opt-in: por default
 * el guard bloquea, y esto es la excepción explícita.
 */
export const AllowWhenPaused = () => SetMetadata(ALLOW_WHEN_PAUSED_KEY, true);
