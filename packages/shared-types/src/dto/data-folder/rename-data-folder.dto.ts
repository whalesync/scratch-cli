import { IsNotEmpty, IsString } from 'class-validator';

export class RenameDataFolderDto {
  @IsNotEmpty()
  @IsString()
  name?: string;
}

export type ValidatedRenameDataFolderDto = Required<Pick<RenameDataFolderDto, 'name'>>;
