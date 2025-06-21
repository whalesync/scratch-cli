export enum EditSessionStatus {
  CREATING = "CREATING",
  EDITING = "EDITING",
  COMMITTING = "COMMITTING",
  DONE = "DONE",
  CANCELLED = "CANCELLED",
}

export interface EditSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: EditSessionStatus;
  connectorAccountId: string;
}

export interface CreateEditSessionDto {
  connectorAccountId: string;
}

export interface UpdateEditSessionDto {
  status: EditSessionStatus.COMMITTING | EditSessionStatus.CANCELLED;
}
