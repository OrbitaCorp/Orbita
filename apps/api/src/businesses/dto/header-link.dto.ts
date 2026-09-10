import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class HeaderLinkDto {
  @IsString() @MaxLength(64) id!: string;
  @IsString() @MaxLength(60) label!: string;
  @IsBoolean() on!: boolean;
}
