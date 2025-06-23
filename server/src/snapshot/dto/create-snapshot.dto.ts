import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import { ConnectorAccountId } from 'src/types/ids';
import { TablePath } from '../../remote-service/connectors/types';

export class CreateSnapshotDto {
  @IsString()
  connectorAccountId: ConnectorAccountId;

  @IsArray()
  @ArrayNotEmpty()
  tablePaths: TablePath[];
}
