import { Prisma } from '@prisma/client';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { MappingConfig } from '../types';

export class UpdateGenericTableDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  pollRecords?: string;

  @IsObject()
  @IsOptional()
  mapping?: MappingConfig;

  // AI generation prompt
  @IsString()
  @IsOptional()
  prompt?: string;

  // API key for external services
  @IsString()
  @IsOptional()
  apiKey?: string;

  // Schema generation
  @IsString()
  @IsOptional()
  fetchSchema?: string;

  @IsObject()
  @IsOptional()
  schema?: Prisma.InputJsonValue;

  // CRUD operation function bodies
  @IsString()
  @IsOptional()
  getRecord?: string;

  @IsString()
  @IsOptional()
  deleteRecord?: string;

  @IsString()
  @IsOptional()
  createRecord?: string;

  @IsString()
  @IsOptional()
  updateRecord?: string;

  // Response schemas
  @IsObject()
  @IsOptional()
  pollRecordsResponse?: Prisma.InputJsonValue;

  @IsObject()
  @IsOptional()
  getRecordResponse?: Prisma.InputJsonValue;
}
