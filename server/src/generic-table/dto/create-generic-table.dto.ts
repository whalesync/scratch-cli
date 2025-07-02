import { Prisma } from '@prisma/client';
import { IsNotEmpty, IsObject, IsString, MaxLength } from 'class-validator';

export class CreateGenericTableDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsObject()
  fetch: Prisma.InputJsonValue;

  @IsObject()
  mapping: Prisma.InputJsonValue;
}
