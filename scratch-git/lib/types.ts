export interface CommitOptions {
  message: string;
  author?: {
    name: string;
    email: string;
  };
}

export interface FileChange {
  path: string;
  content?: string;
  type: "add" | "modify" | "delete";
}

export interface GitFile {
  name: string;
  path: string;
  type: "file" | "directory";
}

export interface DirtyFile {
  path: string;
  status: "added" | "modified" | "deleted";
}

export interface IGitService {
  getRepoPath(repoId: string): string;
  initRepo(repoId: string): Promise<void>;
  deleteRepo(repoId: string): Promise<void>;

  list(repoId: string, branch: string, folderPath: string): Promise<GitFile[]>;

  getFile(
    repoId: string,
    branch: string,
    filePath: string,
  ): Promise<string | null>;
  fileExists(
    repoId: string,
    branch: string,
    filePath: string,
  ): Promise<boolean>;

  commitFiles(
    repoId: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    message: string,
  ): Promise<void>;
  deleteFiles(
    repoId: string,
    branch: string,
    filePaths: string[],
    message: string,
  ): Promise<void>;

  rebaseDirty(
    repoId: string,
  ): Promise<{ rebased: boolean; conflicts: string[] }>;
  getDirtyStatus(repoId: string): Promise<DirtyFile[]>;
  getFileDiff(
    repoId: string,
    filePath: string,
  ): Promise<{ main: string | null; dirty: string | null } | null>;
}
