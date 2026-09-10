import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// Mismo tope que InviteMemberDto (auditoría interna 10/09, ítem `api.members`).
export class UpdateMemberDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsUUID() roleId?: string;
}
