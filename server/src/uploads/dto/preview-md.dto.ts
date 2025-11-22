export interface MdFieldValue {
  value: unknown;
  type: string;
}

export class PreviewMdResponseDto {
  data?: Record<string, MdFieldValue>; // Front matter with type info
  PAGE_CONTENT?: string; // Markdown content
}
