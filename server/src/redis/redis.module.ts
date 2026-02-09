import { Module } from '@nestjs/common';
import { ScratchConfigModule } from 'src/config/scratch-config.module';
import { RedisPubSubService } from './redis-pubsub.service';

@Module({
  imports: [ScratchConfigModule],
  providers: [RedisPubSubService],
  exports: [RedisPubSubService],
})
export class RedisModule {}
