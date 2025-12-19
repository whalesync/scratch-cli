import { ResourceContentType } from '@spinner/shared-types';

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
