import { Injectable } from '@nestjs/common';
import { JobHandlerService } from '../job-handler.service';

@Injectable()
export class WorkerPoolService {
  constructor(private readonly jobHandlerService: JobHandlerService) {}

  // async executeJob(task: JobData): Promise<JobResult> {
  //   try {
  //     const handler = this.jobHandlerService.getHandler(task);
  //     const result = await handler.run(task, (progress) => progress);
  //     return result as JobResult;
  //   } catch (error) {
  //     return {
  //       success: false,
  //       error: error instanceof Error ? error.message : 'Unknown error',
  //       executionTime: 0,
  //     };
  //   }
  // }
}
