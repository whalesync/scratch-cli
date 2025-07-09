import { IsNotEmpty, IsString } from 'class-validator';

export class CreateStyleGuideDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  body: string;
}
