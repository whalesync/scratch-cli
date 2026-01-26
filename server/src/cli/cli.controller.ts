import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CliAuthGuard } from 'src/auth/cli-auth.guard';
import type { CliConnectorCredentials, CliRequestWithUser } from 'src/auth/types';
import { Actor, userToActor } from 'src/users/types';
import { BUILD_VERSION } from 'src/version';
import { CliService } from './cli.service';
import { DownloadedFilesResponseDto, DownloadRequestDto } from './dtos/download-files.dto';
import { ListJsonTablesResponseDto } from './dtos/list-json-tables.dto';
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

  @Get('list-json-tables')
  async listJsonTables(@Req() req: CliRequestWithUser): Promise<ListJsonTablesResponseDto> {
    this.validateCredentials(req.connectorCredentials);
    const actor = this.getActorFromRequest(req);
    // req.connectorCredentials is guaranteed to be defined after validateCredentials
    return this.cliService.listJsonTables(req.connectorCredentials as CliConnectorCredentials, actor);
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
