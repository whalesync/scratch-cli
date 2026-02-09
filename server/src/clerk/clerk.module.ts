import { Module } from '@nestjs/common';
import { ScratchConfigModule } from '../config/scratch-config.module';
import { ClerkClientProvider } from './clerk-client.provider';
import { ClerkService } from './clerk.service';

@Module({
  imports: [ScratchConfigModule],
  providers: [ClerkClientProvider, ClerkService],
  exports: [ClerkClientProvider, ClerkService], //export this service to use in other modules
})
export class ClerkModule {}
