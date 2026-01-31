import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { HealthController } from './health.controller';

@Module({
  imports: [AuthModule, ScratchpadConfigModule],
  controllers: [HealthController],
})
export class HealthModule {}
