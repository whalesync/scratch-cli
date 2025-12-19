import { StyleGuideId } from '../ids';

export type ResourceContentType = 'markdown' | 'json' | 'text';
export const DEFAULT_CONTENT_TYPE: ResourceContentType = 'markdown';

///
/// NOTE: Keep this in sync with server/prisma/schema.prisma StyleGuide model
/// Begin "keep in sync" section
///

export interface StyleGuide {
  id: StyleGuideId;
  createdAt: string;
  updatedAt: string;
  name: string;
  body: string;
  userId: string;
  organizationId: string;
  autoInclude: boolean;
  sourceUrl: string | null;
  contentType: ResourceContentType;
  lastDownloadedAt: string | null;
  tags: string[];
}

///
/// End "keep in sync" section
///
