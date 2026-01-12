import { Body, ClassSerializerInterceptor, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { CliAuthGuard } from 'src/auth/cli-auth.guard';
import { BUILD_VERSION } from 'src/version';
import { CliService } from './cli.service';
import { FetchTableSpecDto, FetchTableSpecResponseDto } from './dtos/fetch-table-spec.dto';
import { ListTableSpecsDto, ListTableSpecsResponseDto } from './dtos/list-table-specs.dto';
import { ListTablesDto, ListTablesResponseDto } from './dtos/list-tables.dto';
import { TestCredentialsDto, TestCredentialsResponseDto } from './dtos/test-credentials.dto';

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

  @Post('test-credentials')
  async testCredentials(@Body() testCredentialsDto: TestCredentialsDto): Promise<TestCredentialsResponseDto> {
    return this.cliService.testCredentials(testCredentialsDto);
  }

  @Post('list-tables')
  async listTables(@Body() listTablesDto: ListTablesDto): Promise<ListTablesResponseDto> {
    return this.cliService.listTables(listTablesDto);
  }

  @Post('fetch-table-spec')
  async fetchTableSpec(@Body() fetchTableSpecDto: FetchTableSpecDto): Promise<FetchTableSpecResponseDto> {
    return this.cliService.fetchTableSpec(fetchTableSpecDto);
  }

  @Post('list-table-specs')
  async listTableSpecs(@Body() listTableSpecsDto: ListTableSpecsDto): Promise<ListTableSpecsResponseDto> {
    return this.cliService.listTableSpecs(listTableSpecsDto);
  }
}
