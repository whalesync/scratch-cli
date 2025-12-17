import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from '../config/scratchpad-config.module';
import { ExperimentsModule } from '../experiments/experiments.module';
import { BugReportController } from './bug-report.controller';
import { BugReportService } from './bug-report.service';
import { LinearService } from './linear.service';

@Module({
  imports: [ScratchpadConfigModule, ExperimentsModule],
  controllers: [BugReportController],
  providers: [BugReportService, LinearService],
  exports: [BugReportService], //export this service to use in other modules
})
export class BugReportModule {}
