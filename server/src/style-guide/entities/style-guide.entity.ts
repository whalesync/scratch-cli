import { StyleGuideCluster } from 'src/db/cluster-types';

export class StyleGuide {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  body: string;
  userId: string;
  organizationId: string | null;
  autoInclude: boolean;
  sourceUrl: string | null;
  contentType: string;
  lastDownloadedAt: Date | null;
  tags: string[];

  constructor(styleGuide: StyleGuideCluster.StyleGuide) {
    this.id = styleGuide.id;
    this.createdAt = styleGuide.createdAt;
    this.updatedAt = styleGuide.updatedAt;
    this.name = styleGuide.name;
    this.body = styleGuide.body;
    this.userId = styleGuide.userId;
    this.organizationId = styleGuide.organizationId;
    this.autoInclude = styleGuide.autoInclude;
    this.sourceUrl = styleGuide.sourceUrl;
    this.contentType = styleGuide.contentType;
    this.lastDownloadedAt = styleGuide.lastDownloadedAt;
    this.tags = styleGuide.tags ?? [];
  }
}
