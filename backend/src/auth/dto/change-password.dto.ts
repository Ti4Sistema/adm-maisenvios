import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha atual' })
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(10, { message: 'A nova senha deve ter pelo menos 10 caracteres' })
  @MaxLength(128)
  newPassword: string;
}
