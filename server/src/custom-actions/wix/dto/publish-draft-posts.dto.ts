import { IsArray, IsString } from 'class-validator';

export class WixPublishDraftPostsDto {
  @IsString()
  snapshotTableId: string;

  @IsArray()
  @IsString({ each: true })
  recordIds: string[];
}
