import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type {
  DataFolder,
  DataFolderId,
  ValidatedCreateDataFolderDto,
  ValidatedMoveDataFolderDto,
  ValidatedRenameDataFolderDto,
  WorkbookId,
} from '@spinner/shared-types';
import { CreateDataFolderDto, MoveDataFolderDto, RenameDataFolderDto } from '@spinner/shared-types';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { userToActor } from '../users/types';
import { DataFolderService } from './data-folder.service';
import { WorkbookService } from './workbook.service';

@Controller('data-folder')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class DataFolderController {
  constructor(
    private readonly dataFolderService: DataFolderService,
    private readonly workbookService: WorkbookService,
  ) {}

  @Post('/create')
  async create(@Body() createDataFolderDto: CreateDataFolderDto, @Req() req: RequestWithUser): Promise<DataFolder> {
    const dto = createDataFolderDto as ValidatedCreateDataFolderDto;
    const actor = userToActor(req.user);

    // Verify the user has access to the workbook
    const workbook = await this.workbookService.findOne(dto.workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    return await this.dataFolderService.createFolder(dto, actor);
  }

  @Get(':id')
  async findOne(@Param('id') id: DataFolderId, @Req() req: RequestWithUser): Promise<DataFolder> {
    return await this.dataFolderService.findOne(id, userToActor(req.user));
  }

  @Delete(':id')
  async delete(@Param('id') id: DataFolderId, @Req() req: RequestWithUser): Promise<void> {
    await this.dataFolderService.deleteFolder(id, userToActor(req.user));
  }

  @Patch(':id/rename')
  async rename(
    @Param('id') id: DataFolderId,
    @Body() renameDto: RenameDataFolderDto,
    @Req() req: RequestWithUser,
  ): Promise<DataFolder> {
    const dto = renameDto as ValidatedRenameDataFolderDto;
    return await this.dataFolderService.renameFolder(id, dto.name, userToActor(req.user));
  }

  @Patch(':id/move')
  async move(
    @Param('id') id: DataFolderId,
    @Body() moveDto: MoveDataFolderDto,
    @Req() req: RequestWithUser,
  ): Promise<DataFolder> {
    const dto = moveDto as ValidatedMoveDataFolderDto;
    return await this.dataFolderService.moveFolder(id, dto.parentFolderId ?? null, userToActor(req.user));
  }

  @Get(':id/new-file')
  async getNewFileTemplate(
    @Param('id') id: DataFolderId,
    @Req() req: RequestWithUser,
  ): Promise<Record<string, unknown>> {
    return await this.dataFolderService.getNewFileTemplate(id, userToActor(req.user));
  }

  @Post(':id/files')
  async createFile(
    @Param('id') id: DataFolderId,
    @Body() body: { name: string; useTemplate?: boolean; workbookId: string },
    @Req() req: RequestWithUser,
  ) {
    return await this.dataFolderService.createFile(
      body.workbookId as WorkbookId,
      id,
      { name: body.name, useTemplate: body.useTemplate },
      userToActor(req.user),
    );
  }
}
