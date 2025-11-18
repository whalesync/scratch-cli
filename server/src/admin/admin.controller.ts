import { Controller, Get } from '@nestjs/common';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { BUILD_VERSION } from 'src/version';

/**
 * Root of the Scratch API.
 *
 * NOTE: It is *not* auth guarded because it only returns basic helpful info.
 */
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
      in_cloud: ScratchpadConfigService.isRunningInCloudRun(),
      app_url: ScratchpadConfigService.getClientBaseUrl(),
    };
  }
}
