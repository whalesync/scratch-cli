///
/// NOTE: Keep this in sync with server/prisma/schema.prisma Organization model
/// Begin "keep in sync" section
///

export interface Organization {
  id: string;
  clerkId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

///
/// End "keep in sync" section
///
