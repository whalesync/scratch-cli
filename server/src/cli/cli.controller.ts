import {
  Body,
  ClassSerializerInterceptor,
  Controller,
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
    return this.cliService.testConnection(req.connectorCredentials);
  }

  @Get('list-tables')
  async listTables(@Req() req: CliRequest): Promise<ListTablesResponseDto> {
    return this.cliService.listTables(req.connectorCredentials);
  }

  @Post('download')
  async download(@Req() req: CliRequest, @Body() dto: DownloadRequestDto): Promise<DownloadedFilesResponseDto> {
    // WIP - DON'T USE THIS YET - NOT IMPLEMENTED
    return this.cliService.download(req.connectorCredentials, dto);
  }
}
