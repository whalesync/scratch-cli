export class FolderProgressDto {
  readonly id?: string;
  readonly name?: string;
  readonly connector?: string;
  readonly files?: number;
  readonly status?: string;
}

export class JobProgressDto {
  readonly totalFiles?: number;
  readonly folders?: FolderProgressDto[];
}

export class JobStatusResponseDto {
  readonly jobId?: string;
  readonly state?: string;
  readonly progress?: JobProgressDto;
  readonly error?: string;
  readonly failedReason?: string;
}
