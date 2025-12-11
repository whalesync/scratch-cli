import { IsArray, IsOptional, IsString } from 'class-validator';
import type { ConnectorAccountId } from '../../ids';
import type { EntityId } from '../../connector-types';

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
