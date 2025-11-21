import { ClassSerializerInterceptor, Controller, Get, UseInterceptors } from '@nestjs/common';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { BUILD_VERSION } from 'src/version';

/**
 * Health check endpoint for the Scratch API.
 *
 * NOTE: It is *not* auth guarded because it only returns basic helpful info for monitoring services.
 */
@Controller()
@UseInterceptors(ClassSerializerInterceptor)
export class HealthController {
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
      apptype: ScratchpadConfigService.getScratchpadServiceType(),
    };
  }
}
