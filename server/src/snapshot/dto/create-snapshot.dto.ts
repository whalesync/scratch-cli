import { IsString } from 'class-validator';
import { ConnectorAccountId } from 'src/types/ids';

export class CreateSnapshotDto {
  @IsString()
  connectorAccountId: ConnectorAccountId;
}
