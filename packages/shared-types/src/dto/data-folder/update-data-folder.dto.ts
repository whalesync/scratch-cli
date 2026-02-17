import { IsOptional, IsString } from 'class-validator';

export class UpdateDataFolderDto {
  @IsOptional()
  @IsString()
  filter?: string | null;
}

export type ValidatedUpdateDataFolderDto = Pick<UpdateDataFolderDto, 'filter'>;
