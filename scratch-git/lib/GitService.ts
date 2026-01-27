import path from "path";
import { CommitOptions, IGitService } from "./types";
import * as gitLib from "./git-utils";

export class GitService implements IGitService {
  private _resolveId(repoId: string): string {
    return repoId.endsWith(".git") ? repoId : `${repoId}.git`;
  }

  public getRepoPath(repoId: string): string {
    return gitLib.getRepoPath(this._resolveId(repoId));
  }

  public async initRepo(repoId: string): Promise<void> {
    return gitLib.initRepo(this._resolveId(repoId));
  }

  public async readFile(
    repoId: string,
    filePath: string,
    ref: string = "main",
  ): Promise<string | null> {
    return gitLib.readFileFromBranch(this._resolveId(repoId), ref, filePath);
  }

  public async statelessCommit(
    repoId: string,
    files: { path: string; content: string | null }[],
    options: CommitOptions,
  ): Promise<void> {
    // Map files to FileChange format
    const changes: gitLib.FileChange[] = files.map((f) => {
      if (f.content === null) {
        return {
          path: f.path,
          type: "delete",
        };
      }
      return {
        path: f.path,
        content: f.content,
        // We use 'modify' which handles both creation and update in the provided lib logic
        type: "modify",
      };
    });

    // We assume statelessCommit targets main by default,
    // as that was the behavior of the previous implementation (push origin main)
    await gitLib.commitChangesToRef(
      this._resolveId(repoId),
      "main",
      changes,
      options.message,
    );
  }

  public async createDirtyBranch(
    repoId: string,
    userId: string,
  ): Promise<void> {
    return gitLib.createDirtyBranch(this._resolveId(repoId), userId);
  }
}
