import { Service } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EntityId } from '../../remote-service/connectors/types';

export class AddTableToSnapshotDto {
  @IsNotEmpty()
  @IsEnum(Service)
  service: Service;

  @IsOptional()
  @IsString()
  connectorAccountId?: string;

  @IsNotEmpty()
  tableId: EntityId;
}
