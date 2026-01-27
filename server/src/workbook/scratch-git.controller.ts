import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { WorkbookId } from '@spinner/shared-types';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import { ScratchGitService } from 'src/scratch-git/scratch-git.service';
import { userToActor } from 'src/users/types';

@Controller('scratch-git')
@UseGuards(ScratchpadAuthGuard)
export class ScratchGitController {
  constructor(private readonly scratchGitService: ScratchGitService) {}

  @Post(':id/backup')
  async backupToRepo(@Param('id') workbookId: string, @Req() req: any): Promise<{ success: boolean; message: string }> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return this.scratchGitService.backupWorkbookToRepo(workbookId as WorkbookId, userToActor(req.user));
  }
}
