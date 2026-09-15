export interface MemberAuthResponse {
  type: 'member';
  token: string;
  refreshToken: string;
  // hasTempPassword: el panel lo lee para obligar a elegir una contraseña
  // propia antes de usar cualquier otra pantalla (hallazgo
  // contrasena-temporal-reseteo, auditoría interna 09/09).
  member: { id: string; name: string; email: string; status: string; hasTempPassword: boolean };
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

// Segundo factor (RBT-647): la contraseña (o Google) ya se validó, pero la
// sesión real todavía no se emite — falta confirmar el código que se mandó
// por mail. Sin `token`/`refreshToken`: a propósito, para que nada del lado
// del cliente pueda confundir esto con una sesión válida.
export interface PlatformAdminMfaChallenge {
  type: 'platform_admin_mfa_required';
  email: string;
}
