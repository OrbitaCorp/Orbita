import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { RUBROS_BUSQUEDA, RubroBusqueda } from './leads-discovery.catalogo';
import { CLASIFICACIONES_LEAD, ESTADOS_LEAD, RUBROS_LEAD } from './leads-seed.data';

export class CrearLeadDto {
  @IsIn(RUBROS_LEAD)
  rubro!: (typeof RUBROS_LEAD)[number];

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  subrubro!: string;

  @IsOptional()
  @IsIn(CLASIFICACIONES_LEAD)
  clasificacion?: (typeof CLASIFICACIONES_LEAD)[number];

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  negocio!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  localidad!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  zona?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  departamento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  instagram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  webActual?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  asignadoA?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notas?: string;
}

export class ActualizarLeadDto {
  @IsOptional()
  @IsIn(RUBROS_LEAD)
  rubro?: (typeof RUBROS_LEAD)[number];

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  subrubro?: string;

  @IsOptional()
  @IsIn(CLASIFICACIONES_LEAD)
  clasificacion?: (typeof CLASIFICACIONES_LEAD)[number];

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  negocio?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  localidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  instagram?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  webActual?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  direccion?: string | null;

  @IsOptional()
  @IsBoolean()
  contactado?: boolean;

  @IsOptional()
  @IsIn(ESTADOS_LEAD)
  estado?: (typeof ESTADOS_LEAD)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  asignadoA?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notas?: string | null;
}

export class BuscarLeadsDto {
  @IsOptional()
  @IsIn(['TODOS', ...RUBROS_BUSQUEDA])
  rubro?: 'TODOS' | RubroBusqueda;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  localidad?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  maxConsultas?: number;

  @IsOptional()
  @IsBoolean()
  forzarRebusqueda?: boolean;
}
