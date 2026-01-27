export interface CommitOptions {
  message: string;
  author?: {
    name: string;
    email: string;
  };
}

export interface IGitService {
  /**
   * Get the filesystem path for a workspace's git repo
   */
  getRepoPath(repoId: string): string;

  /**
   * Initialize a bare git repository
   */
  initRepo(repoId: string): Promise<void>;

  /**
   * Read a file's content directly from the bare repo
   */
  readFile(
    repoId: string,
    filePath: string,
    ref?: string,
  ): Promise<string | null>;

  /**
   * Stateless commit: Clone (partial) -> Edit -> Commit -> Push
   */
  statelessCommit(
    repoId: string,
    files: { path: string; content: string | null }[],
    options: CommitOptions,
  ): Promise<void>;

  /**
   * Create a dirty branch for a user effectively creating a bookmark/backup point
   */
  createDirtyBranch(repoId: string, userId: string): Promise<void>;
}
