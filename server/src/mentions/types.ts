export type MentionsSearchRequestDto = {
  text: string;
  snapshotId: string;
  tableId?: string; // optional; demo may hardcode on client
};

export type ResourceMentionEntity = {
  id: string;
  title: string;
  preview: string;
};

export type RecordMentionEntity = {
  id: string; // record wsId
  title: string;
  tableId: string;
};

export type MentionsSearchResponseDto = {
  resources: ResourceMentionEntity[];
  records: RecordMentionEntity[];
};
