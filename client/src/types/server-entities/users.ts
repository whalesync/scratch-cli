export interface User {
  id: string;
  clerkId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  apiToken?: string;
}
