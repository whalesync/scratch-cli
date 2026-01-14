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
import { Request } from 'express';
import { CliAuthGuard } from 'src/auth/cli-auth.guard';
import { CliConnectorCredentials } from 'src/auth/types';
import { BUILD_VERSION } from 'src/version';
import { CliService } from './cli.service';
import { DownloadedFilesResponseDto, DownloadRequestDto } from './dtos/download-files.dto';
import { ListTablesResponseDto } from './dtos/list-tables.dto';
import { TestConnectionResponseDto } from './dtos/test-connection.dto';
import { UploadChangesDto, UploadChangesResponseDto } from './dtos/upload-changes.dto';

/**
 * CLI Request type with optional connector credentials from X-Scratch-Connector header
 */
type CliRequest = Request & { connectorCredentials?: CliConnectorCredentials };

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
  async testConnection(@Req() req: CliRequest): Promise<TestConnectionResponseDto> {
    this.validateCredentials(req.connectorCredentials);
    // req.connectorCredentials is guaranteed to be defined after validateCredentials
    return this.cliService.testConnection(req.connectorCredentials as CliConnectorCredentials);
  }

  @Get('list-tables')
  async listTables(@Req() req: CliRequest): Promise<ListTablesResponseDto> {
    this.validateCredentials(req.connectorCredentials);
    // req.connectorCredentials is guaranteed to be defined after validateCredentials
    return this.cliService.listTables(req.connectorCredentials as CliConnectorCredentials);
  }

  @Post('download')
  @Post('download')
  async download(@Req() req: CliRequest, @Body() dto: DownloadRequestDto): Promise<DownloadedFilesResponseDto> {
    this.validateCredentials(req.connectorCredentials);
    // req.connectorCredentials is guaranteed to be defined after validateCredentials
    return this.cliService.download(req.connectorCredentials as CliConnectorCredentials, dto);
  }

  @Post('upload')
  async upload(@Req() req: CliRequest, @Body() dto: UploadChangesDto): Promise<UploadChangesResponseDto> {
    this.validateCredentials(req.connectorCredentials);
    // req.connectorCredentials is guaranteed to be defined after validateCredentials
    return await this.cliService.upload(req.connectorCredentials as CliConnectorCredentials, dto);
  }

  private validateCredentials(credentials?: CliConnectorCredentials): void {
    if (!credentials) {
      throw new ForbiddenException('Missing connector credentials');
    }

    if (!credentials?.service) {
      throw new BadRequestException('No data service provided in connector credentials');
    }
  }
}
