import { Injectable } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';
import { executeDeleteRecord, executePollRecords, executeSchema } from './function-executor';

@Injectable()
export class RestApiImportService {
  constructor(private readonly aiService: AiService) {}

  async executePollRecords(functionString: string, apiKey: string): Promise<unknown> {
    return executePollRecords(functionString, apiKey);
  }

  async executeDeleteRecord(functionString: string, recordId: string, apiKey: string): Promise<unknown> {
    return executeDeleteRecord(functionString, recordId, apiKey);
  }

  async executeSchema(functionString: string, apiKey: string): Promise<unknown> {
    return executeSchema(functionString, apiKey);
  }

  async generatePollRecords(request: GeneratePollRecordsRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for fetching records from APIs. Based on the user's request, generate a JavaScript function that uses fetch() to retrieve records and returns them in a standardized format.

The function should have this structure:
async function pollRecords(apiKey) {
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
- It should take an "apiKey" parameter
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
- Only return the function code itself, no explanations or additional text
- The function should be valid JavaScript

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

  async generateSchema(request: GenerateSchemaRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for fetching table schemas from APIs. 
Based on the user's request, generate a JavaScript function that uses fetch() to retrieve the table schema and returns it in a standardized format.

The function should have this structure:
async function fetchSchema(apiKey) {
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
- It should take an "apiKey" parameter
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
- Only return the function code itself, no explanations or additional text
- The function should be valid JavaScript

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

  async generateGetRecord(request: GenerateGetRecordRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for fetching individual records via API calls. Based on the user's request, generate a JavaScript function that uses fetch() to get a single record.

The function should have this exact structure:
async function getRecord(recordId) {
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
- It should take a "recordId" parameter
- Use GET method for the fetch call
- Include appropriate headers (e.g., "Content-Type": "application/json", "Authorization" if needed)
- Include error handling for non-2xx responses
- The URL should include the recordId parameter (e.g., \`\${baseUrl}/\${recordId}\`)
- Only return the function code itself, no explanations or additional text
- The function should be valid JavaScript

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

  async generateDeleteRecord(request: GenerateDeleteRecordRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for deleting records via API calls. Based on the user's request, generate a JavaScript function that uses fetch() to delete a record.

The function should have this structure:
async function deleteRecord(recordId, apiKey) {
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
- It should take a "recordId" parameter and an "apiKey" parameter
- Use DELETE method for the fetch call
- Include the API key in the Authorization header (e.g., "Authorization": "Bearer \${apiKey}")
- Include appropriate headers (e.g., "Content-Type": "application/json")
- Include error handling for non-2xx responses
- The URL should include the recordId parameter (e.g., \`\${baseUrl}/\${recordId}\`)
- Only return the function code itself, no explanations or additional text
- The function should be valid JavaScript

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

  async generateCreateRecord(request: GenerateCreateRecordRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for creating records via API calls. Based on the user's request, generate a JavaScript function that uses fetch() to create a new record.

The function should have this structure:
async function createRecord(recordData, apiKey) {
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
- It should take 2 parameters: 
  - "recordData": {[fieldId]: value}, the values for each field in the record
  - "apiKey": string, the auth token
- the field values are 
- Use POST method for the fetch call unless the docs for the specific service instruct otherwise
- Include the API key in the Authorization header (e.g., "Authorization": "Bearer \${apiKey}" or as specified in the documentation for the specific service) 
- Include appropriate headers (e.g., "Content-Type": "application/json")
- Map the record data to the format required and 
- Include error handling for non-2xx responses
- Only return the function code itself, no explanations or additional text
- The function should be valid JavaScript

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

  async generateUpdateRecord(request: GenerateUpdateRecordRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for updating records via API calls. Based on the user's request, generate a JavaScript function that uses fetch() to update an existing record.

The function should have this structure:
async function updateRecord(recordId, recordData, apiKey) {
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
- It should take a "recordId" parameter, a "recordData" parameter (object with field values), and an "apiKey" parameter
- Use PUT method for the fetch call (or PATCH if the service prefers partial updates)
- Include the API key in the Authorization header (e.g., "Authorization": "Bearer \${apiKey}")
- Include appropriate headers (e.g., "Content-Type": "application/json")
- Include the recordData in the request body as JSON
- The URL should include the recordId parameter (e.g., \`\${baseUrl}/\${recordId}\`)
- Include error handling for non-2xx responses
- Only return the function code itself, no explanations or additional text
- The function should be valid JavaScript

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

export type GeneratePollRecordsRequest = {
  prompt: string;
};

export type GenerateSchemaRequest = {
  prompt: string;
};

export type GenerateGetRecordRequest = {
  prompt: string;
};

export type GenerateDeleteRecordRequest = {
  prompt: string;
};

export type GenerateCreateRecordRequest = {
  prompt: string;
};

export type GenerateUpdateRecordRequest = {
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
