import { IsNotEmpty, IsString } from 'class-validator';

export class MentionsSearchResourcesRequestDto {
  @IsString()
  @IsNotEmpty()
  text?: string;
}

export type ValidatedMentionsSearchResourcesRequestDto = Required<MentionsSearchResourcesRequestDto>;
