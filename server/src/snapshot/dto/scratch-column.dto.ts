import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { PostgresColumnType } from 'src/remote-service/connectors/types';

export class AddScratchColumnDto {
  @IsString()
  @IsNotEmpty()
  columnName: string;

  @IsEnum(PostgresColumnType)
  dataType: PostgresColumnType;
}

export class RemoveScratchColumnDto {
  @IsString()
  @IsNotEmpty()
  columnId: string;
}
