import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { DataFolderId, WorkbookId } from '@spinner/shared-types';
import { CliAuthGuard } from 'src/auth/cli-auth.guard';
import type { CliConnectorCredentials, CliRequestWithUser } from 'src/auth/types';
import { Actor, userToActor } from 'src/users/types';
import { BUILD_VERSION } from 'src/version';
import { DataFolderEntity } from 'src/workbook/entities/data-folder.entity';
import { Workbook } from 'src/workbook/entities/workbook.entity';
import { CliService } from './cli.service';
import { DownloadedFilesResponseDto, DownloadRequestDto } from './dtos/download-files.dto';
import { GetFolderFilesResponseDto, PutFolderFilesResponseDto } from './dtos/folder-files.dto';
import { ListTablesResponseDto } from './dtos/list-tables.dto';
import { TestConnectionResponseDto } from './dtos/test-connection.dto';
import { UploadChangesDto, UploadChangesResponseDto } from './dtos/upload-changes.dto';
import { ValidateFilesRequestDto, ValidateFilesResponseDto } from './dtos/validate-files.dto';

@Controller('cli/v1')
@UseGuards(CliAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class CliController {
  constructor(private readonly cliService: CliService) {}

  @Get('health')
  health() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'scratch-cli',
      build_version: BUILD_VERSION,
      api_version: '1',
    };
  }

  @Get('workbooks')
  async listWorkbooks(@Req() req: CliRequestWithUser): Promise<Workbook[]> {
    const actor = this.getActorFromRequest(req);
    if (!actor) {
      throw new ForbiddenException('Authentication required');
    }
    return this.cliService.listWorkbooks(actor);
  }

  @Get('workbooks/:workbookId/folders')
  async listDataFolders(
    @Param('workbookId') workbookId: WorkbookId,
    @Req() req: CliRequestWithUser,
  ): Promise<DataFolderEntity[]> {
    const actor = this.getActorFromRequest(req);
    if (!actor) {
      throw new ForbiddenException('Authentication required');
    }
    return this.cliService.listDataFolders(workbookId, actor);
  }

  @Get('folders/:folderId/files')
  async getFolderFiles(
    @Param('folderId') folderId: DataFolderId,
    @Req() req: CliRequestWithUser,
  ): Promise<GetFolderFilesResponseDto> {
    const actor = this.getActorFromRequest(req);
    if (!actor) {
      throw new ForbiddenException('Authentication required');
    }
    return this.cliService.getFolderFiles(folderId, actor);
  }

  @Put('folders/:folderId/files')
  @UseInterceptors(FilesInterceptor('files', 1000)) // Accept up to 1000 files
  async putFolderFiles(
    @Param('folderId') folderId: DataFolderId,
    @Req() req: CliRequestWithUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { deletedFiles?: string },
  ): Promise<PutFolderFilesResponseDto> {
    const actor = this.getActorFromRequest(req);
    if (!actor) {
      throw new ForbiddenException('Authentication required');
    }

    // Parse files from multipart - each file's content is raw (no JSON encoding)
    const parsedFiles = (files || []).map((f) => ({
      name: f.originalname,
      content: f.buffer.toString('utf-8'),
    }));

    // Parse deletedFiles from JSON string (sent as form field)
    let deletedFiles: string[] = [];
    if (body.deletedFiles) {
      try {
        const parsed: unknown = JSON.parse(body.deletedFiles);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
          deletedFiles = parsed;
        }
      } catch {
        // Ignore parse errors
      }
    }

    return this.cliService.putFolderFiles(
      folderId,
      {
        files: parsedFiles,
        deletedFiles,
      },
      actor,
    );
  }

  @Get('test-connection')
  async testConnection(@Req() req: CliRequestWithUser): Promise<TestConnectionResponseDto> {
    this.validateCredentials(req.connectorCredentials);
    const actor = this.getActorFromRequest(req);
    // req.connectorCredentials is guaranteed to be defined after validateCredentials
    return this.cliService.testConnection(req.connectorCredentials as CliConnectorCredentials, actor);
  }

  @Get('list-tables')
  async listTables(@Req() req: CliRequestWithUser): Promise<ListTablesResponseDto> {
    this.validateCredentials(req.connectorCredentials);
    const actor = this.getActorFromRequest(req);
    // req.connectorCredentials is guaranteed to be defined after validateCredentials
    return this.cliService.listTables(req.connectorCredentials as CliConnectorCredentials, actor);
  }

  @Post('download')
  async download(@Req() req: CliRequestWithUser, @Body() dto: DownloadRequestDto): Promise<DownloadedFilesResponseDto> {
    this.validateCredentials(req.connectorCredentials);
    const actor = this.getActorFromRequest(req);
    // req.connectorCredentials is guaranteed to be defined after validateCredentials
    return this.cliService.download(req.connectorCredentials as CliConnectorCredentials, dto, actor);
  }

  @Post('upload')
  async upload(@Req() req: CliRequestWithUser, @Body() dto: UploadChangesDto): Promise<UploadChangesResponseDto> {
    this.validateCredentials(req.connectorCredentials);
    const actor = this.getActorFromRequest(req);
    // req.connectorCredentials is guaranteed to be defined after validateCredentials
    return await this.cliService.upload(req.connectorCredentials as CliConnectorCredentials, dto, actor);
  }

  @Post('validate-files')
  async validateFiles(
    @Req() req: CliRequestWithUser,
    @Body() dto: ValidateFilesRequestDto,
  ): Promise<ValidateFilesResponseDto> {
    this.validateCredentials(req.connectorCredentials);
    const actor = this.getActorFromRequest(req);
    // req.connectorCredentials is guaranteed to be defined after validateCredentials
    return this.cliService.validateFiles(req.connectorCredentials as CliConnectorCredentials, dto, actor);
  }

  private validateCredentials(credentials?: CliConnectorCredentials): void {
    if (!credentials) {
      throw new ForbiddenException('Missing connector credentials');
    }

    if (!credentials?.service) {
      throw new BadRequestException('No data service provided in connector credentials');
    }
  }

  private getActorFromRequest(req: CliRequestWithUser): Actor | undefined {
    // req.user can be true (valid request, no auth) or AuthenticatedUser (valid API token)
    if (req.user && typeof req.user !== 'boolean') {
      return userToActor(req.user);
    }
    return undefined;
  }
}
