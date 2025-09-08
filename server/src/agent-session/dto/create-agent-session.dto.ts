import { IsObject, IsString } from 'class-validator';

export class CreateAgentSessionDto {
  @IsString()
  id: string;

  @IsString()
  userId: string;

  @IsString()
  snapshotId: string;

  @IsObject()
  data: any;
}
