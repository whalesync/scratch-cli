/* eslint-disable @typescript-eslint/no-namespace */
import { Prisma } from '@prisma/client';

export namespace UserCluster {
  export type User = Prisma.UserGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.UserDefaultArgs>()({
    include: { apiTokens: true, organization: { include: { subscriptions: true } } },
  });
}

export namespace SnapshotCluster {
  export type Snapshot = Prisma.SnapshotGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.SnapshotDefaultArgs>()({
    include: {
      connectorAccount: true,
      snapshotTables: {
        include: {
          connectorAccount: true,
        },
      },
    },
  });
}

export namespace SnapshotTableCluster {
  export type SnapshotTable = Prisma.SnapshotTableGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.SnapshotTableDefaultArgs>()({
    include: { connectorAccount: true },
  });
}

export namespace StyleGuideCluster {
  export type StyleGuide = Prisma.StyleGuideGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.StyleGuideDefaultArgs>()({});
}
