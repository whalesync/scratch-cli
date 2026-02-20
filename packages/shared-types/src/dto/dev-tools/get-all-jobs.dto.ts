export interface GetAllJobsResponseDto {
  jobs: {
    dbJobId: string;
    bullJobId?: string | null;
    workbookId?: string | null;
    dataFolderId?: string | null;
    userId: string;
    type: string;
    state: string;
    publicProgress?: Record<string, unknown>;
    processedOn?: string | null;
    finishedOn?: string | null;
    createdAt: string;
    failedReason?: string | null;
  }[];
  total: number;
  limit: number;
  offset: number;
}
