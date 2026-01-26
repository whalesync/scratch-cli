import { IsOptional, IsString } from 'class-validator';

export class MoveDataFolderDto {
  @IsOptional()
  @IsString()
  parentFolderId?: string | null;
}

export type ValidatedMoveDataFolderDto = Pick<MoveDataFolderDto, 'parentFolderId'>;
