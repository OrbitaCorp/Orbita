import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

// Normalización de emails de entrada (auditoría interna del 2026-09-09,
// verificación 9 del ítem `api.auth`).
//
// Las unique de Postgres (`@@unique([businessId, email])` en Member y
// Customer, `email @unique` en PlatformAdmin) son CASE-SENSITIVE: sin
// normalizar, `Ana@x.com` y `ana@x.com` son dos cuentas distintas dentro del
// mismo negocio y quien se registró con mayúsculas no puede loguearse si
// después las escribe distinto.
//
// La regla es una sola y vale para los dos lados: se normaliza al BUSCAR
// (login, olvidé mi contraseña, reset) y al CREAR (registro, invitación de
// member, alta de negocio, alta de cliente, alta de platform admin). Si se
// normalizara solo al buscar, una cuenta creada con mayúsculas quedaría
// inaccesible para siempre.
//
// Verificado contra producción antes de aplicarlo: 0 emails con mayúsculas,
// 0 con espacios y 0 colisiones al pasar todo a minúsculas, así que el
// cambio no deja afuera ninguna cuenta existente.

/** Recorta espacios y pasa a minúsculas. Deja pasar lo que no sea string para que lo rechace @IsEmail. */
export function normalizeEmail<T>(value: T): T | string {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

/**
 * Reemplaza a `@IsEmail()` en cualquier DTO: normaliza antes de validar y de
 * que el valor llegue al servicio. El tope de 254 es el máximo de una
 * dirección de correo según RFC 5321.
 */
export function NormalizedEmail(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => normalizeEmail(value)),
    IsEmail(),
    MaxLength(254),
  );
}
