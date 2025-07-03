/* eslint-disable @typescript-eslint/no-namespace */
import { Prisma } from '@prisma/client';

export namespace UserCluster {
  export type User = Prisma.UserGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.UserDefaultArgs>()({
    include: { apiTokens: true },
  });
}

export namespace SnapshotCluster {
  export type Snapshot = Prisma.SnapshotGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.SnapshotDefaultArgs>()({
    include: { connectorAccount: true },
  });
}
