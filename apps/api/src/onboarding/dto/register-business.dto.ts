import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Nombres recortados, no vacíos y con tope (80, igual que el nombre del
// negocio en UpdateBusinessDto): antes llegaban sin límite (auditoría
// interna 10/09, ítem api.onboarding).
export class RegisterBusinessDto {
  @Transform(recortar) @IsString() @IsNotEmpty() @MaxLength(80) ownerName!: string;
  @NormalizedEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @Transform(recortar) @IsString() @IsNotEmpty() @MaxLength(80) businessName!: string;
}
