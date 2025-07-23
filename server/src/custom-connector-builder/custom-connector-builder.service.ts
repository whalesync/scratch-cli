import { Injectable } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';
import {
  executeCreateRecord as executeCreateRecordFn,
  executeDeleteRecord as executeDeleteRecordFn,
  executeListTables,
  executePollRecords as executePollRecordsFn,
  executeSchema as executeSchemaFn,
  executeUpdateRecord as executeUpdateRecordFn,
} from './function-executor';

@Injectable()
export class RestApiImportService {
  private readonly tableIdDescription = `
  // tableId is an array of strings that identifies the table
  // 
  // For services where the account is identified by the API key (most services):
  // - tableId will be: [tableId] (single element)
  // - Use tableId[0] for the table ID
  // 
  // For services with multiple accounts/bases (like Airtable, Notion workspaces):
  // - tableId will be: [baseId/accountId, tableId] (two elements)
  // - Use tableId[0] for base/account ID and tableId[1] for table ID
  // 
  // Determine which case applies based on the service documentation`;

  private readonly tableIdGuidelines = `
- The tableId parameter is an array of strings that identifies the table
- DETERMINE THE TABLE ID STRUCTURE:
  - If the service uses the API key to identify the account (most services): tableId = [tableId]
  - If the service has multiple accounts/bases: tableId = [baseId/accountId, tableId]
- Use tableId[0] for the table ID (or base ID if applicable)
- Use tableId[1] for the table ID only if the service has multiple accounts/bases
- DO NOT hardcode any table IDs in the function body - always use the tableId parameter`;

  constructor(private readonly aiService: AiService) {}

  async executePollRecords(functionString: string, apiKey: string, tableId: string[]): Promise<unknown> {
    return executePollRecordsFn(functionString, apiKey, tableId);
  }

  async executeDeleteRecord(
    functionString: string,
    recordId: string,
    apiKey: string,
    tableId: string[],
  ): Promise<unknown> {
    return executeDeleteRecordFn(functionString, recordId, apiKey, tableId);
  }

  async executeSchema(functionString: string, apiKey: string, tableId: string[]): Promise<unknown> {
    return executeSchemaFn(functionString, apiKey, tableId);
  }

  async executeCreateRecord(
    functionString: string,
    recordData: Record<string, unknown>,
    apiKey: string,
    tableId: string[],
  ): Promise<unknown> {
    return executeCreateRecordFn(functionString, recordData, apiKey, tableId);
  }

  async executeUpdateRecord(
    functionString: string,
    recordId: string,
    recordData: Record<string, unknown>,
    apiKey: string,
    tableId: string[],
  ): Promise<unknown> {
    return executeUpdateRecordFn(functionString, recordId, recordData, apiKey, tableId);
  }

  async executeListTables(functionString: string, apiKey: string): Promise<unknown> {
    return executeListTables(functionString, apiKey);
  }

