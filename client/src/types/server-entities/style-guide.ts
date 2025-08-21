export interface StyleGuide {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  body: string;
  userId: string;
  autoInclude: boolean;
  sourceUrl: string | null;
  contentType: string;
  lastDownloadedAt: string | null;
  tags: string[];
}

export interface CreateStyleGuideDto {
  name: string;
  body: string;
  autoInclude: boolean;
  sourceUrl?: string;
  contentType?: string;
  tags: string[];
}

export interface UpdateStyleGuideDto {
  name?: string;
  body?: string;
  autoInclude?: boolean;
  sourceUrl?: string;
  contentType?: string;
  tags?: string[];
}