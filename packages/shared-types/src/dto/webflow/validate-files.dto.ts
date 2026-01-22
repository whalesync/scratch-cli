import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Inline file data for validation - allows validating without fetching from database
 */
export class WebflowValidateFileInput {
  @IsString()
  filename?: string;

  @IsString()
  @IsOptional()
  id?: string;

  /**
   * Pre-parsed field data. If provided, used directly for validation.
   */
  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;

  /**
   * Raw markdown content with frontmatter. If provided (and data is not),
   * the server will parse it using gray-matter and the tableSpec.
   */
  @IsString()
  @IsOptional()
  rawContent?: string;
}

export class WebflowValidateFilesDto {
  @IsString()
  snapshotTableId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recordIds?: string[];

  /**
   * Optional inline file data - if provided, validates this data directly
   * without fetching from the database. Takes precedence over recordIds.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebflowValidateFileInput)
  @IsOptional()
  files?: WebflowValidateFileInput[];
}

export type ValidatedWebflowValidateFilesDto = Required<Pick<WebflowValidateFilesDto, 'snapshotTableId'>> &
  Pick<WebflowValidateFilesDto, 'recordIds' | 'files'>;

export type WebflowValidateFileResult = {
  recordId: string;
  filename: string;
  publishable: boolean;
  errors?: string[];
};

export type WebflowValidateFilesResponse = {
  results: WebflowValidateFileResult[];
  summary: {
    total: number;
    publishable: number;
    invalid: number;
  };
};
