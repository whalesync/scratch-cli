import { EditSessionStatus, EditSession as PrismaEditSession } from '@prisma/client';

export class EditSession implements PrismaEditSession {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: EditSessionStatus;
  connectorAccountId: string;
}
