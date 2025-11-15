import { StyleGuideId } from './ids';

export type ResourceContentType = 'markdown' | 'json' | 'text';
export const DEFAULT_CONTENT_TYPE: ResourceContentType = 'markdown';

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

export interface CreateStyleGuideDto {
  name: string;
  body: string;
  autoInclude: boolean;
  sourceUrl?: string;
  contentType?: ResourceContentType;
  tags: string[];
}

export interface UpdateStyleGuideDto {
  name?: string;
  body?: string;
  autoInclude?: boolean;
  sourceUrl?: string;
  contentType?: ResourceContentType;
  tags?: string[];
}

export interface ExternalContent {
  url: string;
  contentType: ResourceContentType;
  content: string;
}
