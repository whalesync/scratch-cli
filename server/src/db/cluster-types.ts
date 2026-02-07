/* eslint-disable @typescript-eslint/no-namespace */
import { Prisma } from '@prisma/client';

export namespace UserCluster {
  export type User = Prisma.UserGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.UserDefaultArgs>()({
    include: { apiTokens: true, organization: { include: { subscriptions: true } } },
  });
}

export namespace WorkbookCluster {
  export type Workbook = Prisma.WorkbookGetPayload<typeof _validator>;
  export type DataFolder = Workbook['dataFolders'][number];

  export const _validator = Prisma.validator<Prisma.WorkbookDefaultArgs>()({
    include: {
      dataFolders: {
        include: { connectorAccount: true },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });
}

export namespace StyleGuideCluster {
  export type StyleGuide = Prisma.StyleGuideGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.StyleGuideDefaultArgs>()({});
}

export namespace DataFolderCluster {
  export type DataFolder = Prisma.DataFolderGetPayload<typeof _validator>;

  export const _validator = Prisma.validator<Prisma.DataFolderDefaultArgs>()({
    include: { connectorAccount: true },
  });
}
