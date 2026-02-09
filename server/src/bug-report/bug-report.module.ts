import { Module } from '@nestjs/common';
import { ScratchConfigModule } from '../config/scratch-config.module';
import { ExperimentsModule } from '../experiments/experiments.module';
import { BugReportController } from './bug-report.controller';
import { BugReportService } from './bug-report.service';
import { LinearService } from './linear.service';

@Module({
  imports: [ScratchConfigModule, ExperimentsModule],
  controllers: [BugReportController],
  providers: [BugReportService, LinearService],
  exports: [BugReportService], //export this service to use in other modules
})
export class BugReportModule {}
