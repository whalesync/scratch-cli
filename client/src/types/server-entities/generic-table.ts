export interface GenericTable {
  id: string; // GenericTableId
  createdAt: string; // DateTime
  updatedAt: string; // DateTime
  name: string;
  fetch: Record<string, unknown> | null;
  mapping: Record<string, unknown> | null;
  userId: string; // UserId
}

export interface CreateGenericTableDto {
  name: string;
  fetch?: Record<string, unknown>;
  mapping?: Record<string, unknown>;
} 