  async generateListTablesFunction(request: GenerateListTablesFunctionRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for listing tables from APIs. Based on the user's request, generate a JavaScript function that uses fetch() to retrieve a list of available tables and returns them in a standardized format.

IMPORTANT: There are two types of services you need to handle differently:

1. OPINIONATED SCHEMA SERVICES (CRMs, Task Tracking apps, etc.):
   - These have predefined business entities with static schemas
   - Examples: Salesforce (Accounts, Contacts, Opportunities), HubSpot (Companies, Contacts, Deals), Asana (Projects, Tasks, Teams)
   - Each table corresponds to a specific business entity
   - The schema is usually well-defined and consistent
   - You can often return a static list of tables if the documentation is clear
   - If the service has an API endpoint to fetch available objects/entities, use that instead

2. FLEXIBLE SCHEMA SERVICES (Spreadsheet-like apps):
   - These allow users to create custom tables with flexible schemas
   - Examples: Airtable, Google Sheets, Notion databases, Supabase
   - All tables are equal and user-defined
   - Tables are typically available through a dedicated endpoint
   - You need to fetch the actual list of tables from the API

The function should have this structure:
async function listTables(apiKey) {
  // For OPINIONATED SCHEMA services, you might return a static list:
  // if (serviceType === 'opinionated') {
  //   return [
  //     { id: ['account', 'accounts'], displayName: 'Accounts' },
  //     { id: ['account', 'contacts'], displayName: 'Contacts' },
  //     { id: ['account', 'opportunities'], displayName: 'Opportunities' }
  //   ];
  // }
  
  // For FLEXIBLE SCHEMA services, fetch from API:
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": \`Bearer \${apiKey}\`,
      "Content-Type": "application/json",
      // other appropriate headers
    },
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to fetch tables: \${response.statusText}\`);
  }
  
  const data = await response.json();
  
  // Transform the API response into standardized format
  // The function should extract table information and convert it to:
  // Array of { id: string[], displayName: string }
  
  // For services that have multiple bases/accounts:
  // 1. First, list all bases/accounts associated with the API key
  // 2. Then, for each base/account, fetch all its tables
  // 3. Combine all tables from all bases/accounts into a single array
  // 4. Use the format: id: [baseId/accountId, tableId] for compound identification
  
  // Example transformation logic for multi-account services:
  // const bases = await fetchBases(apiKey);
  // const allTables = [];
  // for (const base of bases) {
  //   const tables = await fetchTablesForBase(apiKey, base.id);
  //   allTables.push(...tables.map(table => ({
  //     id: [base.id, table.id], // [baseId, tableId]
  //     displayName: \`\${base.name} - \${table.name}\`
  //   })));
  // }
  // return allTables;
  
  // For single-account services, use simpler logic:
  // const tables = data.tables || data.bases || data.workspaces || data;
  // return tables.map(table => ({
  //   id: [table.baseId || table.id, table.tableId || table.name], // [accountId, tableId]
  //   displayName: table.name || table.displayName || table.title
  // }));
  
  // Return the standardized format
  return standardizedTables;
}

Guidelines:
- FIRST: Determine if this is an OPINIONATED SCHEMA service or FLEXIBLE SCHEMA service
- For OPINIONATED SCHEMA services (CRMs, task trackers):
  - Check if the documentation provides a clear list of available objects/entities
  - If yes, return a static list of the main business entities
  - If no, look for an API endpoint that lists available objects (e.g., /objects, /entities, /metadata)
  - Use meaningful display names that match the business terminology
- For FLEXIBLE SCHEMA services (spreadsheet-like):
  - Always fetch the actual list of tables from the API
  - Look for endpoints like /tables, /bases, /databases, /sheets, etc.
  - Handle multi-account scenarios properly
- The function should be named "listTables"
- It should take an "apiKey" parameter
- Use GET method for the fetch call
- Include the API key in the Authorization header (e.g., "Authorization": "Bearer \${apiKey}")
- Include appropriate headers (e.g., "Content-Type": "application/json")
- Include error handling for non-2xx responses
- The function MUST return an array of objects with this exact structure:
  [
    {
      id: string[],        // Array of strings for compound table identification: [baseId/accountId, tableId]
      displayName: string  // Human-readable table name
    }
  ]
- For services with multiple bases/accounts (like Airtable, Notion workspaces, etc.):
  - First fetch all bases/accounts associated with the API key
  - Then fetch all tables from each base/account
  - Combine all tables into a single array
  - Use the format: id: [baseId/accountId, tableId] for compound identification
  - Include the base/account name in the displayName for clarity
- For single-account services, use: id: [accountId, tableId]
- Transform the API response to match this standardized format
- Handle different API response structures (arrays, objects with tables/bases/workspaces properties, etc.)
- The id should be an array of strings since tables are usually identified by multiple parameters (e.g., base ID + table ID)
- CRITICAL: Return ONLY the JavaScript function code itself, no JSON wrapper, no explanations, no markdown formatting
- Do NOT wrap the function in {"function": "..."} or any other JSON structure
- Do NOT include \`\`\`javascript or \`\`\` code blocks
- The function should be valid JavaScript that can be executed directly

User request: ${request.prompt}

Generate only the JavaScript function:
    `;

    const result = await this.aiService.generate(aiPrompt);

    // Clean up the response to extract just the function
    let cleanedResponse = result.trim();

    // Remove common formatting artifacts
    cleanedResponse = cleanedResponse.replace(/```javascript\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```js\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    cleanedResponse = cleanedResponse.trim();

    return cleanedResponse;
  }

  async generateFetchSchemaFunction(request: GenerateFetchSchemaFunctionRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for fetching table schemas from APIs. 
Based on the user's request, generate a JavaScript function that uses fetch() to retrieve the table schema and returns it in a standardized format.

The function should have this structure:
async function fetchSchema(apiKey, tableId) {
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": \`Bearer \${apiKey}\`,
      "Content-Type": "application/json",
      // other appropriate headers
    },
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to fetch schema: \${response.statusText}\`);
  }
  
  const data = await response.json();
  
  // Transform the API response into standardized schema format
  // The function should extract schema information and convert it to:
  // Array of { id: string, displayName: string, type: string }
  
  // Example transformation logic (adapt based on the API structure):
  // const schemaFields = data.fields || data.columns || data.properties || [];
  // return schemaFields.map(field => ({
  //   id: field.id || field.name || field.key,
  //   displayName: field.displayName || field.label || field.name || field.key,
  //   type: mapApiTypeToPostgresType(field.type || field.dataType)
  // }));
  
  // Return the standardized schema format
  return standardizedSchema;
}

Guidelines:
- The function should be named "fetchSchema"
- It should take TWO parameters: "apiKey" (string) and "tableId" (string[])
${this.tableIdGuidelines}
- Use GET method for the fetch call
- Include the API key in the Authorization header (e.g., "Authorization": "Bearer \${apiKey}")
- Include appropriate headers (e.g., "Content-Type": "application/json")
- Include error handling for non-2xx responses
- The function MUST return an array of objects with this exact structure:
  [
    {
      id: string,           // Field identifier (used as column name)
      displayName: string,  // Human-readable field name
      type: string          // PostgreSQL column type (text, numeric, boolean, jsonb, etc.)
    }
  ]
- Map API field types to PostgreSQL types appropriately:
  - text, string, varchar → "text"
  - number, integer, float → "numeric"
  - boolean → "boolean"
  - object, json → "jsonb"
  - array → "text[]" (for simple arrays) or "jsonb" (for complex arrays)
- For some services, the schema might be static (no API call needed)
- For others, you may need to call a specific endpoint to get schema information
- CRITICAL: Return ONLY the JavaScript function code itself, no JSON wrapper, no explanations, no markdown formatting
- Do NOT wrap the function in {"function": "..."} or any other JSON structure
- Do NOT include \`\`\`javascript or \`\`\` code blocks
- The function should be valid JavaScript that can be executed directly

User request: ${request.prompt}

Generate only the JavaScript function:
    `;

    const result = await this.aiService.generate(aiPrompt);

    // Clean up the response to extract just the function
    let cleanedResponse = result.trim();

    // Remove common formatting artifacts
    cleanedResponse = cleanedResponse.replace(/```javascript\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```js\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    cleanedResponse = cleanedResponse.trim();

    return cleanedResponse;
  }

  async generatePollRecordsFunction(request: GeneratePollRecordsFunctionRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for fetching records from APIs. Based on the user's request, generate a JavaScript function that uses fetch() to retrieve records and returns them in a standardized format.

The function should have this structure:
async function pollRecords(apiKey, tableId) {
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": \`Bearer \${apiKey}\`,
      "Content-Type": "application/json",
      // other appropriate headers
    },
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to fetch records: \${response.statusText}\`);
  }
  
  const data = await response.json();
  
  // Transform the API response into standardized format
  // The function should extract records from the response and convert them to:
  // Array of { id: string, fields: { [fieldId]: value } }
  
  // Example transformation logic (adapt based on the API structure):
  // const records = data.items || data.data || data.records || data;
  // return records.map(record => ({
  //   id: record.id || record.ID || record._id || generateId(),
  //   fields: {
  //     // Convert all record properties to fields
  //     ...Object.fromEntries(
  //       Object.entries(record).map(([key, value]) => [key, String(value || '')])
  //     )
  //   }
  // }));
  
  // Return the standardized format
  return standardizedRecords;
}

Guidelines:
- The function should be named "pollRecords"
- It should take TWO parameters: "apiKey" (string) and "tableId" (string[])
${this.tableIdGuidelines}
- Use GET method for the fetch call
- Include the API key in the Authorization header (e.g., "Authorization": "Bearer \${apiKey}")
- Include appropriate headers (e.g., "Content-Type": "application/json")
- Include error handling for non-2xx responses
- The function MUST return an array of objects with this exact structure:
  [
    {
      id: string,           // Unique identifier for the record
      fields: {             // Object with field IDs as keys
        [fieldId]: value    // Field values (always string)
      }
    }
  ]
- Transform the API response to match this standardized format
- Handle different API response structures (arrays, objects with items/data/records properties, etc.)
- Convert all field values to strings
- Generate unique IDs if the API doesn't provide them
- CRITICAL: Return ONLY the JavaScript function code itself, no JSON wrapper, no explanations, no markdown formatting
- Do NOT wrap the function in {"function": "..."} or any other JSON structure
- Do NOT include \`\`\`javascript or \`\`\` code blocks
- The function should be valid JavaScript that can be executed directly

User request: ${request.prompt}

Generate only the JavaScript function:
    `;

    const result = await this.aiService.generate(aiPrompt);

    // Clean up the response to extract just the function
    let cleanedResponse = result.trim();

    // Remove common formatting artifacts
    cleanedResponse = cleanedResponse.replace(/```javascript\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```js\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    cleanedResponse = cleanedResponse.trim();

    return cleanedResponse;
  }

  async generateGetRecordFunction(request: GenerateGetRecordFunctionRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for fetching individual records via API calls. Based on the user's request, generate a JavaScript function that uses fetch() to get a single record.

The function should have this exact structure:
async function getRecord(recordId, apiKey, tableId) {
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      // appropriate headers
    }
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to get record: \${response.statusText}\`);
  }
  
  return response.json();
}

Guidelines:
- The function should be named "getRecord"
- It should take THREE parameters: "recordId" (string), "apiKey" (string), and "tableId" (string[])
${this.tableIdGuidelines}
- Use GET method for the fetch call
- Include appropriate headers (e.g., "Content-Type": "application/json", "Authorization" if needed)
- Include error handling for non-2xx responses
- The URL should include the recordId parameter (e.g., \`\${baseUrl}/\${recordId}\`)
- CRITICAL: Return ONLY the JavaScript function code itself, no JSON wrapper, no explanations, no markdown formatting
- Do NOT wrap the function in {"function": "..."} or any other JSON structure
- Do NOT include \`\`\`javascript or \`\`\` code blocks
- The function should be valid JavaScript that can be executed directly

User request: ${request.prompt}

Generate only the JavaScript function:
    `;

    const result = await this.aiService.generate(aiPrompt);

    // Clean up the response to extract just the function
    let cleanedResponse = result.trim();

    // Remove common formatting artifacts
    cleanedResponse = cleanedResponse.replace(/```javascript\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```js\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    cleanedResponse = cleanedResponse.trim();

    return cleanedResponse;
  }

  async generateDeleteRecordFunction(request: GenerateDeleteRecordFunctionRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for deleting records via API calls. Based on the user's request, generate a JavaScript function that uses fetch() to delete a record.

The function should have this structure:
async function deleteRecord(recordId, apiKey, tableId) {
  
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Authorization": \`Bearer \${apiKey}\`,
      "Content-Type": "application/json",
      // other appropriate headers
    },
    // body if needed
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to delete record: \${response.statusText}\`);
  }
  
  return response.json();
}

Guidelines:
- The function should be named "deleteRecord"
- It should take THREE parameters: "recordId" (string), "apiKey" (string), and "tableId" (string[])
${this.tableIdGuidelines}
- Use DELETE method for the fetch call
- Include the API key in the Authorization header (e.g., "Authorization": "Bearer \${apiKey}")
- Include appropriate headers (e.g., "Content-Type": "application/json")
- Include error handling for non-2xx responses
- The URL should include the recordId parameter (e.g., \`\${baseUrl}/\${recordId}\`)
- CRITICAL: Return ONLY the JavaScript function code itself, no JSON wrapper, no explanations, no markdown formatting
- Do NOT wrap the function in {"function": "..."} or any other JSON structure
- Do NOT include \`\`\`javascript or \`\`\` code blocks
- The function should be valid JavaScript that can be executed directly

User request: ${request.prompt}

Generate only the JavaScript function:
    `;

    const result = await this.aiService.generate(aiPrompt);

    // Clean up the response to extract just the function
    let cleanedResponse = result.trim();

    // Remove common formatting artifacts
    cleanedResponse = cleanedResponse.replace(/```javascript\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```js\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    cleanedResponse = cleanedResponse.trim();

    return cleanedResponse;
  }

  async generateCreateRecordFunction(request: GenerateCreateRecordFunctionRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for creating records via API calls. Based on the user's request, generate a JavaScript function that uses fetch() to create a new record.

The function should have this structure:
async function createRecord(recordData, apiKey, tableId) {
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${apiKey}\`,
      "Content-Type": "application/json",
      // other appropriate headers
    },
    body: JSON.stringify(recordData),
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to create record: \${response.statusText}\`);
  }
  
  return response.json();
}

Guidelines:
- The function should be named "createRecord"
- It should take THREE parameters: 
  - "recordData": {[fieldId]: value}, the values for each field in the record
  - "apiKey": string, the auth token
  - "tableId": string[], the table identifier
${this.tableIdGuidelines}
- Use POST method for the fetch call unless the docs for the specific service instruct otherwise
- Include the API key in the Authorization header (e.g., "Authorization": "Bearer \${apiKey}" or as specified in the documentation for the specific service) 
- Include appropriate headers (e.g., "Content-Type": "application/json")
- Map the record data to the format required and 
- Include error handling for non-2xx responses
- CRITICAL: Return ONLY the JavaScript function code itself, no JSON wrapper, no explanations, no markdown formatting
- Do NOT wrap the function in {"function": "..."} or any other JSON structure
- Do NOT include \`\`\`javascript or \`\`\` code blocks
- The function should be valid JavaScript that can be executed directly

User request: ${request.prompt}

Generate only the JavaScript function:
    `;

    const result = await this.aiService.generate(aiPrompt);

    // Clean up the response to extract just the function
    let cleanedResponse = result.trim();

    // Remove common formatting artifacts
    cleanedResponse = cleanedResponse.replace(/```javascript\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```js\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    cleanedResponse = cleanedResponse.trim();

    return cleanedResponse;
  }

  async generateUpdateRecordFunction(request: GenerateUpdateRecordFunctionRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for updating records via API calls. Based on the user's request, generate a JavaScript function that uses fetch() to update an existing record.

The function should have this structure:
async function updateRecord(recordId, recordData, apiKey, tableId) {

  
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": \`Bearer \${apiKey}\`,
      "Content-Type": "application/json",
      // other appropriate headers
    },
    body: JSON.stringify(recordData),
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to update record: \${response.statusText}\`);
  }
  
  return response.json();
}

Guidelines:
- The function should be named "updateRecord"
- It should take FOUR parameters: "recordId" (string), "recordData" (object with field values), "apiKey" (string), and "tableId" (string[])
${this.tableIdGuidelines}
- Use PUT method for the fetch call (or PATCH if the service prefers partial updates)
- Include the API key in the Authorization header (e.g., "Authorization": "Bearer \${apiKey}")
- Include appropriate headers (e.g., "Content-Type": "application/json")
- Include the recordData in the request body as JSON
- The URL should include the recordId parameter (e.g., \`\${baseUrl}/\${recordId}\`)
- Include error handling for non-2xx responses
- CRITICAL: Return ONLY the JavaScript function code itself, no JSON wrapper, no explanations, no markdown formatting
- Do NOT wrap the function in {"function": "..."} or any other JSON structure
- Do NOT include \`\`\`javascript or \`\`\` code blocks
- The function should be valid JavaScript that can be executed directly

User request: ${request.prompt}

Generate only the JavaScript function:
    `;

    const result = await this.aiService.generate(aiPrompt);

    // Clean up the response to extract just the function
    let cleanedResponse = result.trim();

    // Remove common formatting artifacts
    cleanedResponse = cleanedResponse.replace(/```javascript\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```js\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    cleanedResponse = cleanedResponse.trim();

    return cleanedResponse;
  }
}
export type ApiImportData = {
  externalBaseId: string;
  tableName: string;
  records: any;
  matchOn: string;
};

export type GeneratePollRecordsFunctionRequest = {
  prompt: string;
};

export type GenerateFetchSchemaFunctionRequest = {
  prompt: string;
};

export type GenerateGetRecordFunctionRequest = {
  prompt: string;
};

export type GenerateDeleteRecordFunctionRequest = {
  prompt: string;
};

export type GenerateCreateRecordFunctionRequest = {
  prompt: string;
};

export type GenerateUpdateRecordFunctionRequest = {
  prompt: string;
};

export type GenerateListTablesFunctionRequest = {
  prompt: string;
};

export type GenerateFetchResponse = {
  url: string;
  params: {
    method: string;
    headers: Record<string, string>;
    body?: string | null;
  };
};

export type ImportResult = {
  created: number;
  updated: number;
  failed: number;
};
