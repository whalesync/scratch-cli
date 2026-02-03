import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export class FolderMappingDto {
  @IsString()
  @IsNotEmpty()
  sourceId!: string;

  @IsString()
  @IsNotEmpty()
  destId!: string;

  @IsNotEmpty()
  fieldMap!: Record<string, string>;

  @IsString()
  @IsOptional()
  matchingField!: string | null;
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
}
