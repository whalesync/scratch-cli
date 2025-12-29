import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RunMigrationDto {
  @IsString()
  migration?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];
}

export type ValidatedRunMigrationDto = Required<Pick<RunMigrationDto, 'migration'>> &
  Pick<RunMigrationDto, 'qty' | 'ids'>;

export interface AvailableMigrationsResponse {
  migrations: string[];
}

export interface MigrationResult {
  migratedIds: string[];
  remainingCount: number;
  migrationName: string;
}
