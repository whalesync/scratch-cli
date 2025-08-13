export interface User {
  id: string;
  clerkId: string;
  createdAt: Date;
  updatedAt: Date;
  agentToken?: string;
  websocketToken?: string;
  isAdmin: boolean;
}
