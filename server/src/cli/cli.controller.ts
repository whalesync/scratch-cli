import { Body, ClassSerializerInterceptor, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { CliAuthGuard } from 'src/auth/cli-auth.guard';
import { BUILD_VERSION } from 'src/version';
import { CliService } from './cli.service';
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
}
