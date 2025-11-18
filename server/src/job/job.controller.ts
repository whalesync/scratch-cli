import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { dbJobToJobEntity, JobEntity } from './entities/job.entity';
import { JobService } from './job.service';

@Controller('jobs')
@UseGuards(ScratchpadAuthGuard)
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Get()
  async getJobs(
    @Req() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<JobEntity[]> {
    const userId = req.user.id;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    const dbJobs = await this.jobService.getJobsByUserId(userId, limitNum, offsetNum);
    return dbJobs.map(dbJobToJobEntity);
  }

  @Get(':jobId/progress')
  async getJobProgress(@Param('jobId') jobId: string): Promise<JobEntity> {
    return this.jobService.getJobProgress(jobId);
  }

  @Post(':jobId/cancel')
  async cancelJob(@Param('jobId') jobId: string): Promise<{ success: boolean; message: string }> {
    return await this.jobService.cancelJob(jobId);
  }
}
