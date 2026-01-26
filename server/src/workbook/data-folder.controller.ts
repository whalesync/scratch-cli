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
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser): Promise<DataFolder> {
    return await this.dataFolderService.findOne(id as DataFolderId, userToActor(req.user));
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: RequestWithUser): Promise<void> {
    await this.dataFolderService.deleteFolder(id as DataFolderId, userToActor(req.user));
  }

  @Patch(':id/rename')
  async rename(
    @Param('id') id: string,
    @Body() renameDto: RenameDataFolderDto,
    @Req() req: RequestWithUser,
  ): Promise<DataFolder> {
    const dto = renameDto as ValidatedRenameDataFolderDto;
    return await this.dataFolderService.renameFolder(id as DataFolderId, dto.name, userToActor(req.user));
  }

  @Patch(':id/move')
  async move(
    @Param('id') id: string,
    @Body() moveDto: MoveDataFolderDto,
    @Req() req: RequestWithUser,
  ): Promise<DataFolder> {
    const dto = moveDto as ValidatedMoveDataFolderDto;
    return await this.dataFolderService.moveFolder(
      id as DataFolderId,
      dto.parentFolderId ?? null,
      userToActor(req.user),
    );
  }
}
