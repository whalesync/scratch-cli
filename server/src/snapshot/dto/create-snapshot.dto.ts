import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import { ConnectorAccountId } from 'src/types/ids';
import { EntityId } from '../../remote-service/connectors/types';

export class CreateSnapshotDto {
  @IsString()
  connectorAccountId: ConnectorAccountId;

  @IsString()
  name: string;

  @IsArray()
  @ArrayNotEmpty()
  tableIds: EntityId[];
}
