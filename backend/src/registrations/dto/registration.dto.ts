import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { REGISTRATION_STATUSES, REGISTRATION_TYPES } from '../registration-rules';

const TYPES = Object.keys(REGISTRATION_TYPES);
const STATUSES = Object.keys(REGISTRATION_STATUSES);

export class CreateRegistrationDto {
  @IsIn(TYPES, { message: 'Tipo de cadastro inválido' })
  type: string;

  @IsOptional()
  @IsObject()
  values?: Record<string, unknown>;
}

export class FieldChangeDto {
  @IsString()
  @IsNotEmpty()
  field: string;

  // O valor que a tela tinha antes da edição: se mudou no banco, é conflito.
  @Allow()
  from: unknown;

  @Allow()
  to: unknown;
}

export class UpdateRegistrationDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Nenhuma alteração enviada' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => FieldChangeDto)
  changes: FieldChangeDto[];
}

export class ListRegistrationsDto {
  @IsOptional()
  @IsIn(TYPES)
  type?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class PastedRowDto {
  @IsInt()
  line: number;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  cells: string[];
}

export class ImportSmartDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Nenhuma linha colada' })
  @ArrayMaxSize(500, { message: 'Cole no máximo 500 linhas por vez' })
  @ValidateNested({ each: true })
  @Type(() => PastedRowDto)
  rows: PastedRowDto[];

  @IsBoolean()
  dryRun: boolean;
}
