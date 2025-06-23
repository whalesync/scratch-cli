import { Body, Controller, Post } from '@nestjs/common';
import {
  GenerateFetchRequest,
  GenerateFetchResponse,
  RestApiImportService,
} from './api-import.service';

@Controller('rest/api-import')
export class RestApiImportController {
  constructor(private readonly restApiImportService: RestApiImportService) {}

  @Post('/generate-fetch')
  async generateFetch(
    @Body() data: GenerateFetchRequest,
  ): Promise<GenerateFetchResponse> {
    const result = await this.restApiImportService.generateFetch(data);

    return result;
  }

  @Post('/fetch')
  async fetch(@Body() data: GenerateFetchResponse): Promise<unknown> {
    const result = await this.restApiImportService.fetch(data);

    return result;
  }
}
