import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ROLES } from '../../access/roles';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(255, { message: 'Tamanho máximo do nome é 255 posições' })
  name: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(255, { message: 'Tamanho máximo do e-mail é 255 posições' })
  email: string;

  @IsString()
  @MinLength(10, { message: 'A senha deve ter pelo menos 10 caracteres' })
  @MaxLength(128, { message: 'Tamanho máximo da senha é 128 posições' })
  password: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(Object.keys(ROLES), { each: true, message: 'Papel inválido' })
  roles: string[];
}
