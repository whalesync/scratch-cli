import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class ValidateMappingDto {
  @IsString()
  @IsNotEmpty()
  sourceId!: string;

  @IsString()
  @IsNotEmpty()
  destId!: string;

  @IsObject()
  mapping!: Record<string, string>;
}
