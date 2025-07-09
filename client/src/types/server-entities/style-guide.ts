export interface StyleGuide {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  body: string;
  userId: string;
}

export interface CreateStyleGuideDto {
  name: string;
  body: string;
}

export interface UpdateStyleGuideDto {
  name?: string;
  body?: string;
} 