import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { WorkbookId } from '@spinner/shared-types';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { userToActor } from 'src/users/types';
import { ScratchGitService } from './scratch-git.service';

@Controller('scratch-git')
@UseGuards(ScratchpadAuthGuard)
export class ScratchGitController {
  constructor(private readonly scratchGitService: ScratchGitService) {}

  @Post(':id/backup')
  async backupToRepo(
    @Param('id') workbookId: WorkbookId,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; message: string }> {
    return this.scratchGitService.backupWorkbookToRepo(workbookId, userToActor(req.user));
  }
}
