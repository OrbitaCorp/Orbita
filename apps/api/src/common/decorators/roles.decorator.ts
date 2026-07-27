import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Debe coincidir con los `name` reales seedeados en `roles` (prisma/seed.ts) — RolesGuard
// compara member.roleName (valor de la DB, en español) contra este tipo literalmente.
export type AppRole = 'owner' | 'admin' | 'empleado';

/** Restringe un endpoint a los roles indicados. Ej: @Roles('owner', 'admin'). */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
