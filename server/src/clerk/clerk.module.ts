import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from '../config/scratchpad-config.module';
import { ClerkClientProvider } from './clerk-client.provider';
import { ClerkService } from './clerk.service';

@Module({
  imports: [ScratchpadConfigModule],
  providers: [ClerkClientProvider, ClerkService],
  exports: [ClerkClientProvider, ClerkService], //export this service to use in other modules
})
export class ClerkModule {}
