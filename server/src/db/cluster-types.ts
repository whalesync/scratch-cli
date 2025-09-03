/* eslint-disable @typescript-eslint/no-namespace */
import { Prisma } from '@prisma/client';

export namespace UserCluster {
  export type User = Prisma.UserGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.UserDefaultArgs>()({
    include: { apiTokens: true, subscriptions: true },
  });
}

export namespace SnapshotCluster {
  export type Snapshot = Prisma.SnapshotGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.SnapshotDefaultArgs>()({
    include: { connectorAccount: true },
  });
}

export namespace StyleGuideCluster {
  export type StyleGuide = Prisma.StyleGuideGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.StyleGuideDefaultArgs>()({});
}

export namespace CsvFileCluster {
  export type CsvFile = Prisma.CsvFileGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.CsvFileDefaultArgs>()({});
}
