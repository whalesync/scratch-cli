import { IsString } from 'class-validator';

export class WebflowPublishSiteDto {
  @IsString()
  snapshotTableId: string;
}
