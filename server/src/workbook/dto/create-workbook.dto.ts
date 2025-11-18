import { IsArray, IsOptional, IsString } from 'class-validator';
import type { EntityId } from '../../remote-service/connectors/types';
import { ConnectorAccountId } from '../../types/ids';

export class CreateWorkbookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsArray()
  @IsOptional()
  tables?: {
    connectorAccountId: ConnectorAccountId;
    tableId: EntityId;
  }[];
}
