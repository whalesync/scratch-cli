import { Service } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListTablesDto {
  @IsEnum(Service)
  service: Service;

  @IsOptional()
  @IsString()
  connectorAccountId?: string | null;
}
