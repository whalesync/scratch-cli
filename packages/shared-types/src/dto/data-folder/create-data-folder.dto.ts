import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { WorkbookId } from '../../ids';

export class CreateDataFolderDto {
  @IsNotEmpty()
  @IsString()
  name?: string;

  @IsNotEmpty()
  @IsString()
  workbookId?: WorkbookId;

  @IsOptional()
  @IsString()
  connectorAccountId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tableIds?: string[];

  @IsOptional()
  @IsString()
  parentFolderId?: string;
}

export type ValidatedCreateDataFolderDto = Required<Pick<CreateDataFolderDto, 'name' | 'workbookId'>> &
  Pick<CreateDataFolderDto, 'connectorAccountId' | 'tableIds' | 'parentFolderId'>;
