import { Organization as PrismaOrganization } from '@prisma/client';

export class Organization {
  id: string;
  clerkId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(organization: PrismaOrganization) {
    this.id = organization.id;
    this.clerkId = organization.clerkId;
    this.name = organization.name;
    this.createdAt = organization.createdAt;
    this.updatedAt = organization.updatedAt;
  }
}
