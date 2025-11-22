import { IsString } from 'class-validator';

export class WebflowPublishSiteDto {
  @IsString()
  snapshotTableId?: string;
}

export type ValidatedWebflowPublishSiteDto = Required<WebflowPublishSiteDto>;
