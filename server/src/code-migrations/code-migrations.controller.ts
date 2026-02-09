/* eslint-disable @typescript-eslint/require-await */
import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type {
  AvailableMigrationsResponse,
  MigrationResult,
  RunMigrationDto,
  ValidatedRunMigrationDto,
} from '@spinner/shared-types';
import { hasAdminToolsPermission } from 'src/auth/permissions';
import { ScratchAuthGuard } from '../auth/scratch-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { DbService } from '../db/db.service';

const AVAILABLE_MIGRATIONS: string[] = [];

@Controller('code-migrations')
@UseGuards(ScratchAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class CodeMigrationsController {
  private readonly logger = new Logger(CodeMigrationsController.name);

  constructor(private readonly db: DbService) {}

  @Get('available')
  getAvailableMigrations(@Req() req: RequestWithUser): AvailableMigrationsResponse {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can access migrations');
    }

    return { migrations: AVAILABLE_MIGRATIONS };
  }

  @Post('run')
  async runMigration(@Req() req: RequestWithUser, @Body() dtoParam: RunMigrationDto): Promise<MigrationResult> {
    const dto = dtoParam as ValidatedRunMigrationDto;
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can run migrations');
    }

    // Validate that either qty or ids is provided, but not both
    if (dto.qty && dto.ids && dto.ids.length > 0) {
      throw new BadRequestException('Cannot provide both qty and ids. Choose one.');
    }

    if (!dto.qty && (!dto.ids || dto.ids.length === 0)) {
      throw new BadRequestException('Must provide either qty or ids.');
    }

    switch (dto.migration) {
      default:
        throw new BadRequestException(`Unknown migration: ${dto.migration}`);
    }
  }
}
