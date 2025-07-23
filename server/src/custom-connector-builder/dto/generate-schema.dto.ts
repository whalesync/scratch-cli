import { IsString } from 'class-validator';

export class GenerateSchemaRequest {
  @IsString()
  prompt: string;
}
