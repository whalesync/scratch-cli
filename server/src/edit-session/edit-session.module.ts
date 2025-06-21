import { Module } from '@nestjs/common';
import { DbModule } from 'src/db/db.module';
import { EditSessionController } from './edit-session.controller';
import { EditSessionService } from './edit-session.service';

@Module({
  imports: [DbModule],
  controllers: [EditSessionController],
  providers: [EditSessionService],
  exports: [EditSessionService],
})
export class EditSessionModule {}
