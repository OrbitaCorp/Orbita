import { IsEmail } from 'class-validator';

export class SendMailTestDto {
  @IsEmail() to!: string;
}
