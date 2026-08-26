import { SetMetadata } from '@nestjs/common';

export const REQUIRES_ADDON_KEY = 'requiresAddon';

/**
 * Marca un endpoint como exclusivo de un add-on pago (paquete "Avanzado" y
 * los que se sumen después) — 403 si el negocio no lo tiene activo. Mismo
 * patrón que `@FullModeOnly()` (full-mode-only.decorator.ts), pero acá el
 * chequeo necesita ir a la base (no viaja en el JWT) — ver AddonGuard.
 */
export const RequiresAddon = (type: string) => SetMetadata(REQUIRES_ADDON_KEY, type);
