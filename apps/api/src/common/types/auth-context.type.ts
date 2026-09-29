import { BusinessMode, PlatformAdminRole } from '@prisma/client';

export interface MemberContext {
  type: 'member';
  memberId: string;
  businessId: string;
  businessMode: BusinessMode;
  roleId: string;
  roleName: string;
  permissions: string[];
  // Visitante anónimo del panel de la demo (ver DemoGuard): solo lectura.
  readOnly?: boolean;
}

export interface CustomerContext {
  type: 'customer';
  customerId: string;
  businessId: string;
  businessMode: BusinessMode;
  // Cliente de la tienda demo (el Invitado, ver DemoGuard): solo lectura.
  readOnly?: boolean;
}

// Super admin de plataforma: identidad cross-tenant, NO pertenece a ningún
// negocio (sin businessId ni businessMode). Ver PlatformAdminGuard.
export interface PlatformAdminContext {
  type: 'platform_admin';
  adminId: string;
  adminRole: PlatformAdminRole; // SUPERADMIN | OPERATOR
}

export type AuthContext = MemberContext | CustomerContext | PlatformAdminContext;
