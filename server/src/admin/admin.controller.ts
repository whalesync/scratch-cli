import { Controller, Get } from '@nestjs/common';
import { BUILD_VERSION } from 'src/version';

@Controller()
export class AdminController {
  @Get()
  getRoot() {
    return {
      server: 'Scratchpad API',
      build_version: BUILD_VERSION,
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      service: 'scratchpad-api',
      build_version: BUILD_VERSION,
    };
  }
}
