import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginDto } from '../../src/auth/dto/login.dto';
import { RegisterDto } from '../../src/auth/dto/register.dto';
import { ForgotPasswordDto } from '../../src/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '../../src/auth/dto/reset-password.dto';
import { AcceptInvitationDto } from '../../src/auth/dto/accept-invitation.dto';
import { RefreshDto } from '../../src/auth/dto/refresh.dto';
import { InviteMemberDto } from '../../src/members/dto/invite-member.dto';
import { RegisterBusinessDto } from '../../src/onboarding/dto/register-business.dto';
import { normalizeEmail } from '../../src/common/decorators/normalized-email.decorator';

// Unit test de la validación de entrada de auth (auditoría interna
// 2026-09-09, verificación 9 del ítem `api.auth`).
//
// Dos cosas que faltaban:
// 1) Tope de largo en las contraseñas: argon2 hashea lo que le llegue y el
//    body admite hasta 10 MB, así que sin @MaxLength una sola request podía
//    quemar CPU del servidor a voluntad.
// 2) Normalización del email: las unique de Postgres son case-sensitive, así
//    que "Ana@x.com" y "ana@x.com" eran dos cuentas distintas en el mismo
//    negocio y quien se registraba con mayúsculas no podía volver a entrar
//    escribiéndolo distinto. Se normaliza al buscar Y al crear.

function validar<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const dto = plainToInstance(cls, plain);
  const errores = validateSync(dto as object, { whitelist: true });
  return { dto, errores, props: errores.map((e) => e.property) };
}

describe('Normalización del email', () => {
  it('normalizeEmail recorta y baja a minúsculas, y deja pasar lo que no es string', () => {
    expect(normalizeEmail('  Ana@Ejemplo.COM ')).toBe('ana@ejemplo.com');
    expect(normalizeEmail('ya@esta.bien')).toBe('ya@esta.bien');
    expect(normalizeEmail(42)).toBe(42);
    expect(normalizeEmail(undefined)).toBeUndefined();
  });

  const conEmail: [string, new () => any][] = [
    ['LoginDto', LoginDto],
    ['ForgotPasswordDto', ForgotPasswordDto],
    ['RegisterDto', RegisterDto],
    ['ResetPasswordDto', ResetPasswordDto],
    ['InviteMemberDto', InviteMemberDto],
    ['RegisterBusinessDto', RegisterBusinessDto],
  ];

  it.each(conEmail)('%s normaliza el email antes de validar', (_nombre, cls) => {
    const { dto } = validar(cls, {
      email: '  Ana@Ejemplo.COM ',
      password: 'unaClaveLarga1',
      newPassword: 'unaClaveLarga1',
      code: '123456',
      firstName: 'Ana',
      name: 'Ana',
      ownerName: 'Ana',
      businessName: 'Tienda',
      roleId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    });
    expect((dto as { email: string }).email).toBe('ana@ejemplo.com');
  });

  it.each(conEmail)('%s rechaza un email que no es email', (_nombre, cls) => {
    const { props } = validar(cls, { email: 'no-es-un-email' });
    expect(props).toContain('email');
  });
});

describe('Tope de largo en las contraseñas', () => {
  const larga = 'a'.repeat(129);

  it('LoginDto rechaza una contraseña de más de 128 caracteres', () => {
    expect(validar(LoginDto, { email: 'a@b.com', password: larga }).props).toContain('password');
  });

  it('LoginDto acepta una contraseña normal', () => {
    expect(validar(LoginDto, { email: 'a@b.com', password: 'unaClaveLarga1' }).errores).toHaveLength(0);
  });

  it('LoginDto sigue exigiendo el mínimo de 8', () => {
    expect(validar(LoginDto, { email: 'a@b.com', password: 'corta' }).props).toContain('password');
  });

  it('AcceptInvitationDto rechaza una contraseña de más de 128 caracteres', () => {
    const token = 'a'.repeat(64);
    expect(validar(AcceptInvitationDto, { token, newPassword: larga }).props).toContain('newPassword');
    expect(validar(AcceptInvitationDto, { token, newPassword: 'unaClaveLarga1' }).errores).toHaveLength(0);
  });

  it('RegisterBusinessDto rechaza una contraseña de más de 128 caracteres', () => {
    const base = { email: 'a@b.com', ownerName: 'Ana', businessName: 'Tienda' };
    expect(validar(RegisterBusinessDto, { ...base, password: larga }).props).toContain('password');
  });
});

describe('Tope de largo en los datos del registro', () => {
  const base = { email: 'a@b.com', password: 'unaClaveLarga1' };

  it('rechaza nombre, apellido y teléfono desmedidos', () => {
    expect(validar(RegisterDto, { ...base, firstName: 'a'.repeat(121) }).props).toContain('firstName');
    expect(validar(RegisterDto, { ...base, firstName: 'Ana', lastName: 'b'.repeat(121) }).props).toContain('lastName');
    expect(validar(RegisterDto, { ...base, firstName: 'Ana', phone: '9'.repeat(41) }).props).toContain('phone');
  });

  it('rechaza un nombre vacío', () => {
    expect(validar(RegisterDto, { ...base, firstName: '' }).props).toContain('firstName');
  });

  it('acepta un registro normal', () => {
    expect(validar(RegisterDto, { ...base, firstName: 'Ana', lastName: 'Pérez', phone: '1122334455' }).errores).toHaveLength(0);
  });
});

describe('Códigos y tokens con forma fija', () => {
  it('el código de reset tiene que ser de 6 dígitos', () => {
    const base = { email: 'a@b.com', newPassword: 'unaClaveLarga1' };
    expect(validar(ResetPasswordDto, { ...base, code: 'abcdef' }).props).toContain('code');
    expect(validar(ResetPasswordDto, { ...base, code: '12345' }).props).toContain('code');
    expect(validar(ResetPasswordDto, { ...base, code: '123456' }).errores).toHaveLength(0);
  });

  it('el refresh token tiene que medir 64 caracteres', () => {
    expect(validar(RefreshDto, { refreshToken: 'corto' }).props).toContain('refreshToken');
    expect(validar(RefreshDto, { refreshToken: 'a'.repeat(64) }).errores).toHaveLength(0);
  });
});
