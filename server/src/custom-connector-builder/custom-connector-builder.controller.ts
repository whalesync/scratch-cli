import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import type {
  GenerateCreateRecordFunctionRequest,
  GenerateDeleteRecordFunctionRequest,
  GenerateListTablesFunctionRequest,
  GeneratePollRecordsFunctionRequest,
  GenerateUpdateRecordFunctionRequest,
} from './custom-connector-builder.service';
import { RestApiImportService } from './custom-connector-builder.service';

// Add a DTO for the execute-poll-records endpoint
export class ExecutePollRecordsDto {
  function: string;
  apiKey: string;
  tableId: string[];
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
  tableId: string[];
}

// Add DTOs for the new endpoints
export class ExecuteCreateRecordRequest {
  functionString: string;
  recordData: Record<string, unknown>;
  apiKey: string;
  tableId: string[];
}

export class ExecuteUpdateRecordRequest {
  functionString: string;
  recordId: string;
  recordData: Record<string, unknown>;
  apiKey: string;
  tableId: string[];
}

// Add DTO for schema execution
export class ExecuteSchemaRequest {
  functionString: string;
  apiKey: string;
  tableId: string[];
}

// Add DTO for list tables execution
export class ExecuteListTablesRequest {
  functionString: string;
  apiKey: string;
}

@Controller('rest/custom-connector-builder')
@UseGuards(ScratchpadAuthGuard)
export class RestApiImportController {
  constructor(private readonly restApiImportService: RestApiImportService) {}

  @Post('/generate-schema/:connectorId')
  async generateSchema(
    @Req() req: RequestWithUser,
    @Param('connectorId') connectorId: string,
  ): Promise<{ function: string }> {
    if (!req.user) {
      throw new Error('User not found');
    }
    const result = await this.restApiImportService.generateFetchSchemaFunction(req.user.id, connectorId);
    return { function: result };
  }

  @Post('/execute-schema')
  async executeSchema(@Body() request: ExecuteSchemaRequest) {
    return this.restApiImportService.executeSchema(request.functionString, request.apiKey, request.tableId);
  }

  @Post('/generate-poll-records')
  async generatePollRecords(@Body() data: GeneratePollRecordsFunctionRequest): Promise<{ function: string }> {
    const result = await this.restApiImportService.generatePollRecordsFunction(data);

    return { function: result };
  }

  @Post('/generate-delete-record')
  async generateDeleteRecord(@Body() request: GenerateDeleteRecordFunctionRequest): Promise<{ function: string }> {
    const result = await this.restApiImportService.generateDeleteRecordFunction(request);
    return { function: result };
  }

  @Post('/execute-poll-records')
  async executePollRecords(@Body() body: ExecutePollRecordsDto) {
    return this.restApiImportService.executePollRecords(body.function, body.apiKey, body.tableId);
  }

  @Post('/execute-delete-record')
  async executeDeleteRecord(@Body() request: ExecuteDeleteRecordRequest) {
    return this.restApiImportService.executeDeleteRecord(
      request.functionString,
      request.recordId,
      request.apiKey,
      request.tableId,
    );
  }

  @Post('/generate-create-record')
  async generateCreateRecord(@Body() request: GenerateCreateRecordFunctionRequest): Promise<{ function: string }> {
    const result = await this.restApiImportService.generateCreateRecordFunction(request);
    return { function: result };
  }

  @Post('/execute-create-record')
  async executeCreateRecord(@Body() request: ExecuteCreateRecordRequest) {
    return this.restApiImportService.executeCreateRecord(
      request.functionString,
      request.recordData,
      request.apiKey,
      request.tableId,
    );
  }

  @Post('/generate-update-record')
  async generateUpdateRecord(@Body() request: GenerateUpdateRecordFunctionRequest): Promise<{ function: string }> {
    const result = await this.restApiImportService.generateUpdateRecordFunction(request);
    return { function: result };
  }

  @Post('/execute-update-record')
  async executeUpdateRecord(@Body() request: ExecuteUpdateRecordRequest) {
    return this.restApiImportService.executeUpdateRecord(
      request.functionString,
      request.recordId,
      request.recordData,
      request.apiKey,
      request.tableId,
    );
  }

  @Post('/generate-list-tables')
  async generateListTables(@Body() data: GenerateListTablesFunctionRequest): Promise<{ function: string }> {
    const result = await this.restApiImportService.generateListTablesFunction(data);
    return { function: result };
  }

  @Post('/execute-list-tables')
  async executeListTables(@Body() request: ExecuteListTablesRequest) {
    return this.restApiImportService.executeListTables(request.functionString, request.apiKey);
  }
}
