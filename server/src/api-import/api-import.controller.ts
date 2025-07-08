import { Body, Controller, Post } from '@nestjs/common';
import {
  GenerateCreateRecordRequest,
  GenerateDeleteRecordRequest,
  GeneratePollRecordsRequest,
  GenerateSchemaRequest,
  GenerateUpdateRecordRequest,
  RestApiImportService,
} from './api-import.service';
import {
  executeCreateRecord as executeCreateRecordFn,
  executeUpdateRecord as executeUpdateRecordFn,
} from './function-executor';

// Add a DTO for the execute-poll-records endpoint
export class ExecutePollRecordsDto {
  function: string;
  apiKey: string;
}

// Add a DTO for the execute-delete-record endpoint
export class ExecuteDeleteRecordDto {
  function: string;
  recordId: string;
  apiKey: string;
}

export class ExecuteDeleteRecordRequest {
  functionString: string;
  recordId: string;
  apiKey: string;
}

// Add DTOs for the new endpoints
export class ExecuteCreateRecordRequest {
  functionString: string;
  recordData: Record<string, unknown>;
  apiKey: string;
}

export class ExecuteUpdateRecordRequest {
  functionString: string;
  recordId: string;
  recordData: Record<string, unknown>;
  apiKey: string;
}

// Add DTO for schema execution
export class ExecuteSchemaRequest {
  functionString: string;
  apiKey: string;
}

@Controller('rest/api-import')
export class RestApiImportController {
  constructor(private readonly restApiImportService: RestApiImportService) {}

  @Post('/generate-schema')
  async generateSchema(@Body() data: GenerateSchemaRequest): Promise<{ function: string }> {
    const result = await this.restApiImportService.generateSchema(data);
    return { function: result };
  }

  @Post('/execute-schema')
  async executeSchema(@Body() request: ExecuteSchemaRequest) {
    return this.restApiImportService.executeSchema(request.functionString, request.apiKey);
  }

  @Post('/generate-poll-records')
  async generatePollRecords(@Body() data: GeneratePollRecordsRequest): Promise<{ function: string }> {
    const result = await this.restApiImportService.generatePollRecords(data);

    return { function: result };
  }

  @Post('/generate-delete-record')
  async generateDeleteRecord(@Body() request: GenerateDeleteRecordRequest) {
    return this.restApiImportService.generateDeleteRecord(request);
  }

  @Post('/execute-poll-records')
  async executePollRecords(@Body() body: ExecutePollRecordsDto) {
    return this.restApiImportService.executePollRecords(body.function, body.apiKey);
  }

  @Post('/execute-delete-record')
  async executeDeleteRecord(@Body() request: ExecuteDeleteRecordRequest) {
    return this.restApiImportService.executeDeleteRecord(request.functionString, request.recordId, request.apiKey);
  }

  @Post('/generate-create-record')
  async generateCreateRecord(@Body() request: GenerateCreateRecordRequest) {
    return this.restApiImportService.generateCreateRecord(request);
  }

  @Post('/execute-create-record')
  async executeCreateRecord(@Body() request: ExecuteCreateRecordRequest) {
    return await executeCreateRecordFn(request.functionString, request.recordData, request.apiKey);
  }

  @Post('/generate-update-record')
  async generateUpdateRecord(@Body() request: GenerateUpdateRecordRequest) {
    return this.restApiImportService.generateUpdateRecord(request);
  }

  @Post('/execute-update-record')
  async executeUpdateRecord(@Body() request: ExecuteUpdateRecordRequest) {
    return await executeUpdateRecordFn(request.functionString, request.recordId, request.recordData, request.apiKey);
  }
}
