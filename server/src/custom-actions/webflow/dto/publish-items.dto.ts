import { IsArray, IsString } from 'class-validator';

export class WebflowPublishItemsDto {
  @IsString()
  snapshotTableId: string;

  @IsArray()
  @IsString({ each: true })
  recordIds: string[];
}
