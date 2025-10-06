import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { JobEntity, JobProgressEntity } from './entities/job.entity';
import { JobService } from './job.service';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @UseGuards(ScratchpadAuthGuard)
  @Get()
  async getJobs(
    @Req() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<JobEntity[]> {
    const userId = req.user.id;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    return this.jobService.getJobsByUserId(userId, limitNum, offsetNum);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get(':jobId/progress')
  async getJobProgress(@Param('jobId') jobId: string): Promise<JobProgressEntity> {
    return this.jobService.getJobProgress(jobId);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':jobId/cancel')
  async cancelJob(@Param('jobId') jobId: string): Promise<{ success: boolean; message: string }> {
    return await this.jobService.cancelJob(jobId);
  }
}
