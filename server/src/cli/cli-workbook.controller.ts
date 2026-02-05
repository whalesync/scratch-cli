import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { WorkbookId } from '@spinner/shared-types';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { userToActor } from 'src/users/types';
import { WorkbookService } from 'src/workbook/workbook.service';
import {
  CliWorkbookResponseDto,
  CreateCliWorkbookDto,
  ListWorkbooksQueryDto,
  ListWorkbooksResponseDto,
} from './dtos/cli-workbook.dto';

/**
 * Controller for CLI workbook operations.
 * Provides simplified endpoints for CLI access to workbook management.
 *
 * All endpoints require API token authentication via Authorization header.
 */
@Controller('cli/v1/workbooks')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(ScratchpadAuthGuard)
export class CliWorkbookController {
  constructor(private readonly workbookService: WorkbookService) {}

  /**
   * List all workbooks for the authenticated user.
   */
  @Get()
  async listWorkbooks(
    @Req() req: RequestWithUser,
    @Query() query: ListWorkbooksQueryDto,
  ): Promise<ListWorkbooksResponseDto> {
    const actor = userToActor(req.user);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const workbooks = await this.workbookService.findAllForUser(actor, sortBy, sortOrder);

    return {
      workbooks: workbooks.map((wb) => this.toCliResponse(wb)),
    };
  }

  /**
   * Create a new workbook.
   */
  @Post()
  async createWorkbook(
    @Req() req: RequestWithUser,
    @Body() dto: CreateCliWorkbookDto,
  ): Promise<CliWorkbookResponseDto> {
    const actor = userToActor(req.user);

    const workbook = await this.workbookService.create(
      {
        name: dto.name,
      },
      actor,
    );

    return this.toCliResponse(workbook);
  }

  /**
   * Get a single workbook by ID.
   */
  @Get(':id')
  async getWorkbook(@Req() req: RequestWithUser, @Param('id') id: string): Promise<CliWorkbookResponseDto> {
    const actor = userToActor(req.user);
    const workbook = await this.workbookService.findOne(id as WorkbookId, actor);

    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    return this.toCliResponse(workbook);
  }

  /**
   * Delete a workbook by ID.
   */
  @Delete(':id')
  async deleteWorkbook(@Req() req: RequestWithUser, @Param('id') id: string): Promise<{ success: boolean }> {
    const actor = userToActor(req.user);

    // Verify workbook exists and user has access
    const workbook = await this.workbookService.findOne(id as WorkbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    await this.workbookService.delete(id as WorkbookId, actor);

    return { success: true };
  }

  /**
   * Convert a workbook to the CLI response format.
   */
  private toCliResponse(workbook: {
    id: string;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
    snapshotTables?: unknown[];
  }): CliWorkbookResponseDto {
    return {
      id: workbook.id,
      name: workbook.name ?? undefined,
      createdAt: workbook.createdAt.toISOString(),
      updatedAt: workbook.updatedAt.toISOString(),
      tableCount: workbook.snapshotTables?.length ?? 0,
    };
  }
}
