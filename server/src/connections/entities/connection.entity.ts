import { Connection as PrismaConnection, Service } from '@prisma/client';

export class Connection implements PrismaConnection {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  service: Service;
  displayName: string;
  apiKey: string;
}
