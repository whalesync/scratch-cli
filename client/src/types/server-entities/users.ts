export interface User {
  id: string;
  clerkId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  // @deprecated - use agentToken or websocketToken instead
  apiToken?: string;
  agentToken?: string;
  websocketToken?: string;
}
