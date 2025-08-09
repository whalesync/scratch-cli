export interface StyleGuide {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  body: string;
  userId: string;
  autoInclude: boolean;
}

export interface CreateStyleGuideDto {
  name: string;
  body: string;
  autoInclude: boolean;
}

export interface UpdateStyleGuideDto {
  name?: string;
  body?: string;
  autoInclude?: boolean;
}