import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { RedisPubSubService } from './redis-pubsub.service';

@Module({
  imports: [ScratchpadConfigModule],
  providers: [RedisPubSubService],
  exports: [RedisPubSubService],
})
export class RedisModule {}
