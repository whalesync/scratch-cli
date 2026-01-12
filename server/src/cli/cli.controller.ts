import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Post,
  Query,
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
import { FetchTableSpecResponseDto } from './dtos/fetch-table-spec.dto';
import { ListTableSpecsResponseDto } from './dtos/list-table-specs.dto';
import { ListTablesResponseDto } from './dtos/list-tables.dto';
import { TestCredentialsResponseDto } from './dtos/test-credentials.dto';

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

  @Get('test-credentials')
  async testCredentials(@Req() req: CliRequest): Promise<TestCredentialsResponseDto> {
    return this.cliService.testCredentials(req.connectorCredentials);
  }

  @Get('list-tables')
  async listTables(@Req() req: CliRequest): Promise<ListTablesResponseDto> {
    return this.cliService.listTables(req.connectorCredentials);
  }

  @Get('fetch-table-spec')
  async fetchTableSpec(@Req() req: CliRequest, @Query('tableId') tableId: string): Promise<FetchTableSpecResponseDto> {
    return this.cliService.fetchTableSpec(req.connectorCredentials, tableId);
  }

  @Get('list-table-specs')
  async listTableSpecs(@Req() req: CliRequest): Promise<ListTableSpecsResponseDto> {
    return this.cliService.listTableSpecs(req.connectorCredentials);
  }

  @Post('download')
  async download(@Req() req: CliRequest, @Body() body: DownloadRequestDto): Promise<DownloadedFilesResponseDto> {
    return this.cliService.download(req.connectorCredentials, body.tableId ?? []);
  }
}
