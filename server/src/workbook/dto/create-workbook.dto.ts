import { ConnectorAccountId } from '@spinner/shared-types';
import { IsArray, IsOptional, IsString } from 'class-validator';
import type { EntityId } from '../../remote-service/connectors/types';

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

export type ValidatedCreateWorkbookDto = CreateWorkbookDto;
