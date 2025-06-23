import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import { ConnectorAccountId } from 'src/types/ids';

export class CreateSnapshotDto {
  @IsString()
  connectorAccountId: ConnectorAccountId;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  tablePaths: string[];
}
