import { IsNotEmpty, IsString } from 'class-validator';

export class CreateContentSnapshotDto {
  @IsString()
  @IsNotEmpty()
  readonly name: string;
}
