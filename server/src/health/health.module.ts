import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ScratchConfigModule } from 'src/config/scratch-config.module';
import { HealthController } from './health.controller';

@Module({
  imports: [AuthModule, ScratchConfigModule],
  controllers: [HealthController],
})
export class HealthModule {}
