import { $Enums, User as PrismaUser } from '@prisma/client';

export class User implements PrismaUser {
  createdAt: Date;
  updatedAt: Date;
  clerkId: string | null;
  isAdmin: boolean;
  role: $Enums.UserRole;
  id: string;
}
