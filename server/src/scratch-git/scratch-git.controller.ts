import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { WorkbookId } from '@spinner/shared-types';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import { ScratchGitService } from './scratch-git.service';

@Controller('scratch-git')
@UseGuards(ScratchpadAuthGuard)
export class ScratchGitController {
  constructor(private readonly scratchGitService: ScratchGitService) {}

  @Get(':id/list')
  async listRepoFiles(
    @Param('id') workbookId: WorkbookId,
    @Query('branch') branch = 'main',
    @Query('folder') folder = '',
  ): Promise<any[]> {
    return this.scratchGitService.listRepoFiles(workbookId, branch, folder);
  }

  @Get(':id/file')
  async getRepoFile(
    @Param('id') workbookId: WorkbookId,
    @Query('branch') branch = 'main',
    @Query('path') path: string,
  ): Promise<{ content: string }> {
    return this.scratchGitService.getRepoFile(workbookId, branch, path);
  }
  @Get(':id/git-status')
  async getRepoStatus(@Param('id') workbookId: WorkbookId): Promise<unknown> {
    console.log(`[ScratchGitController] getRepoStatus called for ${workbookId}`);
    return this.scratchGitService.getRepoStatus(workbookId);
  }

  @Get(':id/git-diff')
  async getFileDiff(@Param('id') workbookId: WorkbookId, @Query('path') path: string): Promise<unknown> {
    console.log(`[ScratchGitController] getFileDiff called for ${workbookId} path=${path}`);
    return this.scratchGitService.getFileDiff(workbookId, path);
  }
}
