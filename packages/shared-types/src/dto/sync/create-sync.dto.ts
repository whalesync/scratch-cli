import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { TransformerConfig } from '../../sync-mapping';

/**
 * Extended field mapping value that includes optional transformer configuration.
 * Used when a field needs transformation during sync.
 */
export interface FieldMappingValue {
  destinationField: string;
  transformer?: TransformerConfig;
}

/**
 * Field map type that supports both simple and complex mappings:
 * - Simple: { "source_col": "dest_col" }
 * - With transformer: { "source_col": { destinationField: "dest_col", transformer: {...} } }
 */
export type FieldMapType = Record<string, string | FieldMappingValue>;

export class FolderMappingDto {
  @IsString()
  @IsNotEmpty()
  sourceId!: string;

  @IsString()
  @IsNotEmpty()
  destId!: string;

  @IsNotEmpty()
  fieldMap!: FieldMapType;

  @IsString()
  @IsOptional()
  matchingDestinationField!: string | null;

  @IsString()
  @IsOptional()
  matchingSourceField?: string | null;
}

export class CreateSyncDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FolderMappingDto)
  folderMappings!: FolderMappingDto[];

  @IsString()
  @IsOptional()
  schedule!: string | null;

  @IsBoolean()
  @IsOptional()
  autoPublish!: boolean;

  @IsBoolean()
  @IsOptional()
  enableValidation?: boolean;
}
