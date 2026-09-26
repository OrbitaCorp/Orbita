import { IsString, MaxLength } from 'class-validator';

export class ProxyImageDto {
  @IsString()
  @MaxLength(2000)
  url!: string;
}
