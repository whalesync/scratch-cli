import { Body, Controller, Post } from '@nestjs/common';
import { GenerateDeleteRecordRequest, GeneratePollRecordsRequest, RestApiImportService } from './api-import.service';

// Add a DTO for the execute-poll-records endpoint
export class ExecutePollRecordsDto {
  function: string;
  apiKey: string;
}

@Controller('rest/api-import')
export class RestApiImportController {
  constructor(private readonly restApiImportService: RestApiImportService) {}

  @Post('/generate-poll-records')
  async generatePollRecords(@Body() data: GeneratePollRecordsRequest): Promise<{ function: string }> {
    const result = await this.restApiImportService.generatePollRecords(data);

    return { function: result };
  }

  @Post('/generate-delete-record')
  async generateDeleteRecord(@Body() data: GenerateDeleteRecordRequest): Promise<{ function: string }> {
    const result = await this.restApiImportService.generateDeleteRecord(data);

    return { function: result };
  }

  @Post('/execute-poll-records')
  async executePollRecords(@Body() body: ExecutePollRecordsDto) {
    return this.restApiImportService.executePollRecords(body.function, body.apiKey);
  }
}
