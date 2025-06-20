import { Service } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateConnectorAccountDto {
  @IsEnum(Service)
  @IsNotEmpty()
  readonly service: Service;

  @IsString()
  @IsNotEmpty()
  readonly apiKey: string;
}
