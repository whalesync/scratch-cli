export interface User {
  id: string;
  clerkId: string;
  createdAt: Date;
  updatedAt: Date;
  websocketToken?: string;
  isAdmin: boolean;
  agentJwt?: string;
}
