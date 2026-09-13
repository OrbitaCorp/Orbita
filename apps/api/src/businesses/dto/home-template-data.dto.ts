import {
  IsString, IsOptional, IsBoolean, MaxLength, ValidateNested, IsObject,
  Validate, ValidatorConstraint, type ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';

// Topes de la bolsa de secciones. Generosos a propósito: el largo "de verdad"
// de cada campo lo impone el panel (cada plantilla declara su `max` por campo,
// ver secciones.ts). Lo de acá es el cinturón: que nadie guarde un JSON
// gigante ni estructuras anidadas.
const MAX_SECCIONES = 24;
const MAX_CAMPOS_POR_SECCION = 24;
const MAX_LARGO_CAMPO = 2000;
const MAX_LARGO_CLAVE = 40;

@ValidatorConstraint({ name: 'seccionesPlantillaValidas' })
export class SeccionesPlantillaValidas implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    if (valor === null || valor === undefined) return true;
    if (typeof valor !== 'object' || Array.isArray(valor)) return false;

    const secciones = Object.entries(valor as Record<string, unknown>);
    if (secciones.length > MAX_SECCIONES) return false;

    for (const [idSeccion, campos] of secciones) {
      if (idSeccion.length > MAX_LARGO_CLAVE) return false;
      if (typeof campos !== 'object' || campos === null || Array.isArray(campos)) return false;

      const entradas = Object.entries(campos as Record<string, unknown>);
      if (entradas.length > MAX_CAMPOS_POR_SECCION) return false;

      for (const [idCampo, contenido] of entradas) {
        if (idCampo.length > MAX_LARGO_CLAVE) return false;
        // Solo texto plano: sin objetos ni arrays anidados, que es por donde
        // se cuela un JSON inflado o una forma que el home no sabe dibujar.
        if (typeof contenido !== 'string') return false;
        if (contenido.length > MAX_LARGO_CAMPO) return false;
      }
    }
    return true;
  }

  defaultMessage(): string {
    return `secciones debe ser un objeto de secciones (máx ${MAX_SECCIONES}), cada una con campos de texto (máx ${MAX_CAMPOS_POR_SECCION} de ${MAX_LARGO_CAMPO} caracteres)`;
  }
}

// Cupón de la plantilla Vidriera: el bloque oscuro con el código en caja
// punteada. Es texto que la portada muestra tal cual (React lo escapa solo,
// no se interpola en ningún <style> como los colores/fuentes de acá al lado)
// — los máximos son por diseño, no por seguridad: el título se dibuja a 27px
// y el código en monoespaciada con letter-spacing, así que un texto largo
// desborda la caja en vez de avisar.
export class HomeCouponDto {
  @IsString() @MaxLength(60) titulo!: string;
  @IsString() @MaxLength(140) bajada!: string;
  @IsString() @MaxLength(24) codigo!: string;
}

// Contenido propio de UNA plantilla de Home. Cada clave la usa una plantilla
// distinta; se van sumando a medida que una plantilla nueva necesite algo que
// las demás no tienen. Ver el porqué del JSON (en vez de una columna por
// campo) en el comentario de `homeTemplateData` en schema.prisma.
export class HomeTemplateDataDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => HomeCouponDto)
  cupon?: HomeCouponDto;

  // Escaparate: por default el header solo muestra el nombre de la tienda en
  // texto (su diseño original, sin ícono) — en `true`, se muestra además el
  // logo subido (o el degradé genérico si no subió ninguno). Ver
  // StorefrontChrome.tsx § logoIcono.
  @IsOptional()
  @IsBoolean()
  mostrarIconoLogo?: boolean;

  // Las secciones propias de la plantilla activa ("El taller" de Premium, el
  // muro de Mosaico, la carta de varietales de Bodega), indexadas por sección
  // y campo. El esquema —qué secciones tiene cada plantilla y con qué campos—
  // vive del lado del panel (plantillas/secciones.ts) y cambia cada vez que se
  // suma una plantilla; replicarlo acá como una clase por plantilla obligaría
  // a desplegar el backend por cada texto nuevo, así que acá se valida la
  // FORMA (texto plano, nada anidado, con topes) y no las claves.
  //
  // Es texto que la portada muestra tal cual (React lo escapa solo; nada de
  // esto se interpola en un <style> como los colores). Los topes son por
  // diseño y para no guardar un JSON gigante.
  @IsOptional()
  @IsObject()
  @Validate(SeccionesPlantillaValidas)
  secciones?: Record<string, Record<string, string>>;
}
