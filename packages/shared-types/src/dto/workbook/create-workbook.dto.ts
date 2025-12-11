import { IsArray, IsOptional, IsString } from 'class-validator';
import type { EntityId } from '../../connector-types';
import type { ConnectorAccountId } from '../../ids';

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
