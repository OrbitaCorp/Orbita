import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// Crear un negocio de Alquileres desde Superadmin. El rubro y el subdominio se
// validan en el servicio (contra los rubros habilitados y las reglas de
// subdominio del alta), que devuelve el motivo en castellano.
export class CrearNegocioAlquileresDto {
  @IsString() @MinLength(3) @MaxLength(80) nombre!: string;
  @IsString() @MinLength(3) @MaxLength(63) subdominio!: string;
  @IsString() @MaxLength(40) rubro!: string;
  @IsString() @MinLength(2) @MaxLength(80) duenoNombre!: string;
  @IsEmail() @MaxLength(160) duenoEmail!: string;
  // Temporal: el dueño la cambia al entrar. 72 es el tope que se le pide a cualquier contraseña.
  @IsString() @MinLength(10) @MaxLength(72) contrasenaTemporal!: string;
}
