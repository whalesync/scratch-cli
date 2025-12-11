import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class ReesolveRemoteDeletesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recordWsIds?: string[];

  @IsEnum(['create', 'delete'])
  action?: 'create' | 'delete';
}

export type ValidatedHandleRemoteDeletesDto = Required<Omit<ReesolveRemoteDeletesDto, 'recordWsIds'>> & {
  recordWsIds?: string[];
};
