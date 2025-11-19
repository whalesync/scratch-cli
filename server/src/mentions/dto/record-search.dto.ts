import { IsNotEmpty, IsString } from 'class-validator';

export class MentionsSearchRecordsRequestDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsNotEmpty()
  workbookId: string;

  @IsString()
  @IsNotEmpty()
  tableId: string;
}
