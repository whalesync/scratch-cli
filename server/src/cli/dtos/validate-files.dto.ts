import { Type } from 'class-transformer';
import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class FileToValidate {
  // The remote ID of the record that this file is linked to (optional for new files)
  @IsString()
  @IsOptional()
  id?: string;

  // The filename of the file, used to identify the file in the response
  @IsString()
  filename?: string;

  // The content of the file as key-value pairs (parsed frontmatter)
  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;
}

export type ValidatedFileToValidate = Required<Pick<FileToValidate, 'filename' | 'data'>>;

export class ValidateFilesRequestDto {
  // The ID of the table to validate against, can be an array of IDs if the table is nested in a base or site
  @IsString({ each: true })
  @IsArray()
  tableId?: string[];

  // The files to validate
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileToValidate)
  files?: FileToValidate[];
}

export type ValidatedValidateFilesRequestDto = Required<Pick<ValidateFilesRequestDto, 'tableId' | 'files'>>;

export type ValidatedFileResult = {
  // The remote ID of the record (if provided)
  id?: string;

  // The filename of the file
  filename: string;

  // The content of the file as key-value pairs
  data: Record<string, unknown>;

  // Whether the file passed validation and is ready to be published
  publishable: boolean;

  // Optional validation errors/warnings
  errors?: string[];
};

export class ValidateFilesResponseDto {
  readonly error?: string;
  readonly files?: ValidatedFileResult[];
}
