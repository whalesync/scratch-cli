import { Injectable } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';
import { executeDeleteRecord, executePollRecords } from './function-executor';

@Injectable()
export class RestApiImportService {
  constructor(private readonly aiService: AiService) {}

  async executePollRecords(functionString: string, apiKey: string): Promise<unknown> {
    return executePollRecords(functionString, apiKey);
  }

  async executeDeleteRecord(functionString: string, recordId: string, apiKey: string): Promise<unknown> {
    return executeDeleteRecord(functionString, recordId, apiKey);
  }

  async generatePollRecords(request: GeneratePollRecordsRequest): Promise<string> {
    const aiPrompt = `
You are a JavaScript function generator for fetching records via API calls. 
Based on the user's request, generate a JavaScript function that uses fetch() to get records. 

The user might provide a text prompt that describes how to connect to the service, including account/base id, table id, and possibly some other information.
Alternatively they might provide a link to the table in the service. In that case you should extract the account/base id and table id from the link.
The user could also privude both link and explanation. For example the link may include a view id, but the explanation could direct you to ignore the view. 

The function should have this exact structure:

async function pollRecords(apiKey) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": \`Bearer \${apiKey}\`,
      "Content-Type": "application/json",
      // other appropriate headers
    }
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to fetch records: \${response.statusText}\`);
  }
  
  return response.json();
}

However some services might have slightly different structure.
If the service has a different structure, please generate a function that works with the service's structure.

Guidelines:
- The function should be named "pollRecords"
- It should take an "apiKey" parameter for authentication
- Use GET method for the fetch call (or appropriate method based on the request)
- Include the API key in the Authorization header (e.g., "Authorization": "Bearer \${apiKey}")
- Include appropriate headers (e.g., "Content-Type": "application/json")
- Include error handling for non-2xx responses
- Only return the function code itself, no explanations or additional text
- The function should be valid JavaScript

User request: ${request.prompt}
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

export type GenerateGetRecordRequest = {
  prompt: string;
};

export type GenerateDeleteRecordRequest = {
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
