export interface MemberAuthResponse {
  type: 'member';
  token: string;
  refreshToken: string;
  member: { id: string; name: string; email: string; status: string };
  role: string;
  permissions: string[];
  business: { id: string; name: string; subdomain: string; mode: string };
}

export interface CustomerAuthResponse {
  type: 'customer';
  token: string;
  refreshToken: string;
  customer: { id: string; firstName: string; lastName: string | null; email: string | null; avatarUrl: string | null };
  business: { id: string; name: string; subdomain: string; mode: string };
}

export interface PlatformAdminAuthResponse {
  type: 'platform_admin';
  token: string;
  refreshToken: string;
  admin: { id: string; name: string; email: string; role: string };
  // Sin `business`: un super admin no pertenece a ningún negocio.
}

export type LoginResponse =
  | MemberAuthResponse
  | CustomerAuthResponse
  | PlatformAdminAuthResponse;
