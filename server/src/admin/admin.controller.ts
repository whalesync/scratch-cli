import { Controller, Get } from '@nestjs/common';

@Controller()
export class AdminController {
  @Get()
  getRoot() {
    return {
      server: 'Scratchpad API',
      version: '1.0.0',
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      service: 'scratchpad-api',
    };
  }
}
