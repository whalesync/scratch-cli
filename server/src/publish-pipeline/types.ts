export type PipelinePhaseType = 'edit' | 'create' | 'delete' | 'backfill';

export interface PipelinePhase {
  type: PipelinePhaseType;
  recordCount: number;
  commitHash?: string;
}

export interface PipelineInfo {
  pipelineId: string;
  workbookId: string;
  userId: string;
  phases: PipelinePhase[];
  branchName: string;
  createdAt: Date;
  status: string;
}
